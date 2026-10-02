import type {Word} from '../types';

// Captions without a speech-recognition model: she reads her script, so the words are known and
// only their timing is missing. The recording is split into stretches of speech at her pauses,
// then the script is fitted onto those stretches so sentences start after pauses and each
// stretch gets about as many words as its length allows.

export type Interval = {startMs: number; endMs: number};

/** Loudness in dB per 10 ms frame, lightly smoothed. */
export type Envelope = Float32Array;

const FRAME_MS = 10;
/** Quieter gaps shorter than this are part of speech (between syllables and words). */
const MIN_PAUSE_MS = 180;
/** Louder bits shorter than this are clicks or breaths, not speech. */
const MIN_SPEECH_MS = 60;

const percentile = (sorted: Float32Array, p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

export const loudness = (samples: Float32Array, sampleRate: number): Envelope => {
	const hop = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
	const frames = Math.floor(samples.length / hop);
	const raw = new Float32Array(frames);
	for (let f = 0; f < frames; f++) {
		let sum = 0;
		for (let i = f * hop; i < (f + 1) * hop; i++) sum += samples[i] * samples[i];
		raw[f] = 10 * Math.log10(sum / hop + 1e-10);
	}
	const db = new Float32Array(frames);
	for (let f = 0; f < frames; f++) db[f] = (raw[Math.max(0, f - 1)] + raw[f] + raw[Math.min(frames - 1, f + 1)]) / 3;
	return db;
};

/** The stretches where she is speaking, from the loudness envelope with an adaptive threshold. */
export const speechIntervals = (db: Envelope): Interval[] => {
	const frames = db.length;
	if (frames === 0) return [];
	const sorted = db.slice().sort();
	const floor = percentile(sorted, 0.1);
	const loud = percentile(sorted, 0.95);
	if (loud - floor < 6) return [{startMs: 0, endMs: frames * FRAME_MS}];
	const threshold = floor + (loud - floor) * 0.35;

	// Loud frames → runs; runs closer than MIN_PAUSE_MS are joined; short blips are dropped.
	const runs: Interval[] = [];
	let start = -1;
	for (let f = 0; f <= frames; f++) {
		const on = f < frames && db[f] > threshold;
		if (on && start < 0) start = f;
		if (!on && start >= 0) {
			runs.push({startMs: start * FRAME_MS, endMs: f * FRAME_MS});
			start = -1;
		}
	}
	const joined: Interval[] = [];
	for (const run of runs) {
		const prev = joined[joined.length - 1];
		if (prev && run.startMs - prev.endMs < MIN_PAUSE_MS) prev.endMs = run.endMs;
		else joined.push({...run});
	}
	return joined.filter((r) => r.endMs - r.startMs >= MIN_SPEECH_MS);
};

const SENTENCE_END = /[.!?؟…]["'»”)]*$/;
const CLAUSE_END = /[,،;:]["'»”)]*$/;

/** Rough speaking length of a word, in "average word" units. */
const wordWeight = (text: string) => Math.min(1.6, Math.max(0.6, text.replace(/[^\p{L}\p{N}]/gu, '').length / 5));

/**
 * Fits the script's words onto the speech stretches. `breakAfter[i]` marks a word that ends a
 * scene. A stretch boundary is cheapest after a full stop or a scene's end, a little dearer after
 * a comma, and dearest in the middle of a phrase; each stretch should hold roughly the words its
 * length allows at her average speaking rate. Solved exactly by dynamic programming.
 */
/**
 * Moves each word boundary inside a stretch to the clearest dip in loudness near where the
 * word-length estimate puts it, keeping the boundaries in order.
 */
const snapToDips = (bounds: number[], startMs: number, endMs: number, db: Envelope | undefined): number[] => {
	if (!db || bounds.length === 0) return bounds;
	const at = (ms: number) => db[Math.min(db.length - 1, Math.max(0, Math.round(ms / FRAME_MS)))];
	const average = (endMs - startMs) / (bounds.length + 1);
	const reach = Math.min(400, average * 0.6);
	const out: number[] = [];
	let floor = startMs + 60;
	for (let b = 0; b < bounds.length; b++) {
		const ceiling = endMs - 60 * (bounds.length - b);
		let best = Math.min(Math.max(bounds[b], floor), ceiling);
		let bestScore = -Infinity;
		for (let ms = Math.max(floor, bounds[b] - reach); ms <= Math.min(ceiling, bounds[b] + reach); ms += FRAME_MS) {
			// A dip: quieter than the loudest point on either side within 60 ms.
			let left = -Infinity;
			let right = -Infinity;
			for (let d = FRAME_MS; d <= 60; d += FRAME_MS) {
				left = Math.max(left, at(ms - d));
				right = Math.max(right, at(ms + d));
			}
			const depth = Math.min(left, right) - at(ms);
			const score = depth - (Math.abs(ms - bounds[b]) / reach) * 4;
			if (depth > 2 && score > bestScore) {
				bestScore = score;
				best = ms;
			}
		}
		out.push(best);
		floor = best + 60;
	}
	return out;
};

export const alignWords = (words: string[], intervals: Interval[], breakAfter: boolean[] = [], db?: Envelope): Word[] => {
	const n = words.length;
	const k = intervals.length;
	if (n === 0) return [];
	if (k === 0) return [];
	const weight = words.map(wordWeight);
	const prefix = new Float64Array(n + 1);
	for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + weight[i];
	const speechMs = intervals.reduce((s, r) => s + r.endMs - r.startMs, 0);
	const msPerUnit = speechMs / prefix[n];

	const boundaryCost = (j: number) => {
		if (j === 0 || j === n) return 0;
		const text = words[j - 1];
		if (breakAfter[j - 1] || SENTENCE_END.test(text)) return 0;
		if (CLAUSE_END.test(text)) return 0.4;
		return 1.6;
	};

	// cost[k][j]: best cost of placing the first j words into the first k stretches.
	const cost = Array.from({length: k + 1}, () => new Float64Array(n + 1).fill(Infinity));
	const from = Array.from({length: k + 1}, () => new Int32Array(n + 1));
	cost[0][0] = 0;
	for (let s = 1; s <= k; s++) {
		const length = intervals[s - 1].endMs - intervals[s - 1].startMs;
		for (let j = 0; j <= n; j++) {
			// An empty stretch (a cough, a breath) costs more the longer it is.
			let best = cost[s - 1][j] + (length / 350) ** 2;
			let arg = j;
			for (let i = 0; i < j; i++) {
				if (cost[s - 1][i] === Infinity) continue;
				const expected = (prefix[j] - prefix[i]) * msPerUnit;
				const misfit = ((length - expected) / (expected * 0.3 + 250)) ** 2;
				const c = cost[s - 1][i] + misfit + boundaryCost(j);
				if (c < best) {
					best = c;
					arg = i;
				}
			}
			cost[s][j] = best;
			from[s][j] = arg;
		}
	}

	// Walk back to find which words each stretch got, then spread them across it by length.
	const groups: [number, number][] = new Array(k);
	let j = n;
	for (let s = k; s >= 1; s--) {
		const i = from[s][j];
		groups[s - 1] = [i, j];
		j = i;
	}
	const result: Word[] = [];
	groups.forEach(([a, b], s) => {
		if (a === b) return;
		const {startMs, endMs} = intervals[s];
		const span = prefix[b] - prefix[a];
		const estimate = [];
		for (let w = a + 1; w < b; w++) estimate.push(startMs + ((prefix[w] - prefix[a]) / span) * (endMs - startMs));
		const edges = [startMs, ...snapToDips(estimate, startMs, endMs, db), endMs];
		for (let w = a; w < b; w++) {
			result.push({text: words[w], startMs: Math.round(edges[w - a]), endMs: Math.round(edges[w - a + 1])});
		}
	});
	return result;
};
