import {headlineTokens, type HeadlineSegment} from '../shared/timeline';

let context: CanvasRenderingContext2D | null = null;

/** Width in px of `text` in a CSS font like `700 96px "Caveat"`. */
export const measureText = (text: string, font: string) => {
	context ??= document.createElement('canvas').getContext('2d');
	if (!context) return text.length * 40;
	context.font = font;
	return context.measureText(text).width;
};

export type TextLine = {tokens: HeadlineSegment[][]; text: string; width: number};

const tokenText = (token: HeadlineSegment[]) => token.map((s) => s.text).join('');

/** Breaks a headline (with *emphasis*) into lines no wider than maxWidth. */
export const wrapHeadline = (headline: string, font: string, maxWidth: number): TextLine[] => {
	const lines: TextLine[] = [];
	let current: HeadlineSegment[][] = [];
	for (const token of headlineTokens(headline)) {
		const candidate = [...current, token].map(tokenText).join(' ');
		if (current.length > 0 && measureText(candidate, font) > maxWidth) {
			const text = current.map(tokenText).join(' ');
			lines.push({tokens: current, text, width: measureText(text, font)});
			current = [token];
		} else {
			current.push(token);
		}
	}
	if (current.length > 0) {
		const text = current.map(tokenText).join(' ');
		lines.push({tokens: current, text, width: measureText(text, font)});
	}
	return lines;
};
