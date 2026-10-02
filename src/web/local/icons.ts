import {bodiesFrom, ICON_SOURCES, ICONS_UNAVAILABLE, type IconLibrary, LUCIDE_VERSION, searchLibrary} from '../../shared/iconLibrary';
import {idbGet, idbPut} from './db';

// The phone downloads the Lucide library once (about 1.5 MB) and keeps it, like the server does.
const KEY = `iconLibrary-${LUCIDE_VERSION}`;

const fetchJson = async <T>(url: string): Promise<T> => {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Icon download failed (${res.status})`);
	return (await res.json()) as T;
};

let library: Promise<IconLibrary> | null = null;

const loadLibrary = () => {
	library ??= (async () => {
		const cached = await idbGet<IconLibrary>('kv', KEY);
		if (cached) return cached;
		const [nodes, tags, categories] = await Promise.all([
			fetchJson<IconLibrary['nodes']>(ICON_SOURCES.nodes),
			fetchJson<IconLibrary['tags']>(ICON_SOURCES.tags).catch(() => ({})),
			fetchJson<IconLibrary['categories']>(ICON_SOURCES.categories).catch(() => ({})),
		]);
		const fresh = {nodes, tags, categories};
		await idbPut('kv', KEY, fresh);
		return fresh;
	})().catch(() => {
		library = null;
		throw new Error(ICONS_UNAVAILABLE);
	});
	return library;
};

export const searchIcons = async (query: string, category: string, limit: number) => searchLibrary(await loadLibrary(), {query, category, limit});

export const iconBodies = async (names: string[]) => bodiesFrom(await loadLibrary(), names);
