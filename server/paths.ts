import dotenv from 'dotenv';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({path: path.join(ROOT, '.env'), quiet: true});

export const PORT = Number(process.env.API_PORT ?? 3100);
export const PROD = process.argv.includes('--prod');

// DATA_DIR lets a test copy of the app run against its own data.
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
export const TRASH_DIR = path.join(DATA_DIR, 'trash');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');
export const RENDERS_DIR = path.join(DATA_DIR, 'renders');
export const TMP_DIR = path.join(DATA_DIR, 'tmp');
export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export const TOOLS_DIR = path.join(ROOT, 'tools');
export const WHISPER_DIR = path.join(TOOLS_DIR, 'whisper');
export const MODELS_DIR = path.join(TOOLS_DIR, 'models');
export const WHISPER_VERSION = process.env.WHISPER_VERSION ?? '1.9.2';
export const WHISPER_MODEL = process.env.WHISPER_MODEL ?? 'large-v3-turbo-q5_0';
export const modelPath = () => path.join(MODELS_DIR, `ggml-${WHISPER_MODEL}.bin`);

export const WEB_DIST = path.join(ROOT, 'dist', 'web');
export const REMOTION_ENTRY = path.join(ROOT, 'src', 'remotion', 'index.ts');

export const ensureDirs = () => {
	for (const dir of [PROJECTS_DIR, TRASH_DIR, MEDIA_DIR, RENDERS_DIR, TMP_DIR, WHISPER_DIR, MODELS_DIR]) {
		mkdirSync(dir, {recursive: true});
	}
};

/** Resolves `name` inside `dir`, refusing anything that would escape it. */
export const safeJoin = (dir: string, name: string) => {
	const resolved = path.resolve(dir, name);
	if (path.dirname(resolved) !== path.resolve(dir)) {
		throw new UserError('Invalid file name.');
	}
	return resolved;
};

/** An error whose message is safe and friendly enough to show in the app. */
export class UserError extends Error {
	constructor(
		message: string,
		readonly status = 400,
	) {
		super(message);
	}
}
