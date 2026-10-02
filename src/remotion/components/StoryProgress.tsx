import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {TimedScene} from '../../shared/types';
import {useVideo} from '../context';

/** Instagram-story style segments: one per scene, filling as the scene plays. */
export const StoryProgress: React.FC<{scenes: TimedScene[]}> = ({scenes}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, layout} = useVideo();
	const ms = (frame / fps) * 1000;
	return (
		<div
			style={{
				position: 'absolute',
				top: layout.progressTop,
				left: layout.left + 20,
				right: layout.right + 20,
				display: 'flex',
				gap: 12,
			}}
		>
			{scenes.map((scene, i) => {
				const progress = Math.min(1, Math.max(0, (ms - scene.startMs) / (scene.endMs - scene.startMs)));
				return (
					<div
						key={i}
						style={{
							flex: 1,
							height: 10,
							borderRadius: 5,
							background: theme.text,
							position: 'relative',
							overflow: 'hidden',
						}}
					>
						<div style={{position: 'absolute', inset: 0, background: theme.bgTop, opacity: 0.8}} />
						<div
							style={{
								position: 'absolute',
								top: 0,
								bottom: 0,
								insetInlineStart: 0,
								width: `${progress * 100}%`,
								background: theme.accent,
							}}
						/>
					</div>
				);
			})}
		</div>
	);
};
