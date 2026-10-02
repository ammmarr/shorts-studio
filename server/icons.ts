import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ICON_ALIASES, ICONS, isCuratedIcon} from '../src/shared/icons';
import {iconSearchTerms} from '../src/shared/iconKeywords';
import {DATA_DIR, UserError} from './paths';

// The full Lucide icon set (~1,850 icons) is downloaded once from the jsDelivr CDN and cached on
// disk, so nothing extra is installed or bundled into the app. Categories come from lucide.dev.
const VERSION = '1.48.0';
const CACHE_DIR = path.join(DATA_DIR, 'cache', `lucide-${VERSION}`);
const SOURCES = {
	nodes: `https://cdn.jsdelivr.net/npm/lucide-static@${VERSION}/icon-nodes.json`,
	tags: `https://cdn.jsdelivr.net/npm/lucide-static@${VERSION}/tags.json`,
	categories: 'https://lucide.dev/api/categories',
};

type IconNode = [string, Record<string, string | number>];
type Library = {
	nodes: Record<string, IconNode[]>;
	tags: Record<string, string[]>;
	categories: Record<string, string[]>;
};

const cachedJson = async <T>(key: keyof typeof SOURCES): Promise<T> => {
	const file = path.join(CACHE_DIR, `${key}.json`);
	if (existsSync(file)) {
		return JSON.parse(await readFile(file, 'utf8')) as T;
	}
	const res = await fetch(SOURCES[key], {signal: AbortSignal.timeout(30_000)});
	if (!res.ok) {
		throw new Error(`Icon download failed (${res.status}): ${SOURCES[key]}`);
	}
	const text = await res.text();
	const data = JSON.parse(text) as T;
	await mkdir(CACHE_DIR, {recursive: true});
	await writeFile(file, text, 'utf8');
	return data;
};

let library: Promise<Library> | null = null;

export const loadIconLibrary = () => {
	library ??= (async () => {
		const [nodes, tags, categories] = await Promise.all([
			cachedJson<Library['nodes']>('nodes'),
			cachedJson<Library['tags']>('tags').catch(() => ({})),
			cachedJson<Library['categories']>('categories').catch(() => ({})),
		]);
		return {nodes, tags, categories};
	})().catch((error) => {
		library = null;
		throw error;
	});
	return library;
};

const ALLOWED_TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
// Only geometry and paint attributes: the markup is injected into pages, so nothing else passes.
const ALLOWED_ATTRIBUTES = new Set([
	'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'points',
	'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity',
]);
const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Turns Lucide's node list into the inner markup of a 24x24 stroke SVG. */
export const nodesToBody = (nodes: IconNode[]) =>
	nodes
		.filter(([tag]) => ALLOWED_TAGS.has(tag))
		.map(([tag, attrs]) => {
			const attributes = Object.entries(attrs)
				.filter(([key]) => ALLOWED_ATTRIBUTES.has(key))
				.map(([key, value]) => `${key}="${escapeAttr(String(value))}"`)
				.join(' ');
			return `<${tag} ${attributes}/>`;
		})
		.join('');

const unavailable = () =>
	new UserError('The icon library could not be downloaded. Check the internet connection and try again.', 503);

export const iconBodies = async (names: string[]): Promise<Record<string, string>> => {
	const {nodes} = await loadIconLibrary().catch(() => {
		throw unavailable();
	});
	const out: Record<string, string> = {};
	for (const name of new Set(names)) {
		const node = nodes[name] ?? nodes[ICON_ALIASES[name]];
		if (node) out[name] = nodesToBody(node);
	}
	return out;
};

const CURATED_KEYWORDS = new Map<string, string>(ICONS.map(([name, words]) => [name, words]));

const score = (name: string, tags: string[], categories: string[], term: string) => {
	if (name === term) return 100;
	if (name.startsWith(term)) return 70;
	if (name.split('-').includes(term)) return 60;
	if (name.includes(term)) return 45;
	if (tags.includes(term)) return 40;
	if (CURATED_KEYWORDS.get(name)?.split(' ').includes(term)) return 40;
	if (tags.some((t) => t.startsWith(term))) return 25;
	if (categories.includes(term)) return 15;
	return 0;
};

export type IconHit = {name: string; body: string};

/** Searches names, tags and categories. Arabic queries are mapped to English terms first. */
export const searchIcons = async (options: {query: string; category: string; limit: number}) => {
	const lib = await loadIconLibrary().catch(() => {
		throw unavailable();
	});
	const terms = iconSearchTerms(options.query);
	const names = Object.keys(lib.nodes);
	let ranked: {name: string; score: number}[];
	if (terms.length > 0) {
		ranked = names
			.map((name) => {
				const best = Math.max(...terms.map((t) => score(name, lib.tags[name] ?? [], lib.categories[name] ?? [], t)));
				return {name, score: best > 0 && isCuratedIcon(name) ? best + 5 : best};
			})
			.filter((hit) => hit.score > 0)
			.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
	} else if (options.category === 'health' || !options.category) {
		ranked = ICONS.map(([name]) => ({name, score: 1}));
	} else {
		ranked = names.filter((name) => lib.categories[name]?.includes(options.category)).map((name) => ({name, score: 1}));
	}
	const icons: IconHit[] = ranked
		.slice(0, options.limit)
		.filter((hit) => lib.nodes[hit.name])
		.map((hit) => ({name: hit.name, body: nodesToBody(lib.nodes[hit.name])}));
	return {total: ranked.length, icons, librarySize: names.length};
};
