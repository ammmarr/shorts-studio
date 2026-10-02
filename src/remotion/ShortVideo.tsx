import React, {useMemo} from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, interpolate} from 'remotion';
import {layoutFor} from '../shared/layout';
import {THEMES} from '../shared/themes';
import {durationInFrames} from '../shared/timeline';
import type {TemplateId, VideoProps} from '../shared/types';
import {VideoContext} from './context';
import {fontFor} from './fonts';
import {CardsTemplate} from './templates/Cards';
import {EditorialTemplate} from './templates/Editorial';
import {KineticTemplate} from './templates/Kinetic';
import {PhotoTemplate} from './templates/PhotoStory';
import {PrescriptionTemplate} from './templates/Prescription';
import {QuizTemplate} from './templates/Quiz';
import {WhiteboardTemplate} from './templates/Whiteboard';

const TEMPLATES: Record<TemplateId, React.FC<{props: VideoProps}>> = {
	cards: CardsTemplate,
	whiteboard: WhiteboardTemplate,
	photo: PhotoTemplate,
	prescription: PrescriptionTemplate,
	kinetic: KineticTemplate,
	quiz: QuizTemplate,
	editorial: EditorialTemplate,
	};

export const ShortVideo: React.FC<VideoProps> = (props) => {
	const theme = THEMES[props.themeId] ?? THEMES.clinic;
	const rtl = props.language === 'ar';
	const total = durationInFrames(props);
	const icons = props.icons ?? {};
	// Bold words shows the spoken words itself, so the caption strip is off there.
	const captionPosition = props.templateId === 'kinetic' ? 'off' : (props.captionPosition ?? 'bottom');
	const context = useMemo(
		() => ({theme, lang: props.language, rtl, brand: props.brand, icons, layout: layoutFor(captionPosition), captionsOn: captionPosition !== 'off'}),
		[theme, props.language, rtl, props.brand, icons, captionPosition],
	);
	const Template = TEMPLATES[props.templateId] ?? CardsTemplate;
	const musicVolume = props.audioUrl ? 0.1 : 0.35;
	return (
		<VideoContext.Provider value={context}>
			<AbsoluteFill style={{fontFamily: fontFor(props.language), direction: rtl ? 'rtl' : 'ltr', color: theme.text}}>
				<Template props={props} />
				{/* @remotion/media's Audio works in both renderers: the server's and the phone's own. */}
				{props.audioUrl ? <Audio src={props.audioUrl} /> : null}
				{props.musicUrl ? (
					<Audio
						src={props.musicUrl}
						loop
						volume={(f) =>
							interpolate(f, [0, 15, total - 30, total], [0, musicVolume, musicVolume, 0], {
								extrapolateLeft: 'clamp',
								extrapolateRight: 'clamp',
							})
						}
					/>
				) : null}
			</AbsoluteFill>
		</VideoContext.Provider>
	);
};
