import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useVideo} from '../context';
import {Avatar} from './Avatar';

export const BrandBar: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, brand, layout} = useVideo();
	if (!brand.doctorName && !brand.handle) {
		return null;
	}
	const enter = spring({frame, fps, config: {damping: 16, stiffness: 140}});
	return (
		<div
			style={{
				position: 'absolute',
				top: layout.brandTop,
				left: layout.left,
				right: layout.right,
				display: 'flex',
				justifyContent: 'center',
				transform: `translateY(${(1 - enter) * -60}px)`,
				opacity: enter,
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 18,
					paddingTop: 10,
					paddingBottom: 10,
					paddingInlineStart: 10,
					paddingInlineEnd: 34,
					borderRadius: 999,
					background: theme.card,
					border: `2px solid ${theme.cardBorder}`,
					boxShadow: `0 10px 30px ${theme.shadow}`,
				}}
			>
				<Avatar size={70} />
				<div style={{display: 'flex', flexDirection: 'column', lineHeight: 1.15}}>
					{brand.doctorName ? (
						<span style={{fontSize: 36, fontWeight: 800, color: theme.text}}>{brand.doctorName}</span>
					) : null}
					{brand.handle ? (
						<span style={{fontSize: 26, fontWeight: 600, color: theme.muted, direction: 'ltr', unicodeBidi: 'isolate'}}>
							{brand.handle}
						</span>
					) : null}
				</div>
			</div>
		</div>
	);
};
