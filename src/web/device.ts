import {KeepAwake} from '@capacitor-community/keep-awake';
import {useEffect, useState} from 'react';
import {isPhoneApp} from './platform';

/** Short vibration for tactile feedback on Android; silently ignored elsewhere. */
export const haptic = (pattern: number | number[] = 12) => {
	try {
		navigator.vibrate?.(pattern);
	} catch {
		// not supported
	}
};

const MOBILE_QUERY = '(max-width: 760px)';

export const useIsMobile = () => {
	const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
	useEffect(() => {
		const media = window.matchMedia(MOBILE_QUERY);
		const onChange = () => setMobile(media.matches);
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}, []);
	return mobile;
};

/** Keeps the screen on while `active` (recording, rendering). */
export const useWakeLock = (active: boolean) => {
	useEffect(() => {
		// The phone app's web view has no wake lock of its own; the native plugin does it.
		if (active && isPhoneApp()) {
			void KeepAwake.keepAwake().catch(() => undefined);
			return () => void KeepAwake.allowSleep().catch(() => undefined);
		}
		if (!active || !('wakeLock' in navigator)) return;
		let lock: WakeLockSentinel | null = null;
		let cancelled = false;
		const request = () => {
			navigator.wakeLock
				.request('screen')
				.then((l) => {
					if (cancelled) void l.release();
					else lock = l;
				})
				.catch(() => undefined);
		};
		// The lock is dropped when the app goes to the background; take it again on return.
		const onVisible = () => document.visibilityState === 'visible' && request();
		request();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', onVisible);
			void lock?.release();
		};
	}, [active]);
};

/**
 * Marks <body> while the on-screen keyboard is likely open (a text field has focus), so fixed
 * bottom bars can step out of the way.
 */
export const useTypingClass = () => {
	useEffect(() => {
		const isTextField = (el: EventTarget | null) =>
			el instanceof HTMLTextAreaElement ||
			(el instanceof HTMLInputElement && !['checkbox', 'radio', 'file', 'button', 'range'].includes(el.type));
		const onIn = (e: FocusEvent) => isTextField(e.target) && document.body.classList.add('typing');
		const onOut = () => document.body.classList.remove('typing');
		document.addEventListener('focusin', onIn);
		document.addEventListener('focusout', onOut);
		return () => {
			document.removeEventListener('focusin', onIn);
			document.removeEventListener('focusout', onOut);
		};
	}, []);
};
