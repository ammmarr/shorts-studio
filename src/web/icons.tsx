import React, {useEffect, useState} from 'react';
import {iconFor} from '../remotion/icons';
import {api} from './api';

// Icon drawings fetched from the server's icon library, shared by the picker and the preview.
const cache = new Map<string, string>();
const listeners = new Set<() => void>();
const pending = new Set<string>();

export const rememberIcons = (icons: {name: string; body: string}[]) => {
	for (const icon of icons) cache.set(icon.name, icon.body);
	listeners.forEach((notify) => notify());
};

/** Drawings for the given icon names, fetched once and cached. */
export const useIconBodies = (names: string[]): Record<string, string> => {
	const [, setVersion] = useState(0);
	const key = [...new Set(names)].sort().join(',');
	useEffect(() => {
		const notify = () => setVersion((v) => v + 1);
		listeners.add(notify);
		return () => {
			listeners.delete(notify);
		};
	}, []);
	useEffect(() => {
		const missing = key.split(',').filter((n) => n && !cache.has(n) && !pending.has(n));
		if (missing.length === 0) return;
		missing.forEach((n) => pending.add(n));
		api
			.iconBodies(missing)
			.then((bodies) => rememberIcons(Object.entries(bodies).map(([name, body]) => ({name, body}))))
			.catch(() => undefined)
			.finally(() => missing.forEach((n) => pending.delete(n)));
	}, [key]);
	const out: Record<string, string> = {};
	for (const name of key.split(',')) {
		const body = cache.get(name);
		if (body) out[name] = body;
	}
	return out;
};

/** An icon on the app's screens: the library drawing when known, else a built-in one. */
export const IconSvg: React.FC<{name: string; size: number; body?: string}> = ({name, size, body}) => {
	const drawing = body ?? cache.get(name);
	if (drawing) {
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden
				dangerouslySetInnerHTML={{__html: drawing}}
			/>
		);
	}
	const Fallback = iconFor(name);
	return <Fallback size={size} aria-hidden />;
};
