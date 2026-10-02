import {idbDelete, idbGet, idbKeys, idbPut} from './db';

// Files on the phone are stored under the same paths the server uses ("/media/photo-123.jpg",
// "/renders/my-short.mp4"), so projects look the same either way. Each stored file gets an object
// URL once, so pictures, the preview player and the renderer can use it straight away.

const urls = new Map<string, string>();

/** Makes every stored file available by URL. Blobs from storage are not read into memory. */
export const loadFiles = async () => {
	for (const path of await idbKeys('files')) {
		if (urls.has(path)) continue;
		const blob = await idbGet<Blob>('files', path);
		if (blob) urls.set(path, URL.createObjectURL(blob));
	}
};

/** The URL of a stored file, or null if there is none. */
export const fileUrl = (path: string) => urls.get(path) ?? null;

export const readFile = async (path: string) => {
	const blob = await idbGet<Blob>('files', path);
	if (!blob) throw new Error('The file was not found on this phone.');
	return blob;
};

export const saveFile = async (path: string, blob: Blob) => {
	await idbPut('files', path, blob);
	const old = urls.get(path);
	if (old) URL.revokeObjectURL(old);
	urls.set(path, URL.createObjectURL(blob));
	return path;
};

export const deleteFile = async (path: string | null | undefined) => {
	if (!path) return;
	await idbDelete('files', path);
	const old = urls.get(path);
	if (old) URL.revokeObjectURL(old);
	urls.delete(path);
};

let counter = 0;
/** A new, unique path like /media/photo-1790757067021.jpg. */
export const newMediaPath = (prefix: string, extension: string) => `/media/${prefix}-${Date.now()}${counter++ % 10}.${extension}`;
