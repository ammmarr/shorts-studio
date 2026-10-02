import {BellRing} from 'lucide-react';
import React from 'react';
import {interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {formatNumber, VIDEO_STRINGS} from '../../shared/strings';
import type {TimedScene, VideoProps} from '../../shared/types';
import {AnimatedHeadline, headlineSize} from '../components/AnimatedHeadline';
import {Avatar} from '../components/Avatar';
import {Background} from '../components/Background';
import {BrandBar} from '../components/BrandBar';
import {Captions} from '../components/Captions';
import {IconGlyph} from '../components/IconGlyph';
import {Medallion} from '../components/Medallion';
import {Photo} from '../components/Photo';
import {StoryProgress} from '../components/StoryProgress';
import {useVideo} from '../context';
import {Card, SceneFrame} from '../scenes/SceneFrame';
import {SceneSequences} from './shared';

/** A burst of paper confetti from the centre of its box, starting at `at`. */
const Confetti: React.FC<{at: number; seed: string}> = ({at, seed}) => {
	const frame = useCurrentFrame();
	const {theme} = useVideo();
	const t = frame - at;
	if (t < 0 || t > 40) return null;
	const colors = [theme.accent, theme.accent2, theme.fact, theme.myth];
	return (
		<div style={{position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none'}}>
			{Array.from({length: 26}, (_, i) => {
				const angle = random(`${seed}-a${i}`) * Math.PI * 2;
				const speed = 14 + random(`${seed}-s${i}`) * 16;
				const x = Math.cos(angle) * speed * t;
				const y = Math.sin(angle) * speed * t + 0.9 * t * t;
				return (
					<span
						key={i}
						style={{
							position: 'absolute',
							width: 18,
							height: 30,
							borderRadius: 4,
							background: colors[i % colors.length],
							transform: `translate(${x}px, ${y}px) rotate(${t * (12 + i)}deg)`,
							opacity: interpolate(t, [26, 40], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
						}}
					/>
				);
			})}
		</div>
	);
};

const Label: React.FC<{color: string; children: React.ReactNode; tilt?: number}> = ({color, children, tilt = -3}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {lang} = useVideo();
	const pop = spring({frame, fps, config: {damping: 9, stiffness: 190}});
	return (
		<div
			style={{
				padding: '14px 40px',
				borderRadius: 999,
				background: color,
				color: '#FFFFFF',
				fontSize: 46,
				fontWeight: 900,
				letterSpacing: lang === 'ar' ? 0 : 3,
				transform: `rotate(${tilt}deg) scale(${pop})`,
				boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
			}}
		>
			{children}
		</div>
	);
};

/** Countdown ring around the question icon: 3, 2, 1. */
const Countdown: React.FC<{icon: string; image: string | null; duration: number}> = ({icon, image, duration}) => {
	const frame = useCurrentFrame();
	const {theme, lang} = useVideo();
	const span = Math.max(30, duration * 0.8);
	const p = Math.min(1, frame / span);
	const left = Math.max(1, 3 - Math.floor(p * 3));
	const r = 150;
	const circumference = 2 * Math.PI * r;
	return (
		<div style={{position: 'relative', width: 340, height: 340, display: 'grid', placeItems: 'center'}}>
			<svg width={340} height={340} style={{position: 'absolute', inset: 0, transform: 'rotate(-90deg)'}}>
				<circle cx={170} cy={170} r={r} fill="none" stroke={theme.cardBorder} strokeWidth={18} />
				<circle cx={170} cy={170} r={r} fill="none" stroke={theme.accent} strokeWidth={18} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * p} />
			</svg>
			{image ? (
				<div style={{width: 250, height: 250, borderRadius: '50%', overflow: 'hidden'}}>
					<Photo src={image} height={250} radius={125} />
				</div>
			) : (
				<Medallion icon={icon} size={220} background={theme.accent} color={theme.onAccent} />
			)}
			<div
				style={{
					position: 'absolute',
					top: -10,
					insetInlineEnd: -10,
					width: 96,
					height: 96,
					borderRadius: '50%',
					background: theme.text,
					color: theme.bgTop,
					display: 'grid',
					placeItems: 'center',
					fontSize: 56,
					fontWeight: 900,
				}}
			>
				{formatNumber(left, lang)}
			</div>
		</div>
	);
};

const AnswerButton: React.FC<{label: string; state: 'idle' | 'right' | 'wrong'; reveal: number}> = ({label, state, reveal}) => {
	const frame = useCurrentFrame();
	const {theme} = useVideo();
	const right = state === 'right';
	const wrong = state === 'wrong';
	const shake = wrong && reveal > 0 && reveal < 1 ? Math.sin(frame * 2.4) * 12 * (1 - reveal) : 0;
	return (
		<div
			style={{
				flex: 1,
				height: 150,
				borderRadius: 32,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 16,
				fontSize: 56,
				fontWeight: 900,
				background: right ? theme.fact : wrong ? theme.myth : theme.card,
				color: right || wrong ? '#FFFFFF' : theme.text,
				border: `4px solid ${right ? theme.fact : wrong ? theme.myth : theme.cardBorder}`,
				opacity: wrong ? 0.75 : 1,
				transform: `translateX(${shake}px) scale(${right ? 1 + Math.sin(Math.min(1, reveal) * Math.PI) * 0.08 : 1})`,
				boxShadow: `0 14px 30px ${theme.shadow}`,
				position: 'relative',
			}}
		>
			{right ? <IconGlyph name="circle-check" size={58} color="#FFFFFF" strokeWidth={2.6} /> : null}
			{wrong ? <IconGlyph name="circle-x" size={58} color="#FFFFFF" strokeWidth={2.6} /> : null}
			{label}
		</div>
	);
};

const QuizScene: React.FC<{scene: TimedScene; duration: number; index: number}> = ({scene, duration, index}) => {
	const frame = useCurrentFrame();
	const {theme, lang, brand} = useVideo();
	const strings = VIDEO_STRINGS[lang];
	const size = headlineSize(scene.headline, [84, 74, 64, 56]);

	if (scene.kind === 'hook') {
		return (
			<SceneFrame duration={duration}>
				<Label color={theme.accent}>{strings.quiz}</Label>
				<div style={{height: 40}} />
				<Countdown icon={scene.icon} image={scene.image} duration={duration} />
				<div style={{height: 44}} />
				<AnimatedHeadline text={scene.headline} fontSize={headlineSize(scene.headline, [96, 84, 72, 62])} delay={6} stagger={4} />
			</SceneFrame>
		);
	}

	if (scene.kind === 'myth') {
		const revealAt = Math.max(24, Math.round(duration * 0.55));
		const reveal = interpolate(frame, [revealAt, revealAt + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
		const revealed = frame >= revealAt;
		const timer = interpolate(frame, [8, revealAt], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
		return (
			<SceneFrame duration={duration}>
				<Label color={theme.accent2} tilt={2}>
					{strings.trueOrFalse}
				</Label>
				<div style={{height: 36}} />
				<Card style={{padding: scene.image ? '30px 30px 40px' : undefined}}>
					{scene.image ? (
						<>
							<Photo src={scene.image} height={240} radius={26} />
							<div style={{height: 24}} />
						</>
					) : null}
					<AnimatedHeadline text={scene.headline} fontSize={size} delay={4} />
				</Card>
				<div style={{height: 36}} />
				<div style={{display: 'flex', gap: 28, width: '100%', position: 'relative'}}>
					<AnswerButton label={strings.trueWord} state={revealed ? 'wrong' : 'idle'} reveal={reveal} />
					<div style={{flex: 1, position: 'relative', display: 'flex'}}>
						<AnswerButton label={strings.falseWord} state={revealed ? 'right' : 'idle'} reveal={reveal} />
						<Confetti at={revealAt} seed={`q${index}`} />
					</div>
				</div>
				<div style={{height: 28}} />
				<div style={{width: '100%', height: 16, borderRadius: 8, background: theme.cardBorder, overflow: 'hidden'}}>
					<div style={{width: `${timer * 100}%`, height: '100%', background: timer > 0.3 ? theme.accent : theme.myth, marginInlineStart: 0}} />
				</div>
			</SceneFrame>
		);
	}

	if (scene.kind === 'fact') {
		return (
			<SceneFrame duration={duration}>
				<Label color={theme.fact}>{strings.answer}</Label>
				<div style={{height: 40}} />
				<div style={{position: 'relative', width: scene.image ? '100%' : undefined}}>
					{scene.image ? (
						<>
							<Photo src={scene.image} height={380} radius={36} />
							<div style={{position: 'absolute', bottom: -40, insetInlineEnd: 30}}>
								<Medallion icon="circle-check" size={120} background={theme.fact} color="#FFFFFF" />
							</div>
						</>
					) : (
						<Medallion icon="circle-check" size={230} background={theme.fact} color="#FFFFFF" rings ringColor={theme.fact} />
					)}
					<Confetti at={4} seed={`f${index}`} />
				</div>
				<div style={{height: 40}} />
				<AnimatedHeadline text={scene.headline} fontSize={size} delay={8} />
				{scene.subtext.trim() ? (
					<div style={{marginTop: 22, fontSize: 44, fontWeight: 600, color: theme.muted, textAlign: 'center'}}>{scene.subtext}</div>
				) : null}
			</SceneFrame>
		);
	}

	if (scene.kind === 'cta') {
		const pulse = 1 + Math.max(0, Math.sin((frame - 16) / 5)) * 0.05;
		return (
			<SceneFrame duration={duration}>
				<Avatar size={180} ring={8} />
				<div style={{height: 34}} />
				<AnimatedHeadline text={strings.score} fontSize={lang === 'ar' ? 84 : 80} delay={4} />
				<div style={{marginTop: 18, fontSize: 48, fontWeight: 700, color: theme.accent}}>{strings.commentScore}</div>
				<div
					style={{
						marginTop: 44,
						display: 'flex',
						alignItems: 'center',
						gap: 18,
						padding: '24px 60px',
						borderRadius: 999,
						background: '#FF0033',
						color: '#FFFFFF',
						fontSize: 52,
						fontWeight: 800,
						transform: `scale(${pulse})`,
					}}
				>
					<BellRing size={52} color="#FFFFFF" strokeWidth={2.4} />
					{strings.subscribe}
				</div>
				{brand.handle ? <div style={{marginTop: 20, fontSize: 38, color: theme.muted, direction: 'ltr'}}>{brand.handle}</div> : null}
			</SceneFrame>
		);
	}

	// point: a "did you know?" card
	return (
		<SceneFrame duration={duration}>
			<Label color={theme.accent} tilt={-2}>
				{strings.didYouKnow} {scene.number !== null ? `#${formatNumber(scene.number, lang)}` : ''}
			</Label>
			<div style={{height: 36}} />
			<Card>
				{scene.image ? (
					<Photo src={scene.image} height={360} radius={30} delay={4} />
				) : (
					<Medallion icon={scene.icon} size={190} background={theme.accentSoft} color={theme.accent} delay={4} />
				)}
				<div style={{height: 34}} />
				<AnimatedHeadline text={scene.headline} fontSize={size} delay={8} />
				{scene.subtext.trim() ? (
					<div style={{marginTop: 20, fontSize: 42, fontWeight: 600, color: theme.muted, textAlign: 'center'}}>{scene.subtext}</div>
				) : null}
			</Card>
		</SceneFrame>
	);
};

export const QuizTemplate: React.FC<{props: VideoProps}> = ({props}) => (
	<>
		<Background />
		<SceneSequences scenes={props.scenes} render={(scene, i, duration) => <QuizScene scene={scene} duration={duration} index={i} />} />
		<BrandBar />
		<StoryProgress scenes={props.scenes} />
		<Captions pages={props.captions} />
	</>
);
