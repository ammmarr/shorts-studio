import {ArrowLeft, Check, CloudOff, Film, Lightbulb, Loader2, Mic, PenLine, Play} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {buildVideoProps} from '../../shared/timeline';
import type {Project, RenderInfo, VoicePitch} from '../../shared/types';
import {api, waitForJob, type TranscribeResult} from '../api';
import {navigate, useApp} from '../App';
import {Sheet, useFeedback} from '../components/feedback';
import {PhonePreview} from '../components/PhonePreview';
import {ErrorNote} from '../components/ui';
import {StepIdea} from '../editor/StepIdea';
import {StepScript} from '../editor/StepScript';
import {StepVideo} from '../editor/StepVideo';
import {StepVoice} from '../editor/StepVoice';
import {haptic, useIsMobile, useWakeLock} from '../device';
import {useT} from '../i18n';
import {useIconBodies} from '../icons';
import {getServer} from '../server';

const STEPS = [
	{id: 'idea', label: 'step_idea', Icon: Lightbulb},
	{id: 'script', label: 'step_script', Icon: PenLine},
	{id: 'voice', label: 'step_voice', Icon: Mic},
	{id: 'video', label: 'step_video', Icon: Film},
] as const;

export type JobState = {progress: number; error: string | null; running: boolean};
const idleJob: JobState = {progress: 0, error: null, running: false};

export type EditorApi = {
	project: Project;
	/** Changes the project and autosaves it. */
	update: (updater: (p: Project) => Project) => void;
	goTo: (step: string) => void;
	captionJob: JobState;
	renderJob: JobState;
	/** Uploads a cleaned-up recording and starts the automatic captions. */
	saveVoice: (wav: Blob) => Promise<void>;
	/** Moves the voice up or down so it sounds less like her; remembered for her next videos. */
	setPitch: (pitch: VoicePitch) => Promise<void>;
	removeVoice: () => Promise<void>;
	redoCaptions: () => Promise<void>;
	startRender: () => Promise<void>;
};

export const Editor: React.FC<{id: string; step: string}> = ({id, step}) => {
	const {settings, setSettings} = useApp();
	const [project, setProject] = useState<Project | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
	const [captionJob, setCaptionJob] = useState<JobState>(idleJob);
	const [renderJob, setRenderJob] = useState<JobState>(idleJob);
	const latest = useRef<Project | null>(null);
	const timer = useRef<number | undefined>(undefined);
	const saving = useRef(false);
	const again = useRef(false);
	const isMobile = useIsMobile();
	const [previewOpen, setPreviewOpen] = useState(false);
	const {toast} = useFeedback();
	const {t} = useT();
	// Keep the phone awake while captions or the video are being made.
	useWakeLock(captionJob.running || renderJob.running);

	const apply = useCallback((updater: (p: Project) => Project) => {
		setProject((prev) => {
			if (!prev) return prev;
			const next = updater(prev);
			latest.current = next;
			return next;
		});
	}, []);

	const flush = useCallback(async (): Promise<void> => {
		window.clearTimeout(timer.current);
		timer.current = undefined;
		if (!latest.current) return;
		if (saving.current) {
			again.current = true;
			return;
		}
		saving.current = true;
		setSaveState('saving');
		try {
			const saved = await api.saveProject(latest.current);
			// The server owns the recording and the rendered file; captions it wrote win over an empty list.
			apply((p) => ({...p, voice: saved.voice, render: saved.render, words: p.words ?? saved.words}));
			setSaveState('saved');
		} catch {
			setSaveState('error');
		} finally {
			saving.current = false;
			if (again.current) {
				again.current = false;
				void flush();
			}
		}
	}, [apply]);

	const update = useCallback(
		(updater: (p: Project) => Project) => {
			apply(updater);
			setSaveState('saving');
			window.clearTimeout(timer.current);
			timer.current = window.setTimeout(() => void flush(), 700);
		},
		[apply, flush],
	);

	useEffect(() => {
		api
			.project(id)
			.then((p) => {
				latest.current = p;
				setProject(p);
			})
			.catch((e: Error) => setLoadError(e.message));
		return () => {
			// Save anything typed in the last moment before leaving.
			if (timer.current !== undefined) void flush();
		};
	}, [id, flush]);

	const trackCaptions = useCallback(
		async (jobId: string) => {
			setCaptionJob({progress: 0, error: null, running: true});
			try {
				const result = await waitForJob<TranscribeResult>(jobId, (progress) => setCaptionJob({progress, error: null, running: true}));
				apply((p) => ({...p, words: result.words}));
				setCaptionJob(idleJob);
				toast(t('captionsReady'));
			} catch (e) {
				setCaptionJob({progress: 0, error: (e as Error).message, running: false});
			}
		},
		[apply, toast, t],
	);

	const editor: EditorApi | null = useMemo(() => {
		if (!project) return null;
		return {
			project,
			update,
			goTo: (next) => navigate(`#/v/${id}/${next}`),
			captionJob,
			renderJob,
			saveVoice: async (wav) => {
				await flush();
				const {project: saved, jobId} = await api.uploadVoice(id, wav, settings.voicePitch);
				apply((p) => ({...p, voice: saved.voice, words: null}));
				if (jobId) void trackCaptions(jobId);
			},
			setPitch: async (pitch) => {
				const saved = await api.setVoicePitch(id, pitch);
				apply((p) => ({...p, voice: saved.voice}));
				if (pitch !== settings.voicePitch) {
					void api.saveSettings({voicePitch: pitch}).then(setSettings).catch(() => undefined);
				}
			},
			removeVoice: async () => {
				const saved = await api.removeVoice(id);
				apply((p) => ({...p, voice: saved.voice, words: null}));
			},
			redoCaptions: async () => {
				await flush();
				const {jobId} = await api.transcribe(id);
				void trackCaptions(jobId);
			},
			startRender: async () => {
				await flush();
				setRenderJob({progress: 0, error: null, running: true});
				try {
					const {jobId} = await api.render(id);
					const render = await waitForJob<RenderInfo>(jobId, (progress) => setRenderJob({progress, error: null, running: true}));
					apply((p) => ({...p, render}));
					setRenderJob(idleJob);
					haptic([20, 60, 20]);
					toast(t('videoReady'));
				} catch (e) {
					setRenderJob({progress: 0, error: (e as Error).message, running: false});
				}
			},
		};
	}, [project, update, id, captionJob, renderJob, flush, apply, trackCaptions, toast, t, settings.voicePitch, setSettings]);

	// Drawings for the scene icons, so the preview can show any icon from the library.
	const icons = useIconBodies(project?.scenes.map((s) => s.icon) ?? []);
	const videoProps = useMemo(() => (project ? buildVideoProps(project, settings, {icons, mediaBase: getServer() || undefined}) : null), [project, settings, icons]);
	const previewHint = project?.voice ? t('previewWithVoice') : t('previewNoVoice');

	if (loadError) {
		return (
			<div className="page">
				<ErrorNote message={loadError} />
				<a className="btn" href="#/">
					<ArrowLeft size={18} className="flip-rtl" /> {t('backToShorts')}
				</a>
			</div>
		);
	}
	if (!editor || !videoProps) {
		return <div className="center-screen muted">{t('opening')}</div>;
	}

	const current = STEPS.some((s) => s.id === step) ? step : 'idea';
	const currentIndex = STEPS.findIndex((s) => s.id === current);
	const hasScript = editor.project.scenes.length > 0;
	const saveLabel = saveState === 'saving' ? t('saving') : saveState === 'error' ? t('notSaved') : t('saved');
	const SaveIcon = saveState === 'saving' ? Loader2 : saveState === 'error' ? CloudOff : Check;

	return (
		<div className="page editor">
			{isMobile ? (
				<div className="editor-head mobile">
					<div className="editor-head-row">
						<a className="icon-btn" href="#/" onClick={() => void flush()} aria-label={t('backToShorts')}>
							<ArrowLeft size={20} className="flip-rtl" />
						</a>
						<div className="editor-head-title">
							<span className="text-mono-eyebrow">{t('stepOf', {n: currentIndex + 1, total: STEPS.length})}</span>
							<strong>{t(STEPS[currentIndex].label)}</strong>
						</div>
						<span className={`save-state ${saveState}`} aria-live="polite" title={saveLabel}>
							<SaveIcon size={14} className={saveState === 'saving' ? 'spin' : ''} />
							<span className="sr-only">{saveLabel}</span>
						</span>
						{hasScript ? (
							<button className="btn small" onClick={() => setPreviewOpen(true)}>
								<Play size={14} /> {t('preview')}
							</button>
						) : null}
					</div>
					<div className="step-bars" role="tablist" aria-label="Steps">
						{STEPS.map(({id: stepId, label}, i) => (
							<button
								key={stepId}
								role="tab"
								aria-selected={i === currentIndex}
								aria-label={`${i + 1}. ${t(label)}`}
								className={i <= currentIndex ? 'filled' : ''}
								onClick={() => editor.goTo(stepId)}
							/>
						))}
					</div>
				</div>
			) : (
				<div className="editor-head">
					<a className="btn ghost small" href="#/" onClick={() => void flush()}>
						<ArrowLeft size={16} className="flip-rtl" /> {t('navShorts')}
					</a>
					<ol className="stepper">
						{STEPS.map(({id: stepId, label, Icon}, i) => (
							<li key={stepId} className={i === currentIndex ? 'current' : i < currentIndex ? 'done' : ''}>
								<button onClick={() => editor.goTo(stepId)} aria-current={i === currentIndex ? 'step' : undefined}>
									<span className="step-dot">{i < currentIndex ? <Check size={12} /> : i === currentIndex ? i + 1 : <Icon size={11} />}</span>
									<span>{t(label)}</span>
								</button>
							</li>
						))}
					</ol>
					<span className={`save-state ${saveState}`} aria-live="polite">
						<SaveIcon size={14} className={saveState === 'saving' ? 'spin' : ''} /> {saveState === 'error' ? t('notSavedRetry') : saveLabel}
					</span>
				</div>
			)}

			<div className="two-col">
				<div>
					{current === 'idea' ? <StepIdea editor={editor} /> : null}
					{current === 'script' ? <StepScript editor={editor} /> : null}
					{current === 'voice' ? <StepVoice editor={editor} /> : null}
					{current === 'video' ? <StepVideo editor={editor} videoProps={videoProps} /> : null}
				</div>
				{isMobile ? null : (
					<aside className="preview-col">
						{hasScript ? (
							<>
								<PhonePreview props={videoProps} initialFrame={40} />
								<p className="muted small center">{previewHint}</p>
							</>
						) : (
							<div className="card how">
								<h3>{t('howItWorks')}</h3>
								<p className="muted">{t('howItWorksBody')}</p>
							</div>
						)}
					</aside>
				)}
			</div>

			{isMobile && hasScript ? (
				<>
					<Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title={t('preview')} className="preview-sheet">
						<PhonePreview props={videoProps} initialFrame={40} />
						<p className="muted small center">{previewHint}</p>
					</Sheet>
				</>
			) : null}
		</div>
	);
};
