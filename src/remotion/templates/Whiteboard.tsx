import React, {useMemo} from 'react';
import {AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {formatNumber, VIDEO_STRINGS} from '../../shared/strings';
import {stripMarkup} from '../../shared/timeline';
import type {TimedScene, VideoProps} from '../../shared/types';
import {Avatar} from '../components/Avatar';
import {BrandBar} from '../components/BrandBar';
import {Captions} from '../components/Captions';
import {Hand} from '../components/Hand';
import {IconGlyph} from '../components/IconGlyph';
import {StoryProgress} from '../components/StoryProgress';
import {useVideo} from '../context';
import {handFontFor, useFontsLoaded} from '../fonts';
import {type TextLine, wrapHeadline} from '../measure';
import {exitOpacity, SceneSequences} from './shared';

const OFFSTAGE = {x: 1180, y: 1720};

type Point = {x: number; y: number};
type Segment = {start: number; end: number; ink: string; at: (t: number) => Point};

const Board: React.FC = () => {
	const {theme} = useVideo();
	const grid = theme.dark ? 'rgba(255,255,255,0.05)' : `${theme.pattern}16`;
	return (
		<AbsoluteFill
			style={{
				background: theme.dark ? theme.bgTop : '#FFFFFF',
				backgroundImage: `linear-gradient(${grid} 2px, transparent 2px), linear-gradient(90deg, ${grid} 2px, transparent 2px)`,
				backgroundSize: '60px 60px',
			}}
		>
			<AbsoluteFill
				style={{
					background: theme.dark
						? 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.09), transparent 62%)'
						: `radial-gradient(circle at 50% 32%, transparent 52%, ${theme.bgBottom}99)`,
				}}
			/>
		</AbsoluteFill>
	);
};

/** A path drawn progressively (0–1) with round caps, like a marker stroke. */
const Stroke: React.FC<{d: string; color: string; width: number; draw: number}> = ({d, color, width, draw}) =>
	draw <= 0 ? null : (
		<path
			d={d}
			pathLength={1}
			strokeDasharray={1}
			strokeDashoffset={1 - Math.min(1, draw)}
			fill="none"
			stroke={color}
			strokeWidth={width}
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	);

const lerp = (a: Point, b: Point, t: number): Point => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});

const WhiteboardScene: React.FC<{scene: TimedScene; duration: number}> = ({scene, duration}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, lang, rtl, brand, layout} = useVideo();
	const ar = lang === 'ar';
	// Everything is written inside YouTube's safe zone, around the captions.
	const AREA_TOP = layout.sceneTop;
	const AREA_HEIGHT = layout.sceneHeight;
	const CENTER_X = layout.centerX;
	const MAX_WIDTH = layout.width - 40;
	const photo = scene.kind !== 'cta' ? scene.image : null;
	const FIGURE = photo ? 330 : 210;
	const family = handFontFor(lang);
	const cta = scene.kind === 'cta';
	const headline = cta ? brand.endCardText : scene.headline;
	const subtext = cta ? brand.doctorName : scene.subtext;

	const length = stripMarkup(headline).length;
	const headSize = ar ? (length <= 20 ? 92 : length <= 36 ? 80 : 68) : length <= 20 ? 128 : length <= 36 ? 108 : 90;
	const headFont = `${ar ? 800 : 700} ${headSize}px "${family}"`;
	const subSize = ar ? 50 : 66;
	const subFont = `${ar ? 700 : 600} ${subSize}px "${family}"`;
	const ready = useFontsLoaded();
	const lines = useMemo(() => (ready ? wrapHeadline(headline, headFont, MAX_WIDTH) : []), [headline, headFont, ready]);
	const subLines = useMemo(
		() => (ready && subtext.trim() ? wrapHeadline(subtext, subFont, MAX_WIDTH) : []),
		[subtext, subFont, ready],
	);
	const headLine = headSize * (ar ? 1.5 : 1.1);
	const subLine = subSize * (ar ? 1.55 : 1.2);

	// Vertical layout: figure, headline lines, small lines, and the CTA button.
	const buttonHeight = cta ? 130 : 0;
	const blockHeight =
		FIGURE + 40 + lines.length * headLine + (subLines.length ? 20 + subLines.length * subLine : 0) + (cta ? 40 + buttonHeight : 0);
	const top = AREA_TOP + Math.max(0, (AREA_HEIGHT - blockHeight) / 2);
	const figureCenter = {x: CENTER_X, y: top + FIGURE / 2};
	const linesTop = top + FIGURE + 40;
	const subTop = linesTop + lines.length * headLine + 20;
	const buttonTop = subTop + subLines.length * subLine + 40;
	const lineX = (line: TextLine) => CENTER_X - line.width / 2;

	// The writing timeline: each segment moves the pen along something being drawn or written.
	const plan = useMemo(() => {
		const segments: Segment[] = [];
		const perChar = ar ? 1.7 : 1.25;
		let t = 3;
		const add = (frames: number, ink: string, at: Segment['at']) => {
			segments.push({start: t, end: t + frames, ink, at});
			t += frames;
			return segments[segments.length - 1];
		};
		const numberCenter = {x: CENTER_X + (rtl ? 1 : -1) * (FIGURE / 2 + 90), y: figureCenter.y};
		const circleAt = (c: Point, r: number) => (p: number) => {
			const a = -Math.PI / 2 + p * Math.PI * 2 * 0.92;
			return {x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r};
		};
		const numberSeg = scene.kind === 'point' ? add(12, theme.accent, circleAt(numberCenter, 58)) : null;
		const figureSeg = add(Math.round(Math.min(26, duration * 0.18)), cta ? theme.accent : theme.text, circleAt(figureCenter, FIGURE * 0.36));
		t += 2;
		const totalWidth = lines.reduce((n, l) => n + l.width, 0) || 1;
		const subWidth = subLines.reduce((n, l) => n + l.width, 0);
		const headChars = lines.reduce((n, l) => n + l.text.length, 0);
		const subChars = subLines.reduce((n, l) => n + l.text.length, 0);
		const budget = Math.max(14, duration * 0.68 - t);
		const headFrames = Math.max(8, Math.min(headChars * perChar, budget * (subChars ? 0.72 : 1)));
		const subFrames = subChars ? Math.max(6, Math.min(subChars * perChar * 0.75, budget - headFrames)) : 0;
		const lineSegs = lines.map((line, i) => {
			const y = linesTop + i * headLine + headLine * 0.72;
			const x = lineX(line);
			return add(Math.max(3, (headFrames * line.width) / totalWidth), theme.text, (p) => ({x: rtl ? x + line.width * (1 - p) : x + line.width * p, y}));
		});
		const subSegs = subLines.map((line, i) => {
			const y = subTop + i * subLine + subLine * 0.72;
			const x = lineX(line);
			return add(Math.max(3, (subFrames * line.width) / (subWidth || 1)), cta ? theme.accent : theme.muted, (p) => ({x: rtl ? x + line.width * (1 - p) : x + line.width * p, y}));
		});
		// Finishing marks.
		t += 3;
		const last = lines[lines.length - 1];
		const lastY = linesTop + (lines.length - 1) * headLine;
		const strikeSegs =
			scene.kind === 'myth'
				? lines.map((line, i) => {
						const y = linesTop + i * headLine + headLine * 0.5;
						const x0 = lineX(line) - 18;
						const x1 = lineX(line) + line.width + 18;
						return add(8, theme.myth, (p) => ({x: rtl ? x1 + (x0 - x1) * p : x0 + (x1 - x0) * p, y: y + Math.sin(p * Math.PI * 6) * 14}));
					})
				: [];
		const underline =
			last && (scene.kind === 'fact' || scene.kind === 'hook')
				? add(12, scene.kind === 'fact' ? theme.fact : theme.accent, (p) => {
						const x0 = lineX(last) - 10;
						const x1 = lineX(last) + last.width + 10;
						return {x: rtl ? x1 + (x0 - x1) * p : x0 + (x1 - x0) * p, y: lastY + headLine * 0.98 + Math.sin(p * Math.PI * 3) * 8};
					})
				: null;
		const checkBase = {x: CENTER_X + (rtl ? -1 : 1) * (FIGURE / 2 + 80), y: figureCenter.y};
		const check =
			scene.kind === 'fact'
				? add(10, theme.fact, (p) =>
						p < 0.4
							? lerp({x: checkBase.x - 40, y: checkBase.y}, {x: checkBase.x - 10, y: checkBase.y + 34}, p / 0.4)
							: lerp({x: checkBase.x - 10, y: checkBase.y + 34}, {x: checkBase.x + 46, y: checkBase.y - 40}, (p - 0.4) / 0.6),
					)
				: null;
		const button = cta
			? add(16, theme.accent, (p) => {
					const w = 520;
					const x0 = CENTER_X - w / 2;
					const corners = [
						{x: x0, y: buttonTop},
						{x: x0 + w, y: buttonTop},
						{x: x0 + w, y: buttonTop + buttonHeight},
						{x: x0, y: buttonTop + buttonHeight},
						{x: x0, y: buttonTop},
					];
					const s = Math.min(3.999, p * 4);
					return lerp(corners[Math.floor(s)], corners[Math.floor(s) + 1], s - Math.floor(s));
				})
			: null;
		return {segments, numberSeg, numberCenter, figureSeg, lineSegs, subSegs, strikeSegs, underline, check, checkBase, button, end: t};
	}, [ar, rtl, scene.kind, duration, lines, subLines, theme, cta, figureCenter.y, linesTop, subTop, headLine, subLine, buttonTop, CENTER_X, FIGURE]);

	const amount = (seg: Segment | null) => (seg ? interpolate(frame, [seg.start, seg.end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0);

	// Where the pen is now.
	const {segments} = plan;
	const active = segments.find((s) => frame >= s.start && frame < s.end) ?? [...segments].reverse().find((s) => frame >= s.end) ?? segments[0];
	const writing = segments.some((s) => frame >= s.start && frame < s.end);
	const pen = active ? active.at(amount(active)) : OFFSTAGE;
	const wobbly = writing ? {x: pen.x + Math.cos(frame * 0.9) * 3, y: pen.y + Math.sin(frame * 1.7) * 5} : pen;
	const enter = interpolate(frame, [0, 6], [0, 1], {extrapolateRight: 'clamp'});
	const leave = interpolate(frame, [plan.end + 2, plan.end + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	// Slides in from off-screen, writes, then slides away when the scene is written.
	const tip = frame < 6 ? lerp(OFFSTAGE, segments[0]?.at(0) ?? pen, enter) : lerp(wobbly, OFFSTAGE, leave);

	const exit = exitOpacity(frame, duration);
	const labelPop = (seg: Segment | null) => (seg ? spring({frame: frame - seg.start, fps, config: {damping: 10, stiffness: 180}}) : 0);
	const textStyle = (font: string, lineHeight: number, color: string): React.CSSProperties => ({
		position: 'absolute',
		font,
		lineHeight: `${lineHeight}px`,
		color,
		whiteSpace: 'pre',
		direction: rtl ? 'rtl' : 'ltr',
	});
	const reveal = (p: number) => (rtl ? `inset(-20% 0 -20% ${(1 - p) * 100}%)` : `inset(-20% ${(1 - p) * 100}% -20% 0)`);

	return (
		<AbsoluteFill style={{opacity: exit, transform: `translateY(${(1 - exit) * -30}px)`}}>
			{/* figure: the icon (or the avatar on the ending) drawn by the pen */}
			<div style={{position: 'absolute', left: figureCenter.x - FIGURE / 2, top: figureCenter.y - FIGURE / 2, width: FIGURE, height: FIGURE, display: 'grid', placeItems: 'center'}}>
				{cta ? (
					<div style={{opacity: amount(plan.figureSeg), transform: `scale(${0.8 + 0.2 * amount(plan.figureSeg)})`}}>
						<Avatar size={FIGURE - 30} />
					</div>
				) : photo ? (
					// Her photo, taped to the board like a Polaroid.
					<div
						style={{
							position: 'relative',
							width: FIGURE - 20,
							height: FIGURE,
							padding: '14px 14px 52px',
							background: '#FFFFFF',
							boxShadow: '0 16px 36px rgba(0,0,0,0.22)',
							transform: `rotate(${rtl ? 4 : -4}deg) scale(${0.7 + 0.3 * amount(plan.figureSeg)})`,
							opacity: Math.min(1, amount(plan.figureSeg) * 2),
						}}
					>
						<Img src={photo} onError={() => undefined} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
						<div style={{position: 'absolute', top: -18, left: '50%', width: 120, height: 36, marginLeft: -60, background: 'rgba(250,235,180,0.75)', transform: 'rotate(-3deg)'}} />
					</div>
				) : (
					<IconGlyph name={scene.icon} size={FIGURE - 20} color={scene.kind === 'myth' ? theme.myth : scene.kind === 'fact' ? theme.fact : theme.text} strokeWidth={1.7} draw={amount(plan.figureSeg)} />
				)}
			</div>

			{scene.number !== null && plan.numberSeg ? (
				<div
					style={{
						...textStyle(`${ar ? 800 : 700} 76px "${family}"`, 116, theme.accent),
						left: plan.numberCenter.x - 58,
						top: plan.numberCenter.y - 58,
						width: 116,
						textAlign: 'center',
						opacity: amount(plan.numberSeg),
					}}
				>
					{formatNumber(scene.number, lang)}
				</div>
			) : null}

			{lines.map((line, i) => (
				<div key={i} style={{...textStyle(headFont, headLine, theme.text), left: lineX(line), top: linesTop + i * headLine, width: line.width, clipPath: reveal(amount(plan.lineSegs[i]))}}>
					{line.tokens.map((token, j) => (
						<React.Fragment key={j}>
							{j > 0 ? ' ' : ''}
							{token.map((seg, k) =>
								seg.em ? (
									<span key={k} style={{color: theme.accent, background: `linear-gradient(transparent 58%, ${theme.accentSoft} 58%)`}}>
										{seg.text}
									</span>
								) : (
									<React.Fragment key={k}>{seg.text}</React.Fragment>
								),
							)}
						</React.Fragment>
					))}
				</div>
			))}

			{subLines.map((line, i) => (
				<div key={i} style={{...textStyle(subFont, subLine, cta ? theme.accent : theme.muted), left: lineX(line), top: subTop + i * subLine, width: line.width, clipPath: reveal(amount(plan.subSegs[i]))}}>
					{line.text}
				</div>
			))}

			{cta && plan.button ? (
				<div
					style={{
						...textStyle(`${ar ? 800 : 700} ${ar ? 60 : 76}px "${family}"`, 130, theme.accent),
						left: CENTER_X - 260,
						top: buttonTop,
						width: 520,
						textAlign: 'center',
						opacity: amount(plan.button),
					}}
				>
					{VIDEO_STRINGS[lang].subscribe}
				</div>
			) : null}

			{/* marks drawn over the text */}
			<svg width={1080} height={1920} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
				{plan.numberSeg ? (
					<Stroke
						d={`M ${plan.numberCenter.x} ${plan.numberCenter.y - 58} a 58 58 0 1 1 -1 0`}
						color={theme.accent}
						width={7}
						draw={amount(plan.numberSeg) / 0.92}
					/>
				) : null}
				{cta ? (
					<Stroke d={`M ${figureCenter.x} ${figureCenter.y - FIGURE * 0.47} a ${FIGURE * 0.47} ${FIGURE * 0.47} 0 1 1 -1 0`} color={theme.accent} width={7} draw={amount(plan.figureSeg)} />
				) : null}
				{plan.strikeSegs.map((seg, i) => {
					const pts = Array.from({length: 25}, (_, k) => seg.at(k / 24));
					return <Stroke key={i} d={`M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}`} color={theme.myth} width={10} draw={amount(seg)} />;
				})}
				{plan.underline ? (
					<Stroke
						d={`M ${Array.from({length: 25}, (_, k) => plan.underline!.at(k / 24)).map((p) => `${p.x} ${p.y}`).join(' L ')}`}
						color={scene.kind === 'fact' ? theme.fact : theme.accent}
						width={9}
						draw={amount(plan.underline)}
					/>
				) : null}
				{plan.check ? (
					<Stroke
						d={`M ${plan.checkBase.x - 40} ${plan.checkBase.y} L ${plan.checkBase.x - 10} ${plan.checkBase.y + 34} L ${plan.checkBase.x + 46} ${plan.checkBase.y - 40}`}
						color={theme.fact}
						width={14}
						draw={amount(plan.check)}
					/>
				) : null}
				{plan.button ? (
					<Stroke
						d={`M ${CENTER_X - 260} ${buttonTop} h 520 v ${buttonHeight} h -520 Z`}
						color={theme.accent}
						width={8}
						draw={amount(plan.button)}
					/>
				) : null}
			</svg>

			{/* MYTH / FACT written like a quick label */}
			{scene.kind === 'myth' || scene.kind === 'fact' ? (
				<div
					style={{
						...textStyle(`${ar ? 800 : 700} ${ar ? 64 : 84}px "${family}"`, 100, scene.kind === 'myth' ? theme.myth : theme.fact),
						top: top - 30,
						[rtl ? 'right' : 'left']: 90,
						transform: `rotate(${rtl ? 8 : -8}deg) scale(${labelPop(scene.kind === 'myth' ? plan.strikeSegs[0] ?? null : plan.check)})`,
					}}
				>
					{scene.kind === 'myth' ? VIDEO_STRINGS[lang].myth : VIDEO_STRINGS[lang].fact}
				</div>
			) : null}

			{leave < 1 ? (
				<div style={{position: 'absolute', left: tip.x, top: tip.y}}>
					<Hand ink={active?.ink ?? theme.text} sleeve={theme.dark ? theme.accent2 : theme.text} scale={0.95} />
				</div>
			) : null}
		</AbsoluteFill>
	);
};

export const WhiteboardTemplate: React.FC<{props: VideoProps}> = ({props}) => (
	<>
		<Board />
		<SceneSequences scenes={props.scenes} render={(scene, _i, duration) => <WhiteboardScene scene={scene} duration={duration} />} />
		<BrandBar />
		<StoryProgress scenes={props.scenes} />
		<Captions pages={props.captions} />
	</>
);
