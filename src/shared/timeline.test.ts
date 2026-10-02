import {describe, expect, it} from 'vitest';
import {DEFAULT_SETTINGS, newProject} from './project';
import {
	buildCaptionPages,
	buildVideoProps,
	computeSceneStarts,
	estimateWords,
	headlineTokens,
	parseEmphasis,
	propsSignature,
	replaceWords,
	restoreFromScript,
	smoothWordTimings,
} from './timeline';
import type {Scene, Word} from './types';

const scene = (kind: Scene['kind'], narration: string): Scene => ({
	id: kind + narration.length,
	kind,
	headline: 'Headline',
	subtext: '',
	icon: 'heart',
	narration,
	image: null,
	});

const scenes = [
	scene('hook', 'Stop drinking water like this.'),
	scene('point', 'Sip slowly through the day.'),
	scene('cta', 'Follow for more.'),
];

describe('parseEmphasis', () => {
	it('marks words between stars', () => {
		expect(parseEmphasis('Stop *drinking* water')).toEqual([
			{text: 'Stop ', em: false},
			{text: 'drinking', em: true},
			{text: ' water', em: false},
		]);
	});
});

describe('headlineTokens', () => {
	it('keeps punctuation attached to the highlighted word', () => {
		expect(headlineTokens('Drinking water *wrong*?')).toEqual([
			[{text: 'Drinking', em: false}],
			[{text: 'water', em: false}],
			[
				{text: 'wrong', em: true},
				{text: '?', em: false},
			],
		]);
	});
});

describe('estimateWords', () => {
	it('produces increasing, non-overlapping timings for every narration word', () => {
		const words = estimateWords(scenes, 'en');
		expect(words.map((w) => w.text).join(' ')).toBe(
			'Stop drinking water like this. Sip slowly through the day. Follow for more.',
		);
		for (let i = 1; i < words.length; i++) {
			expect(words[i].startMs).toBeGreaterThanOrEqual(words[i - 1].endMs);
		}
	});
});

describe('computeSceneStarts', () => {
	it('starts each scene just before its first spoken word', () => {
		const words = estimateWords(scenes, 'en');
		const starts = computeSceneStarts(scenes, words);
		expect(starts[0]).toBe(0);
		expect(starts[1]).toBe(words[5].startMs - 120);
		expect(starts[2]).toBe(words[10].startMs - 120);
	});

	it('copes with a transcript that has a different word count', () => {
		const transcript: Word[] = Array.from({length: 26}, (_, i) => ({
			text: 'w' + i,
			startMs: i * 400,
			endMs: i * 400 + 350,
		}));
		const starts = computeSceneStarts(scenes, transcript);
		expect(starts).toHaveLength(3);
		expect(starts[1]).toBeGreaterThan(starts[0]);
		expect(starts[2]).toBeGreaterThan(starts[1]);
	});
});

describe('buildCaptionPages', () => {
	it('breaks at sentence ends and keeps pages short', () => {
		const words = estimateWords(scenes, 'en');
		const pages = buildCaptionPages(words, 'en', 20000);
		expect(pages.map((p) => p.words.map((w) => w.text).join(' '))).toEqual([
			'Stop drinking water',
			'like this.',
			'Sip slowly through',
			'the day.',
			'Follow for more.',
		]);
		expect(pages[1].firstIndex).toBe(3);
	});

	it('uses shorter pages for Arabic', () => {
		const words = estimateWords([scene('hook', 'اشرب الماء ببطء طوال اليوم')], 'ar');
		const pages = buildCaptionPages(words, 'ar', 20000);
		expect(pages.every((p) => p.words.length <= 3)).toBe(true);
	});
});

describe('smoothWordTimings', () => {
	it('spreads words that share a start time up to the next word', () => {
		const words: Word[] = [
			{text: 'You', startMs: 10720, endMs: 10760},
			{text: 'may', startMs: 10720, endMs: 10760},
			{text: 'have', startMs: 10720, endMs: 10840},
			{text: 'heard', startMs: 10840, endMs: 10890},
			{text: 'that', startMs: 10890, endMs: 11200},
		];
		const smoothed = smoothWordTimings(words);
		expect(smoothed.map((w) => w.startMs)).toEqual([10720, 10760, 10800, 10840, 10890]);
		for (let i = 1; i < smoothed.length; i++) {
			expect(smoothed[i].startMs).toBeGreaterThan(smoothed[i - 1].startMs);
		}
	});

	it('leaves well-spaced words alone', () => {
		const words: Word[] = [
			{text: 'a', startMs: 0, endMs: 300},
			{text: 'b', startMs: 300, endMs: 600},
		];
		expect(smoothWordTimings(words)).toEqual(words);
	});
});

describe('restoreFromScript', () => {
	const timed = (texts: string[]): Word[] => texts.map((text, i) => ({text, startMs: i * 300, endMs: i * 300 + 250}));

	it('brings back the script’s punctuation and capitals, keeping the timing', () => {
		const heard = timed(['stop', 'drinking', 'water', 'like', 'this', 'sip', 'slowly']);
		const restored = restoreFromScript(heard, scenes);
		expect(restored.map((w) => w.text)).toEqual(['Stop', 'drinking', 'water', 'like', 'this.', 'Sip', 'slowly']);
		expect(restored[4].startMs).toBe(1200);
	});

	it('keeps words she said differently from the script', () => {
		const heard = timed(['stop', 'gulping', 'water', 'like', 'this']);
		expect(restoreFromScript(heard, scenes).map((w) => w.text)).toEqual(['Stop', 'gulping', 'water', 'like', 'this.']);
	});

	it('matches Arabic despite hamza and taa marbuta spelling differences', () => {
		const arabic = [scene('hook', 'أغلب الناس بيشربوا المية غلط.')];
		const heard = timed(['اغلب', 'الناس', 'بيشربوا', 'الميه', 'غلط']);
		expect(restoreFromScript(heard, arabic).map((w) => w.text)).toEqual(['أغلب', 'الناس', 'بيشربوا', 'المية', 'غلط.']);
	});

	it('tolerates a one-letter recognition slip in longer words', () => {
		const heard = timed(['stop', 'drinkin', 'water']);
		expect(restoreFromScript(heard, scenes).map((w) => w.text)).toEqual(['Stop', 'drinking', 'water']);
	});
});

describe('replaceWords', () => {
	it('spreads the original time span over the corrected words', () => {
		const words: Word[] = [
			{text: 'a', startMs: 0, endMs: 100},
			{text: 'wrong', startMs: 100, endMs: 500},
			{text: 'z', startMs: 500, endMs: 600},
		];
		const fixed = replaceWords(words, 1, 1, 'right one');
		expect(fixed.map((w) => w.text)).toEqual(['a', 'right', 'one', 'z']);
		expect(fixed[1].startMs).toBe(100);
		expect(fixed[2].endMs).toBe(500);
	});
});

describe('buildVideoProps', () => {
	it('numbers points, fits the recording and makes media URLs absolute', () => {
		const project = {
			...newProject('tips', 'en', DEFAULT_SETTINGS),
			scenes: scenes.map((s, i) => (i === 1 ? {...s, image: '/media/photo-1.jpg'} : s)),
			captionPosition: 'top' as const,
			voice: {url: '/media/voice-p.wav', originalUrl: '/media/voice.wav', pitch: -1.5 as const, durationMs: 9000},
			};
		const props = buildVideoProps(project, {...DEFAULT_SETTINGS, doctorName: 'Dr. Mona'}, {
			mediaBase: 'http://localhost:3100',
		});
		// The video plays the disguised copy of her voice.
		expect(props.audioUrl).toBe('http://localhost:3100/media/voice-p.wav');
		expect(props.scenes[1].image).toBe('http://localhost:3100/media/photo-1.jpg');
		expect(props.scenes[0].image).toBeNull();
		expect(props.captionPosition).toBe('top');
		expect(props.durationMs).toBe(9500);
		expect(props.scenes.map((s) => s.number)).toEqual([null, 1, null]);
		expect(props.scenes[2].endMs).toBe(9500);
		const lastWord = props.captions[props.captions.length - 1].words.at(-1)!;
		expect(lastWord.endMs).toBeLessThanOrEqual(9000);
		expect(props.brand.endCardText).toBe('Follow for more health tips');
		// The same video has the same fingerprint wherever its media is loaded from.
		expect(propsSignature(props)).toBe(propsSignature(buildVideoProps(project, {...DEFAULT_SETTINGS, doctorName: 'Dr. Mona'})));
	});
});
