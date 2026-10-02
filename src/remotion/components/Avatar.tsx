import React from 'react';
import {Img} from 'remotion';
import {useVideo} from '../context';

const initials = (name: string) => {
	const words = name
		.replace(/^(dr\.?|د\.?)\s*/i, '')
		.split(/\s+/)
		.filter(Boolean);
	return words
		.slice(0, 2)
		.map((w) => Array.from(w)[0])
		.join('')
		.toUpperCase();
};

export const Avatar: React.FC<{size: number; ring?: number}> = ({size, ring = 0}) => {
	const {theme, brand} = useVideo();
	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: '50%',
				overflow: 'hidden',
				flexShrink: 0,
				background: theme.accent,
				color: theme.onAccent,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontSize: size * 0.4,
				fontWeight: 800,
				boxShadow: ring ? `0 0 0 ${ring}px ${theme.card}` : undefined,
			}}
		>
			{brand.logoUrl ? (
				<Img src={brand.logoUrl} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
			) : (
				initials(brand.doctorName) || '+'
			)}
		</div>
	);
};
