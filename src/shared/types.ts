import type {IconName} from './icons';

export type Lang = 'ar' | 'en';
export type Dialect = 'egyptian' | 'msa';
export type Format = 'tips' | 'myth_fact' | 'qa';
export type SceneKind = 'hook' | 'point' | 'myth' | 'fact' | 'cta';
export type ThemeId = 'clinic' | 'bold' | 'warm' | 'sky' | 'blush';
/** The animation style of a video. */
export type TemplateId = 'cards' | 'whiteboard' | 'photo' | 'prescription' | 'kinetic' | 'quiz' | 'editorial';
/** Where the word-by-word captions sit; the rest of the layout makes room. */
export type CaptionPosition = 'top' | 'bottom' | 'off';
/** Voice disguise, in semitones: 0 is her natural voice. */
export type VoicePitch = -3 | -1.5 | 0 | 1.5 | 3;

export type Scene = {
	id: string;
	kind: SceneKind;
	/** Short on-screen text. `*word*` marks a highlighted word. */
	headline: string;
	/** Optional smaller line under the headline. */
	subtext: string;
	icon: IconName;
	/** Optional photo for this card (a /media/ URL); shown instead of, or with, the icon. */
	image: string | null;
	/** What the doctor says during this scene. */
	narration: string;
};

/** One spoken word with its timing inside the voice recording. */
export type Word = {
	text: string;
	startMs: number;
	endMs: number;
};

export type Voice = {
	/** What the video plays: the recording, pitch-shifted when a disguise is chosen. */
	url: string;
	/** The untouched recording (captions are made from it). */
	originalUrl: string;
	pitch: VoicePitch;
	durationMs: number;
};

export type RenderInfo = {
	url: string;
	fileName: string;
	createdAt: string;
	/** propsSignature() of the rendered video (with relative media URLs). */
	signature: string;
};

export type YoutubeKit = {
	title: string;
	description: string;
	hashtags: string[];
};

export type Project = {
	id: string;
	createdAt: string;
	updatedAt: string;
	title: string;
	idea: string;
	format: Format;
	language: Lang;
	scenes: Scene[];
	reviewNotes: string[];
	youtube: YoutubeKit;
	voice: Voice | null;
	/** Caption words from the recording (null until the voice is transcribed). */
	words: Word[] | null;
	themeId: ThemeId;
	templateId: TemplateId;
	captionPosition: CaptionPosition;
	render: RenderInfo | null;
};

export type ProjectSummary = Pick<
	Project,
	'id' | 'title' | 'idea' | 'language' | 'format' | 'themeId' | 'templateId' | 'createdAt' | 'updatedAt' | 'render'
> & {hasVoice: boolean; sceneCount: number};

export type Settings = {
	doctorName: string;
	channelName: string;
	handle: string;
	logoUrl: string | null;
	musicUrl: string | null;
	themeId: ThemeId;
	/** Default animation style for new videos. */
	templateId: TemplateId;
	/** Default caption position for new videos. */
	captionPosition: CaptionPosition;
	/** Voice disguise applied to every new recording. */
	voicePitch: VoicePitch;
	language: Lang;
	/** Language of the app's own screens. */
	uiLanguage: Lang;
	dialect: Dialect;
	/** Custom end-card line; empty means the default for the video's language. */
	endCardText: string;
	showDisclaimer: boolean;
	setupDone: boolean;
};

export type Health = {
	ok: true;
	aiEnabled: boolean;
	whisperReady: boolean;
	whisperProblem: string | null;
	/** Addresses the phone app can use to reach this computer over Wi-Fi. */
	addresses: string[];
};

export type JobStatus<T = unknown> = {
	id: string;
	kind: 'transcribe' | 'render';
	status: 'running' | 'done' | 'error';
	progress: number;
	result: T | null;
	error: string | null;
};

/** What the AI writer returns. */
export type GeneratedScript = {
	title: string;
	scenes: Scene[];
	reviewNotes: string[];
	youtube: YoutubeKit;
};

// ---------- Video (Remotion input props) ----------

export type TimedScene = {
	kind: SceneKind;
	headline: string;
	subtext: string;
	icon: IconName;
	/** Absolute or /media/ URL of the card's photo. */
	image: string | null;
	/** 1-based number for "point" scenes, otherwise null. */
	number: number | null;
	startMs: number;
	endMs: number;
};

export type CaptionPage = {
	startMs: number;
	endMs: number;
	/** Index of the first word of this page inside the full word list. */
	firstIndex: number;
	words: Word[];
};

// A `type` (not `interface`) so it satisfies Remotion's Record<string, unknown> props constraint.
export type VideoProps = {
	language: Lang;
	themeId: ThemeId;
	templateId: TemplateId;
	captionPosition: CaptionPosition;
	brand: {
		doctorName: string;
		handle: string;
		logoUrl: string | null;
		endCardText: string;
		showDisclaimer: boolean;
	};
	scenes: TimedScene[];
	captions: CaptionPage[];
	audioUrl: string | null;
	musicUrl: string | null;
	durationMs: number;
	/** SVG bodies (Lucide, 24x24, stroke=currentColor) for the icons the scenes use. */
	icons: Record<string, string>;
};
