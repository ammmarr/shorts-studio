import {Check, Copy, Image as ImageIcon, PenLine} from 'lucide-react';
import React, {useState} from 'react';
import {CAPTION_POSITIONS, TEMPLATE_IDS, THEME_LIST, THEMES, type Theme} from '../../shared/themes';
import type {CaptionPosition, TemplateId, ThemeId} from '../../shared/types';
import {useT} from '../i18n';

export const ThemePicker: React.FC<{value: ThemeId; onChange: (id: ThemeId) => void}> = ({value, onChange}) => {
	const {t} = useT();
	return (
		<div className="theme-grid">
			{THEME_LIST.map((theme) => (
				<button
					type="button"
					key={theme.id}
					className={`theme-card ${theme.id === value ? 'selected' : ''}`}
					onClick={() => onChange(theme.id)}
					aria-pressed={theme.id === value}
				>
					<span className="theme-swatch" style={{background: `linear-gradient(160deg, ${theme.bgTop}, ${theme.bgBottom})`}}>
						<span style={{background: theme.accent}} />
						<span style={{background: theme.card, borderColor: theme.cardBorder}} />
					</span>
					<strong>{t(`theme_${theme.id}`)}</strong>
					<span className="muted small">{t(`theme_${theme.id}_desc`)}</span>
					{theme.id === value ? (
						<span className="tick">
							<Check size={12} />
						</span>
					) : null}
				</button>
			))}
		</div>
	);
};

/** A tiny drawing of each animation style, in the chosen colours. */
const TemplateArt: React.FC<{id: TemplateId; theme: Theme}> = ({id, theme}) => {
	const {lang} = useT();
	const bar = (w: string, color = theme.text, h = 5) => <span style={{display: 'block', width: w, height: h, borderRadius: 3, background: color}} />;
	switch (id) {
		case 'whiteboard':
			return (
				<span className="tpl-art" style={{background: '#FFFFFF', backgroundImage: `linear-gradient(${theme.pattern}22 1px, transparent 1px), linear-gradient(90deg, ${theme.pattern}22 1px, transparent 1px)`, backgroundSize: '10px 10px'}}>
					{bar('60%', theme.text, 4)}
					{bar('40%', theme.accent, 4)}
					<PenLine size={18} color={theme.text} style={{position: 'absolute', insetInlineEnd: 8, bottom: 8}} />
				</span>
			);
		case 'photo':
			return (
				<span className="tpl-art" style={{background: `linear-gradient(160deg, ${theme.accent}, ${theme.text})`, justifyContent: 'flex-end'}}>
					<ImageIcon size={20} color={theme.onAccent} style={{position: 'absolute', top: 8, insetInlineStart: 8, opacity: 0.8}} />
					<span className="tpl-bubble" style={{background: theme.card, width: '100%'}}>
						{bar('75%', theme.text, 4)}
						{bar('45%', theme.accent, 3)}
					</span>
				</span>
			);
		case 'prescription':
			return (
				<span className="tpl-art" style={{background: theme.bgBottom}}>
					<span className="tpl-rx" style={{background: '#FFFFFF'}}>
						<span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.accent, color: theme.onAccent, padding: '2px 5px', fontSize: 10, fontWeight: 800, fontStyle: 'italic', fontFamily: 'Georgia, serif'}}>
							{bar('40%', theme.onAccent, 3)}
							Rx
						</span>
						{[theme.fact, theme.myth, theme.fact].map((color, i) => (
							<span key={i} style={{display: 'flex', gap: 4, alignItems: 'center', padding: '0 5px'}}>
								<span style={{width: 6, height: 6, borderRadius: 2, border: `1.5px solid ${color}`}} />
								{bar(i === 1 ? '45%' : '60%', i === 1 ? theme.muted : theme.text, 3)}
							</span>
						))}
					</span>
				</span>
			);
		case 'editorial':
			return (
				<span className="tpl-art" style={{background: theme.bgTop, gap: 5}}>
					<span style={{display: 'flex', justifyContent: 'space-between'}}>
						{bar('22%', theme.muted, 3)}
						<span style={{display: 'block', width: 10, height: 3, background: theme.myth}} />
					</span>
					<span style={{display: 'block', height: 1, background: theme.text, opacity: 0.25}} />
					{bar('82%', theme.text, 7)}
					{bar('58%', theme.text, 7)}
					<span style={{display: 'block', width: '26%', height: 2, background: theme.accent}} />
				</span>
			);
		case 'kinetic':
			return (
				<span className="tpl-art" style={{background: theme.accent, alignItems: 'center'}}>
					<span style={{fontWeight: 900, fontSize: 20, color: theme.onAccent, lineHeight: 1}}>{lang === 'ar' ? 'كلام' : 'ABC'}</span>
					<span style={{fontWeight: 900, fontSize: 13, padding: '1px 6px', borderRadius: 4, background: theme.text, color: theme.bgTop}}>
						{lang === 'ar' ? 'مهم' : 'DEF'}
					</span>
				</span>
			);
		case 'quiz':
			return (
				<span className="tpl-art" style={{background: theme.bgBottom, alignItems: 'center'}}>
					<span style={{width: 26, height: 26, borderRadius: '50%', border: `4px solid ${theme.accent}`, borderTopColor: theme.cardBorder}} />
					<span style={{display: 'flex', gap: 5, width: '80%'}}>
						<span style={{flex: 1, height: 12, borderRadius: 4, background: theme.myth}} />
						<span style={{flex: 1, height: 12, borderRadius: 4, background: theme.fact}} />
					</span>
				</span>
			);
		default:
			return (
				<span className="tpl-art" style={{background: `linear-gradient(160deg, ${theme.bgTop}, ${theme.bgBottom})`, alignItems: 'center'}}>
					<span style={{width: 22, height: 22, borderRadius: '50%', background: theme.accent}} />
					<span className="tpl-bubble" style={{background: theme.card, width: '75%', alignItems: 'center'}}>
						{bar('70%', theme.text, 4)}
					</span>
				</span>
			);
	}
};

export const TemplatePicker: React.FC<{value: TemplateId; themeId: ThemeId; onChange: (id: TemplateId) => void}> = ({value, themeId, onChange}) => {
	const {t} = useT();
	const theme = THEMES[themeId] ?? THEMES.clinic;
	return (
		<div className="template-grid">
			{TEMPLATE_IDS.map((id) => (
				<button type="button" key={id} className={`template-card ${id === value ? 'selected' : ''}`} onClick={() => onChange(id)} aria-pressed={id === value}>
					<TemplateArt id={id} theme={theme} />
					<strong>{t(`tpl_${id}`)}</strong>
					<span className="muted small">{t(`tpl_${id}_desc`)}</span>
					{id === value ? (
						<span className="tick">
							<Check size={12} />
						</span>
					) : null}
				</button>
			))}
		</div>
	);
};

/** Where the captions go, drawn as three small screens; "Bold words" has its words built in. */
export const CaptionPositionPicker: React.FC<{value: CaptionPosition; templateId: TemplateId; onChange: (v: CaptionPosition) => void}> = ({
	value,
	templateId,
	onChange,
}) => {
	const {t} = useT();
	if (templateId === 'kinetic') {
		return <small className="muted">{t('captionsBuiltIn')}</small>;
	}
	return (
		<>
			<div className="caption-grid" role="radiogroup">
				{CAPTION_POSITIONS.map((position) => (
					<button
						type="button"
						key={position}
						role="radio"
						aria-checked={position === value}
						className={`caption-card ${position === value ? 'selected' : ''}`}
						onClick={() => onChange(position)}
					>
						<span className={`caption-art ${position}`} aria-hidden>
							<span className="caption-art-scene" />
							{position === 'off' ? null : <span className="caption-art-line" />}
						</span>
						<strong>{t(`capPos_${position}`)}</strong>
					</button>
				))}
			</div>
			<small className="muted">{t('captionPlaceHint')}</small>
		</>
	);
};

export function Segmented<T extends string>({
	value,
	options,
	onChange,
}: {
	value: T;
	options: {value: T; label: string}[];
	onChange: (value: T) => void;
}) {
	return (
		<div className="segmented" role="radiogroup">
			{options.map((o) => (
				<button
					type="button"
					role="radio"
					aria-checked={o.value === value}
					key={o.value}
					className={o.value === value ? 'on' : ''}
					onClick={() => onChange(o.value)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

export const ProgressBar: React.FC<{value: number; label: string}> = ({value, label}) => (
	<div className="progress">
		<div className="progress-label">
			<span>{label}</span>
			<span>{Math.round(value * 100)}%</span>
		</div>
		<div className="progress-track">
			<div className="progress-fill" style={{width: `${Math.max(3, value * 100)}%`}} />
		</div>
	</div>
);

export const CopyButton: React.FC<{text: string; label?: string; onCopied?: () => void}> = ({text, label, onCopied}) => {
	const {t} = useT();
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Older phone web views: fall back to a hidden text field.
			const field = document.createElement('textarea');
			field.value = text;
			document.body.appendChild(field);
			field.select();
			document.execCommand('copy');
			field.remove();
		}
		setCopied(true);
		onCopied?.();
		setTimeout(() => setCopied(false), 1500);
	};
	return (
		<button type="button" className="btn small" disabled={!text} onClick={() => void copy()}>
			{copied ? <Check size={14} /> : <Copy size={14} />}
			{copied ? t('copied') : (label ?? t('copy'))}
		</button>
	);
};

export const ErrorNote: React.FC<{message: string | null}> = ({message}) => {
	const {tError} = useT();
	return message ? (
		<div className="note error" role="alert">
			{tError(message)}
		</div>
	) : null;
};
