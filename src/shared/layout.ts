import type {CaptionPosition} from './types';

/**
 * YouTube Shorts covers parts of the 1080x1920 frame with its own buttons: search and menu icons
 * along the top, the like/comment/share column on the right (on the left for viewers whose
 * YouTube is in Arabic), and the title, channel name and Subscribe button along the bottom.
 * Everything important stays inside this box, which is centred so both sides are clear.
 */
export const SAFE_ZONE = {top: 190, bottom: 1470, left: 150, right: 930} as const;

/** The areas YouTube covers (x, y, width, height); `side` is mirrored to the left in Arabic. */
export const YOUTUBE_OVERLAYS = {
	top: {x: 0, y: 0, w: 1080, h: 170},
	side: {x: 950, y: 820, w: 130, h: 900},
	sideRtl: {x: 0, y: 820, w: 130, h: 900},
	bottom: {x: 0, y: 1490, w: 1080, h: 430},
} as const;

export type Layout = {
	brandTop: number;
	progressTop: number;
	sceneTop: number;
	sceneHeight: number;
	/** Where caption lines start (top position) or end (bottom position); null when captions are off. */
	captionTop: number | null;
	captionBottom: number | null;
	/** Distance from the left and right edges of the frame. */
	left: number;
	right: number;
	width: number;
	centerX: number;
};

const CONTENT_TOP = 340;
const CAPTION_ROOM = 220;

/** Where the brand bar, scene content and captions go for a given caption position. */
export const layoutFor = (position: CaptionPosition): Layout => {
	const base = {
		brandTop: SAFE_ZONE.top,
		progressTop: 300,
		left: SAFE_ZONE.left,
		right: 1080 - SAFE_ZONE.right,
		width: SAFE_ZONE.right - SAFE_ZONE.left,
		centerX: (SAFE_ZONE.left + SAFE_ZONE.right) / 2,
	};
	if (position === 'top') {
		const sceneTop = CONTENT_TOP + CAPTION_ROOM;
		return {...base, captionTop: CONTENT_TOP - 10, captionBottom: null, sceneTop, sceneHeight: SAFE_ZONE.bottom - sceneTop};
	}
	if (position === 'off') {
		return {...base, captionTop: null, captionBottom: null, sceneTop: CONTENT_TOP, sceneHeight: SAFE_ZONE.bottom - CONTENT_TOP};
	}
	return {
		...base,
		captionTop: null,
		captionBottom: SAFE_ZONE.bottom,
		sceneTop: CONTENT_TOP,
		sceneHeight: SAFE_ZONE.bottom - CAPTION_ROOM - CONTENT_TOP - 20,
	};
};
