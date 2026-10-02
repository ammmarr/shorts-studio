import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {headlineTokens, stripMarkup} from '../../shared/timeline';
import {useVideo} from '../context';

/** Picks a font size so short headlines are huge and long ones still fit. */
export const headlineSize = (text: string, sizes: [number, number, number, number]) => {
	const length = stripMarkup(text).length;
	if (length <= 18) return sizes[0];
	if (length <= 32) return sizes[1];
	if (length <= 50) return sizes[2];
	return sizes[3];
};

/** Headline whose words pop in one after another; `*word*` gets a highlighter stroke. */
export const AnimatedHeadline: React.FC<{
	text: string;
	fontSize: number;
	delay?: number;
	stagger?: number;
	color?: string;
	opacity?: number;
}> = ({text, fontSize, delay = 0, stagger = 3, color, opacity = 1}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, rtl} = useVideo();
	return (
		<div
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				justifyContent: 'center',
				columnGap: fontSize * 0.26,
				rowGap: fontSize * 0.08,
				fontSize,
				fontWeight: 800,
				lineHeight: 1.2,
				color: color ?? theme.text,
				opacity,
				textAlign: 'center',
			}}
		>
			{headlineTokens(text).map((segments, i) => {
				const s = spring({frame: frame - delay - i * stagger, fps, config: {damping: 13, stiffness: 170}});
				const marker = spring({frame: frame - delay - i * stagger - 6, fps, config: {damping: 20, stiffness: 120}});
				return (
					<span
						key={i}
						style={{
							display: 'inline-block',
							transform: `translateY(${(1 - s) * 44}px) scale(${0.85 + 0.15 * s})`,
							opacity: Math.min(1, s * 1.5),
						}}
					>
						{segments.map((segment, j) =>
							segment.em ? (
								<span key={j} style={{position: 'relative', color: theme.accent}}>
									<span
										style={{
											position: 'absolute',
											left: -8,
											right: -8,
											bottom: '6%',
											height: '34%',
											borderRadius: 10,
											background: theme.accentSoft,
											transform: `scaleX(${marker})`,
											transformOrigin: rtl ? 'right' : 'left',
											zIndex: -1,
										}}
									/>
									{segment.text}
								</span>
							) : (
								<React.Fragment key={j}>{segment.text}</React.Fragment>
							),
						)}
					</span>
				);
			})}
		</div>
	);
};
