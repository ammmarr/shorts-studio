import type {IconName} from './icons';
import type {Format, Lang, Project, Scene, SceneKind, Settings} from './types';

export const newId = () => crypto.randomUUID();

export const DEFAULT_SETTINGS: Settings = {
	doctorName: '',
	channelName: '',
	handle: '',
	logoUrl: null,
	musicUrl: null,
	themeId: 'clinic',
	templateId: 'cards',
	captionPosition: 'bottom',
	voicePitch: 0,
	language: 'ar',
	uiLanguage: 'ar',
	dialect: 'egyptian',
	endCardText: '',
	showDisclaimer: true,
	setupDone: false,
};

const DEFAULT_ICON: Record<SceneKind, IconName> = {
	hook: 'lightbulb',
	point: 'circle-check',
	myth: 'circle-x',
	fact: 'circle-check',
	cta: 'heart-pulse',
};

export const blankScene = (kind: SceneKind): Scene => ({
	id: newId(),
	kind,
	headline: '',
	subtext: '',
	icon: DEFAULT_ICON[kind],
	image: null,
	narration: '',
});

const SKELETONS: Record<Format, SceneKind[]> = {
	tips: ['hook', 'point', 'point', 'point', 'cta'],
	myth_fact: ['hook', 'myth', 'fact', 'cta'],
	qa: ['hook', 'point', 'point', 'point', 'cta'],
};

export const skeletonScenes = (format: Format): Scene[] => SKELETONS[format].map(blankScene);

export const newProject = (format: Format, language: Lang, settings: Settings): Project => {
	const now = new Date().toISOString();
	return {
		id: newId(),
		createdAt: now,
		updatedAt: now,
		title: '',
		idea: '',
		format,
		language,
		scenes: [],
		reviewNotes: [],
		youtube: {title: '', description: '', hashtags: []},
		voice: null,
		words: null,
		themeId: settings.themeId,
		templateId: settings.templateId,
		captionPosition: settings.captionPosition,
		render: null,
	};
};

export const FORMATS: Format[] = ['tips', 'myth_fact', 'qa'];

const fileSafe = (text: string) =>
	text
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50) || 'short';

/** "Drinking-water-2026-10-02-1459.mp4": the video's name plus when it was made. */
export const renderFileName = (project: Project, extension: string, now = new Date()) => {
	const pad = (n: number) => String(n).padStart(2, '0');
	const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
	return `${fileSafe(project.title || project.youtube.title)}-${stamp}.${extension}`;
};
