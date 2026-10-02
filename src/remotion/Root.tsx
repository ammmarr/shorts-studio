import React from 'react';
import {Composition} from 'remotion';
import {durationInFrames, FPS, HEIGHT, WIDTH} from '../shared/timeline';
import {SAMPLE_PROPS} from './sample';
import {ShortVideo} from './ShortVideo';

export const RemotionRoot: React.FC = () => (
	<Composition
		id="Short"
		component={ShortVideo}
		width={WIDTH}
		height={HEIGHT}
		fps={FPS}
		durationInFrames={durationInFrames(SAMPLE_PROPS)}
		defaultProps={SAMPLE_PROPS}
		calculateMetadata={({props}) => ({durationInFrames: durationInFrames(props)})}
	/>
);
