import {spawn} from 'node:child_process';
import {RenderInternals} from '@remotion/renderer';
import {UserError} from './paths';

/**
 * The ffmpeg filter that moves a voice up or down by `semitones` without changing its speed:
 * play it faster (higher), resample back, then stretch it to its original length.
 */
export const pitchFilter = (semitones: number, sampleRate: number) => {
	const k = 2 ** (semitones / 12);
	return `asetrate=${Math.round(sampleRate * k)},aresample=${sampleRate},atempo=${(1 / k).toFixed(6)}`;
};

/** Writes a copy of the WAV at `input` with its pitch shifted, using the ffmpeg that ships with Remotion. */
export const shiftPitch = (input: string, output: string, semitones: number, sampleRate: number) =>
	new Promise<void>((resolve, reject) => {
		const ffmpeg = RenderInternals.getExecutablePath({type: 'ffmpeg', indent: false, logLevel: 'error', binariesDirectory: null});
		const args = ['-y', '-v', 'error', '-i', input, '-af', pitchFilter(semitones, sampleRate), '-ar', String(sampleRate), '-c:a', 'pcm_s16le', output];
		const child = spawn(ffmpeg, args, {windowsHide: true});
		let errors = '';
		child.stderr.on('data', (chunk) => {
			errors += chunk;
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			console.error('ffmpeg pitch shift failed:', errors.trim());
			reject(new UserError('Could not change the voice. Please try again.', 500));
		});
	});
