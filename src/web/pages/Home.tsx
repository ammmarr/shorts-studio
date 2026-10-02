import {CheckCircle2, Copy, Film, Mic, PenLine, Plus, Trash2} from 'lucide-react';
import React, {useCallback, useEffect, useState} from 'react';
import type {ProjectSummary} from '../../shared/types';
import {api} from '../api';
import {navigate, useApp} from '../App';
import {Skeleton, useFeedback} from '../components/feedback';
import {ErrorNote} from '../components/ui';
import {haptic} from '../device';
import {useT} from '../i18n';

const Status: React.FC<{p: ProjectSummary}> = ({p}) => {
	const {t} = useT();
	if (p.render) {
		return (
			<span className="chip ok">
				<CheckCircle2 size={13} /> {t('statusReady')}
			</span>
		);
	}
	if (p.hasVoice) {
		return (
			<span className="chip">
				<Mic size={13} /> {t('statusVoice')}
			</span>
		);
	}
	return (
		<span className="chip">
			<PenLine size={13} /> {t('statusDraft')}
		</span>
	);
};

export const Home: React.FC = () => {
	const {createShort, creating} = useApp();
	const {toast} = useFeedback();
	const {t, tError, lang} = useT();
	const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const locale = lang === 'ar' ? 'ar-EG' : undefined;

	const when = (iso: string) => {
		const date = new Date(iso);
		const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
		if (days === 0) return t('today', {time: date.toLocaleTimeString(locale, {hour: 'numeric', minute: '2-digit'})});
		if (days === 1) return t('yesterday');
		return date.toLocaleDateString(locale, {day: 'numeric', month: 'short', year: 'numeric'});
	};

	const load = useCallback(() => api.projects().then(setProjects).catch((e: Error) => setError(e.message)), []);
	useEffect(() => {
		void load();
	}, [load]);

	const duplicate = async (p: ProjectSummary) => {
		try {
			const copy = await api.duplicateProject(p.id);
			toast(t('copyMade'));
			navigate(`#/v/${copy.id}/script`);
		} catch (e) {
			toast(tError((e as Error).message), {tone: 'error'});
		}
	};

	// Delete right away and offer Undo, instead of asking "are you sure?" first.
	const remove = async (p: ProjectSummary) => {
		haptic();
		setProjects((all) => all?.filter((x) => x.id !== p.id) ?? null);
		try {
			await api.deleteProject(p.id);
			toast(t('deleted', {title: p.title || t('untitled')}), {
				action: {
					label: t('undo'),
					run: () => {
						void api
							.restoreProject(p.id)
							.then(load)
							.catch((e: Error) => toast(tError(e.message), {tone: 'error'}));
					},
				},
			});
		} catch (e) {
			toast(tError((e as Error).message), {tone: 'error'});
			void load();
		}
	};

	const open = (p: ProjectSummary) => navigate(`#/v/${p.id}/${p.sceneCount ? 'script' : 'idea'}`);

	return (
		<div className="page">
			<div className="page-head">
				<div>
					<p className="text-mono-eyebrow">{t('homeEyebrow')}</p>
					<h1>{t('navShorts')}</h1>
					<p className="lead">{t('homeLead')}</p>
				</div>
				<button className="btn primary big hide-mobile" onClick={() => void createShort()} disabled={creating}>
					<Plus size={18} /> {t('newShort')}
				</button>
			</div>
			<ErrorNote message={error} />

			{projects === null && !error ? (
				<div className="project-grid" aria-busy="true">
					{[0, 1, 2].map((i) => (
						<div key={i} className="card project-card">
							<Skeleton height={22} width="40%" />
							<div style={{height: 16}} />
							<Skeleton height={20} width="85%" />
							<div style={{height: 8}} />
							<Skeleton height={14} width="55%" />
						</div>
					))}
				</div>
			) : null}

			{projects && projects.length === 0 ? (
				<div className="card empty">
					<span className="empty-icon">
						<Film size={22} />
					</span>
					<h2 style={{marginTop: 0}}>{t('emptyTitle')}</h2>
					<ol className="steps-list">
						{(
							[
								['step_idea', 'emptyIdea'],
								['step_script', 'emptyScript'],
								['step_voice', 'emptyVoice'],
								['step_video', 'emptyVideo'],
							] as const
						).map(([step, text]) => (
							<li key={step}>
								<span>
									<strong>{t(step)}</strong> <span className="muted">– {t(text)}</span>
								</span>
							</li>
						))}
					</ol>
					<div>
						<button className="btn primary big" onClick={() => void createShort()} disabled={creating}>
							<Plus size={18} /> {t('makeFirst')}
						</button>
					</div>
				</div>
			) : null}

			<div className="project-grid">
				{projects?.map((p) => (
					<article key={p.id} className="card project-card" role="link" tabIndex={0} onClick={() => open(p)} onKeyDown={(e) => e.key === 'Enter' && open(p)}>
						<div className="project-card-top">
							<span className="chip">{p.language === 'ar' ? 'العربية' : 'English'}</span>
							<Status p={p} />
						</div>
						<h3 dir="auto">{p.title || (p.idea ? p.idea.slice(0, 60) : t('untitled'))}</h3>
						<p className="muted small">
							{t(`format_${p.format}`)} · {t(`tpl_${p.templateId ?? 'cards'}`)} · {when(p.updatedAt)}
						</p>
						<div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
							<button className="btn ghost small" onClick={() => duplicate(p)}>
								<Copy size={15} /> {t('makeCopy')}
							</button>
							<button className="btn ghost small danger" onClick={() => remove(p)}>
								<Trash2 size={15} /> {t('delete')}
							</button>
						</div>
					</article>
				))}
			</div>
		</div>
	);
};
