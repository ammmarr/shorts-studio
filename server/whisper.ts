import {spawn} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import {readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {smoothWordTimings} from '../src/shared/timeline';
import type {Lang, Word} from '../src/shared/types';
import {modelPath, WHISPER_DIR, WHISPER_MODEL} from './paths';

const EXE_NAMES = process.platform === 'win32' ? ['whisper-cli.exe', 'main.exe'] : ['whisper-cli', 'main'];

const findFile = (dir: string, names: string[], depth = 4): string | null => {
	if (!existsSync(dir) || depth < 0) {
		return null;
	}
	const entries = readdirSync(dir, {withFileTypes: true});
	for (const name of names) {
		if (entries.some((e) => e.isFile() && e.name === name)) {
			return path.join(dir, name);
		}
	}
	for (const entry of entries) {
		if (entry.isDirectory()) {
			const found = findFile(path.join(dir, entry.name), names, depth - 1);
			if (found) {
				return found;
			}
		}
	}
	return null;
};

export const findWhisperExe = () => findFile(WHISPER_DIR, EXE_NAMES);

export const whisperStatus = (): {ready: boolean; problem: string | null} => {
	if (!findWhisperExe()) {
		return {ready: false, problem: 'Captions are not set up yet: run "npm run setup" once.'};
	}
	if (!existsSync(modelPath())) {
		return {ready: false, problem: `The caption model (${WHISPER_MODEL}) is missing: run "npm run setup" once.`};
	}
	return {ready: true, problem: null};
};

type WhisperJson = {transcription: {offsets: {from: number; to: number}; text: string}[]};

const NOISE = /^[[(].*[\])]$/; // [BLANK_AUDIO], (music), [Applause]
const PUNCTUATION_ONLY = /^[\p{P}\p{S}]+$/u;

/** Turns whisper's one-segment-per-word output into caption words. */
export const segmentsToWords = (json: WhisperJson, durationMs: number): Word[] => {
	const words: Word[] = [];
	for (const segment of json.transcription) {
		const text = segment.text.trim();
		if (!text || NOISE.test(text)) {
			continue;
		}
		const startMs = Math.min(segment.offsets.from, durationMs);
		const endMs = Math.min(Math.max(segment.offsets.to, startMs + 40), durationMs);
		if (PUNCTUATION_ONLY.test(text) && words.length > 0) {
			words[words.length - 1].text += text;
			continue;
		}
		words.push({text, startMs, endMs});
	}
	return smoothWordTimings(words);
};

/** Transcribes a 16 kHz mono WAV with word-level timings. */
export const transcribe = async (
	wavPath: string,
	lang: Lang,
	durationMs: number,
	onProgress: (p: number) => void,
): Promise<Word[]> => {
	const exe = findWhisperExe();
	const status = whisperStatus();
	if (!exe || !status.ready) {
		throw new Error(status.problem ?? 'Captions are not set up.');
	}
	const outBase = wavPath.replace(/\.wav$/, '');
	const threads = Math.max(2, Math.min(8, os.cpus().length - 1));
	const args = [
		'-m', modelPath(),
		'-f', wavPath,
		'-l', lang,
		'-t', String(threads),
		'-ml', '1', // one segment per word...
		'-sow', // ...split on whole words, so Arabic letters are never cut in half
		'-oj',
		'-of', outBase,
		'-pp',
	];
	await new Promise<void>((resolve, reject) => {
		const child = spawn(exe, args, {cwd: path.dirname(exe), windowsHide: true});
		let log = '';
		const onData = (data: Buffer) => {
			const text = data.toString('utf8');
			log = (log + text).slice(-4000);
			const match = [...text.matchAll(/progress\s*=\s*(\d+)%/g)].at(-1);
			if (match) {
				onProgress(Number(match[1]) / 100);
			}
		};
		child.stdout.on('data', onData);
		child.stderr.on('data', onData);
		child.on('error', reject);
		child.on('close', (code) => {
			if (existsSync(`${outBase}.json`)) {
				resolve();
			} else {
				reject(new Error(`Caption engine failed (exit code ${code}). ${log.slice(-600)}`));
			}
		});
	});
	const json = JSON.parse(await readFile(`${outBase}.json`, 'utf8')) as WhisperJson;
	await rm(`${outBase}.json`, {force: true});
	return segmentsToWords(json, durationMs);
};
