import React from 'react';
import {Easing, interpolate, Sequence} from 'remotion';
import {msToFrame} from '../../shared/timeline';
import type {TimedScene} from '../../shared/types';

/** One <Sequence> per scene; `render` gets the scene, its index and its length in frames. */
export const SceneSequences: React.FC<{
	scenes: TimedScene[];
	render: (scene: TimedScene, index: number, duration: number) => React.ReactNode;
}> = ({scenes, render}) => (
	<>
		{scenes.map((scene, i) => {
			const from = msToFrame(scene.startMs);
			const duration = Math.max(1, msToFrame(scene.endMs) - from);
			return (
				<Sequence key={i} from={from} durationInFrames={duration} name={`${scene.kind} ${i + 1}`}>
					{render(scene, i, duration)}
				</Sequence>
			);
		})}
	</>
);

/** 0→1 between two frames, clamped, with an ease. */
export const progress = (frame: number, from: number, to: number, easing = Easing.out(Easing.cubic)) =>
	to <= from ? (frame >= to ? 1 : 0) : interpolate(frame, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});

/** Fades a scene out over its last frames. */
export const exitOpacity = (frame: number, duration: number, frames = 6) =>
	interpolate(frame, [duration - frames, duration], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
