import {BellRing} from 'lucide-react';
import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {formatNumber, VIDEO_STRINGS} from '../../shared/strings';
import type {TimedScene, VideoProps} from '../../shared/types';
import {AnimatedHeadline, headlineSize} from '../components/AnimatedHeadline';
import {Avatar} from '../components/Avatar';
import {BrandBar} from '../components/BrandBar';
import {Captions} from '../components/Captions';
import {IconGlyph} from '../components/IconGlyph';
import {StoryProgress} from '../components/StoryProgress';
import {useVideo} from '../context';
import {exitOpacity, SceneSequences} from './shared';

/** Full-screen photo with a slow zoom and drift (the "Ken Burns" effect), alternating direction per card. */
const Backdrop: React.FC<{scene: TimedScene; index: number; duration: number}> = ({scene, index, duration}) => {
	const frame = useCurrentFrame();
	const {theme} = useVideo();
	const t = Math.min(1, frame / Math.max(1, duration));
	const zoomIn = index % 2 === 0;
	const scale = zoomIn ? 1.08 + t * 0.12 : 1.2 - t * 0.12;
	const drift = (index % 3 === 0 ? -1 : 1) * t * 40;
	if (!scene.image) {
		return (
			<AbsoluteFill style={{background: `linear-gradient(160deg, ${theme.bgTop}, ${theme.bgBottom})`, overflow: 'hidden'}}>
				<div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.16, transform: `scale(${scale})`}}>
					<IconGlyph name={scene.icon} size={900} color={theme.accent} strokeWidth={1.4} />
				</div>
			</AbsoluteFill>
		);
	}
	return (
		<AbsoluteFill style={{overflow: 'hidden', background: '#000'}}>
			<Img src={scene.image} onError={() => undefined} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translateX(${drift}px)`}} />
			{/* darken the top and bottom so the brand bar and text stay readable */}
			<AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.6) 100%)'}} />
		</AbsoluteFill>
	);
};

const Chip: React.FC<{color: string; children: React.ReactNode}> = ({color, children}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {lang} = useVideo();
	const pop = spring({frame: frame - 4, fps, config: {damping: 10, stiffness: 200}});
	return (
		<div style={{alignSelf: 'center', padding: '10px 30px', borderRadius: 999, background: color, color: '#FFFFFF', fontSize: 38, fontWeight: 900, letterSpacing: lang === 'ar' ? 0 : 2, transform: `scale(${pop})`}}>
			{children}
		</div>
	);
};

const PhotoScene: React.FC<{scene: TimedScene; index: number; duration: number}> = ({scene, index, duration}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, lang, layout, brand} = useVideo();
	const strings = VIDEO_STRINGS[lang];
	const fadeIn = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
	const exit = exitOpacity(frame, duration);
	const panel = spring({frame: frame - 3, fps, config: {damping: 14, stiffness: 150}});
	const strikeAt = Math.max(14, duration * 0.4);
	const strike = interpolate(frame, [strikeAt, strikeAt + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const label =
		scene.kind === 'point'
			? {text: `${strings.tip} ${scene.number !== null ? formatNumber(scene.number, lang) : ''}`, color: theme.accent}
			: scene.kind === 'myth'
				? {text: strings.myth, color: theme.myth}
				: scene.kind === 'fact'
					? {text: strings.fact, color: theme.fact}
					: null;

	return (
		<AbsoluteFill style={{opacity: fadeIn * exit}}>
			<Backdrop scene={scene} index={index} duration={duration} />
			<div
				style={{
					position: 'absolute',
					left: layout.left,
					right: layout.right,
					top: layout.sceneTop,
					height: layout.sceneHeight,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: scene.kind === 'cta' ? 'center' : 'flex-end',
					alignItems: 'stretch',
				}}
			>
				{scene.kind === 'cta' ? (
					<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, padding: '50px 40px', borderRadius: 44, background: theme.card, boxShadow: `0 30px 80px ${theme.shadow}`, transform: `scale(${0.9 + 0.1 * panel})`, opacity: panel}}>
						<Avatar size={180} ring={8} />
						{brand.doctorName ? <div style={{fontSize: 56, fontWeight: 900, color: theme.text}}>{brand.doctorName}</div> : null}
						<div style={{fontSize: 50, fontWeight: 800, color: theme.text, textAlign: 'center', lineHeight: 1.25}}>{brand.endCardText}</div>
						<div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '22px 56px', borderRadius: 999, background: '#FF0033', color: '#FFFFFF', fontSize: 50, fontWeight: 800, transform: `scale(${1 + Math.max(0, Math.sin((frame - 14) / 5)) * 0.05})`}}>
							<BellRing size={48} color="#FFFFFF" strokeWidth={2.4} />
							{strings.subscribe}
						</div>
						{brand.showDisclaimer ? <div style={{fontSize: 26, color: theme.muted, textAlign: 'center'}}>{strings.disclaimer}</div> : null}
					</div>
				) : (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 20,
							padding: '34px 40px 40px',
							borderRadius: 40,
							background: theme.card,
							boxShadow: `0 30px 80px rgba(0,0,0,0.3)`,
							transform: `translateY(${(1 - panel) * 80}px)`,
							opacity: Math.min(1, panel * 1.4),
						}}
					>
						{label ? <Chip color={label.color}>{label.text}</Chip> : null}
						<div style={{position: 'relative'}}>
							<AnimatedHeadline text={scene.headline} fontSize={headlineSize(scene.headline, [92, 80, 68, 58])} delay={6} stagger={3} opacity={scene.kind === 'myth' ? 1 - strike * 0.4 : 1} />
							{scene.kind === 'myth' ? (
								<div style={{position: 'absolute', left: '4%', right: '4%', top: '50%', height: 10, borderRadius: 5, background: theme.myth, transform: `scaleX(${strike})`, transformOrigin: 'left'}} />
							) : null}
						</div>
						{scene.subtext.trim() ? <div style={{fontSize: 42, fontWeight: 600, color: theme.muted, textAlign: 'center', lineHeight: 1.3}}>{scene.subtext}</div> : null}
					</div>
				)}
			</div>
		</AbsoluteFill>
	);
};

export const PhotoTemplate: React.FC<{props: VideoProps}> = ({props}) => (
	<>
		<AbsoluteFill style={{background: '#000'}} />
		<SceneSequences scenes={props.scenes} render={(scene, i, duration) => <PhotoScene scene={scene} index={i} duration={duration} />} />
		<BrandBar />
		<StoryProgress scenes={props.scenes} />
		<Captions pages={props.captions} />
	</>
);
