import {describe, expect, it} from 'vitest';
import {alignWords, loudness, speechIntervals} from './align';
import {shiftPitch} from './pitch';

const RATE = 48000;

/** A vowel-like sound: a fundamental plus a few harmonics. */
const voiced = (seconds: number, f0: number) => {
	const out = new Float32Array(Math.round(seconds * RATE));
	for (let i = 0; i < out.length; i++) {
		const t = i / RATE;
		out[i] = 0.4 * Math.sin(2 * Math.PI * f0 * t) + 0.2 * Math.sin(4 * Math.PI * f0 * t) + 0.1 * Math.sin(6 * Math.PI * f0 * t);
	}
	return out;
};

/** Frequency from the spacing of rising zero crossings. */
const frequency = (x: Float32Array) => {
	const crossings: number[] = [];
	for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) crossings.push(i);
	return ((crossings.length - 1) * RATE) / (crossings[crossings.length - 1] - crossings[0]);
};

describe('shiftPitch', () => {
	it('moves the pitch by the right amount and keeps the length', () => {
		const input = new Float32Array(Array.from({length: RATE * 2}, (_, i) => Math.sin((2 * Math.PI * 200 * i) / RATE)));
		for (const semitones of [3, -3, 1.5]) {
			const out = shiftPitch(input, RATE, semitones);
			expect(out.length).toBe(input.length);
			const expected = 200 * 2 ** (semitones / 12);
			// Ignore the edges, where the windows fade in and out.
			expect(frequency(out.subarray(RATE * 0.2, RATE * 1.8))).toBeCloseTo(expected, 0);
		}
	});

	it('returns a copy unchanged at 0 semitones', () => {
		const input = voiced(0.5, 180);
		const out = shiftPitch(input, RATE, 0);
		expect(out).not.toBe(input);
		expect(Array.from(out.subarray(0, 50))).toEqual(Array.from(input.subarray(0, 50)));
	});
});

describe('captions from pauses', () => {
	// Three sentences spoken in 1.2 s, 0.9 s and 1.5 s, with 0.4 s pauses between them.
	const parts = [voiced(1.2, 190), new Float32Array(RATE * 0.4), voiced(0.9, 210), new Float32Array(RATE * 0.4), voiced(1.5, 200)];
	const samples = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const part of parts) {
		samples.set(part, offset);
		offset += part.length;
	}

	it('finds the stretches of speech between pauses', () => {
		const intervals = speechIntervals(loudness(samples, RATE));
		expect(intervals).toHaveLength(3);
		expect(intervals[1].startMs).toBeGreaterThan(1550);
		expect(intervals[1].startMs).toBeLessThan(1650);
		expect(intervals[2].startMs).toBeGreaterThan(2850);
		expect(intervals[2].startMs).toBeLessThan(2950);
	});

	it('starts each sentence when she starts saying it', () => {
		const db = loudness(samples, RATE);
		const words = 'Drink water slowly. Not all at once. Your body will thank you later.'.split(' ');
		const timed = alignWords(words, speechIntervals(db), [], db);
		expect(timed).toHaveLength(words.length);
		const start = (text: string) => timed.find((w) => w.text === text)!.startMs;
		expect(start('Drink')).toBeLessThan(100);
		expect(Math.abs(start('Not') - 1600)).toBeLessThan(80);
		expect(Math.abs(start('Your') - 2900)).toBeLessThan(80);
		// Words never overlap and stay in order.
		for (let i = 1; i < timed.length; i++) expect(timed[i].startMs).toBeGreaterThanOrEqual(timed[i - 1].endMs);
	});

	it('gives nothing when there is no speech to place words in', () => {
		expect(alignWords(['hello'], [])).toEqual([]);
	});
});
