import React from 'react';
import {Img, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useVideo} from '../context';

/**
 * A card's own photo: rounded, popping in, with a slow zoom so a still picture feels alive.
 * `dim` (0–1) greys it out, used when a myth is crossed out.
 */
export const Photo: React.FC<{src: string; height: number; radius?: number; delay?: number; dim?: number; tilt?: number}> = ({
	src,
	height,
	radius = 40,
	delay = 0,
	dim = 0,
	tilt = 0,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme} = useVideo();
	const enter = spring({frame: frame - delay, fps, config: {damping: 14, stiffness: 140}});
	return (
		<div
			style={{
				position: 'relative',
				width: '100%',
				height,
				borderRadius: radius,
				overflow: 'hidden',
				background: theme.accentSoft,
				boxShadow: `0 24px 60px ${theme.shadow}`,
				transform: `scale(${0.9 + 0.1 * enter}) rotate(${tilt}deg)`,
				opacity: Math.min(1, enter * 1.5),
				flexShrink: 0,
			}}
		>
			<Img
				src={src}
				// A missing photo must not stop the whole video from rendering.
				onError={() => undefined}
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'cover',
					transform: `scale(${1.04 + frame * 0.0011})`,
					filter: dim > 0 ? `grayscale(${dim}) brightness(${1 - dim * 0.2})` : undefined,
				}}
			/>
		</div>
	);
};
