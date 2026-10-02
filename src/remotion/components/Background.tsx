import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {useVideo} from '../context';

const CROSSES = Array.from({length: 16}, (_, i) => ({
	x: random(`cross-x-${i}`) * 1080,
	y: random(`cross-y-${i}`) * 2100,
	size: 26 + random(`cross-s-${i}`) * 34,
	speed: 0.25 + random(`cross-v-${i}`) * 0.5,
	spin: (random(`cross-r-${i}`) - 0.5) * 0.6,
	opacity: 0.06 + random(`cross-o-${i}`) * 0.07,
}));

const Cross: React.FC<{size: number; color: string}> = ({size, color}) => {
	const bar = size / 3;
	return (
		<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
			<rect x={bar} y={0} width={bar} height={size} rx={bar / 3} fill={color} />
			<rect x={0} y={bar} width={size} height={bar} rx={bar / 3} fill={color} />
		</svg>
	);
};

export const Background: React.FC = () => {
	const frame = useCurrentFrame();
	const {theme} = useVideo();
	return (
		<AbsoluteFill style={{background: `linear-gradient(180deg, ${theme.bgTop} 0%, ${theme.bgBottom} 100%)`, overflow: 'hidden'}}>
			<div
				style={{
					position: 'absolute',
					width: 1000,
					height: 1000,
					left: -320 + Math.sin(frame / 90) * 70,
					top: -260 + Math.cos(frame / 110) * 50,
					borderRadius: '50%',
					background: `radial-gradient(circle, ${theme.blobA} 0%, transparent 68%)`,
					opacity: 0.85,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					width: 1100,
					height: 1100,
					right: -380 + Math.cos(frame / 100) * 70,
					bottom: 120 + Math.sin(frame / 80) * 60,
					borderRadius: '50%',
					background: `radial-gradient(circle, ${theme.blobB} 0%, transparent 68%)`,
					opacity: 0.8,
				}}
			/>
			{CROSSES.map((c, i) => {
				const y = (((c.y - frame * c.speed) % 2100) + 2100) % 2100 - 100;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: c.x,
							top: y,
							opacity: c.opacity,
							transform: `rotate(${frame * c.spin}deg)`,
						}}
					>
						<Cross size={c.size} color={theme.pattern} />
					</div>
				);
			})}
		</AbsoluteFill>
	);
};
