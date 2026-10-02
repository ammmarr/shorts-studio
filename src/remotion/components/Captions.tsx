import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CaptionPage} from '../../shared/types';
import {msToFrame, stripMarkup} from '../../shared/timeline';
import {useVideo} from '../context';

// Captions read cleaner without commas and full stops; ? and ! stay.
const clean = (text: string) => stripMarkup(text).replace(/[.,،;:]+$/, '');

/** Word-by-word captions: one short line at a time, the spoken word highlighted. */
export const Captions: React.FC<{pages: CaptionPage[]}> = ({pages}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, lang, layout, captionsOn} = useVideo();
	const ms = (frame / fps) * 1000;
	const page = pages.find((p) => ms >= p.startMs && ms < p.endMs);
	if (!page || !captionsOn) {
		return null;
	}
	const enter = spring({frame: frame - msToFrame(page.startMs), fps, config: {damping: 15, stiffness: 220}});
	const fontSize = lang === 'ar' ? 66 : 60;
	return (
		<div
			style={{
				position: 'absolute',
				// Anchored at its top edge (top position) or bottom edge (bottom position), so a
				// second line grows away from the scene instead of into it.
				...(layout.captionTop !== null ? {top: layout.captionTop} : {bottom: 1920 - (layout.captionBottom ?? 1470)}),
				left: layout.left,
				right: layout.right,
				display: 'flex',
				justifyContent: 'center',
			}}
		>
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					justifyContent: 'center',
					gap: '4px 6px',
					padding: '18px 24px',
					borderRadius: 38,
					background: theme.captionBg,
					boxShadow: `0 14px 40px ${theme.shadow}`,
					transform: `scale(${0.9 + 0.1 * enter})`,
					opacity: Math.min(1, enter * 1.6),
				}}
			>
				{page.words.map((word, i) => {
					const next = page.words[i + 1];
					const active = ms >= word.startMs && ms < (next ? next.startMs : page.endMs);
					return (
						<span
							key={i}
							style={{
								fontSize,
								fontWeight: 800,
								lineHeight: 1.25,
								padding: '2px 14px',
								borderRadius: 20,
								background: active ? theme.captionActiveBg : 'transparent',
								color: active ? theme.captionActiveText : theme.captionText,
								transform: active ? 'scale(1.07)' : 'none',
							}}
						>
							{clean(word.text)}
						</span>
					);
				})}
			</div>
		</div>
	);
};
