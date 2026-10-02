import {Directory, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import type {RenderInfo} from '../shared/types';
import {readFile} from './local/files';
import {isLocalMode, isPhoneApp} from './platform';

const mimeType = (fileName: string) => (fileName.endsWith('.webm') ? 'video/webm' : 'video/mp4');

/** Whether this device can hand a video file to other apps (YouTube, WhatsApp, Drive…). */
export const canShareVideos = () => {
	if (isPhoneApp()) return true;
	try {
		return typeof navigator.canShare === 'function' && navigator.canShare({files: [new File([''], 'x.mp4', {type: 'video/mp4'})]});
	} catch {
		return false;
	}
};

const toBase64 = (blob: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});

/** Writes the video into the app's cache folder in pieces, so a big file doesn't fill the memory. */
const writeToCache = async (fileName: string, blob: Blob) => {
	// A multiple of 3 bytes, so every piece is valid base64 on its own.
	const PIECE = 3 * 1024 * 1024;
	for (let offset = 0; offset < blob.size; offset += PIECE) {
		const data = await toBase64(blob.slice(offset, offset + PIECE));
		if (offset === 0) await Filesystem.writeFile({path: fileName, data, directory: Directory.Cache});
		else await Filesystem.appendFile({path: fileName, data, directory: Directory.Cache});
	}
	return (await Filesystem.getUri({path: fileName, directory: Directory.Cache})).uri;
};

/** Opens the share sheet with the finished video. Resolves false if she backed out. */
export const shareVideo = async (render: RenderInfo, title: string): Promise<boolean> => {
	try {
		const blob = isLocalMode ? await readFile(render.url) : await fetch(render.url).then((r) => r.blob());
		if (isPhoneApp()) {
			const uri = await writeToCache(render.fileName, blob);
			await Share.share({title, files: [uri], dialogTitle: title});
			return true;
		}
		await navigator.share({files: [new File([blob], render.fileName, {type: mimeType(render.fileName)})], title});
		return true;
	} catch (e) {
		const message = String((e as Error).message ?? e).toLowerCase();
		if ((e as Error).name === 'AbortError' || message.includes('cancel')) return false;
		throw e;
	}
};
