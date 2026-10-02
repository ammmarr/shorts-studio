import {UserError} from './paths';

export type Pcm = {sampleRate: number; channels: number; samples: Int16Array};

/** Reads a 16-bit PCM WAV file (what the browser uploads). */
export const parseWav = (buf: Buffer): Pcm => {
	if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
		throw new UserError('The recording is not a valid WAV file.');
	}
	let offset = 12;
	let format: {channels: number; sampleRate: number; bits: number; audioFormat: number} | null = null;
	while (offset + 8 <= buf.length) {
		const id = buf.toString('ascii', offset, offset + 4);
		const size = buf.readUInt32LE(offset + 4);
		const body = offset + 8;
		if (id === 'fmt ') {
			format = {
				audioFormat: buf.readUInt16LE(body),
				channels: buf.readUInt16LE(body + 2),
				sampleRate: buf.readUInt32LE(body + 4),
				bits: buf.readUInt16LE(body + 14),
			};
		} else if (id === 'data') {
			if (!format || format.audioFormat !== 1 || format.bits !== 16) {
				throw new UserError('Only 16-bit PCM WAV recordings are supported.');
			}
			const end = Math.min(buf.length, body + size);
			const samples = new Int16Array(Math.floor((end - body) / 2));
			for (let i = 0; i < samples.length; i++) {
				samples[i] = buf.readInt16LE(body + i * 2);
			}
			return {sampleRate: format.sampleRate, channels: format.channels, samples};
		}
		offset = body + size + (size % 2);
	}
	throw new UserError('The recording has no audio data.');
};

export const pcmDurationMs = (pcm: Pcm) => Math.round((pcm.samples.length / pcm.channels / pcm.sampleRate) * 1000);

/** Mono 16 kHz, which is what whisper.cpp needs. A box filter doubles as the anti-alias filter. */
export const toMono16k = (pcm: Pcm): Int16Array => {
	const frames = Math.floor(pcm.samples.length / pcm.channels);
	const mono = new Float32Array(frames);
	for (let i = 0; i < frames; i++) {
		let sum = 0;
		for (let c = 0; c < pcm.channels; c++) {
			sum += pcm.samples[i * pcm.channels + c];
		}
		mono[i] = sum / pcm.channels;
	}
	const ratio = pcm.sampleRate / 16000;
	const out = new Int16Array(Math.floor(frames / ratio));
	for (let i = 0; i < out.length; i++) {
		const from = Math.floor(i * ratio);
		const to = Math.min(frames, Math.max(from + 1, Math.floor((i + 1) * ratio)));
		let sum = 0;
		for (let j = from; j < to; j++) {
			sum += mono[j];
		}
		out[i] = Math.max(-32768, Math.min(32767, Math.round(sum / (to - from))));
	}
	return out;
};

export const encodeWav = (samples: Int16Array, sampleRate: number): Buffer => {
	const buf = Buffer.alloc(44 + samples.length * 2);
	buf.write('RIFF', 0, 'ascii');
	buf.writeUInt32LE(36 + samples.length * 2, 4);
	buf.write('WAVE', 8, 'ascii');
	buf.write('fmt ', 12, 'ascii');
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(sampleRate, 24);
	buf.writeUInt32LE(sampleRate * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36, 'ascii');
	buf.writeUInt32LE(samples.length * 2, 40);
	for (let i = 0; i < samples.length; i++) {
		buf.writeInt16LE(samples[i], 44 + i * 2);
	}
	return buf;
};
