import {Camera, Check, Loader2, Music, Play, Smartphone, Trash2, UserRound} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {VIDEO_STRINGS} from '../../shared/strings';
import {VOICE_PITCHES} from '../../shared/themes';
import {buildVideoProps} from '../../shared/timeline';
import type {Settings} from '../../shared/types';
import {sampleProject} from '../../remotion/sample';
import {api} from '../api';
import {navigate, useApp} from '../App';
import {ActionBar, Sheet, useFeedback} from '../components/feedback';
import {PhonePreview} from '../components/PhonePreview';
import {CaptionPositionPicker, CopyButton, ErrorNote, Segmented, TemplatePicker, ThemePicker} from '../components/ui';
import {useIsMobile} from '../device';
import {PITCH_LABELS} from '../editor/StepVoice';
import {useT} from '../i18n';
import {getServer, isPhoneApp, serverUrl} from '../server';

/** Crops a photo to a centred square and shrinks it: the video only shows it small, in a circle. */
const shrinkPhoto = async (file: File): Promise<File> => {
	try {
		const bitmap = await createImageBitmap(file);
		const side = Math.min(bitmap.width, bitmap.height);
		const size = Math.min(512, side);
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
		return blob ? new File([blob], 'photo.jpg', {type: 'image/jpeg'}) : file;
	} catch {
		return file;
	}
};

const normalizeHandle = (handle: string) => {
	const h = handle.trim().replace(/\s+/g, '');
	return h && !h.startsWith('@') ? `@${h}` : h;
};

/** Channel look: saved automatically, used by every new video. Also the first-run welcome screen. */
export const Channel: React.FC = () => {
	const {settings, setSettings, health, changeServer} = useApp();
	const {t, tError} = useT();
	const {toast} = useFeedback();
	const isMobile = useIsMobile();
	const [draft, setDraft] = useState<Settings>(settings);
	const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
	const [error, setError] = useState<string | null>(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [uploading, setUploading] = useState(false);
	const pending = useRef<Partial<Settings>>({});
	const timer = useRef<number | undefined>(undefined);
	const firstRun = !settings.setupDone;

	const flush = useCallback(async () => {
		window.clearTimeout(timer.current);
		const changes = pending.current;
		pending.current = {};
		if (Object.keys(changes).length === 0) return;
		setSaveState('saving');
		try {
			setSettings(await api.saveSettings(changes));
			setSaveState(Object.keys(pending.current).length ? 'saving' : 'saved');
		} catch (e) {
			pending.current = {...changes, ...pending.current};
			setSaveState('error');
			setError((e as Error).message);
		}
	}, [setSettings]);

	// Every change is saved on its own: text after a short pause, choices right away.
	const change = <K extends keyof Settings>(key: K, value: Settings[K], delay = 0) => {
		setDraft((d) => ({...d, [key]: value}));
		pending.current = {...pending.current, [key]: value};
		setSaveState('saving');
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => void flush(), delay);
	};

	useEffect(
		() => () => {
			// Leaving the page: save whatever was typed last.
			void flush();
		},
		[flush],
	);

	const upload = async (kind: 'logo' | 'music', file: File | undefined) => {
		if (!file) return;
		setError(null);
		setUploading(kind === 'logo');
		try {
			const next = kind === 'logo' ? await api.uploadLogo(await shrinkPhoto(file)) : await api.uploadMusic(file);
			setSettings(next);
			setDraft((d) => ({...d, logoUrl: next.logoUrl, musicUrl: next.musicUrl}));
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setUploading(false);
		}
	};

	const finishSetup = async () => {
		pending.current = {...pending.current, handle: normalizeHandle(draft.handle), setupDone: true};
		await flush();
		toast(t('allSet'));
		navigate('#/');
	};

	// The preview shows her name, photo, colours and animation style.
	const preview = useMemo(() => {
		const project = {...sampleProject(draft.language, draft.themeId), templateId: draft.templateId, captionPosition: draft.captionPosition};
		return buildVideoProps(project, draft, {mediaBase: getServer() || undefined});
	}, [draft]);
	const previewKey = `${draft.language}-${draft.themeId}-${draft.templateId}-${draft.captionPosition}`;
	const photoInput = (
		<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload('logo', e.target.files?.[0])} />
	);

	return (
		<div className="page two-col">
			<div>
				<div className="page-head">
					<div>
						{firstRun ? <p className="text-mono-eyebrow">{t('welcomeEyebrow', {app: t('appName')})}</p> : null}
						<h1>{firstRun ? t('channelSetupTitle') : t('channelTitle')}</h1>
						<p className="lead">{firstRun ? t('channelSetupLead') : t('channelLead')}</p>
					</div>
					{!firstRun ? (
						<span className={`save-state ${saveState}`} aria-live="polite">
							{saveState === 'saving' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
							{saveState === 'saving' ? t('saving') : saveState === 'error' ? t('notSaved') : t('saved')}
						</span>
					) : null}
				</div>
				{isMobile ? (
					<button className="btn preview-inline" onClick={() => setPreviewOpen(true)}>
						<Play size={16} /> {t('seeLook')}
					</button>
				) : null}
				<ErrorNote message={error} />

				<section className="card form">
					<div className="avatar-upload">
						<label className={`avatar-drop ${draft.logoUrl ? 'has-photo' : ''}`} aria-label={draft.logoUrl ? t('changePhoto') : t('uploadPhoto')}>
							{draft.logoUrl ? <img src={serverUrl(draft.logoUrl)} alt="" /> : <UserRound size={44} strokeWidth={1.5} />}
							<span className="avatar-badge">{uploading ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}</span>
							{photoInput}
						</label>
						<div className="avatar-text">
							<span className="text-label-sm">{t('photoLabel')}</span>
							<span className="muted small">{t('photoHint')}</span>
							<div className="avatar-actions">
								<label className="btn small">
									<Camera size={15} /> {draft.logoUrl ? t('changePhoto') : t('uploadPhoto')}
									{photoInput}
								</label>
								{draft.logoUrl ? (
									<button className="btn ghost small danger" onClick={() => change('logoUrl', null)}>
										<Trash2 size={15} /> {t('remove')}
									</button>
								) : null}
							</div>
						</div>
					</div>
					<label className="field">
						<span>{t('nameLabel')}</span>
						<input
							dir="auto"
							value={draft.doctorName}
							placeholder={t('namePlaceholder')}
							autoComplete="name"
							enterKeyHint="next"
							onChange={(e) => change('doctorName', e.target.value, 700)}
						/>
					</label>
					<label className="field">
						<span>{t('handleLabel')}</span>
						<input
							dir="ltr"
							value={draft.handle}
							placeholder="@yourchannel"
							autoCapitalize="none"
							autoCorrect="off"
							spellCheck={false}
							enterKeyHint="done"
							onChange={(e) => change('handle', e.target.value, 700)}
							onBlur={() => draft.handle !== normalizeHandle(draft.handle) && change('handle', normalizeHandle(draft.handle))}
						/>
					</label>
				</section>

				<section className="card form">
					<div className="field">
						<span>{t('appLanguage')}</span>
						<Segmented
							value={draft.uiLanguage}
							options={[
								{value: 'ar', label: 'العربية'},
								{value: 'en', label: 'English'},
							]}
							onChange={(v) => change('uiLanguage', v)}
						/>
					</div>
					<div className="field">
						<span>{t('videoLanguageDefault')}</span>
						<Segmented
							value={draft.language}
							options={[
								{value: 'ar', label: 'العربية'},
								{value: 'en', label: 'English'},
							]}
							onChange={(v) => change('language', v)}
						/>
					</div>
					<div className="field">
						<span>{t('dialectLabel')}</span>
						<Segmented
							value={draft.dialect}
							options={[
								{value: 'egyptian', label: t('dialectEgyptian')},
								{value: 'msa', label: t('dialectMsa')},
							]}
							onChange={(v) => change('dialect', v)}
						/>
					</div>
				</section>

				<section className="card form">
					<div className="field">
						<span>{t('styleDefault')}</span>
						<TemplatePicker value={draft.templateId} themeId={draft.themeId} onChange={(v) => change('templateId', v)} />
					</div>
					<div className="field">
						<span>{t('colours')}</span>
						<ThemePicker value={draft.themeId} onChange={(v) => change('themeId', v)} />
					</div>
					<div className="field">
						<span>{t('captionPlace')}</span>
						<CaptionPositionPicker value={draft.captionPosition} templateId={draft.templateId} onChange={(v) => change('captionPosition', v)} />
					</div>
					<div className="field">
						<span>{t('voiceSound')}</span>
						<div className="choice-chips" role="radiogroup" aria-label={t('voiceSound')}>
							{VOICE_PITCHES.map((pitch) => (
								<button
									key={pitch}
									type="button"
									role="radio"
									aria-checked={draft.voicePitch === pitch}
									className={`chip button ${draft.voicePitch === pitch ? 'on' : ''}`}
									onClick={() => change('voicePitch', pitch)}
								>
									{t(PITCH_LABELS[pitch])}
								</button>
							))}
						</div>
						<small className="muted">{t('voiceDefaultHint')}</small>
					</div>
					</section>

				<section className="card form">
					<label className="field">
						<span>{t('endLineLabel')}</span>
						<input dir="auto" value={draft.endCardText} placeholder={VIDEO_STRINGS[draft.language].follow} onChange={(e) => change('endCardText', e.target.value, 700)} />
						<small className="muted">{t('endLineHint', {text: VIDEO_STRINGS[draft.language].follow})}</small>
					</label>
					<label className="check">
						<input type="checkbox" checked={draft.showDisclaimer} onChange={(e) => change('showDisclaimer', e.target.checked)} />
						<span>{t('disclaimerCheck', {text: VIDEO_STRINGS[draft.language].disclaimer})}</span>
					</label>
					<div className="field">
						<span>{t('musicLabel')}</span>
						<div className="upload-row">
							{draft.musicUrl ? <audio controls src={serverUrl(draft.musicUrl)} /> : <span className="muted small">{t('noMusic')}</span>}
							<label className="btn">
								<Music size={18} /> {draft.musicUrl ? t('change') : t('uploadMp3')}
								<input hidden type="file" accept="audio/mpeg,audio/wav,audio/ogg" onChange={(e) => upload('music', e.target.files?.[0])} />
							</label>
							{draft.musicUrl ? (
								<button className="btn ghost danger" onClick={() => change('musicUrl', null)}>
									<Trash2 size={18} /> {t('remove')}
								</button>
							) : null}
						</div>
						<small className="muted">{t('musicHint')}</small>
					</div>
				</section>

				{isPhoneApp() ? (
					<section className="card phone-link">
						<Smartphone size={22} className="accent" />
						<div>
							<strong>{t('connectedTo')}</strong>
							<p className="muted small mono" dir="ltr">
								{getServer().replace(/^https?:\/\//, '')}
							</p>
						</div>
						<button className="btn small" onClick={changeServer}>
							{t('change')}
						</button>
					</section>
				) : health.addresses.length > 0 ? (
					<section className="card phone-link">
						<Smartphone size={22} className="accent" />
						<div>
							<strong>{t('usePhoneTitle')}</strong>
							<p className="muted small">{t('usePhoneBody')}</p>
							{health.addresses.map((address) => (
								<p key={address} className="phone-address mono" dir="ltr">
									{address.replace(/^http:\/\//, '')}
									<CopyButton text={address.replace(/^http:\/\//, '')} onCopied={() => toast(t('copied'))} />
								</p>
							))}
						</div>
					</section>
				) : null}

				{firstRun ? (
					<ActionBar>
						<button className="btn primary big" onClick={() => void finishSetup().catch((e: Error) => setError(tError(e.message)))}>
							{t('start')}
						</button>
					</ActionBar>
				) : null}
			</div>
			{isMobile ? (
				<Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title={t('howVideosLook')} className="preview-sheet">
					<PhonePreview key={previewKey} props={preview} initialFrame={60} />
				</Sheet>
			) : (
				<aside className="preview-col">
					<p className="muted small center">{t('howVideosLook')}</p>
					<PhonePreview key={previewKey} props={preview} initialFrame={60} />
				</aside>
			)}
		</div>
	);
};
