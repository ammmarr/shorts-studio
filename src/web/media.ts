import {fileUrl} from './local/files';
import {isLocalMode} from './platform';

/**
 * Where a stored file (/media/…, /renders/…) can be loaded from on this device: the server path
 * in a browser on the computer, the stored file itself in the phone app.
 */
export const mediaUrl = <T extends string | null | undefined>(path: T): T =>
	(isLocalMode && typeof path === 'string' && path.startsWith('/') ? (fileUrl(path) ?? '') : path) as T;

/** For building video props: stored files resolved on the phone, paths kept as they are otherwise. */
export const resolveMedia = isLocalMode ? (path: string) => fileUrl(path) : undefined;
