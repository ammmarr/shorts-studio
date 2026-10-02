import {BellRing} from 'lucide-react';
import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame} from 'remotion';
import {formatNumber, VIDEO_STRINGS} from '../../shared/strings';
import {parseEmphasis, stripMarkup} from '../../shared/timeline';
import type {Lang, SceneKind, TimedScene, VideoProps} from '../../shared/types';
import {Avatar} from '../components/Avatar';
import {BrandBar} from '../components/BrandBar';
import {Captions} from '../components/Captions';
import {DrawLine, ease, FadeUp, MaskReveal} from '../components/minimal';
import {StoryProgress} from '../components/StoryProgress';
import {useVideo} from '../context';
import {fontFor, useFontsLoaded} from '../fonts';
import {measureText, type TextLine, wrapHeadline} from '../measure';
import {exitOpacity, SceneSequences} from './shared';

// Spacing comes in steps of 24px; everything lines up on one start edge.
const GAP = 24;
const META_HEIGHT = 48;
/** Top padding, the meta row, the space above the rule and the rule itself. */
const META_BLOCK = GAP + META_HEIGHT + 12 + 3;
const SUB_SIZE = 42;
const SIZES = [110, 100, 92, 84, 76];
// Beside a photo the headline may go a little smaller, never below 64px.
const PHOTO_SIZES = [92, 84, 76, 70, 64];
const MIN_PHOTO = 320;
const MAX_PHOTO = 620;

const lineHeightFor = (lang: Lang) => (lang === 'ar' ? 1.35 : 1.1);

type Fit = {size: number; lines: TextLine[]; subLines: number; height: number};

const isOrphan = (lines: TextLine[]) => lines.length > 1 && lines[lines.length - 1].tokens.length === 1;

/** Re-wraps into the same number of lines at the narrowest width that allows it, so lines come out even. */
const balance = (headline: string, font: string, width: number, count: number) => {
	let lo = width * 0.5;
	let hi = width;
	for (let i = 0; i < 12; i++) {
		const mid = (lo + hi) / 2;
		if (wrapHeadline(headline, font, mid).length <= count) hi = mid;
		else lo = mid;
	}
	return wrapHeadline(headline, font, hi);
};

/**
 * The biggest headline size that fits in 3 lines (and in `maxHeight`), with the text block's height.
 * One word alone on the last line is avoided: by the next size down if that needs fewer lines,
 * else by evening out the lines, else by a smaller size.
 */
const fitText = (headline: string, subtext: string, lang: Lang, width: number, sizes: number[], maxHeight = Infinity): Fit => {
	const family = fontFor(lang);
	const lh = lineHeightFor(lang);
	const subLines = subtext.trim() ? Math.min(2, Math.ceil(measureText(subtext, `600 ${SUB_SIZE}px "${family}"`) / width)) : 0;
	let fallback: Fit | null = null;
	let fit: Fit = {size: sizes[0], lines: [], subLines, height: 0};
	for (const [i, size] of sizes.entries()) {
		const font = `800 ${size}px "${family}"`;
		let lines = wrapHeadline(headline, font, width);
		if (isOrphan(lines)) {
			const next = sizes[i + 1];
			const shorter = next ? wrapHeadline(headline, `800 ${next}px "${family}"`, width) : null;
			if (shorter && shorter.length < lines.length && !isOrphan(shorter)) continue;
			const even = balance(headline, font, width, lines.length);
			if (!isOrphan(even)) lines = even;
		}
		fit = {size, lines, subLines, height: lines.length * size * lh + (subLines ? GAP + subLines * SUB_SIZE * 1.3 : 0)};
		if (lines.length > 3 || fit.height > maxHeight) continue;
		if (!isOrphan(lines)) return fit;
		fallback ??= fit;
	}
	return fallback ?? fit;
};

/** "01 / 05", or "١ / ٥" in Arabic (an Arabic zero is a dot, so it isn't padded). */
const indexText = (n: number, total: number, lang: Lang) => {
	const pad = (v: number) => (lang === 'ar' ? formatNumber(v, lang) : String(v).padStart(2, '0'));
	return `${pad(n)} / ${pad(total)}`;
};

/** The small row at the top of every card: its place in the video, a Myth/Fact label, and a thin rule. */
const Meta: React.FC<{index: number; total: number; kind: SceneKind; accentLead: boolean; instant: boolean}> = ({
	index,
	total,
	kind,
	accentLead,
	instant,
}) => {
	const frame = useCurrentFrame();
	const {theme, lang} = useVideo();
	const strings = VIDEO_STRINGS[lang];
	const draw = instant ? 1 : ease(frame, 2, 14);
	// The label's colour sits in a small marker, so the words themselves keep full contrast.
	const label = kind === 'myth' ? {text: strings.myth, color: theme.myth} : kind === 'fact' ? {text: strings.fact, color: theme.fact} : null;
	return (
		<div style={{flexShrink: 0, paddingTop: GAP}}>
			<FadeUp instant={instant} frames={12} distance={24}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						height: META_HEIGHT,
						fontSize: 36,
						fontWeight: 600,
						letterSpacing: lang === 'ar' ? 0 : 3,
						color: theme.muted,
					}}
				>
					<span>{indexText(index + 1, total, lang)}</span>
					{label ? (
						<span style={{display: 'flex', alignItems: 'center', gap: GAP, color: theme.text, fontWeight: 700}}>
							<span style={{width: 48, height: 12, background: label.color}} />
							{label.text}
						</span>
					) : null}
				</div>
			</FadeUp>
			<div style={{position: 'relative', marginTop: 12}}>
				<DrawLine progress={draw} color={theme.text} opacity={0.18} />
				{accentLead ? <DrawLine progress={draw} color={theme.accent} thickness={6} style={{position: 'absolute', top: -2, insetInlineStart: 0, width: 96}} /> : null}
			</div>
		</div>
	);
};

/**
 * The headline, line by line. Emphasised words get a thin accent underline that draws in at
 * `momentAt`; a myth is struck through in the myth colour instead.
 */
const Headline: React.FC<{fit: Fit; kind: SceneKind; instant: boolean; delay: number; momentAt: number}> = ({fit, kind, instant, delay, momentAt}) => {
	const frame = useCurrentFrame();
	const {theme, lang} = useVideo();
	const lh = lineHeightFor(lang);
	const myth = kind === 'myth';
	const struck = myth ? ease(frame, momentAt, 10) : 0;
	const stroke = Math.max(6, Math.round(fit.size * 0.07));
	let emphasis = 0;
	return (
		<div style={{flexShrink: 0}}>
			{fit.lines.map((line, i) => (
				<FadeUp key={i} instant={instant} delay={delay + i * 3}>
					<div style={{position: 'relative', fontSize: fit.size, fontWeight: 800, lineHeight: lh, whiteSpace: 'nowrap', color: theme.text}}>
						<span style={{opacity: 1 - struck * 0.45}}>
							{line.tokens.map((token, j) => (
								<React.Fragment key={j}>
									{j > 0 ? ' ' : ''}
									{token.map((segment, k) => {
										if (!segment.em || myth) return <React.Fragment key={k}>{segment.text}</React.Fragment>;
										const order = emphasis++;
										return (
											<span key={k} style={{position: 'relative', display: 'inline-block'}}>
												{segment.text}
												<DrawLine
													progress={ease(frame, momentAt + order * 3, 12)}
													color={theme.accent}
													thickness={stroke}
													style={{position: 'absolute', left: 0, right: 0, bottom: lang === 'ar' ? fit.size * 0.06 : fit.size * 0.02}}
												/>
											</span>
										);
									})}
								</React.Fragment>
							))}
						</span>
						{myth ? (
							<DrawLine
								progress={ease(frame, momentAt + i * 3, 10)}
								color={theme.myth}
								thickness={stroke}
								style={{position: 'absolute', insetInlineStart: 0, width: line.width, top: '52%'}}
							/>
						) : null}
					</div>
				</FadeUp>
			))}
		</div>
	);
};

const Subtext: React.FC<{text: string; instant: boolean; delay: number}> = ({text, instant, delay}) => {
	const {theme} = useVideo();
	return (
		<FadeUp instant={instant} delay={delay} style={{flexShrink: 0, marginTop: GAP}}>
			<div style={{fontSize: SUB_SIZE, fontWeight: 600, lineHeight: 1.3, color: theme.muted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
				{text}
			</div>
		</FadeUp>
	);
};

type SceneProps = {scene: TimedScene; index: number; total: number; duration: number; momentAt: number; instant: boolean};

const StoryCard: React.FC<SceneProps> = ({scene, index, total, duration, momentAt, instant}) => {
	const frame = useCurrentFrame();
	const {theme, lang, layout} = useVideo();
	const width = layout.width - 8;
	const hasEmphasis = parseEmphasis(scene.headline).some((part) => part.em);
	const myth = scene.kind === 'myth';
	const struck = myth ? ease(frame, momentAt, 10) : 0;
	const roomBelowMeta = layout.sceneHeight - META_BLOCK - GAP;

	let fit: Fit;
	let subtext = scene.subtext;
	let photoHeight = 0;
	let textGap: number;
	if (scene.image) {
		// The photo takes whatever height the text leaves, between MIN_PHOTO and MAX_PHOTO.
		const fixed = META_BLOCK + 36 + 48 + GAP;
		fit = fitText(scene.headline, subtext, lang, width, PHOTO_SIZES, layout.sceneHeight - fixed - MIN_PHOTO);
		if (layout.sceneHeight - fixed - fit.height < MIN_PHOTO && subtext) {
			subtext = '';
			fit = fitText(scene.headline, '', lang, width, PHOTO_SIZES, layout.sceneHeight - fixed - MIN_PHOTO);
		}
		photoHeight = Math.min(MAX_PHOTO, Math.max(240, layout.sceneHeight - fixed - fit.height));
		textGap = 48;
	} else {
		fit = fitText(scene.headline, subtext, lang, width, SIZES, roomBelowMeta - 72);
		// The headline starts at the same height on every card, about a quarter of the way down.
		textGap = Math.max(48, Math.min(Math.round(roomBelowMeta * 0.26), roomBelowMeta - fit.height));
	}
	const textDelay = scene.image ? 6 : 3;

	return (
		<>
			<Meta index={index} total={total} kind={scene.kind} accentLead={!hasEmphasis && !myth && scene.kind !== 'fact'} instant={instant} />
			{scene.image ? (
				<MaskReveal progress={instant ? 1 : ease(frame, 4, 16)} style={{flexShrink: 0, marginTop: 36, height: photoHeight, overflow: 'hidden', background: theme.accentSoft}}>
					<Img
						src={scene.image}
						// A missing photo must not stop the whole video from rendering.
						onError={() => undefined}
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'cover',
							transform: `scale(${1 + 0.04 * Math.min(1, frame / Math.max(1, duration))})`,
							filter: struck > 0 ? `grayscale(${struck})` : undefined,
						}}
					/>
				</MaskReveal>
			) : null}
			<div style={{flexShrink: 0, height: textGap}} />
			<Headline fit={fit} kind={scene.kind} instant={instant} delay={textDelay} momentAt={momentAt} />
			{subtext.trim() ? <Subtext text={subtext} instant={instant} delay={textDelay + fit.lines.length * 3 + 2} /> : null}
		</>
	);
};

/** The ending: her byline, the end line, a quiet Subscribe bar and the disclaimer. */
const EndCard: React.FC<SceneProps> = ({scene, index, total, momentAt, instant}) => {
	const {theme, lang, layout, brand} = useVideo();
	const strings = VIDEO_STRINGS[lang];
	const width = layout.width - 8;
	const text = brand.endCardText || stripMarkup(scene.headline);
	const byline = brand.doctorName || brand.handle;
	// Room left for the end line once the byline, the button and the disclaimer have theirs.
	const fixed = META_BLOCK + GAP + 48 + (byline ? 132 + 48 : 0) + 97 + (brand.showDisclaimer ? 48 + 98 : 0);
	const fit = fitText(text, '', lang, width, [100, 92, 84, 76, 70, 64], layout.sceneHeight - fixed);
	// Spare height goes mostly above the group, so it sits a little above the middle.
	const spare = Math.max(0, layout.sceneHeight - fixed - fit.height);
	return (
		<>
			<Meta index={index} total={total} kind="cta" accentLead instant={instant} />
			<div style={{flexShrink: 0, height: 48 + Math.round(spare * 0.4)}} />
			{byline ? (
				<FadeUp instant={instant} delay={3} style={{flexShrink: 0, display: 'flex', alignItems: 'center', gap: GAP, marginBottom: 48}}>
					<Avatar size={132} />
					<div style={{display: 'flex', flexDirection: 'column', lineHeight: 1.2}}>
						{brand.doctorName ? <span style={{fontSize: 46, fontWeight: 800, color: theme.text}}>{brand.doctorName}</span> : null}
						{brand.handle ? <span style={{fontSize: 36, fontWeight: 600, color: theme.muted, direction: 'ltr', unicodeBidi: 'isolate'}}>{brand.handle}</span> : null}
					</div>
				</FadeUp>
			) : null}
			<Headline fit={fit} kind="cta" instant={instant} delay={6} momentAt={momentAt} />
			<FadeUp instant={instant} delay={12} style={{flexShrink: 0, marginTop: 48, alignSelf: 'flex-start'}}>
				<div style={{display: 'flex', alignItems: 'center', gap: GAP, padding: '24px 48px', background: theme.text, color: theme.bgTop, fontSize: 44, fontWeight: 700}}>
					<BellRing size={40} color={theme.bgTop} strokeWidth={2.2} />
					{strings.subscribe}
				</div>
			</FadeUp>
			{brand.showDisclaimer ? (
				<FadeUp instant={instant} delay={15} style={{flexShrink: 0, marginTop: 48}}>
					<div style={{fontSize: 36, fontWeight: 500, lineHeight: 1.35, color: theme.muted}}>{strings.disclaimer}</div>
				</FadeUp>
			) : null}
		</>
	);
};

const EditorialScene: React.FC<{scene: TimedScene; index: number; total: number; duration: number; last: boolean}> = ({scene, index, total, duration, last}) => {
	const frame = useCurrentFrame();
	const {layout} = useVideo();
	// Headlines are broken into lines by measuring them, which needs the real fonts.
	const fontsLoaded = useFontsLoaded();
	if (!fontsLoaded) return null;
	// The first card is on screen from frame 0: it is the thumbnail and the first second.
	const instant = index === 0;
	// The card's one small moment (underline or strike), about a third of the way in.
	const momentAt = Math.max(12, Math.min(Math.round(duration * 0.3), 30, duration - 18));
	const Card = scene.kind === 'cta' ? EndCard : StoryCard;
	return (
		<div
			style={{
				position: 'absolute',
				left: layout.left,
				right: layout.right,
				top: layout.sceneTop,
				height: layout.sceneHeight,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'stretch',
				opacity: last ? 1 : exitOpacity(frame, duration),
			}}
		>
			<Card scene={scene} index={index} total={total} duration={duration} momentAt={momentAt} instant={instant} />
		</div>
	);
};

/** A calm magazine page: big type on a flat page, thin rules, photos as crisp rectangles. */
export const EditorialTemplate: React.FC<{props: VideoProps}> = ({props}) => {
	const {theme} = useVideo();
	return (
		<>
			<AbsoluteFill style={{background: theme.bgTop}} />
			<SceneSequences
				scenes={props.scenes}
				render={(scene, i, duration) => <EditorialScene scene={scene} index={i} total={props.scenes.length} duration={duration} last={i === props.scenes.length - 1} />}
			/>
			<BrandBar />
			<StoryProgress scenes={props.scenes} />
			<Captions pages={props.captions} />
		</>
	);
};
