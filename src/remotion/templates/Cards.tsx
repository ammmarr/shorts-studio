import React from 'react';
import type {VideoProps} from '../../shared/types';
import {Background} from '../components/Background';
import {BrandBar} from '../components/BrandBar';
import {Captions} from '../components/Captions';
import {StoryProgress} from '../components/StoryProgress';
import {SceneView} from '../scenes/Scenes';
import {SceneSequences} from './shared';

/** The original style: animated cards with icons, sliding in scene by scene. */
export const CardsTemplate: React.FC<{props: VideoProps}> = ({props}) => (
	<>
		<Background />
		<SceneSequences scenes={props.scenes} render={(scene, _i, duration) => <SceneView scene={scene} duration={duration} />} />
		<BrandBar />
		<StoryProgress scenes={props.scenes} />
		<Captions pages={props.captions} />
	</>
);
