import {Clapperboard, Laptop, Loader2, Wifi} from 'lucide-react';
import React, {useState} from 'react';
import {useT} from '../i18n';
import {DEFAULT_PORT, getServer, normalizeServer, pingServer, setServer} from '../server';

/**
 * Phone app only: asks once for the address of the computer that makes the videos. The computer
 * shows this address on its "My channel" page and in the window where it runs.
 */
export const Connect: React.FC<{onConnected: () => void; problem?: string | null}> = ({onConnected, problem}) => {
	const {t} = useT();
	const [address, setAddress] = useState(() => getServer().replace(/^http:\/\//, ''));
	const [checking, setChecking] = useState(false);
	const [error, setError] = useState<string | null>(problem ?? null);

	const connect = async (e: React.FormEvent) => {
		e.preventDefault();
		const origin = normalizeServer(address);
		if (!origin) {
			setError(t('connectInvalid'));
			return;
		}
		setChecking(true);
		setError(null);
		const ok = await pingServer(origin);
		setChecking(false);
		if (!ok) {
			setError(t('connectFailed'));
			return;
		}
		setServer(origin);
		onConnected();
	};

	return (
		<div className="center-screen connect">
			<form className="card narrow form" onSubmit={connect}>
				<span className="brand-mark big" aria-hidden>
					<Clapperboard size={26} />
				</span>
				<h1>{t('connectTitle')}</h1>
				<p className="lead">{t('connectLead')}</p>
				<ol className="connect-steps">
					<li>
						<Laptop size={18} /> {t('connectStep1')}
					</li>
					<li>
						<Wifi size={18} /> {t('connectStep2')}
					</li>
				</ol>
				<label className="field">
					<span>{t('connectLabel')}</span>
					<input
						dir="ltr"
						inputMode="url"
						autoCapitalize="none"
						autoCorrect="off"
						spellCheck={false}
						enterKeyHint="go"
						placeholder={`192.168.1.5:${DEFAULT_PORT}`}
						value={address}
						onChange={(e) => setAddress(e.target.value)}
					/>
				</label>
				{error ? (
					<div className="note error" role="alert">
						{error}
					</div>
				) : null}
				<button className="btn primary big" type="submit" disabled={checking || !address.trim()}>
					{checking ? <Loader2 size={18} className="spin" /> : null}
					{checking ? t('connecting') : t('connect')}
				</button>
			</form>
		</div>
	);
};
