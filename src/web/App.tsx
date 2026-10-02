import {Clapperboard, Film, Languages, Plus, UserRound} from 'lucide-react';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import type {Health, Lang, Settings} from '../shared/types';
import {api} from './api';
import {FeedbackProvider, useFeedback} from './components/feedback';
import {useTypingClass} from './device';
import {I18nContext, makeI18n, useT} from './i18n';
import {Channel} from './pages/Channel';
import {Connect} from './pages/Connect';
import {Editor} from './pages/Editor';
import {Home} from './pages/Home';
import {getServer, isPhoneApp, pingServer} from './server';

// ---------- Hash routing: #/  #/channel  #/v/<id>/<step> ----------

export type Route = {page: 'home'} | {page: 'channel'} | {page: 'editor'; id: string; step: string};

const parseRoute = (): Route => {
	const parts = window.location.hash.replace(/^#\/?/, '').split('/');
	if (parts[0] === 'channel') return {page: 'channel'};
	if (parts[0] === 'v' && parts[1]) return {page: 'editor', id: parts[1], step: parts[2] ?? 'idea'};
	return {page: 'home'};
};

export const navigate = (hash: string) => {
	window.location.hash = hash;
};

// ---------- App-wide data ----------

type AppData = {
	settings: Settings;
	health: Health;
	setSettings: (s: Settings) => void;
	/** Creates a new Short and opens it. */
	createShort: () => Promise<void>;
	creating: boolean;
	/** Phone app: go back to the screen that asks for the computer's address. */
	changeServer: () => void;
	};

const AppContext = createContext<AppData | null>(null);

export const useApp = () => {
	const value = useContext(AppContext);
	if (!value) throw new Error('useApp outside App');
	return value;
};

// The screen language is remembered on this device too, so the loading screen already uses it.
const LANG_KEY = 'tabeba.uiLanguage';
const storedLang = (): Lang => {
	try {
		return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar';
	} catch {
		return 'ar';
	}
};

const SetLangContext = createContext<(lang: Lang) => void>(() => undefined);

export const App: React.FC = () => {
	const [lang, setLang] = useState<Lang>(storedLang);
	const i18n = useMemo(() => makeI18n(lang), [lang]);
	useEffect(() => {
		document.documentElement.lang = lang;
		document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
		document.title = i18n.t('appName');
		try {
			localStorage.setItem(LANG_KEY, lang);
		} catch {
			// storage unavailable: the setting is still saved on the server
		}
	}, [lang, i18n]);
	return (
		<I18nContext.Provider value={i18n}>
			<SetLangContext.Provider value={setLang}>
				<FeedbackProvider>
					<Shell />
				</FeedbackProvider>
			</SetLangContext.Provider>
		</I18nContext.Provider>
	);
};

const Shell: React.FC = () => {
	const {toast} = useFeedback();
	const {t, tError, lang} = useT();
	const setLang = useContext(SetLangContext);
	const [route, setRoute] = useState(parseRoute);
	const [settings, setSettingsState] = useState<Settings | null>(null);
	const [health, setHealth] = useState<Health | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	// Phone app: which computer to talk to ('lost' when the saved one stopped answering).
	const [connect, setConnect] = useState<'new' | 'lost' | 'change' | null>(() => (isPhoneApp() && !getServer() ? 'new' : null));
	useTypingClass();

	const setSettings = useCallback(
		(s: Settings) => {
			setSettingsState(s);
			setLang(s.uiLanguage);
		},
		[setLang],
	);

	useEffect(() => {
		const onHash = () => {
			setRoute(parseRoute());
			window.scrollTo({top: 0});
		};
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	}, []);

	const load = useCallback(async () => {
		setError(null);
		if (isPhoneApp()) {
			const server = getServer();
			if (!server || !(await pingServer(server))) {
				setConnect(server ? 'lost' : 'new');
				return;
			}
		}
		// The server may still be starting up; give it a few seconds before showing an error.
		for (let attempt = 1; ; attempt++) {
			try {
				const [s, h] = await Promise.all([api.settings(), api.health()]);
				setSettings(s);
				setHealth(h);
				return;
			} catch (e) {
				if (attempt >= 8) {
					setError((e as Error).message);
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	}, [setSettings]);

	useEffect(() => {
		void load();
	}, [load]);

	const createShort = useCallback(async () => {
		if (!settings || creating) return;
		setCreating(true);
		try {
			const project = await api.createProject('tips', settings.language);
			navigate(`#/v/${project.id}/idea`);
		} catch (e) {
			toast(tError((e as Error).message), {tone: 'error'});
		} finally {
			setCreating(false);
		}
	}, [settings, creating, toast, tError]);

	const switchLanguage = () => {
		const next: Lang = lang === 'ar' ? 'en' : 'ar';
		setLang(next);
		void api
			.saveSettings({uiLanguage: next})
			.then(setSettings)
			.catch(() => undefined);
	};

	if (connect) {
		return (
			<Connect
				problem={connect === 'lost' ? t('connectLost') : null}
				onConnected={() => {
					setConnect(null);
					setSettingsState(null);
					void load();
				}}
			/>
		);
	}
	if (error) {
		return (
			<div className="center-screen">
				<div className="card narrow">
					<h2>{t('cantReach', {app: t('appName')})}</h2>
					<p className="muted">{tError(error)}</p>
					<div className="actions stack-mobile">
						<button className="btn primary big" onClick={() => void load()}>
							{t('tryAgain')}
						</button>
						{isPhoneApp() ? (
							<button className="btn big" onClick={() => setConnect('change')}>
								{t('changeComputer')}
							</button>
						) : null}
					</div>
				</div>
			</div>
		);
	}
	if (!settings || !health) {
		return (
			<div className="center-screen">
				<span className="brand-mark big" aria-label={t('appName')}>
					<Clapperboard size={26} />
				</span>
			</div>
		);
	}

	// First run: set up the channel look before anything else.
	const page = settings.setupDone ? route : ({page: 'channel'} as Route);
	const inEditor = page.page === 'editor';
	const showTabs = settings.setupDone && !inEditor;

	return (
		<AppContext.Provider value={{settings, health, setSettings, createShort, creating, changeServer: () => setConnect('change')}}>
			<div className={`app ${inEditor ? 'in-editor' : ''} ${showTabs ? 'has-tabs' : ''}`}>
				<header className="topbar">
					<a className="brand" href="#/">
						<span className="brand-mark">
							<Clapperboard size={16} />
						</span>
						{t('appName')}
					</a>
					<div className="topbar-end">
						{settings.setupDone ? (
							<nav className="top-nav">
								<a className={page.page !== 'channel' ? 'active' : ''} href="#/">
									{t('navShorts')}
								</a>
								<a className={page.page === 'channel' ? 'active' : ''} href="#/channel">
									{t('navChannel')}
								</a>
							</nav>
						) : null}
						<button className="btn ghost small lang-toggle" onClick={switchLanguage} lang={lang === 'ar' ? 'en' : 'ar'}>
							<Languages size={16} /> {t('switchLanguage')}
						</button>
					</div>
				</header>
				<main>
					{page.page === 'home' ? <Home /> : null}
					{page.page === 'channel' ? <Channel /> : null}
					{page.page === 'editor' ? <Editor key={page.id} id={page.id} step={page.step} /> : null}
				</main>
				{showTabs ? (
					<nav className="tab-bar" aria-label={t('navShorts')}>
						<a className={page.page === 'home' ? 'active' : ''} href="#/">
							<Film size={22} />
							<span>{t('navShorts')}</span>
						</a>
						<button className="tab-new" onClick={() => void createShort()} disabled={creating} aria-label={t('newShort')}>
							<Plus size={26} />
						</button>
						<a className={page.page === 'channel' ? 'active' : ''} href="#/channel">
							<UserRound size={22} />
							<span>{t('navChannel')}</span>
						</a>
					</nav>
				) : null}
			</div>
		</AppContext.Provider>
	);
};
