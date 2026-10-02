import React, {useMemo} from 'react';
import {AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {formatNumber, VIDEO_STRINGS} from '../../shared/strings';
import {msToFrame, normalizeWord, parseEmphasis, stripMarkup} from '../../shared/timeline';
import type {TimedScene, VideoProps} from '../../shared/types';
import type {Theme} from '../../shared/themes';
import {BrandBar} from '../components/BrandBar';
import {IconGlyph} from '../components/IconGlyph';
import {useVideo} from '../context';
import {SceneSequences} from './shared';

type Palette = {bg: string; fg: string; hi: string; hiFg: string};

/** Each scene gets its own flat colour; myths are red, facts green. */
const paletteFor = (theme: Theme, scene: TimedScene, index: number): Palette => {
	if (scene.kind === 'myth') return {bg: theme.myth, fg: '#FFFFFF', hi: '#FFFFFF', hiFg: theme.myth};
	if (scene.kind === 'fact') return {bg: theme.fact, fg: '#FFFFFF', hi: '#FFFFFF', hiFg: theme.fact};
	const cycle: Palette[] = [
		{bg: theme.accent, fg: theme.onAccent, hi: theme.text, hiFg: theme.dark ? theme.bgTop : '#FFFFFF'},
		{bg: theme.dark ? theme.card : theme.text, fg: theme.dark ? theme.text : theme.bgTop, hi: theme.accent, hiFg: theme.onAccent},
		{bg: theme.accent2, fg: theme.onAccent2, hi: theme.dark ? theme.bgTop : theme.text, hiFg: theme.dark ? theme.text : '#FFFFFF'},
		{bg: theme.bgTop, fg: theme.text, hi: theme.accent, hiFg: theme.onAccent},
	];
	return cycle[index % cycle.length];
};

const Chip: React.FC<{color: string; children: React.ReactNode}> = ({color, children}) => (
	<span style={{padding: '10px 30px', borderRadius: 999, border: `4px solid ${color}`, color, fontSize: 40, fontWeight: 900, letterSpacing: 3}}>
		{children}
	</span>
);

const KineticScene: React.FC<{scene: TimedScene; index: number}> = ({scene, index}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, lang, brand, layout} = useVideo();
	const strings = VIDEO_STRINGS[lang];
	const palette = paletteFor(theme, scene, index);
	const punch = interpolate(frame, [0, 8], [1.18, 1], {extrapolateRight: 'clamp'});
	const flash = interpolate(frame, [0, 5], [0.45, 0], {extrapolateRight: 'clamp'});
	const chipIn = spring({frame: frame - 2, fps, config: {damping: 10, stiffness: 200}});
	const label =
		scene.kind === 'point'
			? `${strings.tip} ${scene.number !== null ? formatNumber(scene.number, lang) : ''}`
			: scene.kind === 'myth'
				? strings.myth
				: scene.kind === 'fact'
					? strings.fact
					: null;
	return (
		<AbsoluteFill style={{background: palette.bg, overflow: 'hidden'}}>
			{scene.image ? (
				// Her photo fills the screen under a wash of the scene colour, so the words stay readable.
				<>
					<Img src={scene.image} onError={() => undefined} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${punch * (1.05 + frame * 0.001)})`}} />
					<AbsoluteFill style={{background: palette.bg, opacity: 0.72}} />
				</>
			) : null}
			<div
				style={{
					position: 'absolute',
					insetInlineEnd: -160,
					bottom: 180,
					transform: `scale(${punch}) rotate(${12 + frame * 0.08}deg)`,
					opacity: 0.13,
				}}
			>
				<IconGlyph name={scene.kind === 'myth' ? 'circle-x' : scene.kind === 'fact' ? 'circle-check' : scene.icon} size={880} color={palette.fg} strokeWidth={1.6} />
			</div>
			{label ? (
				<div style={{position: 'absolute', top: layout.sceneTop, left: layout.left, right: layout.right, display: 'flex', justifyContent: 'center', transform: `scale(${chipIn})`}}>
					<Chip color={palette.fg}>{label}</Chip>
				</div>
			) : null}
			<div
				style={{
					position: 'absolute',
					top: layout.sceneTop + layout.sceneHeight - 150,
					left: layout.left,
					right: layout.right,
					textAlign: 'center',
					fontSize: 44,
					fontWeight: 700,
					lineHeight: 1.3,
					color: palette.fg,
					opacity: interpolate(frame, [6, 14], [0, 0.9], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
				}}
			>
				{scene.kind === 'cta' ? brand.endCardText : stripMarkup(scene.headline)}
			</div>
			<AbsoluteFill style={{background: '#FFFFFF', opacity: flash}} />
		</AbsoluteFill>
	);
};

/** The spoken words, huge, each slamming in when it is said. */
const KineticWords: React.FC<{props: VideoProps}> = ({props}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, lang, layout} = useVideo();
	const ms = (frame / fps) * 1000;
	const keywords = useMemo(
		() =>
			new Set(
				props.scenes.flatMap((s) =>
					parseEmphasis(s.headline)
						.filter((p) => p.em)
						.flatMap((p) => p.text.split(/\s+/).map(normalizeWord)),
				),
			),
		[props.scenes],
	);
	const sceneIndex = Math.max(0, props.scenes.findIndex((s) => ms >= s.startMs && ms < s.endMs));
	const scene = props.scenes[sceneIndex];
	const page = props.captions.find((p) => ms >= p.startMs && ms < p.endMs);
	if (!page || !scene) return null;
	const palette = paletteFor(theme, scene, sceneIndex);
	const ar = lang === 'ar';
	const count = page.words.length;
	const fontSize = ar ? (count <= 2 ? 150 : 124) : count <= 2 ? 164 : 134;
	return (
		<div
			style={{
				position: 'absolute',
				top: layout.sceneTop + 90,
				left: layout.left,
				right: layout.right,
				height: layout.sceneHeight - 260,
				display: 'flex',
				flexWrap: 'wrap',
				alignContent: 'center',
				justifyContent: 'center',
				gap: '10px 26px',
			}}
		>
			{page.words.map((word, i) => {
				const started = ms >= word.startMs;
				// Words join the line as they are said, so the line stays centred.
				if (!started) return null;
				const next = page.words[i + 1];
				const active = ms < (next ? next.startMs : page.endMs);
				const slam = spring({frame: frame - msToFrame(word.startMs), fps, config: {damping: 11, stiffness: 260}});
				const key = keywords.has(normalizeWord(word.text));
				const text = word.text.replace(/[.,،;:]+$/, '');
				return (
					<span
						key={`${page.firstIndex}-${i}`}
						style={{
							fontSize,
							fontWeight: 900,
							lineHeight: 1.08,
							textTransform: ar ? 'none' : 'uppercase',
							padding: '0 18px',
							borderRadius: 24,
							color: active ? palette.hiFg : key ? palette.hi : palette.fg,
							background: active ? palette.hi : 'transparent',
							transform: `scale(${0.6 + 0.4 * slam}) rotate(${(1 - slam) * (i % 2 ? 6 : -6)}deg)`,
							textShadow: active ? 'none' : '0 6px 0 rgba(0,0,0,0.12)',
						}}
					>
						{text}
					</span>
				);
			})}
		</div>
	);
};

export const KineticTemplate: React.FC<{props: VideoProps}> = ({props}) => (
	<>
		<SceneSequences scenes={props.scenes} render={(scene, i) => <KineticScene scene={scene} index={i} />} />
		<KineticWords props={props} />
		<BrandBar />
	</>
);
