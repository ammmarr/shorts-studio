const RATE = 48000;
const WINDOW = Math.round(RATE * 0.02);

/** Scales the recording so its loudest moment sits just under full volume (at most 6x louder). */
const normalize = (data: Float32Array) => {
	let peak = 0;
	for (let i = 0; i < data.length; i++) {
		peak = Math.max(peak, Math.abs(data[i]));
	}
	if (peak === 0) {
		return;
	}
	const gain = Math.min(6, 0.89 / peak);
	for (let i = 0; i < data.length; i++) {
		data[i] *= gain;
	}
};

/** Cuts the silence before she starts talking and after she stops, so the hook lands at 0s. */
export const trimSilence = (data: Float32Array, rate = RATE): Float32Array => {
	const windows = Math.floor(data.length / WINDOW);
	const loud = (w: number) => {
		let sum = 0;
		for (let i = w * WINDOW; i < (w + 1) * WINDOW; i++) {
			sum += data[i] * data[i];
		}
		return Math.sqrt(sum / WINDOW) > 0.025;
	};
	let first = 0;
	while (first < windows && !loud(first)) first++;
	let last = windows - 1;
	while (last > first && !loud(last)) last--;
	if (first >= windows) {
		return data;
	}
	const start = Math.max(0, first * WINDOW - Math.round(rate * 0.15));
	const end = Math.min(data.length, (last + 1) * WINDOW + Math.round(rate * 0.35));
	return data.slice(start, end);
};

export const encodeWav = (data: Float32Array, rate: number) => {
	const buffer = new ArrayBuffer(44 + data.length * 2);
	const view = new DataView(buffer);
	const text = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
	};
	text(0, 'RIFF');
	view.setUint32(4, 36 + data.length * 2, true);
	text(8, 'WAVE');
	text(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, rate, true);
	view.setUint32(28, rate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	text(36, 'data');
	view.setUint32(40, data.length * 2, true);
	for (let i = 0; i < data.length; i++) {
		const s = Math.max(-1, Math.min(1, data[i]));
		view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
	}
	return new Blob([buffer], {type: 'audio/wav'});
};

/**
 * Turns any recording the browser can play (webm from the mic, m4a/mp3 from a phone) into a
 * clean mono 48 kHz WAV: silence trimmed, volume evened out.
 */
export const toCleanWav = async (recording: Blob): Promise<{wav: Blob; durationMs: number}> => {
	const context = new AudioContext();
	let decoded: AudioBuffer;
	try {
		decoded = await context.decodeAudioData(await recording.arrayBuffer());
	} catch {
		throw new Error('This file could not be read as audio. Try an MP3, M4A or WAV file.');
	} finally {
		void context.close();
	}
	const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
	const source = offline.createBufferSource();
	source.buffer = decoded;
	source.connect(offline.destination);
	source.start();
	const mono = (await offline.startRendering()).getChannelData(0);
	normalize(mono);
	const trimmed = trimSilence(mono);
	return {wav: encodeWav(trimmed, RATE), durationMs: Math.round((trimmed.length / RATE) * 1000)};
};

/** Reads a 16-bit PCM WAV (as made by toCleanWav) back into mono samples. */
export const decodeWav = async (wav: Blob): Promise<{samples: Float32Array; sampleRate: number}> => {
	const view = new DataView(await wav.arrayBuffer());
	const tag = (offset: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(offset + i)));
	if (view.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
		throw new Error('The recording is not a valid WAV file.');
	}
	let channels = 1;
	let sampleRate = RATE;
	let bits = 16;
	let offset = 12;
	while (offset + 8 <= view.byteLength) {
		const size = view.getUint32(offset + 4, true);
		const body = offset + 8;
		if (tag(offset) === 'fmt ') {
			channels = view.getUint16(body + 2, true);
			sampleRate = view.getUint32(body + 4, true);
			bits = view.getUint16(body + 14, true);
		} else if (tag(offset) === 'data') {
			if (bits !== 16) throw new Error('Only 16-bit PCM WAV recordings are supported.');
			const frames = Math.floor(Math.min(size, view.byteLength - body) / (2 * channels));
			const samples = new Float32Array(frames);
			for (let i = 0; i < frames; i++) {
				let sum = 0;
				for (let c = 0; c < channels; c++) sum += view.getInt16(body + (i * channels + c) * 2, true);
				samples[i] = sum / channels / 32768;
			}
			return {samples, sampleRate};
		}
		offset = body + size + (size % 2);
	}
	throw new Error('The recording has no audio data.');
};
