import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {IconName} from '../../shared/icons';
import {IconGlyph} from './IconGlyph';

/** Round icon badge that bounces in, floats gently and sends out pulse rings. */
export const Medallion: React.FC<{
	icon: IconName;
	size: number;
	background: string;
	color: string;
	delay?: number;
	rings?: boolean;
	ringColor?: string;
}> = ({icon, size, background, color, delay = 0, rings = false, ringColor}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame: frame - delay, fps, config: {damping: 9, stiffness: 150}});
	const float = Math.sin((frame - delay) / 14) * 8;
	return (
		<div style={{position: 'relative', width: size, height: size, transform: `translateY(${float}px)`}}>
			{rings
				? [0, 1].map((n) => {
						const t = ((frame - delay + n * 30) % 60) / 60;
						return (
							<div
								key={n}
								style={{
									position: 'absolute',
									inset: 0,
									borderRadius: '50%',
									border: `6px solid ${ringColor ?? background}`,
									transform: `scale(${1 + t * 0.55})`,
									opacity: frame < delay ? 0 : interpolate(t, [0, 1], [0.55, 0]),
								}}
							/>
						);
					})
				: null}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					borderRadius: '50%',
					background,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					transform: `scale(${enter}) rotate(${(1 - enter) * -25}deg)`,
					boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
				}}
			>
				<IconGlyph name={icon} size={size * 0.52} color={color} strokeWidth={2.1} />
			</div>
		</div>
	);
};
