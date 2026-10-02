import {Clapperboard, Download, FolderOpen, Loader2, PartyPopper, Share2, TriangleAlert} from 'lucide-react';
import React, {useState} from 'react';
import type {VideoProps} from '../../shared/types';
import {api} from '../api';
import {ActionBar, useFeedback} from '../components/feedback';
import {CaptionPositionPicker, CopyButton, ErrorNote, ProgressBar, TemplatePicker, ThemePicker} from '../components/ui';
import {useIsMobile} from '../device';
import {useT} from '../i18n';
import type {EditorApi} from '../pages/Editor';
import {mediaUrl} from '../media';
import {isLocalMode, isPhoneApp} from '../platform';
import {canShareVideos, shareVideo} from '../share';

/** `signature` fingerprints the video as it is now; a render made from anything else is out of date. */
export const StepVideo: React.FC<{editor: EditorApi; videoProps: VideoProps; signature: string}> = ({editor, signature}) => {
	const {project, update, renderJob} = editor;
	const {toast} = useFeedback();
	const {t} = useT();
	const isMobile = useIsMobile();
	const [error, setError] = useState<string | null>(null);
	const [sharing, setSharing] = useState(false);
	const render = project.render;
	const outdated = render ? render.signature !== signature : false;
	const hashtags = project.youtube.hashtags.map((h) => `#${h}`).join(' ');
	const description = [project.youtube.description, hashtags].filter(Boolean).join('\n\n');
	const shareable = canShareVideos();
	const phoneApp = isPhoneApp();

	const share = async () => {
		if (!render) return;
		setSharing(true);
		try {
			await shareVideo(render, project.youtube.title || project.title);
		} catch {
			toast(t('shareFailed'), {tone: 'error'});
		} finally {
			setSharing(false);
		}
	};

	return (
		<div className="step">
			<h1>{t('makeVideoTitle')}</h1>

			{!project.voice ? (
				<div className="note">
					<TriangleAlert size={16} style={{verticalAlign: '-3px'}} /> {t('noVoiceWarning')}{' '}
					<button className="link" onClick={() => editor.goTo('voice')}>
						{t('recordNow')}
					</button>
				</div>
			) : null}

			<section className="card form">
				<div className="field">
					<span>{t('animationStyle')}</span>
					<TemplatePicker value={project.templateId} themeId={project.themeId} onChange={(templateId) => update((p) => ({...p, templateId}))} />
					{isMobile ? <small className="muted">{t('previewTip')}</small> : null}
				</div>
				<div className="field">
					<span>{t('captionPlace')}</span>
					<CaptionPositionPicker
						value={project.captionPosition}
						templateId={project.templateId}
						onChange={(captionPosition) => update((p) => ({...p, captionPosition}))}
					/>
				</div>
				<div className="field">
					<span>{t('colours')}</span>
					<ThemePicker value={project.themeId} onChange={(themeId) => update((p) => ({...p, themeId}))} />
				</div>
			</section>

			<ErrorNote message={error ?? renderJob.error} />

			<section className="card render">
				{renderJob.running ? (
					<div role="status">
						<ProgressBar value={renderJob.progress} label={t('creatingVideo')} />
						<p className="muted small" style={{marginTop: 10}}>
							{isLocalMode ? t('creatingHintPhone') : t('creatingHint')}
						</p>
					</div>
				) : render ? (
					<>
						<div className="ready">
							<PartyPopper size={24} className="accent" />
							<div>
								<strong>{t('videoReady')}</strong>
								<p className="muted small" style={{margin: 0}} dir="auto">
									{render.fileName}
								</p>
							</div>
						</div>
						{outdated ? <div className="note">{t('outdated')}</div> : null}
						{phoneApp && !outdated ? <p className="muted small">{t('shareHint')}</p> : null}
						<video className="final-video" src={mediaUrl(render.url)} controls playsInline preload="metadata" />
					</>
				) : (
					<p className="muted" style={{margin: 0}}>
						{t('happyWithPreview')}
					</p>
				)}
			</section>

			<h2>{t('forYoutube')}</h2>
			<section className="card form">
				<label className="field">
					<span className="field-row">
						{t('titleLabel')} <CopyButton text={project.youtube.title} onCopied={() => toast(t('titleCopied'))} />
					</span>
					<input
						dir="auto"
						value={project.youtube.title}
						placeholder={t('titlePlaceholder')}
						enterKeyHint="done"
						onChange={(e) => update((p) => ({...p, youtube: {...p.youtube, title: e.target.value}}))}
					/>
				</label>
				<label className="field">
					<span className="field-row">
						{t('descriptionLabel')} <CopyButton text={description} label={t('copyWithHashtags')} onCopied={() => toast(t('descriptionCopied'))} />
					</span>
					<textarea
						dir="auto"
						rows={4}
						value={project.youtube.description}
						onChange={(e) => update((p) => ({...p, youtube: {...p.youtube, description: e.target.value}}))}
					/>
				</label>
				<label className="field">
					<span>{t('hashtagsLabel')}</span>
					<input
						dir="auto"
						value={project.youtube.hashtags.join(', ')}
						placeholder="shorts, health, doctor"
						autoCapitalize="none"
						enterKeyHint="done"
						onChange={(e) =>
							update((p) => ({
								...p,
								youtube: {...p.youtube, hashtags: e.target.value.split(/[,،]/).map((h) => h.trim().replace(/^#/, '')).filter(Boolean)},
							}))
						}
					/>
				</label>
			</section>

			<details className="card howto">
				<summary>{t('howToPost')}</summary>
				<ol>
					<li>{t('post1')}</li>
					<li>{t('post2')}</li>
					<li>{t('post3')}</li>
					<li>{t('post4')}</li>
				</ol>
			</details>

			<ActionBar>
				{renderJob.running ? null : render && !outdated ? (
					<>
						{shareable ? (
							<button className="btn primary big" onClick={share} disabled={sharing}>
								{sharing ? <Loader2 size={18} className="spin" /> : <Share2 size={18} />} {phoneApp ? t('shareOrSave') : t('share')}
							</button>
						) : null}
						{phoneApp ? null : (
							<a className={`btn big ${shareable ? '' : 'primary'}`} href={api.downloadUrl(render.fileName)} download={render.fileName}>
								<Download size={18} /> {t('download')}
							</a>
						)}
						{isMobile || isLocalMode ? null : (
							<button className="btn big" onClick={() => api.reveal(render.fileName).catch((e: Error) => setError(e.message))}>
								<FolderOpen size={18} /> {t('showInFolder')}
							</button>
						)}
					</>
				) : (
					<button className="btn primary big" onClick={() => void editor.startRender()}>
						<Clapperboard size={18} /> {render ? t('createAgain') : t('createVideo')}
					</button>
				)}
			</ActionBar>
		</div>
	);
};
