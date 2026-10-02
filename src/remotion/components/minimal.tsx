import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {useVideo} from '../context';

// The motion vocabulary shared by the minimal templates: one easing, fades with a short rise,
// mask reveals and thin lines that draw in. Nothing bounces, rotates or overshoots.

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** 0→1 from frame `start` over `frames`, eased and clamped. */
export const ease = (frame: number, start: number, frames: number) =>
	interpolate(frame, [start, start + frames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE});

/** Fades its content in while it rises 32px. `instant` shows it fully from the first frame. */
export const FadeUp: React.FC<{
	delay?: number;
	frames?: number;
	distance?: number;
	instant?: boolean;
	style?: React.CSSProperties;
	children: React.ReactNode;
}> = ({delay = 0, frames = 14, distance = 32, instant = false, style, children}) => {
	const frame = useCurrentFrame();
	const p = instant ? 1 : ease(frame, delay, frames);
	return <div style={{...style, opacity: p, transform: `translateY(${(1 - p) * distance}px)`}}>{children}</div>;
};

/** Reveals its content from the top edge down as `progress` goes 0→1. */
export const MaskReveal: React.FC<{progress: number; style?: React.CSSProperties; children: React.ReactNode}> = ({progress, style, children}) => (
	<div style={{...style, clipPath: `inset(0 0 ${(1 - progress) * 100}% 0)`}}>{children}</div>
);

/** A thin line that draws in from the reading start (left, or right in Arabic). */
export const DrawLine: React.FC<{progress: number; color: string; thickness?: number; opacity?: number; style?: React.CSSProperties}> = ({
	progress,
	color,
	thickness = 3,
	opacity = 1,
	style,
}) => {
	const {rtl} = useVideo();
	return (
		<div
			style={{
				height: thickness,
				background: color,
				opacity,
				transform: `scaleX(${progress})`,
				transformOrigin: rtl ? 'right' : 'left',
				...style,
			}}
		/>
	);
};
