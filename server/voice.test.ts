import {describe, expect, it} from 'vitest';
import {isMediaImage} from './store';
import {pitchFilter} from './voice';

describe('pitchFilter', () => {
	it('raises the pitch and stretches back to the original speed', () => {
		const filter = pitchFilter(3, 48000);
		const rate = Number(/asetrate=(\d+)/.exec(filter)![1]);
		const tempo = Number(/atempo=([\d.]+)/.exec(filter)![1]);
		expect(rate).toBe(Math.round(48000 * 2 ** (3 / 12)));
		expect(filter).toContain('aresample=48000');
		// Speed-up from the new rate times the slow-down from atempo leaves the length unchanged.
		expect((rate / 48000) * tempo).toBeCloseTo(1, 5);
	});

	it('lowers the pitch within the range atempo accepts', () => {
		const tempo = Number(/atempo=([\d.]+)/.exec(pitchFilter(-3, 44100))![1]);
		expect(tempo).toBeGreaterThan(1);
		expect(tempo).toBeLessThan(2);
	});
});

describe('isMediaImage', () => {
	it('only accepts pictures from the app media folder', () => {
		expect(isMediaImage('/media/photo-123.jpg')).toBe(true);
		expect(isMediaImage('/media/photo-123.webp')).toBe(true);
		expect(isMediaImage('/media/../settings.json')).toBe(false);
		expect(isMediaImage('https://example.com/a.jpg')).toBe(false);
		expect(isMediaImage('/media/voice.wav')).toBe(false);
		expect(isMediaImage(null)).toBe(false);
	});
});
