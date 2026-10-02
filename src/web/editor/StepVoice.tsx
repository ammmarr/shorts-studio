import {ArrowRight, Check, Loader2, Mic, RefreshCw, RotateCcw, Square, Upload, X} from 'lucide-react';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {VOICE_PITCHES} from '../../shared/themes';
import {buildCaptionPages, estimateDurationMs, replaceWords} from '../../shared/timeline';
import type {VoicePitch} from '../../shared/types';
import {useApp} from '../App';
import {toCleanWav} from '../audio/wav';
import {useRecorder} from '../audio/useRecorder';
import {ActionBar, useFeedback} from '../components/feedback';
import {ErrorNote, ProgressBar} from '../components/ui';
import {haptic, useWakeLock} from '../device';
import {type TKey, useT} from '../i18n';
import type {EditorApi} from '../pages/Editor';
import {mediaUrl} from '../media';

export const PITCH_LABELS: Record<VoicePitch, TKey> = {
	[-3]: 'pitchMuchDeeper',
	[-1.5]: 'pitchDeeper',
	0: 'pitchNatural',
	1.5: 'pitchHigher',
	3: 'pitchMuchHigher',
};

/** Same words and timing, a different tone: so the voice in the video sounds less like her. */
const VoiceDisguise: React.FC<{editor: EditorApi}> = ({editor}) => {
	const {t, tError} = useT();
	const voice = editor.project.voice!;
	const [busy, setBusy] = useState<VoicePitch | null>(null);
	const [changed, setChanged] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const choose = async (pitch: VoicePitch) => {
		if (busy !== null || pitch === voice.pitch) return;
		setBusy(pitch);
		setError(null);
		try {
			await editor.setPitch(pitch);
			setChanged(true);
			haptic(12);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setBusy(null);
		}
	};

	return (
		<>
			{/* A new sound plays straight away so she can hear the difference. */}
			<audio key={voice.url} controls autoPlay={changed} src={mediaUrl(voice.url)} />
			<div className="field">
				<span>{t('voiceSound')}</span>
				<div className="choice-chips" role="radiogroup" aria-label={t('voiceSound')}>
					{VOICE_PITCHES.map((pitch) => (
						<button
							key={pitch}
							type="button"
							role="radio"
							aria-checked={voice.pitch === pitch}
							className={`chip button ${voice.pitch === pitch ? 'on' : ''}`}
							onClick={() => void choose(pitch)}
							disabled={busy !== null}
						>
							{busy === pitch ? <Loader2 size={14} className="spin" /> : null}
							{t(PITCH_LABELS[pitch])}
						</button>
					))}
				</div>
				<small className="muted">{error ? tError(error) : t('voiceSoundHint')}</small>
			</div>
		</>
	);
};

const clock = (ms: number) => {
	const s = Math.floor(ms / 1000);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const ScriptLines: React.FC<{editor: EditorApi}> = ({editor}) => {
	const {t} = useT();
	return (
		<>
			{editor.project.scenes
				.filter((s) => s.narration.trim())
				.map((scene) => (
					<p key={scene.id}>
						<span className="tp-label">{t(`scene_${scene.kind}`)}</span>
						{scene.narration}
					</p>
				))}
		</>
	);
};

type Recorder = ReturnType<typeof useRecorder>;

/** Full-screen teleprompter shown while recording; it scrolls along at speaking pace. */
const RecordingOverlay: React.FC<{editor: EditorApi; recorder: Recorder}> = ({editor, recorder}) => {
	const {t} = useT();
	const scroller = useRef<HTMLDivElement>(null);
	const touchedAt = useRef(0);
	const {project} = editor;
	const estimateMs = useMemo(() => Math.max(5000, estimateDurationMs(project.scenes, project.language)), [project]);

	useEffect(() => {
		const el = scroller.current;
		// Pause auto-scroll for a moment whenever she scrolls by hand.
		if (!el || recorder.state !== 'recording' || Date.now() - touchedAt.current < 3000) return;
		const progress = Math.min(1, Math.max(0, (recorder.elapsedMs - 1500) / estimateMs));
		el.scrollTo({top: progress * (el.scrollHeight - el.clientHeight), behavior: 'smooth'});
	}, [recorder.elapsedMs, recorder.state, estimateMs]);

	const touched = () => {
		touchedAt.current = Date.now();
	};

	return (
		<div className="rec-overlay" role="dialog" aria-modal="true" aria-label={t('recording')}>
			<div className="rec-top">
				{recorder.state === 'countdown' ? (
					<span>{t('getReady')}</span>
				) : (
					<span className="rec-status">
						<span className="rec-dot" /> {clock(recorder.elapsedMs)}
					</span>
				)}
				<span className="level" aria-hidden>
					<span style={{width: `${Math.min(100, recorder.level * 160)}%`}} />
				</span>
			</div>
			<div
				className="rec-script"
				ref={scroller}
				dir={project.language === 'ar' ? 'rtl' : 'ltr'}
				onPointerDown={touched}
				onWheel={touched}
				onTouchMove={touched}
			>
				<ScriptLines editor={editor} />
				<div style={{height: '40vh'}} />
			</div>
			{recorder.state === 'countdown' ? <div className="rec-countdown">{recorder.countdown}</div> : null}
			<div className="rec-bottom">
				<button className="btn ghost rec-cancel" onClick={recorder.reset}>
					<X size={18} /> {t('cancel')}
				</button>
				<button className="rec-stop" onClick={recorder.stop} disabled={recorder.state !== 'recording'} aria-label={t('stopRecording')}>
					<Square size={26} fill="currentColor" />
				</button>
				<span className="rec-cancel" aria-hidden />
			</div>
		</div>
	);
};

const Recorder: React.FC<{editor: EditorApi; onCancel?: () => void}> = ({editor, onCancel}) => {
	const {t} = useT();
	const {settings} = useApp();
	const recorder = useRecorder();
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const recording = recorder.state === 'countdown' || recorder.state === 'recording';
	const previewUrl = useMemo(() => (recorder.blob ? URL.createObjectURL(recorder.blob) : null), [recorder.blob]);
	useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);
	useWakeLock(recording || busy !== null);
	useEffect(() => {
		if (recorder.state === 'recording') haptic(30);
		if (recorder.state === 'done') haptic([15, 50, 15]);
	}, [recorder.state]);

	const use = async (audio: Blob) => {
		setError(null);
		try {
			setBusy(t('cleaningSound'));
			const {wav, durationMs} = await toCleanWav(audio);
			if (durationMs < 1500) throw new Error(t('recordingTooShort'));
			setBusy(t('savingRecording'));
			await editor.saveVoice(wav);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setBusy(null);
		}
	};

	return (
		<>
			<details className="card tips">
				<summary>{t('recordTipsTitle')}</summary>
				<ul>
					<li>{t('recordTip1')}</li>
					<li>{t('recordTip2')}</li>
					<li>{t('recordTip3')}</li>
					<li>{t('recordTip4')}</li>
				</ul>
			</details>

			<div className="teleprompter" dir={editor.project.language === 'ar' ? 'rtl' : 'ltr'}>
				<ScriptLines editor={editor} />
			</div>

			<ErrorNote message={recorder.error ? t('micBlocked') : error} />

			<div className="card recorder">
				{busy ? (
					<div className="busy" role="status">
						<Loader2 size={20} className="spin accent" /> {busy}
					</div>
				) : recorder.state === 'done' && previewUrl ? (
					<>
						<strong>{t('listenBack')}</strong>
						<audio controls src={previewUrl} />
						<div className="actions stack-mobile">
							<button className="btn primary big" onClick={() => recorder.blob && use(recorder.blob)}>
								<Check size={18} /> {t('useRecording')}
							</button>
							<button className="btn big" onClick={recorder.reset}>
								<RotateCcw size={18} /> {t('recordAgain')}
							</button>
						</div>
					</>
				) : (
					<>
						<button className="record-button" onClick={recorder.start} aria-label={t('startRecording')}>
							<span />
						</button>
						<strong>{t('tapToRecord')}</strong>
						<span className="muted small">{t('recordHint')}</span>
						{settings.voicePitch !== 0 ? (
							<span className="muted small">{t('voiceWillSound', {sound: t(PITCH_LABELS[settings.voicePitch])})}</span>
						) : null}
						<label className="btn ghost">
							<Upload size={16} /> {t('uploadInstead')}
							<input hidden type="file" accept="audio/*,.m4a" onChange={(e) => e.target.files?.[0] && use(e.target.files[0])} />
						</label>
						{onCancel ? (
							<button className="btn ghost small" onClick={onCancel}>
								{t('keepCurrent')}
							</button>
						) : null}
					</>
				)}
			</div>

			{recording ? <RecordingOverlay editor={editor} recorder={recorder} /> : null}
		</>
	);
};

/** Caption lines she can correct; the timing of each line is kept. */
const CaptionEditor: React.FC<{editor: EditorApi}> = ({editor}) => {
	const {project, update} = editor;
	const {toast} = useFeedback();
	const {t} = useT();
	const words = project.words ?? [];
	const pages = buildCaptionPages(words, project.language, project.voice?.durationMs ?? 0);
	return (
		<div className="caption-list">
			{pages.map((page) => {
				const text = page.words.map((w) => w.text).join(' ');
				return (
					<label key={`${page.firstIndex}-${text}`} className="caption-line">
						<span className="muted small">{clock(page.startMs)}</span>
						<input
							dir="auto"
							defaultValue={text}
							enterKeyHint="done"
							onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
							onBlur={(e) => {
								if (e.target.value.trim() === text) return;
								update((p) => ({
									...p,
									words: replaceWords(p.words ?? [], page.firstIndex, page.words.length, e.target.value),
								}));
								toast(t('captionFixed'));
							}}
						/>
					</label>
				);
			})}
		</div>
	);
};

export const StepVoice: React.FC<{editor: EditorApi}> = ({editor}) => {
	const {health} = useApp();
	const {t, tError} = useT();
	const {project, captionJob, goTo} = editor;
	const [rerecord, setRerecord] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const voiceUrl = project.voice?.originalUrl;
	const firstVoiceUrl = useRef(voiceUrl);

	// Leave re-record mode once a new recording has been saved.
	useEffect(() => {
		if (voiceUrl && voiceUrl !== firstVoiceUrl.current) {
			firstVoiceUrl.current = voiceUrl;
			setRerecord(false);
		}
	}, [voiceUrl]);

	if (project.scenes.every((s) => !s.narration.trim())) {
		return (
			<div className="step">
				<h1>{t('recordYourVoice')}</h1>
				<div className="note">{t('writeFirst')}</div>
				<ActionBar>
					<button className="btn primary big" onClick={() => goTo('script')}>
						{t('goToScript')}
					</button>
				</ActionBar>
			</div>
		);
	}

	if (!project.voice || rerecord) {
		return (
			<div className="step">
				<h1>{t('readAloud')}</h1>
				<p className="lead">{t('readAloudLead')}</p>
				<Recorder editor={editor} onCancel={project.voice ? () => setRerecord(false) : undefined} />
			</div>
		);
	}

	const run = (action: () => Promise<void>) => () => {
		setError(null);
		action().catch((e: Error) => setError(e.message));
	};

	return (
		<div className="step">
			<h1>{t('yourRecording')}</h1>
			<div className="card recorded form">
				<VoiceDisguise editor={editor} />
				<div className="actions">
					<button className="btn" onClick={() => setRerecord(true)}>
						<Mic size={16} /> {t('recordAgain')}
					</button>
				</div>
			</div>

			<ErrorNote message={error ?? captionJob.error} />

			<h2>{t('captions')}</h2>
			{captionJob.running ? (
				<div className="card" role="status">
					<ProgressBar value={captionJob.progress} label={t('captionsWorking')} />
					<p className="muted small" style={{marginTop: 10}}>
						{t('captionsWait')}
					</p>
				</div>
			) : project.words?.length ? (
				<>
					<p className="muted">{t('captionsFix')}</p>
					<CaptionEditor editor={editor} />
					<button className="btn ghost small" onClick={run(editor.redoCaptions)}>
						<RefreshCw size={14} /> {t('captionsAgain')}
					</button>
				</>
			) : health.whisperReady ? (
				<div className="card">
					<p className="muted">{t('noCaptions')}</p>
					<button className="btn" onClick={run(editor.redoCaptions)}>
						<RefreshCw size={16} /> {t('makeCaptions')}
					</button>
				</div>
			) : (
				<div className="note">{t('captionsOff', {problem: tError(health.whisperProblem)})}</div>
			)}

			<ActionBar>
				<button className="btn primary big" onClick={() => goTo('video')}>
					{t('nextVideo')} <ArrowRight size={18} className="flip-rtl" />
				</button>
			</ActionBar>
		</div>
	);
};
