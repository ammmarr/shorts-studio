import type {ThemeId} from './types';

/** A colour scheme for the videos. Display names live in the app's translations. */
export type Theme = {
	id: ThemeId;
	/** true for dark backgrounds (chalkboard look in the whiteboard template). */
	dark: boolean;
	bgTop: string;
	bgBottom: string;
	blobA: string;
	blobB: string;
	pattern: string;
	text: string;
	muted: string;
	card: string;
	cardBorder: string;
	shadow: string;
	accent: string;
	onAccent: string;
	accentSoft: string;
	accent2: string;
	onAccent2: string;
	myth: string;
	fact: string;
	captionBg: string;
	captionText: string;
	captionActiveBg: string;
	captionActiveText: string;
};

export const THEMES: Record<ThemeId, Theme> = {
	clinic: {
		id: 'clinic',
		dark: false,
		bgTop: '#F5FCFB',
		bgBottom: '#D7F0EC',
		blobA: '#A7E6DE',
		blobB: '#C4DCFF',
		pattern: '#0E9F9A',
		text: '#0F2A3A',
		muted: '#4A6373',
		card: '#FFFFFF',
		cardBorder: 'rgba(14,159,154,0.18)',
		shadow: 'rgba(15,42,58,0.14)',
		accent: '#0E9F9A',
		onAccent: '#FFFFFF',
		accentSoft: '#DDF5F2',
		accent2: '#2F6FED',
		onAccent2: '#FFFFFF',
		myth: '#E5484D',
		fact: '#16A34A',
		captionBg: 'rgba(255,255,255,0.94)',
		captionText: '#0F2A3A',
		captionActiveBg: '#0E9F9A',
		captionActiveText: '#FFFFFF',
	},
	bold: {
		id: 'bold',
		dark: true,
		bgTop: '#0B1026',
		bgBottom: '#1A1F45',
		blobA: '#3B2FD6',
		blobB: '#0FB5C9',
		pattern: '#7DD3FC',
		text: '#FFFFFF',
		muted: '#B9C1E8',
		card: '#171D3F',
		cardBorder: 'rgba(125,211,252,0.28)',
		shadow: 'rgba(0,0,0,0.45)',
		accent: '#FACC15',
		onAccent: '#111827',
		accentSoft: 'rgba(250,204,21,0.16)',
		accent2: '#22D3EE',
		onAccent2: '#0B1026',
		myth: '#FB7185',
		fact: '#4ADE80',
		captionBg: 'rgba(11,16,38,0.82)',
		captionText: '#FFFFFF',
		captionActiveBg: '#FACC15',
		captionActiveText: '#111827',
	},
	warm: {
		id: 'warm',
		dark: false,
		bgTop: '#FFF8F1',
		bgBottom: '#FFE1DA',
		blobA: '#FFC9B5',
		blobB: '#FFE6A8',
		pattern: '#F2703F',
		text: '#3A2320',
		muted: '#7A5A54',
		card: '#FFFFFF',
		cardBorder: 'rgba(242,112,63,0.2)',
		shadow: 'rgba(122,62,40,0.16)',
		accent: '#F2703F',
		onAccent: '#FFFFFF',
		accentSoft: '#FFE9DE',
		accent2: '#8B5CF6',
		onAccent2: '#FFFFFF',
		myth: '#E11D48',
		fact: '#15803D',
		captionBg: 'rgba(255,255,255,0.94)',
		captionText: '#3A2320',
		captionActiveBg: '#F2703F',
		captionActiveText: '#FFFFFF',
	},
	sky: {
		id: 'sky',
		dark: false,
		bgTop: '#F4F9FF',
		bgBottom: '#DCEBFF',
		blobA: '#B9D8FF',
		blobB: '#CDF3EE',
		pattern: '#2563EB',
		text: '#0B2545',
		muted: '#4A6282',
		card: '#FFFFFF',
		cardBorder: 'rgba(37,99,235,0.18)',
		shadow: 'rgba(11,37,69,0.14)',
		accent: '#2563EB',
		onAccent: '#FFFFFF',
		accentSoft: '#E0ECFF',
		accent2: '#0E9F9A',
		onAccent2: '#FFFFFF',
		myth: '#DC2626',
		fact: '#16A34A',
		captionBg: 'rgba(255,255,255,0.94)',
		captionText: '#0B2545',
		captionActiveBg: '#2563EB',
		captionActiveText: '#FFFFFF',
	},
	blush: {
		id: 'blush',
		dark: false,
		bgTop: '#FFF5F8',
		bgBottom: '#FCE1EA',
		blobA: '#F9C4D6',
		blobB: '#E4D4FF',
		pattern: '#BE185D',
		text: '#3B1330',
		muted: '#7A4E68',
		card: '#FFFFFF',
		cardBorder: 'rgba(190,24,93,0.18)',
		shadow: 'rgba(59,19,48,0.14)',
		accent: '#BE185D',
		onAccent: '#FFFFFF',
		accentSoft: '#FCE7F0',
		accent2: '#7C3AED',
		onAccent2: '#FFFFFF',
		myth: '#DC2626',
		fact: '#15803D',
		captionBg: 'rgba(255,255,255,0.94)',
		captionText: '#3B1330',
		captionActiveBg: '#BE185D',
		captionActiveText: '#FFFFFF',
	},
};

export const THEME_LIST = Object.values(THEMES);
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const TEMPLATE_IDS = ['cards', 'whiteboard', 'photo', 'prescription', 'kinetic', 'quiz', 'editorial'] as const;
export const CAPTION_POSITIONS = ['top', 'bottom', 'off'] as const;
export const VOICE_PITCHES = [-3, -1.5, 0, 1.5, 3] as const;
