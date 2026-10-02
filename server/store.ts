import {existsSync} from 'node:fs';
import {readdir, readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {isIconName} from '../src/shared/icons';
import {DEFAULT_SETTINGS} from '../src/shared/project';
import {CAPTION_POSITIONS, TEMPLATE_IDS, THEME_IDS, VOICE_PITCHES} from '../src/shared/themes';
import type {Project, ProjectSummary, Scene, Settings, TemplateId, VoicePitch, Word} from '../src/shared/types';
import {PROJECTS_DIR, SETTINGS_FILE, TRASH_DIR, UserError} from './paths';

const writeJsonAtomic = async (file: string, data: unknown) => {
	const tmp = `${file}.${process.pid}.tmp`;
	await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
	await rename(tmp, file);
};

const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, 'utf8')) as T;

const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const oneOf = <T extends string | number>(value: unknown, options: readonly T[], fallback: T): T =>
	options.includes(value as T) ? (value as T) : fallback;

/** Only pictures uploaded to this app's own media folder can be shown in a video. */
export const isMediaImage = (value: unknown): value is string =>
	typeof value === 'string' && /^\/media\/[\w.-]{1,120}\.(png|jpe?g|webp)$/.test(value);

/** Templates that were removed fall back to the original card style. */
const templateOrDefault = (value: unknown): TemplateId => oneOf(value, TEMPLATE_IDS, 'cards');

// ---------- Settings ----------

export const getSettings = async (): Promise<Settings> => {
	if (!existsSync(SETTINGS_FILE)) {
		return {...DEFAULT_SETTINGS};
	}
	const stored = {...DEFAULT_SETTINGS, ...(await readJson<Partial<Settings>>(SETTINGS_FILE))};
	return {...stored, templateId: templateOrDefault(stored.templateId)};
};

export const saveSettings = async (input: Partial<Settings>): Promise<Settings> => {
	const current = await getSettings();
	const next: Settings = {
		doctorName: str(input.doctorName, current.doctorName).slice(0, 60),
		channelName: str(input.channelName, current.channelName).slice(0, 60),
		handle: str(input.handle, current.handle).slice(0, 60),
		logoUrl: input.logoUrl === null ? null : str(input.logoUrl, current.logoUrl ?? '') || null,
		musicUrl: input.musicUrl === null ? null : str(input.musicUrl, current.musicUrl ?? '') || null,
		themeId: oneOf(input.themeId, THEME_IDS, current.themeId),
		templateId: oneOf(input.templateId, TEMPLATE_IDS, current.templateId),
		captionPosition: oneOf(input.captionPosition, CAPTION_POSITIONS, current.captionPosition),
		voicePitch: oneOf<VoicePitch>(input.voicePitch, VOICE_PITCHES, current.voicePitch),
		language: oneOf(input.language, ['ar', 'en'], current.language),
		uiLanguage: oneOf(input.uiLanguage, ['ar', 'en'], current.uiLanguage),
		dialect: oneOf(input.dialect, ['egyptian', 'msa'], current.dialect),
		endCardText: str(input.endCardText, current.endCardText).slice(0, 80),
		showDisclaimer: typeof input.showDisclaimer === 'boolean' ? input.showDisclaimer : current.showDisclaimer,
		setupDone: typeof input.setupDone === 'boolean' ? input.setupDone : current.setupDone,
	};
	await writeJsonAtomic(SETTINGS_FILE, next);
	return next;
};

// ---------- Projects ----------

const ID_PATTERN = /^[a-z0-9-]{8,64}$/;

const projectFile = (id: string) => {
	if (!ID_PATTERN.test(id)) {
		throw new UserError('Unknown video.', 404);
	}
	return path.join(PROJECTS_DIR, `${id}.json`);
};

export const getProject = async (id: string): Promise<Project> => {
	const file = projectFile(id);
	if (!existsSync(file)) {
		throw new UserError('This video could not be found.', 404);
	}
	// Older projects are filled in with the fields added since they were made.
	const project = await readJson<Project>(file);
	return {
		...project,
		templateId: templateOrDefault(project.templateId),
		captionPosition: oneOf(project.captionPosition, CAPTION_POSITIONS, 'bottom'),
		scenes: project.scenes.map((s) => ({...s, image: isMediaImage(s.image) ? s.image : null})),
		voice: project.voice
			? {
					...project.voice,
					originalUrl: project.voice.originalUrl ?? project.voice.url,
					pitch: oneOf<VoicePitch>(project.voice.pitch, VOICE_PITCHES, 0),
				}
			: null,
	};
};

export const writeProject = async (project: Project): Promise<Project> => {
	const saved = {...project, updatedAt: new Date().toISOString()};
	await writeJsonAtomic(projectFile(project.id), saved);
	return saved;
};

export const createProject = async (project: Project) => {
	if (existsSync(projectFile(project.id))) {
		throw new UserError('A video with this id already exists.');
	}
	return writeProject(project);
};

/** Applies a partial update to a stored project, then writes it. */
export const updateProject = async (id: string, update: (project: Project) => Project) =>
	writeProject(update(await getProject(id)));

const sanitizeScenes = (value: unknown): Scene[] | null => {
	if (!Array.isArray(value)) {
		return null;
	}
	return value.slice(0, 20).map((raw) => {
		const scene = (raw ?? {}) as Partial<Scene>;
		return {
			id: str(scene.id) || crypto.randomUUID(),
			kind: oneOf(scene.kind, ['hook', 'point', 'myth', 'fact', 'cta'], 'point'),
			headline: str(scene.headline).slice(0, 140),
			subtext: str(scene.subtext).slice(0, 160),
			icon: isIconName(scene.icon) ? scene.icon : 'lightbulb',
			narration: str(scene.narration).slice(0, 1500),
			image: isMediaImage(scene.image) ? scene.image : null,
			};
	});
};

const sanitizeWords = (value: unknown): Word[] | null => {
	if (!Array.isArray(value)) {
		return null;
	}
	return value
		.filter((w) => w && typeof w.text === 'string' && Number.isFinite(w.startMs) && Number.isFinite(w.endMs))
		.map((w) => ({text: w.text.slice(0, 60), startMs: Math.round(w.startMs), endMs: Math.round(w.endMs)}));
};

/**
 * Saves the fields the editor owns. `voice` and `render` are only ever changed by the server,
 * and a save can't wipe captions that the transcription job wrote in the meantime.
 */
export const saveEditorChanges = async (id: string, input: Partial<Project>) =>
	updateProject(id, (stored) => {
		const words = sanitizeWords(input.words);
		return {
			...stored,
			title: str(input.title, stored.title).slice(0, 120),
			idea: str(input.idea, stored.idea).slice(0, 4000),
			format: oneOf(input.format, ['tips', 'myth_fact', 'qa'], stored.format),
			language: oneOf(input.language, ['ar', 'en'], stored.language),
			themeId: oneOf(input.themeId, THEME_IDS, stored.themeId),
			templateId: oneOf(input.templateId, TEMPLATE_IDS, stored.templateId),
			captionPosition: oneOf(input.captionPosition, CAPTION_POSITIONS, stored.captionPosition),
			scenes: sanitizeScenes(input.scenes) ?? stored.scenes,
			reviewNotes: Array.isArray(input.reviewNotes)
				? input.reviewNotes.filter((n) => typeof n === 'string').slice(0, 10)
				: stored.reviewNotes,
			youtube: input.youtube
				? {
						title: str(input.youtube.title).slice(0, 200),
						description: str(input.youtube.description).slice(0, 5000),
						hashtags: Array.isArray(input.youtube.hashtags)
							? input.youtube.hashtags.filter((h) => typeof h === 'string').slice(0, 15)
							: [],
					}
				: stored.youtube,
			words: words && words.length > 0 ? words : stored.words,
		};
	});

export const listProjects = async (): Promise<ProjectSummary[]> => {
	const files = (await readdir(PROJECTS_DIR)).filter((f) => f.endsWith('.json'));
	const projects = await Promise.all(
		files.map((f) => readJson<Project>(path.join(PROJECTS_DIR, f)).catch(() => null)),
	);
	return projects
		.filter((p): p is Project => p !== null)
		.map((p) => ({
			id: p.id,
			title: p.title,
			idea: p.idea,
			language: p.language,
			format: p.format,
			themeId: p.themeId,
			templateId: templateOrDefault(p.templateId),
			createdAt: p.createdAt,
			updatedAt: p.updatedAt,
			render: p.render,
			hasVoice: Boolean(p.voice),
			sceneCount: p.scenes.length,
		}))
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

/** Brings back the most recently deleted copy of a project (the "Undo" after deleting). */
export const restoreProject = async (id: string): Promise<Project> => {
	const file = projectFile(id);
	const trashed = (await readdir(TRASH_DIR)).filter((f) => f.startsWith(`${id}-`)).sort();
	if (trashed.length === 0) {
		throw new UserError('Nothing to restore.', 404);
	}
	await rename(path.join(TRASH_DIR, trashed[trashed.length - 1]), file);
	return readJson<Project>(file);
};

/** Moves the project to data/trash instead of deleting it, so nothing is lost by a mis-click. */
export const trashProject = async (id: string) => {
	const file = projectFile(id);
	if (existsSync(file)) {
		await rename(file, path.join(TRASH_DIR, `${id}-${Date.now()}.json`));
	}
};
