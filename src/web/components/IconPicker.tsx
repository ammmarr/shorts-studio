import {Search} from 'lucide-react';
import React, {useEffect, useRef, useState} from 'react';
import {ICONS, type IconName} from '../../shared/icons';
import {api} from '../api';
import {useIsMobile} from '../device';
import {type TKey, useT} from '../i18n';
import {IconSvg, rememberIcons} from '../icons';
import {Sheet} from './feedback';

// Browsable groups: the hand-picked health set first, then Lucide's own categories.
const CATEGORIES = ['health', 'medical', 'science', 'food-beverage', 'people', 'sports', 'nature', 'animals', 'emoji', 'time', 'weather', 'home', 'notifications', 'shapes', 'arrows'];

type Hit = {name: string; body?: string};

const IconBrowser: React.FC<{value: IconName; onPick: (icon: IconName) => void; autoFocus: boolean}> = ({value, onPick, autoFocus}) => {
	const {t} = useT();
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState('health');
	const [hits, setHits] = useState<Hit[] | null>(null);
	const [offline, setOffline] = useState(false);
	const [total, setTotal] = useState(0);

	// Search as she types (after a short pause), or browse the chosen group.
	useEffect(() => {
		let cancelled = false;
		const timer = window.setTimeout(
			() => {
				api
					.icons(query.trim(), query.trim() ? '' : category)
					.then((res) => {
						if (cancelled) return;
						rememberIcons(res.icons);
						setHits(res.icons);
						setTotal(res.total);
						setOffline(false);
					})
					.catch(() => {
						if (cancelled) return;
						// No library: fall back to the built-in health icons, filtered locally.
						const q = query.trim().toLowerCase();
						setHits(ICONS.filter(([name, words]) => !q || name.includes(q) || words.includes(q)).map(([name]) => ({name})));
						setOffline(true);
					});
			},
			query ? 250 : 0,
		);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [query, category]);

	return (
		<>
			<label className="search">
				<Search size={16} />
				<input
					autoFocus={autoFocus}
					placeholder={t('searchPictures')}
					value={query}
					autoCapitalize="none"
					enterKeyHint="search"
					dir="auto"
					onChange={(e) => setQuery(e.target.value)}
				/>
			</label>
			{!query && !offline ? (
				<div className="category-chips" role="tablist">
					{CATEGORIES.map((id) => (
						<button key={id} type="button" role="tab" aria-selected={category === id} className={`chip button ${category === id ? 'on' : ''}`} onClick={() => setCategory(id)}>
							{t(`cat_${id}` as TKey)}
						</button>
					))}
				</div>
			) : null}
			{offline ? <p className="muted small">{t('picturesOffline')}</p> : null}
			{hits === null ? (
				<p className="muted small">{t('picturesLoading')}</p>
			) : (
				<>
					<div className="icon-grid">
						{hits.map((hit) => (
							<button
								type="button"
								key={hit.name}
								className={hit.name === value ? 'selected' : ''}
								title={hit.name.replace(/-/g, ' ')}
								aria-label={hit.name.replace(/-/g, ' ')}
								onClick={() => onPick(hit.name)}
							>
								<IconSvg name={hit.name} body={hit.body} size={24} />
							</button>
						))}
					</div>
					{hits.length === 0 ? <p className="muted small">{t('noMatch')}</p> : null}
					{query && total > hits.length ? <p className="muted small">{t('pictureCount', {n: total})}</p> : null}
				</>
			)}
		</>
	);
};

/** Popover on desktop, bottom sheet on phones. */
export const IconPicker: React.FC<{value: IconName; onChange: (icon: IconName) => void}> = ({value, onChange}) => {
	const {t} = useT();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const isMobile = useIsMobile();

	useEffect(() => {
		if (!open || isMobile) return;
		const close = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener('mousedown', close);
		return () => document.removeEventListener('mousedown', close);
	}, [open, isMobile]);

	const pick = (icon: IconName) => {
		onChange(icon);
		setOpen(false);
	};

	return (
		<div className="icon-picker" ref={ref}>
			<button type="button" className="icon-button" onClick={() => setOpen(!open)} aria-label={t('changePicture')}>
				<IconSvg name={value} size={28} />
				<span>{t('change')}</span>
			</button>
			{open && !isMobile ? (
				<div className="icon-popover">
					<IconBrowser value={value} onPick={pick} autoFocus />
				</div>
			) : null}
			{isMobile ? (
				<Sheet open={open} onClose={() => setOpen(false)} title={t('choosePicture')}>
					<IconBrowser value={value} onPick={pick} autoFocus={false} />
				</Sheet>
			) : null}
		</div>
	);
};
