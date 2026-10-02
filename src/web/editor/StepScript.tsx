import {ArrowDown, ArrowRight, ArrowUp, EllipsisVertical, ImagePlus, Loader2, Plus, Stethoscope, Trash2, TriangleAlert, X} from 'lucide-react';
import React, {useState} from 'react';
import {blankScene} from '../../shared/project';
import {estimateDurationMs, splitWords, stripMarkup} from '../../shared/timeline';
import type {Scene, SceneKind} from '../../shared/types';
import {api} from '../api';
import {ActionBar, Sheet, useFeedback} from '../components/feedback';
import {IconPicker} from '../components/IconPicker';
import {useT} from '../i18n';
import {shrinkImage} from '../images';
import type {EditorApi} from '../pages/Editor';
import {mediaUrl} from '../media';

const KIND_OPTIONS: SceneKind[] = ['hook', 'point', 'myth', 'fact', 'cta'];

// A small coloured dot tells card types apart at a glance.
const KIND_DOT: Record<SceneKind, string> = {
	hook: 'var(--color-link)',
	point: 'var(--color-mute)',
	myth: 'var(--color-error)',
	fact: 'var(--color-cyan)',
	cta: 'var(--color-violet)',
};

const Duration: React.FC<{ms: number; recorded: boolean}> = ({ms, recorded}) => {
	const {t} = useT();
	const seconds = Math.round(ms / 1000);
	const tone = seconds === 0 ? '' : seconds < 25 ? 'warn' : seconds <= 60 ? 'ok' : 'warn';
	const advice = seconds === 0 ? t('lengthEmpty') : seconds < 25 ? t('lengthShort') : seconds <= 60 ? t('lengthGood') : t('lengthLong');
	return (
		<div className={`duration ${tone}`}>
			<strong>{recorded ? t('seconds', {n: seconds}) : t('aboutSeconds', {n: seconds})}</strong>
			<span>{advice}</span>
		</div>
	);
};

/** The card's picture: one of her photos, or an icon from the library. */
const ScenePicture: React.FC<{scene: Scene; onChange: (patch: Partial<Scene>) => void}> = ({scene, onChange}) => {
	const {t, tError} = useT();
	const {toast} = useFeedback();
	const [uploading, setUploading] = useState(false);

	const pick = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		try {
			const {url} = await api.uploadImage(await shrinkImage(file));
			onChange({image: url});
		} catch (e) {
			toast(tError((e as Error).message), {tone: 'error'});
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="scene-picture">
			{scene.image ? (
				<div className="photo-tile">
					<img src={mediaUrl(scene.image)} alt="" />
					<button type="button" className="photo-remove" onClick={() => onChange({image: null})} aria-label={t('removePhoto')}>
						<X size={14} />
					</button>
				</div>
			) : (
				<IconPicker value={scene.icon} onChange={(icon) => onChange({icon})} />
			)}
			<label className={`btn small photo-add ${uploading ? 'busy' : ''}`}>
				{uploading ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />}
				{scene.image ? t('change') : t('photo')}
				<input hidden type="file" accept="image/*" disabled={uploading} onChange={(e) => void pick(e.target.files?.[0])} />
			</label>
		</div>
	);
};

export const StepScript: React.FC<{editor: EditorApi}> = ({editor}) => {
	const {project, update, goTo} = editor;
	const {toast} = useFeedback();
	const {t} = useT();
	const [menuFor, setMenuFor] = useState<string | null>(null);
	const [smallLineFor, setSmallLineFor] = useState<Set<string>>(() => new Set());
	const dir = project.language === 'ar' ? 'rtl' : 'ltr';

	const setScene = (id: string, patch: Partial<Scene>) =>
		update((p) => ({...p, scenes: p.scenes.map((s) => (s.id === id ? {...s, ...patch} : s))}));

	const move = (index: number, delta: number) =>
		update((p) => {
			const scenes = [...p.scenes];
			const [scene] = scenes.splice(index, 1);
			scenes.splice(index + delta, 0, scene);
			return {...p, scenes};
		});

	// Remove at once and offer Undo.
	const remove = (scene: Scene, index: number) => {
		update((p) => ({...p, scenes: p.scenes.filter((s) => s.id !== scene.id)}));
		toast(t('cardRemoved'), {
			action: {
				label: t('undo'),
				run: () =>
					update((p) => {
						const scenes = [...p.scenes];
						scenes.splice(Math.min(index, scenes.length), 0, scene);
						return {...p, scenes};
					}),
			},
		});
	};

	const add = (kind: SceneKind) =>
		update((p) => {
			// New cards go before the ending card.
			const endIndex = p.scenes.findIndex((s) => s.kind === 'cta');
			const scenes = [...p.scenes];
			scenes.splice(endIndex === -1 ? scenes.length : endIndex, 0, blankScene(kind));
			return {...p, scenes};
		});

	const menuIndex = project.scenes.findIndex((s) => s.id === menuFor);
	const menuScene = menuIndex === -1 ? null : project.scenes[menuIndex];
	const closeMenu = () => setMenuFor(null);
	let pointNumber = 0;

	return (
		<div className="step">
			<h1>{t('scriptTitle')}</h1>
			<p className="lead">{t('scriptLead')}</p>

			<label className="field">
				<span>{t('videoName')}</span>
				<input dir="auto" value={project.title} placeholder={t('videoNamePlaceholder')} onChange={(e) => update((p) => ({...p, title: e.target.value}))} />
			</label>

			{project.reviewNotes.length > 0 ? (
				<div className="note review">
					<div className="note-title">
						<Stethoscope size={20} /> {t('doctorsCheck')}
					</div>
					<ul dir="auto">
						{project.reviewNotes.map((note, i) => (
							<li key={i}>{note}</li>
						))}
					</ul>
				</div>
			) : null}

			<Duration ms={project.voice ? project.voice.durationMs : estimateDurationMs(project.scenes, project.language)} recorded={Boolean(project.voice)} />

			{project.scenes.map((scene) => {
				const number = scene.kind === 'point' ? ++pointNumber : null;
				const words = splitWords(scene.narration).length;
				const long = stripMarkup(scene.headline).length > 45;
				const showSmallLine = scene.kind !== 'cta' && (scene.subtext.trim() !== '' || smallLineFor.has(scene.id));
				return (
					<section key={scene.id} className="card scene-card">
						<div className="scene-head">
							<span className="dot" style={{background: KIND_DOT[scene.kind]}} aria-hidden />
							<strong className="scene-kind">{t(`scene_${scene.kind}`)}</strong>
							{number !== null ? <span className="muted small mono">#{number}</span> : null}
							<span className="spacer" />
							<button className="icon-btn" onClick={() => setMenuFor(scene.id)} aria-label={t('cardOptions')} title={t('cardOptions')}>
								<EllipsisVertical size={20} />
							</button>
						</div>
						<div className="scene-body">
							<ScenePicture scene={scene} onChange={(patch) => setScene(scene.id, patch)} />
							<div className="scene-fields">
								<label className="field">
									<span>{t('textOnScreen')}</span>
									<input dir={dir} value={scene.headline} placeholder={t(`hint_${scene.kind}`)} onChange={(e) => setScene(scene.id, {headline: e.target.value})} />
									{long ? <small className="warn-text">{t('longText')}</small> : null}
								</label>
								{showSmallLine ? (
									<label className="field">
										<span>{t('smallLine')}</span>
										<input dir={dir} value={scene.subtext} onChange={(e) => setScene(scene.id, {subtext: e.target.value})} />
									</label>
								) : null}
								<label className="field">
									<span>{t('whatYouSay')}</span>
									<textarea dir={dir} rows={3} value={scene.narration} onChange={(e) => setScene(scene.id, {narration: e.target.value})} />
									{words === 0 ? (
										<small className="warn-text">
											<TriangleAlert size={14} /> {t('noNarration')}
										</small>
									) : (
										<small className="muted">{t('wordCount', {n: words})}</small>
									)}
								</label>
								{!showSmallLine && scene.kind !== 'cta' ? (
									<button type="button" className="link small" onClick={() => setSmallLineFor((all) => new Set(all).add(scene.id))}>
										<Plus size={14} /> {t('addSmallLine')}
									</button>
								) : null}
							</div>
						</div>
					</section>
				);
			})}

			<div className="add-row">
				<span className="muted small">{t('addCard')}</span>
				{(['point', 'myth', 'fact'] as const).map((kind) => (
					<button key={kind} className="btn small" onClick={() => add(kind)}>
						<Plus size={16} /> {t(`scene_${kind}`)}
					</button>
				))}
				{!project.scenes.some((s) => s.kind === 'cta') ? (
					<button className="btn small" onClick={() => add('cta')}>
						<Plus size={16} /> {t('scene_cta')}
					</button>
				) : null}
			</div>

			{/* Less-used card actions live here, so each card stays simple. */}
			<Sheet open={menuScene !== null} onClose={closeMenu} title={t('cardOptions')}>
				{menuScene ? (
					<div className="card-menu">
						<div className="field">
							<span>{t('cardType')}</span>
							<div className="choice-chips" role="radiogroup" aria-label={t('cardType')}>
								{KIND_OPTIONS.map((kind) => (
									<button
										key={kind}
										type="button"
										role="radio"
										aria-checked={menuScene.kind === kind}
										className={`chip button ${menuScene.kind === kind ? 'on' : ''}`}
										onClick={() => setScene(menuScene.id, {kind})}
									>
										<span className="dot" style={{background: KIND_DOT[kind]}} aria-hidden /> {t(`scene_${kind}`)}
									</button>
								))}
							</div>
						</div>
						<div className="menu-list">
							<button
								className="menu-item"
								disabled={menuIndex === 0}
								onClick={() => {
									move(menuIndex, -1);
									closeMenu();
								}}
							>
								<ArrowUp size={20} /> {t('moveUp')}
							</button>
							<button
								className="menu-item"
								disabled={menuIndex === project.scenes.length - 1}
								onClick={() => {
									move(menuIndex, 1);
									closeMenu();
								}}
							>
								<ArrowDown size={20} /> {t('moveDown')}
							</button>
							<button
								className="menu-item danger"
								onClick={() => {
									closeMenu();
									remove(menuScene, menuIndex);
								}}
							>
								<Trash2 size={20} /> {t('removeCard')}
							</button>
						</div>
					</div>
				) : null}
			</Sheet>

			<ActionBar>
				<button className="btn primary big" onClick={() => goTo('voice')} disabled={project.scenes.length === 0}>
					{t('nextVoice')} <ArrowRight size={18} className="flip-rtl" />
				</button>
			</ActionBar>
		</div>
	);
};
