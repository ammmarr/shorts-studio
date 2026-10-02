import {Directory, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {isPhoneApp} from './server';

/** Whether this device can hand a video file to other apps (YouTube, WhatsApp, Drive…). */
export const canShareVideos = () => {
	if (isPhoneApp()) return true;
	try {
		return typeof navigator.canShare === 'function' && navigator.canShare({files: [new File([''], 'x.mp4', {type: 'video/mp4'})]});
	} catch {
		return false;
	}
};

/** Opens the phone's share sheet with the finished video. Resolves false if she backed out. */
export const shareVideo = async (url: string, fileName: string, title: string): Promise<boolean> => {
	try {
		if (isPhoneApp()) {
			// The phone app downloads the video from the computer first, then shares the file.
			await Filesystem.downloadFile({url, path: fileName, directory: Directory.Cache});
			const {uri} = await Filesystem.getUri({path: fileName, directory: Directory.Cache});
			await Share.share({title, files: [uri], dialogTitle: title});
			return true;
		}
		const blob = await fetch(url).then((r) => r.blob());
		await navigator.share({files: [new File([blob], fileName, {type: 'video/mp4'})], title});
		return true;
	} catch (e) {
		const message = String((e as Error).message ?? e).toLowerCase();
		if ((e as Error).name === 'AbortError' || message.includes('cancel')) return false;
		throw e;
	}
};
