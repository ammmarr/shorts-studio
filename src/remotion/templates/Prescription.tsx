import {BellRing} from 'lucide-react';
import React from 'react';
import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {VIDEO_STRINGS} from '../../shared/strings';
import {msToFrame, stripMarkup} from '../../shared/timeline';
import type {TimedScene, VideoProps} from '../../shared/types';
import {Background} from '../components/Background';
import {BrandBar} from '../components/BrandBar';
import {Captions} from '../components/Captions';
import {IconGlyph} from '../components/IconGlyph';
import {StoryProgress} from '../components/StoryProgress';
import {useVideo} from '../context';

const MAX_ROWS = 4;

/** Progress 0→1 of something that starts at `from` (in frames) and takes `frames`. */
const ramp = (frame: number, from: number, frames: number) =>
	interpolate(frame, [from, from + frames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** A drawn tick or cross inside a checkbox. */
const Mark: React.FC<{kind: 'tick' | 'cross'; color: string; draw: number}> = ({kind, color, draw}) => (
	<svg width={64} height={64} viewBox="0 0 64 64" style={{flexShrink: 0}}>
		<rect x={4} y={4} width={56} height={56} rx={14} fill="none" stroke={color} strokeWidth={5} opacity={0.5} />
		<path
			d={kind === 'tick' ? 'M16 33 L28 45 L49 20' : 'M18 18 L46 46 M46 18 L18 46'}
			fill="none"
			stroke={color}
			strokeWidth={7}
			strokeLinecap="round"
			strokeLinejoin="round"
			pathLength={1}
			strokeDasharray={1}
			strokeDashoffset={1 - draw}
		/>
	</svg>
);

type Row = {scene: TimedScene; start: number};

const PadRow: React.FC<{row: Row; frame: number; current: boolean}> = ({row, frame, current}) => {
	const {theme, rtl} = useVideo();
	const {scene, start} = row;
	const t = frame - start;
	const writeFrames = Math.min(30, Math.max(12, stripMarkup(scene.headline).length * 0.9));
	const write = ramp(t, 4, writeFrames);
	const markAt = 8 + writeFrames;
	const myth = scene.kind === 'myth';
	const color = myth ? theme.myth : scene.kind === 'fact' ? theme.fact : theme.accent;
	const strike = myth ? ramp(t, markAt + 4, 8) : 0;
	return (
		<div style={{display: 'flex', alignItems: 'center', gap: 24, padding: '18px 0', borderBottom: `3px dashed ${theme.cardBorder}`, opacity: current ? 1 : 0.62}}>
			<Mark kind={myth ? 'cross' : 'tick'} color={color} draw={ramp(t, markAt, 8)} />
			<div style={{position: 'relative', flex: 1}}>
				<div
					style={{
						fontSize: 50,
						fontWeight: 800,
						lineHeight: 1.25,
						color: myth ? theme.muted : theme.text,
						clipPath: rtl ? `inset(-10% 0 -10% ${(1 - write) * 100}%)` : `inset(-10% ${(1 - write) * 100}% -10% 0)`,
					}}
				>
					{stripMarkup(scene.headline)}
				</div>
				{myth ? (
					<div style={{position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, top: '52%', height: 8, borderRadius: 4, background: theme.myth, transform: `scaleX(${strike})`, transformOrigin: rtl ? 'right' : 'left'}} />
				) : null}
				{scene.subtext.trim() && current ? <div style={{fontSize: 36, fontWeight: 600, color: theme.muted, marginTop: 4, opacity: write}}>{scene.subtext}</div> : null}
			</div>
		</div>
	);
};

/** A doctor's prescription pad that fills up: each tip is written in and ticked, myths crossed out. */
export const PrescriptionTemplate: React.FC<{props: VideoProps}> = ({props}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {theme, lang, layout, brand, rtl} = useVideo();
	const strings = VIDEO_STRINGS[lang];
	const ms = (frame / fps) * 1000;
	const scenes = props.scenes;
	const currentIndex = Math.max(0, scenes.findIndex((s) => ms >= s.startMs && ms < s.endMs));
	const current = scenes[currentIndex];
	const hook = scenes.find((s) => s.kind === 'hook');
	const rows: Row[] = scenes
		.map((scene) => ({scene, start: msToFrame(scene.startMs)}))
		.filter((r) => (r.scene.kind === 'point' || r.scene.kind === 'myth' || r.scene.kind === 'fact') && frame >= r.start);
	const hasPhotos = scenes.some((s) => s.kind !== 'cta' && s.image);
	const padIn = spring({frame, fps, config: {damping: 15, stiffness: 120}});
	const titleWrite = ramp(frame, 8, 26);
	const cta = current?.kind === 'cta' ? current : null;
	const visibleRows = rows.slice(-MAX_ROWS);
	const ctaStart = cta ? msToFrame(cta.startMs) : 0;
	const stamp = cta ? spring({frame: frame - ctaStart - 6, fps, config: {damping: 9, stiffness: 220}}) : 0;
	const photo = current && current.kind !== 'cta' ? current.image : null;
	const photoIn = current ? spring({frame: frame - msToFrame(current.startMs) - 4, fps, config: {damping: 12, stiffness: 150}}) : 0;
	const reveal = (p: number) => (rtl ? `inset(-10% 0 -10% ${(1 - p) * 100}%)` : `inset(-10% ${(1 - p) * 100}% -10% 0)`);

	return (
		<>
			<Background />
			<div
				style={{
					position: 'absolute',
					left: layout.left,
					right: layout.right,
					top: layout.sceneTop,
					height: layout.sceneHeight,
					borderRadius: 32,
					background: '#FFFFFF',
					boxShadow: `0 30px 80px ${theme.shadow}`,
					overflow: 'hidden',
					transform: `translateY(${(1 - padIn) * 120}px) rotate(${(1 - padIn) * (rtl ? 3 : -3)}deg)`,
					opacity: padIn,
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				{/* letterhead */}
				<div style={{display: 'flex', alignItems: 'center', gap: 20, padding: '28px 40px', background: theme.accent, color: theme.onAccent}}>
					<div style={{flex: 1, minWidth: 0}}>
						<div style={{fontSize: 46, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{brand.doctorName || brand.handle}</div>
						{brand.handle && brand.doctorName ? <div style={{fontSize: 28, fontWeight: 600, opacity: 0.85, direction: 'ltr', textAlign: rtl ? 'right' : 'left'}}>{brand.handle}</div> : null}
					</div>
					<div style={{fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 110, fontWeight: 700, fontStyle: 'italic', lineHeight: 0.9, direction: 'ltr'}}>
						R<span style={{fontSize: 64}}>x</span>
					</div>
				</div>
				{/* ruled paper */}
				<div
					style={{
						flex: 1,
						minHeight: 0,
						padding: '26px 40px 30px',
						// Photos get their own column on the pad, so they never cover the writing.
						paddingInlineEnd: hasPhotos && !cta ? 300 : 40,
						position: 'relative',
						overflow: 'hidden',
						display: 'flex',
						flexDirection: 'column',
						}}
						>
						{/* Ruled lines as plain lines (not a repeating background), so the phone draws them too. */}
						{Array.from({length: 24}, (_, i) => (
						<div key={i} style={{position: 'absolute', left: 0, right: 0, top: 60 + i * 64, height: 4, background: theme.cardBorder}} />
						))}
						{hook ? (
						<div style={{position: 'relative', flexShrink: 0, fontSize: 58, fontWeight: 900, lineHeight: 1.2, color: theme.text, marginBottom: 18, clipPath: reveal(titleWrite)}}>
							{stripMarkup(hook.headline)}
							<div style={{height: 6, width: '40%', borderRadius: 3, background: theme.accent, marginTop: 10}} />
						</div>
					) : null}
					{/* Rows sit under the title; once the pad is full the oldest slide off the top, so the newest is always visible. */}
					<div
						style={{
							position: 'relative',
							flex: 1,
							minHeight: 0,
							overflow: 'hidden',
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'flex-end',
						}}
						>
						{visibleRows.map((row) => (
							<div key={row.start} style={{flexShrink: 0}}>
								<PadRow row={row} frame={frame} current={row.scene === current} />
							</div>
						))}
						<div style={{flexGrow: 1}} />
						{/* rows sliding off the top fade out under the title */}
						<div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 30, background: 'linear-gradient(#FFFFFF, rgba(255,255,255,0))'}} />
						</div>
					{cta ? (
						<div style={{position: 'relative', flexShrink: 0, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20}}>
							<div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '18px 40px', borderRadius: 999, background: '#FF0033', color: '#FFFFFF', fontSize: 44, fontWeight: 800}}>
								<BellRing size={42} color="#FFFFFF" strokeWidth={2.4} />
								{strings.subscribe}
							</div>
							{/* the doctor's rubber stamp */}
							<div
								style={{
									width: 200,
									height: 200,
									borderRadius: '50%',
									border: `8px solid ${theme.accent}`,
									color: theme.accent,
									display: 'grid',
									placeItems: 'center',
									textAlign: 'center',
									padding: 22,
									fontSize: 30,
									fontWeight: 900,
									lineHeight: 1.15,
									transform: `rotate(-12deg) scale(${interpolate(stamp, [0, 1], [2.2, 1])})`,
									opacity: Math.min(1, stamp * 2) * 0.9,
								}}
							>
								{brand.endCardText}
							</div>
						</div>
					) : null}
				</div>
			</div>

			{/* the current card's photo, paper-clipped to the pad */}
			{photo ? (
				<div
					style={{
						position: 'absolute',
						top: layout.sceneTop + 200,
						insetInlineEnd: layout.right + 24,
						width: 250,
						height: 290,
						padding: '14px 14px 50px',
						background: '#FFFFFF',
						boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
						transform: `rotate(${rtl ? -6 : 6}deg) scale(${photoIn})`,
					}}
				>
					<Img src={photo} onError={() => undefined} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
					<div style={{position: 'absolute', top: -34, insetInlineStart: 40, width: 30, height: 84, borderRadius: 16, border: '6px solid #9CA3AF', borderBottomColor: 'transparent'}} />
				</div>
			) : current && current.kind !== 'cta' && current.kind !== 'hook' ? (
				<div style={{position: 'absolute', top: layout.sceneTop + 190, insetInlineEnd: layout.right + 20, opacity: 0.12}}>
					<IconGlyph name={current.icon} size={220} color={theme.accent} strokeWidth={1.6} />
				</div>
			) : null}

			<BrandBar />
			<StoryProgress scenes={props.scenes} />
			<Captions pages={props.captions} />
		</>
	);
};
