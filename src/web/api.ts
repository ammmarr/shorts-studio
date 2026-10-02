import type {
	Format,
	GeneratedScript,
	Health,
	JobStatus,
	Lang,
	Project,
	ProjectSummary,
	RenderInfo,
	Settings,
	VoicePitch,
	Word,
} from '../shared/types';
import {localApi} from './local/backend';
import {isLocalMode} from './platform';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
	let res: Response;
	try {
		res = await fetch(path, init);
	} catch {
		throw new Error("Tabeba's workspace is not responding. Check your internet connection, or that the computer running it is switched on.");
	}
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error((data as {error?: string}).error ?? `Something went wrong (${res.status}).`);
	}
	return data as T;
};

const sendJson = (method: string, body: unknown): RequestInit => ({
	method,
	headers: {'Content-Type': 'application/json'},
	body: JSON.stringify(body),
});

const sendFile = (file: Blob, type = file.type): RequestInit => ({
	method: 'POST',
	headers: {'Content-Type': type},
	body: file,
});

/** The app's own server on the computer. */
const serverApi = {
	health: () => request<Health>('/api/health'),
	settings: () => request<Settings>('/api/settings'),
	saveSettings: (settings: Partial<Settings>) => request<Settings>('/api/settings', sendJson('PUT', settings)),
	uploadLogo: (file: File) => request<Settings>('/api/settings/logo', sendFile(file)),
	uploadMusic: (file: File) => request<Settings>('/api/settings/music', sendFile(file)),

	projects: () => request<ProjectSummary[]>('/api/projects'),
	createProject: (format: Format, language: Lang) =>
		request<Project>('/api/projects', sendJson('POST', {format, language})),
	project: (id: string) => request<Project>(`/api/projects/${id}`),
	saveProject: (project: Project) => request<Project>(`/api/projects/${project.id}`, sendJson('PUT', project)),
	deleteProject: (id: string) => request<{ok: true}>(`/api/projects/${id}`, {method: 'DELETE'}),
	restoreProject: (id: string) => request<Project>(`/api/projects/${id}/restore`, {method: 'POST'}),
	duplicateProject: (id: string) => request<Project>(`/api/projects/${id}/duplicate`, {method: 'POST'}),

	writeScript: (idea: string, format: Format, language: Lang) =>
		request<GeneratedScript>('/api/script', sendJson('POST', {idea, format, language})),

	uploadImage: (file: Blob) => request<{url: string}>('/api/images', sendFile(file)),

	uploadVoice: (id: string, wav: Blob, pitch: VoicePitch) =>
		request<{project: Project; jobId: string | null}>(`/api/projects/${id}/voice?pitch=${pitch}`, sendFile(wav, 'audio/wav')),
	setVoicePitch: (id: string, pitch: VoicePitch) => request<Project>(`/api/projects/${id}/voice/pitch`, sendJson('POST', {pitch})),
	removeVoice: (id: string) => request<Project>(`/api/projects/${id}/voice`, {method: 'DELETE'}),
	transcribe: (id: string) => request<{jobId: string}>(`/api/projects/${id}/transcribe`, {method: 'POST'}),
	render: (id: string) => request<{jobId: string}>(`/api/projects/${id}/render`, {method: 'POST'}),
	job: <T>(id: string) => request<JobStatus<T>>(`/api/jobs/${id}`),
	reveal: (fileName: string) => request<{ok: true}>(`/api/reveal/${encodeURIComponent(fileName)}`, {method: 'POST'}),
	downloadUrl: (fileName: string) => `/api/download/${encodeURIComponent(fileName)}`,

	icons: (query: string, category: string) =>
		request<{total: number; icons: {name: string; body: string}[]; librarySize: number}>(
			`/api/icons?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&limit=150`,
		),
	iconBodies: (names: string[]) => request<Record<string, string>>(`/api/icons/bodies?names=${names.map(encodeURIComponent).join(',')}`),
};

export type Backend = typeof serverApi;

/** The phone app does everything on the phone; in a browser on the computer, the server does. */
export const api: Backend = isLocalMode ? localApi : serverApi;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Follows a background job until it finishes. */
export const waitForJob = async <T>(jobId: string, onProgress: (p: number) => void): Promise<T> => {
	for (;;) {
		const job = await api.job<T>(jobId);
		onProgress(job.progress);
		if (job.status === 'done') {
			return job.result as T;
		}
		if (job.status === 'error') {
			throw new Error(job.error ?? 'The task failed.');
		}
		await sleep(isLocalMode ? 500 : 1000);
	}
};

export type TranscribeResult = {words: Word[]};
export type RenderResult = RenderInfo;
