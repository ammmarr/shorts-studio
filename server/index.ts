import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile, rm, writeFile} from 'node:fs/promises';
import {networkInterfaces} from 'node:os';
import path from 'node:path';
import express, {type NextFunction, type Request, type Response} from 'express';
import {newProject} from '../src/shared/project';
import {restoreFromScript} from '../src/shared/timeline';
import {VOICE_PITCHES} from '../src/shared/themes';
import type {Format, Health, Lang, Project, VoicePitch} from '../src/shared/types';
import {encodeWav, parseWav, pcmDurationMs, toMono16k} from './audio';
import {iconBodies, searchIcons} from './icons';
import {getJob, startJob} from './jobs';
import {
	ensureDirs,
	MEDIA_DIR,
	PORT,
	PROD,
	RENDERS_DIR,
	safeJoin,
	TMP_DIR,
	UserError,
	WEB_DIST,
} from './paths';
import {renderProject} from './render';
import {aiEnabled, generateScript} from './script';
import {
	createProject,
	getProject,
	getSettings,
	listProjects,
	restoreProject,
	saveEditorChanges,
	saveSettings,
	trashProject,
	updateProject,
} from './store';
import {shiftPitch} from './voice';
import {transcribe, whisperStatus} from './whisper';

ensureDirs();

const app = express();
const json = express.json({limit: '2mb'});
const raw = express.raw({type: () => true, limit: '120mb'});
const param = (req: Request, name: string) => String(req.params[name]);

// The phone app (Capacitor) loads its screens from http://localhost and talks to this server over Wi-Fi.
const APP_ORIGINS = new Set(['http://localhost', 'https://localhost', 'capacitor://localhost']);
app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (origin && APP_ORIGINS.has(origin)) {
		res.setHeader('Access-Control-Allow-Origin', origin);
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		res.setHeader('Access-Control-Max-Age', '86400');
		res.setHeader('Vary', 'Origin');
	}
	if (req.method === 'OPTIONS') {
		res.sendStatus(204);
		return;
	}
	next();
});

// Network adapters that only exist inside this computer (virtual machines, WSL, VPNs).
const VIRTUAL_ADAPTER = /vmware|virtualbox|vbox|vethernet|hyper-v|wsl|docker|loopback|bluetooth|tailscale|zerotier|vpn/i;

/** Addresses a phone on the same Wi-Fi can use to reach this computer. */
const lanAddresses = () => {
	const all = Object.entries(networkInterfaces()).flatMap(([name, nets]) =>
		(nets ?? []).filter((net) => net.family === 'IPv4' && !net.internal).map((net) => ({name, address: net.address})),
	);
	const real = all.filter((net) => !VIRTUAL_ADAPTER.test(net.name));
	return (real.length > 0 ? real : all).map((net) => `http://${net.address}:${PORT}`);
};

app.get('/api/health', (_req, res) => {
	const whisper = whisperStatus();
	const health: Health = {
		ok: true,
		aiEnabled: aiEnabled(),
		whisperReady: whisper.ready,
		whisperProblem: whisper.problem,
		addresses: lanAddresses(),
	};
	res.json(health);
});

// ---------- Settings ----------

app.get('/api/settings', async (_req, res) => {
	res.json(await getSettings());
});

app.put('/api/settings', json, async (req, res) => {
	res.json(await saveSettings(req.body ?? {}));
});

const IMAGE_TYPES: Record<string, string> = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'};
const MUSIC_TYPES: Record<string, string> = {'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg'};

/** Stores an uploaded file in data/media and returns its public URL. */
const storeUpload = async (req: Request, types: Record<string, string>, prefix: string) => {
	const ext = types[String(req.headers['content-type']).split(';')[0]];
	if (!ext) {
		throw new UserError(`Please choose a ${Object.values(types).join(', ')} file.`);
	}
	if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
		throw new UserError('The file was empty.');
	}
	const name = `${prefix}-${Date.now()}.${ext}`;
	await writeFile(path.join(MEDIA_DIR, name), req.body);
	return `/media/${name}`;
};

app.post('/api/settings/logo', raw, async (req, res) => {
	res.json(await saveSettings({logoUrl: await storeUpload(req, IMAGE_TYPES, 'logo')}));
});

app.post('/api/settings/music', raw, async (req, res) => {
	res.json(await saveSettings({musicUrl: await storeUpload(req, MUSIC_TYPES, 'music')}));
});

/** A photo for one card of a video; the editor saves the returned URL on that card. */
app.post('/api/images', raw, async (req, res) => {
	res.json({url: await storeUpload(req, IMAGE_TYPES, 'photo')});
});

// ---------- Projects ----------

app.get('/api/projects', async (_req, res) => {
	res.json(await listProjects());
});

app.post('/api/projects', json, async (req, res) => {
	const settings = await getSettings();
	const format: Format = ['tips', 'myth_fact', 'qa'].includes(req.body?.format) ? req.body.format : 'tips';
	const language: Lang = req.body?.language === 'en' || req.body?.language === 'ar' ? req.body.language : settings.language;
	res.json(await createProject(newProject(format, language, settings)));
});

app.get('/api/projects/:id', async (req, res) => {
	res.json(await getProject(param(req, 'id')));
});

app.put('/api/projects/:id', json, async (req, res) => {
	res.json(await saveEditorChanges(param(req, 'id'), req.body ?? {}));
});

app.delete('/api/projects/:id', async (req, res) => {
	await trashProject(param(req, 'id'));
	res.json({ok: true});
});

app.post('/api/projects/:id/restore', async (req, res) => {
	res.json(await restoreProject(param(req, 'id')));
});

app.post('/api/projects/:id/duplicate', async (req, res) => {
	const source = await getProject(param(req, 'id'));
	const settings = await getSettings();
	const copy: Project = {
		...newProject(source.format, source.language, settings),
		title: source.title ? `${source.title} (copy)` : '',
		idea: source.idea,
		scenes: source.scenes.map((s) => ({...s, id: crypto.randomUUID()})),
		reviewNotes: source.reviewNotes,
		youtube: source.youtube,
		themeId: source.themeId,
		templateId: source.templateId,
		captionPosition: source.captionPosition,
		};
	res.json(await createProject(copy));
});

// ---------- Icons (full Lucide set, downloaded once and cached) ----------

app.get('/api/icons', async (req, res) => {
	const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 120));
	res.json(await searchIcons({query: String(req.query.q ?? '').slice(0, 60), category: String(req.query.category ?? ''), limit}));
});

app.get('/api/icons/bodies', async (req, res) => {
	const names = String(req.query.names ?? '')
		.split(',')
		.filter((n) => /^[a-z0-9-]{1,64}$/.test(n))
		.slice(0, 60);
	res.json(await iconBodies(names));
});

// ---------- AI script ----------

app.post('/api/script', json, async (req, res) => {
	const settings = await getSettings();
	const format: Format = ['tips', 'myth_fact', 'qa'].includes(req.body?.format) ? req.body.format : 'tips';
	const language: Lang = req.body?.language === 'en' ? 'en' : 'ar';
	res.json(
		await generateScript({
			idea: String(req.body?.idea ?? ''),
			format,
			language,
			dialect: settings.dialect,
			doctorName: settings.doctorName,
		}),
	);
});

// ---------- Voice & captions ----------

const toPitch = (value: unknown, fallback: VoicePitch): VoicePitch => {
	const n = Number(value);
	return value !== undefined && value !== '' && VOICE_PITCHES.includes(n as VoicePitch) ? (n as VoicePitch) : fallback;
};

/** The recording as it plays in the video: her own voice, or a copy moved up or down in pitch. */
const disguisedVoice = async (originalName: string, pitch: VoicePitch, sampleRate: number) => {
	if (pitch === 0) {
		return `/media/${originalName}`;
	}
	const name = originalName.replace(/\.wav$/, `-p${pitch > 0 ? 'up' : 'down'}${Math.abs(pitch) * 10}.wav`);
	await shiftPitch(safeJoin(MEDIA_DIR, originalName), safeJoin(MEDIA_DIR, name), pitch, sampleRate);
	return `/media/${name}`;
};


const startTranscription = (project: Project) => {
	const voice = project.voice;
	if (!voice || !whisperStatus().ready) {
		return null;
	}
	const wav16 = path.join(TMP_DIR, `${project.id}-${Date.now()}.wav`);
	return startJob('transcribe', async (progress) => {
		const pcm = parseWav(await readFile(safeJoin(MEDIA_DIR, path.basename(voice.originalUrl))));
		await writeFile(wav16, encodeWav(toMono16k(pcm), 16000));
		const heard = await transcribe(wav16, project.language, voice.durationMs, progress);
		await rm(wav16, {force: true});
		if (heard.length === 0) {
			throw new UserError('No speech was found in the recording.');
		}
		// Captions take the script's spelling and punctuation wherever it was read as written,
		// using the script as it is now (it may have been edited while this ran).
		const words = restoreFromScript(heard, (await getProject(project.id)).scenes);
		// Only store the captions if this is still the project's current recording.
		await updateProject(project.id, (stored) => (stored.voice?.originalUrl === voice.originalUrl ? {...stored, words} : stored));
		return {words};
	});
};

app.post('/api/projects/:id/voice', raw, async (req, res) => {
	const id = param(req, 'id');
	await getProject(id);
	if (!Buffer.isBuffer(req.body)) {
		throw new UserError('No recording was received.');
	}
	const pcm = parseWav(req.body);
	const durationMs = pcmDurationMs(pcm);
	if (durationMs < 1000) {
		throw new UserError('The recording is too short.');
	}
	const name = `voice-${id}-${Date.now()}.wav`;
	await writeFile(path.join(MEDIA_DIR, name), req.body);
	const pitch = toPitch(req.query.pitch, (await getSettings()).voicePitch);
	const url = await disguisedVoice(name, pitch, pcm.sampleRate);
	const project = await updateProject(id, (stored) => ({
		...stored,
		voice: {url, originalUrl: `/media/${name}`, pitch, durationMs},
		words: null,
	}));
	const job = startTranscription(project);
	res.json({project, jobId: job?.id ?? null});
});

/** Changes how the voice sounds in the video. Captions stay as they are: the timing doesn't change. */
app.post('/api/projects/:id/voice/pitch', json, async (req, res) => {
	const id = param(req, 'id');
	const voice = (await getProject(id)).voice;
	if (!voice) {
		throw new UserError('Record your voice first.');
	}
	const pitch = toPitch(req.body?.pitch, 0);
	const original = path.basename(voice.originalUrl);
	const pcm = parseWav(await readFile(safeJoin(MEDIA_DIR, original)));
	const url = await disguisedVoice(original, pitch, pcm.sampleRate);
	const previous = voice.url !== voice.originalUrl ? voice.url : null;
	const project = await updateProject(id, (stored) =>
		stored.voice?.originalUrl === voice.originalUrl ? {...stored, voice: {...stored.voice, url, pitch}} : stored,
	);
	if (previous && previous !== url) {
		await rm(safeJoin(MEDIA_DIR, path.basename(previous)), {force: true});
	}
	res.json(project);
});

app.delete('/api/projects/:id/voice', async (req, res) => {
	res.json(await updateProject(param(req, 'id'), (stored) => ({...stored, voice: null, words: null})));
});

app.post('/api/projects/:id/transcribe', async (req, res) => {
	const project = await getProject(param(req, 'id'));
	if (!project.voice) {
		throw new UserError('Record your voice first.');
	}
	const job = startTranscription(project);
	if (!job) {
		throw new UserError(whisperStatus().problem ?? 'Captions are not available.');
	}
	res.json({jobId: job.id});
});

// ---------- Render ----------

app.post('/api/projects/:id/render', async (req, res) => {
	const id = param(req, 'id');
	const project = await getProject(id);
	if (project.scenes.length === 0) {
		throw new UserError('Write your script first.');
	}
	const settings = await getSettings();
	const job = startJob('render', async (progress) => {
		const render = await renderProject(project, settings, progress);
		await updateProject(id, (stored) => ({...stored, render}));
		return render;
	});
	res.json({jobId: job.id});
});

app.get('/api/jobs/:id', (req, res) => {
	const job = getJob(param(req, 'id'));
	if (!job) {
		throw new UserError('This task is no longer running. Please try again.', 404);
	}
	res.json(job);
});

app.get('/api/download/:file', (req, res) => {
	res.download(safeJoin(RENDERS_DIR, param(req, 'file')));
});

/** Opens File Explorer with the rendered video selected (the app runs on her own computer). */
app.post('/api/reveal/:file', (req, res) => {
	const file = safeJoin(RENDERS_DIR, param(req, 'file'));
	if (!existsSync(file)) {
		throw new UserError('The video file was not found.', 404);
	}
	if (process.platform === 'win32') {
		spawn('explorer.exe', [`/select,${file}`], {detached: true, stdio: 'ignore'}).unref();
	} else {
		spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [path.dirname(file)], {detached: true, stdio: 'ignore'}).unref();
	}
	res.json({ok: true});
});

// ---------- Static files ----------

app.use('/media', express.static(MEDIA_DIR, {fallthrough: false}));
app.use('/renders', express.static(RENDERS_DIR, {fallthrough: false}));
if (PROD) {
	app.use(express.static(WEB_DIST));
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
	if (error instanceof UserError) {
		res.status(error.status).json({error: error.message});
		return;
	}
	const status = (error as {status?: number}).status;
	if (status === 404) {
		res.status(404).json({error: 'Not found.'});
		return;
	}
	if (status === 413) {
		res.status(413).json({error: 'That file is too large.'});
		return;
	}
	console.error(error);
	res.status(500).json({error: 'Something went wrong. Please try again.'});
});

app.listen(PORT, () => {
	const url = PROD ? `http://localhost:${PORT}` : 'http://localhost:5190';
	console.log(`Tabeba's workspace is running: ${url}`);
	if (PROD) {
		for (const address of lanAddresses()) {
			console.log(`On the phone app, connect to: ${address}`);
		}
	}
	if (!whisperStatus().ready) {
		console.log(`Note: ${whisperStatus().problem}`);
	}
	if (!aiEnabled()) {
		console.log('Note: "Write my script" is off until ANTHROPIC_API_KEY is set in .env');
	}
	if (process.env.OPEN_BROWSER === '1') {
		const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
		spawn(opener[0] as string, opener[1] as string[], {detached: true, stdio: 'ignore'}).unref();
	}
});
