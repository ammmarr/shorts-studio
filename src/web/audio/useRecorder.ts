import {useCallback, useEffect, useRef, useState} from 'react';

export type RecorderState = 'idle' | 'countdown' | 'recording' | 'done';

const pickMimeType = () =>
	['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';

/** Microphone recording with a 3-2-1 countdown, a timer and a simple level meter. */
export const useRecorder = () => {
	const [state, setState] = useState<RecorderState>('idle');
	const [countdown, setCountdown] = useState(3);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [level, setLevel] = useState(0);
	const [blob, setBlob] = useState<Blob | null>(null);
	const [error, setError] = useState<string | null>(null);
	const recorder = useRef<MediaRecorder | null>(null);
	const stream = useRef<MediaStream | null>(null);
	const timers = useRef<number[]>([]);

	const cleanup = useCallback(() => {
		timers.current.forEach((t) => window.clearInterval(t));
		timers.current = [];
		stream.current?.getTracks().forEach((t) => t.stop());
		stream.current = null;
	}, []);

	useEffect(() => cleanup, [cleanup]);

	const start = useCallback(async () => {
		setError(null);
		setBlob(null);
		try {
			stream.current = await navigator.mediaDevices.getUserMedia({
				audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true},
			});
		} catch {
			setError('The microphone is blocked. Click the lock icon next to the address bar and allow the microphone.');
			return;
		}
		// Level meter
		const audioContext = new AudioContext();
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 512;
		audioContext.createMediaStreamSource(stream.current).connect(analyser);
		const samples = new Uint8Array(analyser.fftSize);
		timers.current.push(
			window.setInterval(() => {
				analyser.getByteTimeDomainData(samples);
				let peak = 0;
				for (const s of samples) peak = Math.max(peak, Math.abs(s - 128));
				setLevel(peak / 128);
			}, 100),
		);

		setState('countdown');
		for (const n of [3, 2, 1]) {
			setCountdown(n);
			await new Promise((resolve) => setTimeout(resolve, 800));
		}
		const chunks: Blob[] = [];
		const mimeType = pickMimeType();
		const media = new MediaRecorder(stream.current!, mimeType ? {mimeType} : undefined);
		media.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
		media.onstop = () => {
			setBlob(new Blob(chunks, {type: media.mimeType}));
			setState('done');
			void audioContext.close();
			cleanup();
		};
		media.start(250);
		recorder.current = media;
		const startedAt = Date.now();
		setElapsedMs(0);
		timers.current.push(window.setInterval(() => setElapsedMs(Date.now() - startedAt), 200));
		setState('recording');
	}, [cleanup]);

	const stop = useCallback(() => {
		if (recorder.current?.state === 'recording') {
			recorder.current.stop();
		}
	}, []);

	const reset = useCallback(() => {
		if (recorder.current?.state === 'recording') {
			recorder.current.onstop = null;
			recorder.current.stop();
		}
		cleanup();
		setBlob(null);
		setState('idle');
	}, [cleanup]);

	return {state, countdown, elapsedMs, level, blob, error, start, stop, reset};
};
