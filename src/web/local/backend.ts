import Anthropic from '@anthropic-ai/sdk';
import {alignWords, loudness, speechIntervals} from '../../shared/dsp/align';
import {shiftPitch} from '../../shared/dsp/pitch';
import {newProject, renderFileName} from '../../shared/project';
import {ScriptError, writeScript} from '../../shared/scriptWriter';
import {duplicateOf, mergeEditorChanges, mergeSettings, normalizeProject, normalizeSettings, summarizeProjects} from '../../shared/storeLogic';
import {buildVideoProps, propsSignature, splitWords, stripMarkup} from '../../shared/timeline';
import type {Format, Health, Lang, Project, RenderInfo, Settings, VoicePitch, Word} from '../../shared/types';
import {decodeWav, encodeWav} from '../audio/wav';
import {renderOnDevice} from '../render/onDevice';
import {idbDelete, idbGet, idbKeys, idbPut, idbValues, keepDataPersistent} from './db';
import {deleteFile, fileUrl, loadFiles, newMediaPath, readFile, saveFile} from './files';
import {iconBodies, searchIcons} from './icons';
import {getJob, startJob} from './jobs';

// Everything the computer's server does, done on the phone: storage in IndexedDB, voice
// disguise and captions in JavaScript, the video made by Remotion's in-browser renderer, and the
// AI script written by calling Claude directly with her own key.

// ---------- Setup ----------

/** Opens the phone's storage and makes its files available. Call once before using the backend. */
export const initLocal = async () => {
	keepDataPersistent();
	await loadFiles();
	void cleanTrash().catch(() => undefined);
};

// ---------- AI key (kept only on this phone) ----------

const AI_KEY = 'anthropicKey';

export const getAiKey = async () => (await idbGet<string>('kv', AI_KEY)) ?? '';

export const setAiKey = async (key: string) => {
	const trimmed = key.trim();
	if (trimmed) await idbPut('kv', AI_KEY, trimmed);
	else await idbDelete('kv', AI_KEY);
};

// ---------- Settings ----------

const getSettings = async () => normalizeSettings((await idbGet<Partial<Settings>>('kv', 'settings')) ?? null);

const saveSettings = async (input: Partial<Settings>) => {
	const next = mergeSettings(await getSettings(), input);
	await idbPut('kv', 'settings', next);
	return next;
};

// ---------- Projects ----------

const getProject = async (id: string) => {
	const project = await idbGet<Project>('projects', id);
	if (!project) throw new Error('This video could not be found.');
	return normalizeProject(project);
};

const writeProject = async (project: Project) => {
	const saved = {...project, updatedAt: new Date().toISOString()};
	await idbPut('projects', saved.id, saved);
	return saved;
};

// Changes to one project happen one at a time, so a caption job finishing while the editor saves
// can't overwrite one with the other.
const queues = new Map<string, Promise<unknown>>();

const updateProject = (id: string, update: (project: Project) => Project | Promise<Project>): Promise<Project> => {
	const run = (queues.get(id) ?? Promise.resolve()).catch(() => undefined).then(async () => writeProject(await update(await getProject(id))));
	queues.set(id, run);
	return run;
};

/** Every stored file a project uses. */
const filesOf = (project: Project) =>
	[...project.scenes.map((s) => s.image), project.voice?.url, project.voice?.originalUrl, project.render?.url].filter((p): p is string => Boolean(p));

const TRASH_DAYS = 30;

/** Deleted Shorts can be restored for a while; after that they and their files are removed. */
const cleanTrash = async () => {
	const live = new Set((await idbValues<Project>('projects')).flatMap(filesOf));
	for (const key of await idbKeys('trash')) {
		const deletedAt = Number(key.split('@')[1]);
		if (Date.now() - deletedAt < TRASH_DAYS * 86_400_000) continue;
		const project = await idbGet<Project>('trash', key);
		await idbDelete('trash', key);
		for (const path of project ? filesOf(project) : []) {
			if (!live.has(path)) await deleteFile(path);
		}
	}
};

// ---------- Voice and captions ----------

const pitchedCopy = async (projectId: string, original: Blob, pitch: VoicePitch) => {
	const {samples, sampleRate} = await decodeWav(original);
	return saveFile(newMediaPath(`voice-${projectId}-p`, 'wav'), encodeWav(shiftPitch(samples, sampleRate, pitch), sampleRate));
};

/** Captions timed from her recording and her script (see shared/dsp/align). */
const makeCaptions = async (project: Project, onProgress: (p: number) => void) => {
	const voice = project.voice;
	if (!voice) throw new Error('Record your voice first.');
	const {samples, sampleRate} = await decodeWav(await readFile(voice.originalUrl));
	onProgress(0.4);
	const db = loudness(samples, sampleRate);
	const intervals = speechIntervals(db);
	// The script as it is now: it may have been edited since the recording.
	const scenes = (await getProject(project.id)).scenes;
	const texts: string[] = [];
	const breakAfter: boolean[] = [];
	for (const scene of scenes) {
		const words = splitWords(stripMarkup(scene.narration));
		words.forEach((text, i) => {
			texts.push(text);
			breakAfter.push(i === words.length - 1);
		});
	}
	const words: Word[] = alignWords(texts, intervals, breakAfter, db);
	if (words.length === 0) throw new Error('No speech was found in the recording.');
	onProgress(0.9);
	// Only store them if this is still the project's current recording.
	await updateProject(project.id, (stored) => (stored.voice?.originalUrl === voice.originalUrl ? {...stored, words} : stored));
	return {words};
};

const startCaptions = (project: Project) => startJob('transcribe', (progress) => makeCaptions(project, progress));

// ---------- The backend ----------

const IMAGE_TYPES: Record<string, string> = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'};
const MUSIC_TYPES: Record<string, string> = {'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg'};

const storeUpload = async (file: Blob, types: Record<string, string>, prefix: string) => {
	const extension = types[file.type];
	if (!extension) throw new Error(`Please choose a ${Object.values(types).join(', ')} file.`);
	if (file.size === 0) throw new Error('The file was empty.');
	return saveFile(newMediaPath(prefix, extension), file);
};

const stored = (path: string) => fileUrl(path);

export const localApi = {
	health: async (): Promise<Health> => ({ok: true, aiEnabled: Boolean(await getAiKey()), whisperReady: true, whisperProblem: null}),
	settings: getSettings,
	saveSettings,
	uploadLogo: async (file: File) => saveSettings({logoUrl: await storeUpload(file, IMAGE_TYPES, 'logo')}),
	uploadMusic: async (file: File) => saveSettings({musicUrl: await storeUpload(file, MUSIC_TYPES, 'music')}),

	projects: async () => summarizeProjects((await idbValues<Project>('projects')).map(normalizeProject)),
	createProject: async (format: Format, language: Lang) => writeProject(newProject(format, language, await getSettings())),
	project: getProject,
	saveProject: (project: Project) => updateProject(project.id, (current) => mergeEditorChanges(current, project)),
	deleteProject: async (id: string) => {
		const project = await getProject(id);
		await idbPut('trash', `${id}@${Date.now()}`, project);
		await idbDelete('projects', id);
		return {ok: true as const};
	},
	restoreProject: async (id: string) => {
		const keys = (await idbKeys('trash')).filter((k) => k.startsWith(`${id}@`)).sort();
		const key = keys[keys.length - 1];
		const project = key ? await idbGet<Project>('trash', key) : undefined;
		if (!key || !project) throw new Error('Nothing to restore.');
		await idbPut('projects', id, project);
		await idbDelete('trash', key);
		return normalizeProject(project);
	},
	duplicateProject: async (id: string) => {
		const source = await getProject(id);
		return writeProject(duplicateOf(source, newProject(source.format, source.language, await getSettings())));
	},

	writeScript: async (idea: string, format: Format, language: Lang) => {
		const key = await getAiKey();
		if (!key) throw new Error('AI writing is not set up yet. Add your AI key in My channel.');
		const settings = await getSettings();
		// Her own key, stored only on this phone, so calling the API from the app is fine here.
		const client = new Anthropic({apiKey: key, dangerouslyAllowBrowser: true});
		try {
			return await writeScript(client, {idea, format, language, dialect: settings.dialect, doctorName: settings.doctorName}, 'The AI key is not valid. Check it in My channel.');
		} catch (error) {
			throw error instanceof ScriptError ? new Error(error.message) : error;
		}
	},

	uploadImage: async (file: Blob) => ({url: await storeUpload(file, IMAGE_TYPES, 'photo')}),

	uploadVoice: async (id: string, wav: Blob, pitch: VoicePitch) => {
		const previous = (await getProject(id)).voice;
		const {samples, sampleRate} = await decodeWav(wav);
		const durationMs = Math.round((samples.length / sampleRate) * 1000);
		if (durationMs < 1000) throw new Error('The recording is too short.');
		const originalUrl = await saveFile(newMediaPath(`voice-${id}`, 'wav'), wav);
		const url = pitch === 0 ? originalUrl : await pitchedCopy(id, wav, pitch);
		const project = await updateProject(id, (p) => ({...p, voice: {url, originalUrl, pitch, durationMs}, words: null}));
		// The old recording isn't needed any more; space on a phone is precious.
		if (previous) {
			await deleteFile(previous.originalUrl);
			if (previous.url !== previous.originalUrl) await deleteFile(previous.url);
		}
		return {project, jobId: startCaptions(project).id as string | null};
	},
	setVoicePitch: async (id: string, pitch: VoicePitch) => {
		const voice = (await getProject(id)).voice;
		if (!voice) throw new Error('Record your voice first.');
		const url = pitch === 0 ? voice.originalUrl : await pitchedCopy(id, await readFile(voice.originalUrl), pitch);
		const project = await updateProject(id, (p) => (p.voice?.originalUrl === voice.originalUrl ? {...p, voice: {...p.voice, url, pitch}} : p));
		if (voice.url !== voice.originalUrl && voice.url !== url) await deleteFile(voice.url);
		return project;
	},
	removeVoice: async (id: string) => {
		const voice = (await getProject(id)).voice;
		const project = await updateProject(id, (p) => ({...p, voice: null, words: null}));
		await deleteFile(voice?.originalUrl);
		if (voice && voice.url !== voice.originalUrl) await deleteFile(voice.url);
		return project;
	},
	transcribe: async (id: string) => ({jobId: startCaptions(await getProject(id)).id}),

	render: async (id: string) => {
		const project = await getProject(id);
		if (project.scenes.length === 0) throw new Error('Write your script first.');
		const job = startJob('render', async (progress): Promise<RenderInfo> => {
			const settings = await getSettings();
			const icons = await iconBodies(project.scenes.map((s) => s.icon)).catch(() => ({}));
			const props = buildVideoProps(project, settings, {icons, resolve: stored});
			const video = await renderOnDevice(props, (p) => progress(p * 0.97));
			const fileName = renderFileName(project, video.extension);
			const url = await saveFile(`/renders/${fileName}`, video.blob);
			const render: RenderInfo = {url, fileName, createdAt: new Date().toISOString(), signature: propsSignature(buildVideoProps(project, settings))};
			const before = await updateProject(id, (p) => ({...p, render}));
			// Keep only the newest video of each Short.
			if (project.render && project.render.url !== url && before.render?.url === url) await deleteFile(project.render.url);
			return render;
		});
		return {jobId: job.id};
	},
	job: async <T>(id: string) => getJob<T>(id),
	reveal: async (_fileName: string): Promise<{ok: true}> => {
		throw new Error('The video file was not found.');
	},
	downloadUrl: (fileName: string) => fileUrl(`/renders/${fileName}`) ?? '#',

	icons: (query: string, category: string) => searchIcons(query, category, 150),
	iconBodies,
};
