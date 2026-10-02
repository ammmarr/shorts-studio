import {Capacitor} from '@capacitor/core';

/**
 * In a browser the app is served by its own server, so every path is relative. The phone app
 * (APK) carries the screens inside it and talks to the computer running the server over Wi-Fi,
 * at an address she types in once.
 */
export const isPhoneApp = () => Capacitor.isNativePlatform();

const KEY = 'tabeba.server';

export const getServer = (): string => {
	if (!isPhoneApp()) return '';
	try {
		return localStorage.getItem(KEY) ?? '';
	} catch {
		return '';
	}
};

export const setServer = (address: string) => {
	try {
		if (address) localStorage.setItem(KEY, address);
		else localStorage.removeItem(KEY);
	} catch {
		// storage unavailable: she will be asked again next time
	}
};

/** Full URL for a server path (/api/…, /media/…, /renders/…); other URLs are returned as they are. */
export const serverUrl = <T extends string | null | undefined>(path: T): T =>
	(typeof path === 'string' && path.startsWith('/') ? getServer() + path : path) as T;

export const DEFAULT_PORT = '3100';

/** Turns what she typed ("192.168.1.5", "192.168.1.5:3100/", "http://…") into an origin. */
export const normalizeServer = (input: string): string | null => {
	let text = input.trim().replace(/\s+/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[،,٫]/g, '.');
	if (!text) return null;
	if (!/^https?:\/\//i.test(text)) text = `http://${text}`;
	try {
		const url = new URL(text);
		if (!url.port && url.protocol === 'http:') url.port = DEFAULT_PORT;
		return url.origin;
	} catch {
		return null;
	}
};

/** Checks that a Tabeba's workspace server answers at `origin`. */
export const pingServer = async (origin: string) => {
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), 5000);
	try {
		const res = await fetch(`${origin}/api/health`, {signal: controller.signal});
		const data = (await res.json()) as {ok?: boolean};
		return res.ok && data.ok === true;
	} catch {
		return false;
	} finally {
		window.clearTimeout(timer);
	}
};
