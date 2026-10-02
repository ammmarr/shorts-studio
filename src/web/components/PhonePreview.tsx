import {Player} from '@remotion/player';
import {Eye, EyeOff, MessageSquareText, MoreVertical, Music2, Repeat2, Search, Share, ThumbsDown, ThumbsUp} from 'lucide-react';
import React, {useState} from 'react';
import {durationInFrames, FPS, HEIGHT, WIDTH} from '../../shared/timeline';
import type {VideoProps} from '../../shared/types';
import {ShortVideo} from '../../remotion/ShortVideo';
import {useT} from '../i18n';

const OVERLAY_KEY = 'tabeba.showYoutube';

const readOverlayChoice = () => {
	try {
		return localStorage.getItem(OVERLAY_KEY) === '1';
	} catch {
		return false;
	}
};

/**
 * A mock of YouTube's own buttons on top of the preview, so she can see that nothing important
 * hides under them. Arabic viewers get the mirrored layout, as in their YouTube app.
 */
const YoutubeOverlay: React.FC<{handle: string; rtl: boolean}> = ({handle, rtl}) => (
	<div className={`yt-overlay ${rtl ? 'rtl' : ''}`} aria-hidden>
		<div className="yt-top">
			<Search />
			<MoreVertical />
		</div>
		<div className="yt-side">
			<span>
				<ThumbsUp />
				<small>1.2K</small>
			</span>
			<span>
				<ThumbsDown />
			</span>
			<span>
				<MessageSquareText />
				<small>48</small>
			</span>
			<span>
				<Share />
			</span>
			<span>
				<Repeat2 />
			</span>
		</div>
		<div className="yt-bottom">
			<div className="yt-channel">
				<span className="yt-avatar" />
				<strong>{handle || '@channel'}</strong>
				<span className="yt-subscribe">Subscribe</span>
			</div>
			<span className="yt-title" />
			<span className="yt-title short" />
			<div className="yt-audio">
				<Music2 />
				<span className="yt-title short" />
			</div>
		</div>
	</div>
);

/** Live preview of the Short inside a phone frame. */
export const PhonePreview: React.FC<{props: VideoProps; autoPlay?: boolean; initialFrame?: number}> = ({
	props,
	autoPlay = false,
	initialFrame,
}) => {
	const {t} = useT();
	const [showYoutube, setShowYoutube] = useState(readOverlayChoice);
	const toggle = () => {
		setShowYoutube((on) => {
			try {
				localStorage.setItem(OVERLAY_KEY, on ? '0' : '1');
			} catch {
				// remembered for this visit only
			}
			return !on;
		});
	};
	return (
		<div className="phone-wrap">
			<div className="phone">
				<div className="phone-screen">
					<Player
						component={ShortVideo}
						inputProps={props}
						durationInFrames={durationInFrames(props)}
						fps={FPS}
						compositionWidth={WIDTH}
						compositionHeight={HEIGHT}
						style={{width: '100%', height: '100%'}}
						controls
						loop
						autoPlay={autoPlay}
						initialFrame={initialFrame}
						clickToPlay
						acknowledgeRemotionLicense
					/>
					{showYoutube ? <YoutubeOverlay handle={props.brand.handle} rtl={props.language === 'ar'} /> : null}
				</div>
			</div>
			<button type="button" className="btn ghost small yt-toggle" onClick={toggle} aria-pressed={showYoutube}>
				{showYoutube ? <EyeOff size={15} /> : <Eye size={15} />}
				{showYoutube ? t('hideYoutube') : t('showYoutube')}
			</button>
		</div>
	);
};
