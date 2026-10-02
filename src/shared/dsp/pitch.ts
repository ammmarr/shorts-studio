/**
 * Moves a voice up or down by `semitones` and keeps its length, so captions stay in sync. The sound
 * is resampled (which changes pitch and speed together), then stretched back to its original
 * length with WSOLA: short overlapping windows are joined where their waveforms line up best, so
 * the voice stays smooth. Runs on the phone; the result matches the server's ffmpeg version.
 */
export const shiftPitch = (input: Float32Array, sampleRate: number, semitones: number): Float32Array => {
	if (semitones === 0 || input.length < sampleRate * 0.1) return input.slice();
	const k = 2 ** (semitones / 12);
	return stretch(resample(input, k), input.length, sampleRate);
};

/** Plays the sound `k` times faster: pitch × k, length ÷ k. */
const resample = (x: Float32Array, k: number) => {
	const out = new Float32Array(Math.floor((x.length - 1) / k));
	for (let i = 0; i < out.length; i++) {
		const p = i * k;
		const j = Math.floor(p);
		const f = p - j;
		out[i] = x[j] * (1 - f) + x[j + 1] * f;
	}
	return out;
};

const correlation = (x: Float32Array, a: number, b: number, length: number, step: number) => {
	let sum = 0;
	for (let i = 0; i < length; i += step) sum += x[a + i] * x[b + i];
	return sum;
};

/** Stretches `x` to `targetLength` samples without changing its pitch (WSOLA). */
const stretch = (x: Float32Array, targetLength: number, sampleRate: number) => {
	const size = Math.round(sampleRate * 0.032) & ~1; // ~32 ms windows
	const hop = size / 2; // 50% overlap: Hann windows add up to a constant
	const analysisHop = (hop * x.length) / targetLength;
	const tolerance = Math.round(sampleRate * 0.008); // look up to ±8 ms for the best join
	const window = new Float32Array(size);
	for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
	const out = new Float32Array(targetLength + size);
	const weight = new Float32Array(targetLength + size);
	const last = x.length - size - 1;
	let previous = 0;
	for (let m = 0; m * hop < targetLength; m++) {
		const nominal = Math.min(last, Math.round(m * analysisHop));
		let best = nominal;
		const natural = previous + hop; // where the previous window would naturally continue
		if (m > 0 && natural + hop < x.length && last > 0) {
			const lo = Math.max(0, nominal - tolerance);
			const hi = Math.min(last, nominal + tolerance);
			// Coarse search every 4 samples, then refine around the best match.
			let bestScore = -Infinity;
			for (let c = lo; c <= hi; c += 4) {
				const s = correlation(x, natural, c, hop, 2);
				if (s > bestScore) {
					bestScore = s;
					best = c;
				}
			}
			const coarse = best;
			for (let c = Math.max(lo, coarse - 3); c <= Math.min(hi, coarse + 3); c++) {
				const s = correlation(x, natural, c, hop, 1);
				if (s > bestScore) {
					bestScore = s;
					best = c;
				}
			}
		}
		const position = m * hop;
		for (let i = 0; i < size; i++) {
			out[position + i] += x[best + i] * window[i];
			weight[position + i] += window[i];
		}
		previous = best;
	}
	const result = new Float32Array(targetLength);
	for (let i = 0; i < targetLength; i++) result[i] = weight[i] > 1e-3 ? out[i] / weight[i] : 0;
	return result;
};
