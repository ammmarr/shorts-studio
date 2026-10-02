import {HelpCircle, ListChecks, Loader2, PenLine, ShieldAlert, Sparkles} from 'lucide-react';
import React, {useEffect, useState} from 'react';
import {FORMATS, skeletonScenes} from '../../shared/project';
import {api} from '../api';
import {useApp} from '../App';
import {ActionBar, useFeedback} from '../components/feedback';
import {ErrorNote, Segmented} from '../components/ui';
import {useT} from '../i18n';
import type {EditorApi} from '../pages/Editor';

const FORMAT_ICONS = {tips: ListChecks, myth_fact: ShieldAlert, qa: HelpCircle} as const;
const EXAMPLES = ['example1', 'example2', 'example3'] as const;
const WRITING_TIPS = ['writingTip1', 'writingTip2', 'writingTip3', 'writingTip4'] as const;

export const StepIdea: React.FC<{editor: EditorApi}> = ({editor}) => {
	const {health} = useApp();
	const {confirm} = useFeedback();
	const {t} = useT();
	const {project, update, goTo} = editor;
	const [writing, setWriting] = useState(false);
	const [tip, setTip] = useState(0);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!writing) return;
		const timer = window.setInterval(() => setTip((n) => (n + 1) % WRITING_TIPS.length), 4000);
		return () => window.clearInterval(timer);
	}, [writing]);

	const hasContent = project.scenes.some((s) => s.narration.trim() || s.headline.trim());

	const write = async () => {
		if (hasContent && !(await confirm({title: t('replaceTitle'), message: t('replaceMessage'), confirmLabel: t('replaceConfirm')}))) return;
		setWriting(true);
		setError(null);
		try {
			const script = await api.writeScript(project.idea, project.format, project.language);
			update((p) => ({
				...p,
				title: p.title || script.title,
				scenes: script.scenes,
				reviewNotes: script.reviewNotes,
				youtube: script.youtube,
			}));
			goTo('script');
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setWriting(false);
		}
	};

	const writeMyself = () => {
		if (!hasContent) {
			update((p) => ({...p, scenes: skeletonScenes(p.format)}));
		}
		goTo('script');
	};

	return (
		<div className="step">
			<h1>{t('ideaTitle')}</h1>
			<p className="lead">{t('ideaLead')}</p>

			<section className="card form">
				<textarea
					className="idea"
					dir="auto"
					rows={4}
					enterKeyHint="done"
					aria-label={t('ideaTitle')}
					value={project.idea}
					placeholder={t('forExample', {text: t('example1')})}
					onChange={(e) => update((p) => ({...p, idea: e.target.value}))}
				/>
				{!project.idea ? (
					<div className="examples">
						<span className="muted small">{t('tryLabel')}</span>
						{EXAMPLES.map((key) => (
							<button key={key} type="button" className="chip button" onClick={() => update((p) => ({...p, idea: t(key)}))}>
								{t(key)}
							</button>
						))}
					</div>
				) : null}

				<div className="field">
					<span>{t('typeOfVideo')}</span>
					<div className="format-grid">
						{FORMATS.map((format) => {
							const Icon = FORMAT_ICONS[format];
							return (
								<button
									type="button"
									key={format}
									className={`format-card ${project.format === format ? 'selected' : ''}`}
									onClick={() => update((p) => ({...p, format}))}
									aria-pressed={project.format === format}
								>
									<Icon size={22} />
									<strong>{t(`format_${format}`)}</strong>
									<span className="muted small">{t(`format_${format}_desc`)}</span>
								</button>
							);
						})}
					</div>
				</div>

				<div className="field">
					<span>{t('videoLanguage')}</span>
					<Segmented
						value={project.language}
						options={[
							{value: 'ar', label: 'العربية'},
							{value: 'en', label: 'English'},
						]}
						onChange={(language) => update((p) => ({...p, language}))}
					/>
				</div>
			</section>

			<ErrorNote message={error} />

			{writing ? (
				<div className="card writing" role="status">
					<Loader2 size={24} className="spin accent" />
					<div>
						<strong>{t('writing')}</strong>
						<p className="muted small">
							{t(WRITING_TIPS[tip])} {t('writingTime')}
						</p>
					</div>
				</div>
			) : (
				<ActionBar>
					<button className="btn primary big" onClick={write} disabled={!health.aiEnabled || project.idea.trim().length < 5}>
						<Sparkles size={18} /> {t('writeScript')}
					</button>
					<button className="btn big" onClick={writeMyself}>
						<PenLine size={18} /> {t('writeMyself')}
					</button>
				</ActionBar>
			)}
			{!health.aiEnabled ? <p className="note">{t('aiOff')}</p> : null}
		</div>
	);
};
