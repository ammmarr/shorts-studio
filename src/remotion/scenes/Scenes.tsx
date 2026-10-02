import {BellRing, CircleCheck, CircleX, Pointer} from 'lucide-react';
import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {VIDEO_STRINGS, formatNumber} from '../../shared/strings';
import type {TimedScene} from '../../shared/types';
import {AnimatedHeadline, headlineSize} from '../components/AnimatedHeadline';
import {Avatar} from '../components/Avatar';
import {Medallion} from '../components/Medallion';
import {useVideo} from '../context';
import {Photo} from '../components/Photo';
import {IconGlyph} from '../components/IconGlyph';
import {Card, SceneFrame, Tag} from './SceneFrame';

type SceneProps = {scene: TimedScene; duration: number};

const Subtext: React.FC<{text: string; delay: number}> = ({text, delay}) => {
	const frame = useCurrentFrame();
	const {theme} = useVideo();
	if (!text.trim()) {
		return null;
	}
	const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<div
			style={{
				marginTop: 26,
				fontSize: 44,
				fontWeight: 600,
				lineHeight: 1.3,
				color: theme.muted,
				textAlign: 'center',
				opacity,
				transform: `translateY(${(1 - opacity) * 16}px)`,
			}}
		>
			{text}
		</div>
	);
};

const HookScene: React.FC<SceneProps> = ({scene, duration}) => {
	const {theme} = useVideo();
	const words = scene.headline.split(/\s+/).length;
	return (
		<SceneFrame duration={duration}>
			{scene.image ? (
				<Photo src={scene.image} height={520} radius={44} />
			) : (
				<Medallion icon={scene.icon} size={250} background={theme.accent} color={theme.onAccent} rings />
			)}
			<div style={{height: scene.image ? 50 : 70}} />
			<AnimatedHeadline text={scene.headline} fontSize={headlineSize(scene.headline, [104, 90, 76, 64])} delay={6} stagger={4} />
			<Subtext text={scene.subtext} delay={10 + words * 4} />
		</SceneFrame>
	);
};

/** A card that slides in from the side the viewer reads towards. */
const useSlideIn = (delay = 0) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {rtl} = useVideo();
	const s = spring({frame: frame - delay, fps, config: {damping: 15, stiffness: 120}});
	return {
		transform: `translateX(${(1 - s) * (rtl ? -160 : 160)}px) rotate(${(1 - s) * (rtl ? -4 : 4)}deg)`,
		opacity: Math.min(1, s * 1.4),
	};
};

const PointScene: React.FC<SceneProps> = ({scene, duration}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, lang} = useVideo();
	const slide = useSlideIn();
	const badge = spring({frame: frame - 8, fps, config: {damping: 9, stiffness: 180}});
	const words = scene.headline.split(/\s+/).length;
	return (
		<SceneFrame duration={duration}>
			<div style={{width: '100%', ...slide}}>
				<Card>
					<div style={{position: 'relative', width: scene.image ? '100%' : undefined}}>
						{scene.image ? (
							<Photo src={scene.image} height={400} radius={32} delay={4} />
						) : (
							<Medallion icon={scene.icon} size={210} background={theme.accentSoft} color={theme.accent} delay={4} />
						)}
						{scene.number !== null ? (
							<div
								style={{
									position: 'absolute',
									top: -18,
									insetInlineStart: -26,
									width: 96,
									height: 96,
									borderRadius: '50%',
									background: theme.accent,
									color: theme.onAccent,
									border: `6px solid ${theme.card}`,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									fontSize: 54,
									fontWeight: 900,
									transform: `scale(${badge})`,
								}}
							>
								{formatNumber(scene.number, lang)}
							</div>
						) : null}
					</div>
					<div style={{height: 46}} />
					<AnimatedHeadline text={scene.headline} fontSize={headlineSize(scene.headline, [84, 74, 64, 56])} delay={8} />
					<Subtext text={scene.subtext} delay={12 + words * 3} />
				</Card>
			</div>
		</SceneFrame>
	);
};

/** A verdict icon that slams onto the card corner partway through the scene. */
const Stamp: React.FC<{at: number; color: string; kind: 'myth' | 'fact'}> = ({at, color, kind}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme} = useVideo();
	const s = spring({frame: frame - at, fps, config: {damping: 10, stiffness: 200}});
	const Icon = kind === 'myth' ? CircleX : CircleCheck;
	const burst = interpolate(frame - at, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<div
			style={{
				position: 'absolute',
				bottom: -54,
				insetInlineEnd: 10,
				width: 170,
				height: 170,
				opacity: frame < at ? 0 : 1,
			}}
		>
			{kind === 'fact'
				? Array.from({length: 10}, (_, i) => {
						const angle = (i / 10) * Math.PI * 2;
						return (
							<div
								key={i}
								style={{
									position: 'absolute',
									left: 85 - 9,
									top: 85 - 9,
									width: 18,
									height: 18,
									borderRadius: '50%',
									background: i % 2 ? color : theme.accent,
									transform: `translate(${Math.cos(angle) * burst * 150}px, ${Math.sin(angle) * burst * 150}px)`,
									opacity: 1 - burst,
								}}
							/>
						);
					})
				: null}
			<div
				style={{
					width: '100%',
					height: '100%',
					borderRadius: '50%',
					background: theme.card,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					boxShadow: `0 16px 40px ${theme.shadow}`,
					transform: `scale(${interpolate(s, [0, 1], [2.4, 1])}) rotate(${(1 - s) * -30}deg)`,
					opacity: Math.min(1, s * 2),
				}}
			>
				<Icon size={150} color={color} strokeWidth={2.4} />
			</div>
		</div>
	);
};

const VerdictScene: React.FC<SceneProps & {kind: 'myth' | 'fact'}> = ({scene, duration, kind}) => {
	const frame = useCurrentFrame();
	const {theme, lang} = useVideo();
	const slide = useSlideIn();
	const color = kind === 'myth' ? theme.myth : theme.fact;
	const stampAt = Math.max(14, Math.round(duration * 0.35));
	// Myths shake and fade a little once stamped; facts glow.
	const since = frame - stampAt;
	const shake = kind === 'myth' && since > 0 && since < 14 ? Math.sin(since * 2.2) * (14 - since) * 1.4 : 0;
	const dim = kind === 'myth' ? interpolate(since, [0, 8], [1, 0.55], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
	const TagIcon = kind === 'myth' ? CircleX : CircleCheck;
	return (
		<SceneFrame duration={duration}>
			<div style={{width: '100%', ...slide, translate: `${shake}px 0`}}>
				<Card borderColor={color} glow={kind === 'fact' && since > 0 ? `${color}55` : undefined}>
					<Tag color={color}>
						<TagIcon size={46} color="#FFFFFF" strokeWidth={2.6} />
						{kind === 'myth' ? VIDEO_STRINGS[lang].myth : VIDEO_STRINGS[lang].fact}
					</Tag>
					<div style={{height: 40}} />
					{scene.image ? (
						<Photo src={scene.image} height={330} radius={28} delay={4} dim={kind === 'myth' ? 1 - dim : 0} />
					) : (
						<IconGlyph name={scene.icon} size={130} color={color} strokeWidth={1.9} style={{opacity: dim}} />
					)}
					<div style={{height: 34}} />
					<AnimatedHeadline
						text={scene.headline}
						fontSize={headlineSize(scene.headline, [80, 70, 62, 54])}
						delay={6}
						opacity={dim}
					/>
					<Subtext text={scene.subtext} delay={16} />
					<Stamp at={stampAt} color={color} kind={kind} />
				</Card>
			</div>
		</SceneFrame>
	);
};

const CtaScene: React.FC<SceneProps> = ({duration}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, brand, lang} = useVideo();
	const avatar = spring({frame, fps, config: {damping: 10, stiffness: 140}});
	const button = spring({frame: frame - 10, fps, config: {damping: 11, stiffness: 160}});
	const pulse = 1 + Math.max(0, Math.sin((frame - 20) / 5)) * 0.05;
	const tap = interpolate(frame, [22, 30, 34, 40], [0, 1, 0.85, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const textIn = interpolate(frame, [4, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<SceneFrame duration={duration}>
			<div style={{transform: `scale(${avatar})`}}>
				<Avatar size={230} ring={10} />
			</div>
			{brand.doctorName ? (
				<div style={{marginTop: 30, fontSize: 64, fontWeight: 900, color: theme.text, opacity: textIn}}>{brand.doctorName}</div>
			) : null}
			{brand.handle ? (
				<div style={{fontSize: 40, fontWeight: 600, color: theme.muted, direction: 'ltr', opacity: textIn}}>{brand.handle}</div>
			) : null}
			<div
				style={{
					marginTop: 36,
					fontSize: 58,
					fontWeight: 800,
					lineHeight: 1.25,
					color: theme.text,
					textAlign: 'center',
					opacity: textIn,
					transform: `translateY(${(1 - textIn) * 20}px)`,
				}}
			>
				{brand.endCardText}
			</div>
			<div style={{position: 'relative', marginTop: 50, transform: `scale(${button * pulse})`}}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 20,
						padding: '26px 66px',
						borderRadius: 999,
						background: '#FF0033',
						color: '#FFFFFF',
						fontSize: 56,
						fontWeight: 800,
						boxShadow: '0 18px 40px rgba(255,0,51,0.35)',
					}}
				>
					<BellRing size={56} color="#FFFFFF" strokeWidth={2.4} />
					{VIDEO_STRINGS[lang].subscribe}
				</div>
				<div
					style={{
						position: 'absolute',
						bottom: -70,
						insetInlineEnd: 10,
						opacity: tap > 0 ? 1 : 0,
						transform: `translate(${(1 - tap) * 60}px, ${(1 - tap) * 60}px) scale(${0.9 + 0.1 * tap})`,
					}}
				>
					<Pointer size={96} color={theme.text} fill={theme.card} strokeWidth={1.8} />
				</div>
			</div>
			{brand.showDisclaimer ? (
				<div
					style={{
						marginTop: 90,
						textAlign: 'center',
						fontSize: 30,
						fontWeight: 600,
						color: theme.muted,
						opacity: textIn * 0.9,
					}}
				>
					{VIDEO_STRINGS[lang].disclaimer}
				</div>
			) : null}
		</SceneFrame>
	);
};

export const SceneView: React.FC<SceneProps> = ({scene, duration}) => {
	switch (scene.kind) {
		case 'hook':
			return <HookScene scene={scene} duration={duration} />;
		case 'point':
			return <PointScene scene={scene} duration={duration} />;
		case 'myth':
			return <VerdictScene scene={scene} duration={duration} kind="myth" />;
		case 'fact':
			return <VerdictScene scene={scene} duration={duration} kind="fact" />;
		case 'cta':
			return <CtaScene scene={scene} duration={duration} />;
		default:
			return null;
	}
};
