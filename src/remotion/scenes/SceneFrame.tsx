import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {useVideo} from '../context';

/** Positions a scene in the scene area and fades it out during its last frames. */
export const SceneFrame: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
	const frame = useCurrentFrame();
	const {layout} = useVideo();
	const exit = interpolate(frame, [duration - 7, duration], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	return (
		<div
			style={{
				position: 'absolute',
				top: layout.sceneTop,
				height: layout.sceneHeight,
				left: layout.left,
				right: layout.right,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				opacity: exit,
				transform: `scale(${0.94 + 0.06 * exit})`,
			}}
		>
			{children}
		</div>
	);
};

export const Card: React.FC<{
	children: React.ReactNode;
	borderColor?: string;
	glow?: string;
	style?: React.CSSProperties;
}> = ({children, borderColor, glow, style}) => {
	const {theme} = useVideo();
	return (
		<div
			style={{
				position: 'relative',
				isolation: 'isolate',
				width: '100%',
				borderRadius: 56,
				padding: '64px 56px',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				background: theme.card,
				border: `4px solid ${borderColor ?? theme.cardBorder}`,
				boxShadow: `0 30px 80px ${theme.shadow}${glow ? `, 0 0 70px ${glow}` : ''}`,
				...style,
			}}
		>
			{children}
		</div>
	);
};

/** Small coloured label such as "MYTH" / "FACT". */
export const Tag: React.FC<{color: string; children: React.ReactNode}> = ({color, children}) => (
	<div
		style={{
			display: 'inline-flex',
			alignItems: 'center',
			gap: 14,
			padding: '10px 34px',
			borderRadius: 999,
			background: color,
			color: '#FFFFFF',
			fontSize: 44,
			fontWeight: 900,
			letterSpacing: 3,
		}}
	>
		{children}
	</div>
);
