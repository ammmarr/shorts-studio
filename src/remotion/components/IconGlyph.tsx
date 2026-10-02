import React from 'react';
import {useVideo} from '../context';
import {iconFor} from '../icons';

const DRAWABLE = /<(path|circle|rect|line|polyline|polygon|ellipse)\s/g;

/**
 * Any Lucide icon. The drawing comes from the icon library (props.icons); curated icons fall back
 * to built-in components when the library isn't available. `draw` (0–1) animates the strokes
 * being drawn, as if by hand.
 */
export const IconGlyph: React.FC<{
	name: string;
	size: number;
	color: string;
	strokeWidth?: number;
	draw?: number;
	style?: React.CSSProperties;
}> = ({name, size, color, strokeWidth = 2, draw, style}) => {
	const {icons} = useVideo();
	const body = icons[name];
	if (body) {
		const offset = draw === undefined ? 0 : 1 - Math.min(1, Math.max(0, draw));
		const markup =
			offset > 0
				? body.replace(DRAWABLE, `<$1 pathLength="1" stroke-dasharray="1" stroke-dashoffset="${offset.toFixed(4)}" `)
				: body;
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				style={style}
				dangerouslySetInnerHTML={{__html: markup}}
			/>
		);
	}
	const Fallback = iconFor(name);
	const opacity = draw === undefined ? 1 : Math.min(1, Math.max(0, draw * 1.5));
	return <Fallback size={size} color={color} strokeWidth={strokeWidth} style={{opacity, ...style}} />;
};
