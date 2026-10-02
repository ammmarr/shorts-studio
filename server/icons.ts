import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bodiesFrom, ICON_SOURCES, ICONS_UNAVAILABLE, type IconLibrary, LUCIDE_VERSION, searchLibrary} from '../src/shared/iconLibrary';
import {DATA_DIR, UserError} from './paths';

export {nodesToBody} from '../src/shared/iconLibrary';

const CACHE_DIR = path.join(DATA_DIR, 'cache', `lucide-${LUCIDE_VERSION}`);

const cachedJson = async <T>(key: keyof typeof ICON_SOURCES): Promise<T> => {
	const file = path.join(CACHE_DIR, `${key}.json`);
	if (existsSync(file)) {
		return JSON.parse(await readFile(file, 'utf8')) as T;
	}
	const res = await fetch(ICON_SOURCES[key], {signal: AbortSignal.timeout(30_000)});
	if (!res.ok) {
		throw new Error(`Icon download failed (${res.status}): ${ICON_SOURCES[key]}`);
	}
	const text = await res.text();
	const data = JSON.parse(text) as T;
	await mkdir(CACHE_DIR, {recursive: true});
	await writeFile(file, text, 'utf8');
	return data;
};

let library: Promise<IconLibrary> | null = null;

export const loadIconLibrary = () => {
	library ??= (async () => {
		const [nodes, tags, categories] = await Promise.all([
			cachedJson<IconLibrary['nodes']>('nodes'),
			cachedJson<IconLibrary['tags']>('tags').catch(() => ({})),
			cachedJson<IconLibrary['categories']>('categories').catch(() => ({})),
		]);
		return {nodes, tags, categories};
	})().catch((error) => {
		library = null;
		throw error;
	});
	return library;
};

const loaded = () =>
	loadIconLibrary().catch(() => {
		throw new UserError(ICONS_UNAVAILABLE, 503);
	});

export const iconBodies = async (names: string[]) => bodiesFrom(await loaded(), names);

export const searchIcons = async (options: {query: string; category: string; limit: number}) => searchLibrary(await loaded(), options);
