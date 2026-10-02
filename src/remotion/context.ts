import {createContext, useContext} from 'react';
import {type Layout, layoutFor} from '../shared/layout';
import {THEMES, type Theme} from '../shared/themes';
import type {Lang, VideoProps} from '../shared/types';

export type VideoContextValue = {
	theme: Theme;
	lang: Lang;
	rtl: boolean;
	brand: VideoProps['brand'];
	/** SVG bodies of the icons in use (see IconGlyph). */
	icons: Record<string, string>;
	/** Positions inside YouTube's safe zone, arranged around the captions. */
	layout: Layout;
	captionsOn: boolean;
};

export const VideoContext = createContext<VideoContextValue>({
	theme: THEMES.clinic,
	lang: 'en',
	rtl: false,
	brand: {doctorName: '', handle: '', logoUrl: null, endCardText: '', showDisclaimer: false},
	icons: {},
	layout: layoutFor('bottom'),
	captionsOn: true,
});

export const useVideo = () => useContext(VideoContext);
