import {VIDEO_STRINGS} from './strings';
import type {CaptionPage, Lang, Project, Scene, Settings, TimedScene, VideoProps, Word} from './types';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

const WORDS_PER_SECOND: Record<Lang, number> = {en: 2.6, ar: 2.2};
const SCENE_GAP_MS = 250;
const PUNCTUATION_PAUSE_MS = 180;
/** How long the end card stays after the last estimated word. */
const END_HOLD_MS = 1200;
/** Silence kept after a real recording ends. */
const VOICE_TAIL_MS = 500;
const MIN_LAST_SCENE_MS = 1800;
/** Scenes switch slightly before their first word so the picture leads the voice. */
const SCENE_LEAD_MS = 120;
const EMPTY_SCENE_MS = 2500;

const MAX_WORDS_PER_PAGE: Record<Lang, number> = {en: 4, ar: 3};
const MAX_CHARS_PER_PAGE: Record<Lang, number> = {en: 20, ar: 18};
const PAGE_BREAK_GAP_MS = 450;
const SENTENCE_END = /[.!?؟]$/;
const CLAUSE_END = /[,،;:]$/;

export const splitWords = (text: string) => text.split(/\s+/).filter(Boolean);

/** Removes the `*highlight*` markers used in headlines. */
export const stripMarkup = (text: string) => text.replace(/\*/g, '');

/** Splits "Stop *drinking* water" into plain and highlighted parts. */
export const parseEmphasis = (text: string) =>
	text
		.split('*')
		.map((part, i) => ({text: part, em: i % 2 === 1}))
		.filter((part) => part.text.length > 0);

export type HeadlineSegment = {text: string; em: boolean};

/**
 * Splits a headline into words for animation, keeping punctuation glued to its word:
 * "water *wrong*?" gives [[water], [wrong(em), ?]].
 */
export const headlineTokens = (text: string): HeadlineSegment[][] => {
	const tokens: HeadlineSegment[][] = [];
	let glue = false;
	for (const part of parseEmphasis(text)) {
		for (const chunk of part.text.split(/(\s+)/)) {
			if (chunk === '') {
				continue;
			}
			if (/^\s+$/.test(chunk)) {
				glue = false;
				continue;
			}
			if (glue && tokens.length > 0) {
				tokens[tokens.length - 1].push({text: chunk, em: part.em});
			} else {
				tokens.push([{text: chunk, em: part.em}]);
			}
			glue = true;
		}
	}
	return tokens;
};

export const narrationWordCounts = (scenes: Scene[]) =>
	scenes.map((scene) => splitWords(stripMarkup(scene.narration)).length);

/** Rough speaking-time estimate used before she records her voice. */
export const estimateWords = (scenes: Scene[], lang: Lang): Word[] => {
	const baseMs = 1000 / WORDS_PER_SECOND[lang];
	const words: Word[] = [];
	let t = 0;
	for (const scene of scenes) {
		const sceneWords = splitWords(stripMarkup(scene.narration));
		if (sceneWords.length === 0) {
			continue;
		}
		if (words.length > 0) {
			t += SCENE_GAP_MS;
		}
		for (const text of sceneWords) {
			const letters = text.replace(/[^\p{L}\p{N}]/gu, '').length;
			const duration = Math.round(baseMs * Math.min(1.6, Math.max(0.6, letters / 5)));
			words.push({text, startMs: t, endMs: t + duration});
			t += duration;
			if (SENTENCE_END.test(text) || CLAUSE_END.test(text)) {
				t += PUNCTUATION_PAUSE_MS;
			}
		}
	}
	return words;
};

export const estimateDurationMs = (scenes: Scene[], lang: Lang) => {
	const words = estimateWords(scenes, lang);
	return words.length ? words[words.length - 1].endMs + END_HOLD_MS : 0;
};

/**
 * Finds when each scene starts in the (spoken) word list. The script's word counts per scene
 * are mapped proportionally onto the transcript, which stays robust when the transcript has a
 * few more or fewer words than the script.
 */
export const computeSceneStarts = (scenes: Scene[], words: Word[]): number[] => {
	const counts = narrationWordCounts(scenes);
	const total = counts.reduce((a, b) => a + b, 0);
	if (total === 0 || words.length === 0) {
		return scenes.map((_, i) => i * EMPTY_SCENE_MS);
	}
	const starts: number[] = [];
	let before = 0;
	for (let i = 0; i < scenes.length; i++) {
		if (i === 0) {
			starts.push(0);
		} else {
			const index = Math.min(words.length - 1, Math.round((before / total) * words.length));
			starts.push(Math.max(starts[i - 1], words[index].startMs - SCENE_LEAD_MS));
		}
		before += counts[i];
	}
	return starts;
};

/**
 * Speech recognition sometimes gives several words the same start time (typically at the
 * start of a sentence). Spreads such bunched-up words evenly so the highlight keeps moving.
 */
export const smoothWordTimings = (input: Word[]): Word[] => {
	const words = input.map((w) => ({...w}));
	const SAME_MS = 40;
	let i = 0;
	while (i < words.length) {
		let j = i;
		while (j + 1 < words.length && words[j + 1].startMs - words[j].startMs < SAME_MS) {
			j++;
		}
		if (j > i) {
			const from = words[i].startMs;
			const to = Math.max(words[j].endMs, j + 1 < words.length ? words[j + 1].startMs : words[j].endMs);
			const step = (to - from) / (j - i + 1);
			for (let k = i; k <= j; k++) {
				words[k].startMs = Math.round(from + step * (k - i));
				words[k].endMs = Math.round(from + step * (k - i + 1));
			}
		}
		i = j + 1;
	}
	return words;
};

/** Loose form of a word for comparing: no case, accents, harakat, hamza or punctuation. */
export const normalizeWord = (word: string) =>
	word
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/ى/g, 'ي')
		.replace(/ة/g, 'ه')
		.replace(/[^\p{L}\p{N}]/gu, '');

const nearlyEqual = (a: string, b: string) => {
	if (a === b) return true;
	if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
	// At most one letter added, removed or changed.
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) i++;
	if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
	return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
};

/**
 * Speech recognition loses punctuation and sometimes spells words its own way. Where the
 * spoken words line up with the script (longest common subsequence), the script's exact
 * spelling and punctuation are used; anything she said differently keeps the recognized text.
 */
export const restoreFromScript = (words: Word[], scenes: Scene[]): Word[] => {
	const script = scenes.flatMap((s) => splitWords(stripMarkup(s.narration)));
	const a = words.map((w) => normalizeWord(w.text));
	const b = script.map(normalizeWord);
	const n = a.length;
	const m = b.length;
	const table = Array.from({length: n + 1}, () => new Uint16Array(m + 1));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			table[i][j] =
				a[i] && nearlyEqual(a[i], b[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
		}
	}
	const result = words.map((w) => ({...w}));
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] && nearlyEqual(a[i], b[j]) && table[i][j] === table[i + 1][j + 1] + 1) {
			result[i].text = script[j];
			i++;
			j++;
		} else if (table[i + 1][j] >= table[i][j + 1]) {
			i++;
		} else {
			j++;
		}
	}
	return result;
};

/** Groups words into short caption "pages" shown one at a time. */
export const buildCaptionPages = (words: Word[], lang: Lang, durationMs: number): CaptionPage[] => {
	const groups: {firstIndex: number; words: Word[]}[] = [];
	let current: Word[] = [];
	let firstIndex = 0;
	words.forEach((word, i) => {
		if (current.length > 0) {
			const prev = current[current.length - 1];
			const chars = current.reduce((n, w) => n + w.text.length + 1, 0) + word.text.length;
			const shouldBreak =
				current.length >= MAX_WORDS_PER_PAGE[lang] ||
				chars > MAX_CHARS_PER_PAGE[lang] ||
				word.startMs - prev.endMs > PAGE_BREAK_GAP_MS ||
				SENTENCE_END.test(prev.text) ||
				(CLAUSE_END.test(prev.text) && current.length >= 2);
			if (shouldBreak) {
				groups.push({firstIndex, words: current});
				current = [];
			}
		}
		if (current.length === 0) {
			firstIndex = i;
		}
		current.push(word);
	});
	if (current.length > 0) {
		groups.push({firstIndex, words: current});
	}
	return groups.map((group, i) => {
		const last = group.words[group.words.length - 1];
		const next = groups[i + 1];
		const endMs = next
			? Math.min(next.words[0].startMs, last.endMs + 500)
			: Math.min(durationMs, last.endMs + 800);
		return {startMs: group.words[0].startMs, endMs: Math.max(endMs, last.endMs), ...group};
	});
};

/**
 * Replaces `count` words starting at `firstIndex` with the words of `newText`, spreading the
 * original time span across the new words by length. Used when she corrects a caption line.
 */
export const replaceWords = (words: Word[], firstIndex: number, count: number, newText: string): Word[] => {
	const old = words.slice(firstIndex, firstIndex + count);
	if (old.length === 0) {
		return words;
	}
	const start = old[0].startMs;
	const span = Math.max(1, old[old.length - 1].endMs - start);
	const tokens = splitWords(newText);
	const totalChars = tokens.reduce((n, t) => n + t.length, 0) || 1;
	let t = start;
	const replacement = tokens.map((text) => {
		const duration = (span * text.length) / totalChars;
		const word = {text, startMs: Math.round(t), endMs: Math.round(t + duration)};
		t += duration;
		return word;
	});
	return [...words.slice(0, firstIndex), ...replacement, ...words.slice(firstIndex + count)];
};

/** Short fingerprint of what a video will look like, to tell whether a render is out of date. */
export const propsSignature = (props: VideoProps) => {
	// Icon drawings follow from the icon names, so they are left out of the fingerprint, and so is
	// the server address in front of media files (the phone app and the renderer each add their own).
	const text = JSON.stringify({...props, icons: null}).replace(/https?:\/\/[^"/]+(?=\/media\/)/g, '');
	let hash = 5381;
	for (let i = 0; i < text.length; i++) {
		hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
	}
	return hash.toString(36);
};

export const durationInFrames = (props: Pick<VideoProps, 'durationMs'>) =>
	Math.max(1, Math.ceil((props.durationMs / 1000) * FPS));

export const msToFrame = (ms: number) => Math.round((ms / 1000) * FPS);

/** Turns a project + channel settings into the props the video template renders. */
export const buildVideoProps = (
	project: Project,
	settings: Settings,
	options: {mediaBase?: string; icons?: Record<string, string>} = {},
): VideoProps => {
	const absolute = (url: string | null | undefined) =>
		url && options.mediaBase && url.startsWith('/') ? options.mediaBase + url : (url ?? null);
	const lang = project.language;
	const {scenes, voice} = project;

	let words = project.words?.length ? project.words : estimateWords(scenes, lang);
	if (!project.words?.length && voice && words.length) {
		// Recorded but not transcribed yet: stretch the estimate over the recording.
		const scale = Math.max(0.1, (voice.durationMs - 300) / words[words.length - 1].endMs);
		words = words.map((w) => ({...w, startMs: Math.round(w.startMs * scale), endMs: Math.round(w.endMs * scale)}));
	}

	const starts = computeSceneStarts(scenes, words);
	let durationMs = voice
		? voice.durationMs + VOICE_TAIL_MS
		: words.length
			? words[words.length - 1].endMs + END_HOLD_MS
			: scenes.length * EMPTY_SCENE_MS;
	if (scenes.length > 0) {
		durationMs = Math.max(durationMs, starts[starts.length - 1] + MIN_LAST_SCENE_MS);
	}
	durationMs = Math.max(durationMs, 2000);

	let pointNumber = 0;
	const timed: TimedScene[] = scenes
		.map((scene, i) => ({
			kind: scene.kind,
			headline: scene.headline,
			subtext: scene.subtext,
			icon: scene.icon,
			image: absolute(scene.image),
			number: scene.kind === 'point' ? ++pointNumber : null,
			startMs: starts[i],
			endMs: i < scenes.length - 1 ? starts[i + 1] : durationMs,
		}))
		.filter((scene) => scene.endMs - scene.startMs >= 100);

	return {
		language: lang,
		themeId: project.themeId,
		templateId: project.templateId ?? 'cards',
		captionPosition: project.captionPosition ?? 'bottom',
		brand: {
			doctorName: settings.doctorName.trim() || settings.channelName.trim(),
			handle: settings.handle.trim(),
			logoUrl: absolute(settings.logoUrl),
			endCardText: settings.endCardText.trim() || VIDEO_STRINGS[lang].follow,
			showDisclaimer: settings.showDisclaimer,
		},
		scenes: timed,
		captions: buildCaptionPages(words, lang, durationMs),
		audioUrl: absolute(voice?.url ?? null),
		musicUrl: absolute(settings.musicUrl),
		durationMs,
		icons: options.icons ?? {},
	};
};
