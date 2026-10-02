import {X} from 'lucide-react';
import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {useT} from '../i18n';

// ---------- Bottom sheet (centered dialog on wide screens) ----------

// The phone's Back button closes the top open sheet instead of leaving the page. All open sheets
// share one extra history entry; closing the last one from the screen removes it again.
const openSheets: (() => void)[] = [];
let ignoreNextBack = false;

const onBack = () => {
	if (ignoreNextBack) {
		ignoreNextBack = false;
		return;
	}
	const close = openSheets.pop();
	if (!close) return;
	if (openSheets.length > 0) window.history.pushState({sheet: true}, '');
	close();
};

const registerSheet = (close: () => void) => {
	if (openSheets.length === 0) {
		window.addEventListener('popstate', onBack);
		window.history.pushState({sheet: true}, '');
	}
	openSheets.push(close);
	return () => {
		const index = openSheets.indexOf(close);
		if (index === -1) return;
		openSheets.splice(index, 1);
		if (openSheets.length === 0 && (window.history.state as {sheet?: boolean} | null)?.sheet) {
			ignoreNextBack = true;
			window.history.back();
		}
	};
};


export const Sheet: React.FC<{
	open: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	className?: string;
}> = ({open, onClose, title, children, className = ''}) => {
	const {t} = useT();
	const closeRef = useRef(onClose);
	closeRef.current = onClose;
	useEffect(() => {
		if (!open) return;
		return registerSheet(() => closeRef.current());
	}, [open]);
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		document.addEventListener('keydown', onKey);
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = previous;
		};
	}, [open, onClose]);
	if (!open) return null;
	return (
		<div className="sheet-backdrop" onClick={onClose}>
			<div
				className={`sheet ${className}`}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="sheet-grabber" aria-hidden />
				{title ? (
					<div className="sheet-head">
						<h3>{title}</h3>
						<button className="icon-btn" onClick={onClose} aria-label={t('close')}>
							<X size={18} />
						</button>
					</div>
				) : null}
				<div className="sheet-body">{children}</div>
			</div>
		</div>
	);
};

// ---------- Toasts and confirmations ----------

type ToastOptions = {action?: {label: string; run: () => void}; tone?: 'default' | 'error'};
type Toast = ToastOptions & {id: number; message: string};
type ConfirmOptions = {title: string; message?: string; confirmLabel: string; danger?: boolean};

type Feedback = {
	toast: (message: string, options?: ToastOptions) => void;
	confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<Feedback | null>(null);

export const useFeedback = () => {
	const value = useContext(FeedbackContext);
	if (!value) throw new Error('useFeedback outside FeedbackProvider');
	return value;
};

export const FeedbackProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
	const {t} = useT();
	const [toasts, setToasts] = useState<Toast[]>([]);
	const [pending, setPending] = useState<(ConfirmOptions & {resolve: (ok: boolean) => void}) | null>(null);
	const nextId = useRef(1);

	const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

	const toast = useCallback(
		(message: string, options: ToastOptions = {}) => {
			const id = nextId.current++;
			setToasts((all) => [...all.slice(-2), {id, message, ...options}]);
			window.setTimeout(() => dismiss(id), options.action ? 6000 : 3500);
		},
		[dismiss],
	);

	const confirm = useCallback(
		(options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({...options, resolve})),
		[],
	);

	const answer = (ok: boolean) => {
		pending?.resolve(ok);
		setPending(null);
	};

	return (
		<FeedbackContext.Provider value={{toast, confirm}}>
			{children}
			<div className="toast-stack" aria-live="polite">
				{toasts.map((t) => (
					<div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`} role="status">
						<span>{t.message}</span>
						{t.action ? (
							<button
								className="toast-action"
								onClick={() => {
									t.action!.run();
									dismiss(t.id);
								}}
							>
								{t.action.label}
							</button>
						) : null}
					</div>
				))}
			</div>
			<Sheet open={pending !== null} onClose={() => answer(false)} className="confirm">
				{pending ? (
					<>
						<h3>{pending.title}</h3>
						{pending.message ? <p className="muted">{pending.message}</p> : null}
						<div className="sheet-actions">
							<button className="btn big" onClick={() => answer(false)}>
								{t('cancel')}
							</button>
							<button className={`btn big ${pending.danger ? 'danger-fill' : 'primary'}`} onClick={() => answer(true)} autoFocus>
								{pending.confirmLabel}
							</button>
						</div>
					</>
				) : null}
			</Sheet>
		</FeedbackContext.Provider>
	);
};

// ---------- Primary actions: inline on desktop, a thumb-reach bar on phones ----------

export const ActionBar: React.FC<{children: React.ReactNode}> = ({children}) => (
	<div className="action-bar">
		<div className="action-bar-inner">{children}</div>
	</div>
);

export const Skeleton: React.FC<{height?: number; width?: string}> = ({height = 16, width = '100%'}) => (
	<span className="skeleton" style={{height, width}} aria-hidden />
);
