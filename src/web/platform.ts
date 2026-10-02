import {Capacitor} from '@capacitor/core';

/** True inside the Android app (Capacitor); false in a browser. */
export const isPhoneApp = () => Capacitor.isNativePlatform();

const LOCAL_FLAG = 'tabeba.local';

/**
 * Whether everything (storage, captions, voice, rendering, AI) runs on this device instead of on
 * the computer's server. Always so in the phone app. In a browser, `?local=1` switches it on for
 * trying the phone version on a computer, and `?local=0` switches it back off.
 */
export const isLocalMode: boolean = (() => {
	if (isPhoneApp()) return true;
	try {
		const query = new URLSearchParams(window.location.search).get('local');
		if (query === '1') localStorage.setItem(LOCAL_FLAG, '1');
		if (query === '0') localStorage.removeItem(LOCAL_FLAG);
		return localStorage.getItem(LOCAL_FLAG) === '1';
	} catch {
		return false;
	}
})();
