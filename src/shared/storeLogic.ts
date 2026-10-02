import {isIconName} from './icons';
import {DEFAULT_SETTINGS} from './project';
import {CAPTION_POSITIONS, TEMPLATE_IDS, THEME_IDS, VOICE_PITCHES} from './themes';
import type {Project, ProjectSummary, Scene, Settings, TemplateId, VoicePitch, Word} from './types';

// The rules for what may be stored, shared by the computer's server and the phone app's own
// storage, so both accept and repair data the same way.

const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const oneOf = <T extends string | number>(value: unknown, options: readonly T[], fallback: T): T =>
	options.includes(value as T) ? (value as T) : fallback;

/** Only pictures uploaded to this app's own media folder can be shown in a video. */
export const isMediaImage = (value: unknown): value is string =>
	typeof value === 'string' && /^\/media\/[\w.-]{1,120}\.(png|jpe?g|webp)$/.test(value);

/** Templates that were removed fall back to the original card style. */
const templateOrDefault = (value: unknown): TemplateId => oneOf(value, TEMPLATE_IDS, 'cards');

/** Stored settings (possibly from an older version) with every field filled in. */
export const normalizeSettings = (stored: Partial<Settings> | null): Settings => {
	const settings = {...DEFAULT_SETTINGS, ...stored};
	return {...settings, templateId: templateOrDefault(settings.templateId)};
};

/** Applies a partial change to the settings, keeping only valid values. */
export const mergeSettings = (current: Settings, input: Partial<Settings>): Settings => ({
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
});

/** A stored project with the fields added since older versions filled in. */
export const normalizeProject = (project: Project): Project => ({
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
});

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
 * Applies the fields the editor owns. `voice` and `render` are only ever changed by the app's
 * own jobs, and a save can't wipe captions that a caption job wrote in the meantime.
 */
export const mergeEditorChanges = (stored: Project, input: Partial<Project>): Project => {
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
		reviewNotes: Array.isArray(input.reviewNotes) ? input.reviewNotes.filter((n) => typeof n === 'string').slice(0, 10) : stored.reviewNotes,
		youtube: input.youtube
			? {
					title: str(input.youtube.title).slice(0, 200),
					description: str(input.youtube.description).slice(0, 5000),
					hashtags: Array.isArray(input.youtube.hashtags) ? input.youtube.hashtags.filter((h) => typeof h === 'string').slice(0, 15) : [],
				}
			: stored.youtube,
		words: words && words.length > 0 ? words : stored.words,
	};
};

/** What the list of Shorts shows, newest first. */
export const summarizeProjects = (projects: Project[]): ProjectSummary[] =>
	projects
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

/** A copy of a project as a new, unrecorded Short. */
export const duplicateOf = (source: Project, fresh: Project): Project => ({
	...fresh,
	title: source.title ? `${source.title} (copy)` : '',
	idea: source.idea,
	scenes: source.scenes.map((s) => ({...s, id: crypto.randomUUID()})),
	reviewNotes: source.reviewNotes,
	youtube: source.youtube,
	themeId: source.themeId,
	templateId: source.templateId,
	captionPosition: source.captionPosition,
});
