import {loadFont as loadCairo} from '@remotion/google-fonts/Cairo';
import {loadFont as loadCaveat} from '@remotion/google-fonts/Caveat';
import {loadFont as loadPoppins} from '@remotion/google-fonts/Poppins';
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import type {Lang} from '../shared/types';

// Arabic is always Cairo. English uses Poppins, and Caveat for the handwritten whiteboard style.
const cairo = loadCairo('normal', {weights: ['500', '700', '800', '900'], subsets: ['arabic', 'latin']});
const poppins = loadPoppins('normal', {weights: ['500', '600', '700', '800'], subsets: ['latin']});
const caveat = loadCaveat('normal', {weights: ['600', '700'], subsets: ['latin']});

export const fontFor = (lang: Lang) => (lang === 'ar' ? cairo.fontFamily : poppins.fontFamily);
export const handFontFor = (lang: Lang) => (lang === 'ar' ? cairo.fontFamily : caveat.fontFamily);

// Resolves when every face above has loaded. (document.fonts.check() can't be trusted here: it
// reports true for families whose @font-face hasn't been registered yet.)
const allFontsLoaded = Promise.all([cairo, poppins, caveat].map((f) => f.waitUntilDone())).catch(() => undefined);
let fontsLoaded = false;
void allFontsLoaded.then(() => {
	fontsLoaded = true;
});

/** True once the video fonts have loaded; holds the render until then. Needed for measured layouts. */
export const useFontsLoaded = () => {
	const [loaded, setLoaded] = useState(fontsLoaded);
	const [handle] = useState(() => (loaded ? null : delayRender('Loading fonts')));
	useEffect(() => {
		if (loaded) return;
		let cancelled = false;
		void allFontsLoaded.then(() => {
			if (cancelled) return;
			setLoaded(true);
			if (handle !== null) continueRender(handle);
		});
		return () => {
			cancelled = true;
		};
	}, [loaded, handle]);
	return loaded;
};
