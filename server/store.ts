import {existsSync} from 'node:fs';
import {readdir, readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {mergeEditorChanges, mergeSettings, normalizeProject, normalizeSettings, summarizeProjects} from '../src/shared/storeLogic';
import type {Project, ProjectSummary, Settings} from '../src/shared/types';
import {PROJECTS_DIR, SETTINGS_FILE, TRASH_DIR, UserError} from './paths';

const writeJsonAtomic = async (file: string, data: unknown) => {
	const tmp = `${file}.${process.pid}.tmp`;
	await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
	await rename(tmp, file);
};

const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, 'utf8')) as T;

// ---------- Settings ----------

export const getSettings = async (): Promise<Settings> =>
	normalizeSettings(existsSync(SETTINGS_FILE) ? await readJson<Partial<Settings>>(SETTINGS_FILE) : null);

export const saveSettings = async (input: Partial<Settings>): Promise<Settings> => {
	const next = mergeSettings(await getSettings(), input);
	await writeJsonAtomic(SETTINGS_FILE, next);
	return next;
};

// ---------- Projects ----------

const ID_PATTERN = /^[a-z0-9-]{8,64}$/;

const projectFile = (id: string) => {
	if (!ID_PATTERN.test(id)) {
		throw new UserError('Unknown video.', 404);
	}
	return path.join(PROJECTS_DIR, `${id}.json`);
};

export const getProject = async (id: string): Promise<Project> => {
	const file = projectFile(id);
	if (!existsSync(file)) {
		throw new UserError('This video could not be found.', 404);
	}
	// Older projects are filled in with the fields added since they were made.
	return normalizeProject(await readJson<Project>(file));
};

export const writeProject = async (project: Project): Promise<Project> => {
	const saved = {...project, updatedAt: new Date().toISOString()};
	await writeJsonAtomic(projectFile(project.id), saved);
	return saved;
};

export const createProject = async (project: Project) => {
	if (existsSync(projectFile(project.id))) {
		throw new UserError('A video with this id already exists.');
	}
	return writeProject(project);
};

/** Applies a partial update to a stored project, then writes it. */
export const updateProject = async (id: string, update: (project: Project) => Project) =>
	writeProject(update(await getProject(id)));

/** Saves the fields the editor owns (see mergeEditorChanges). */
export const saveEditorChanges = async (id: string, input: Partial<Project>) =>
	updateProject(id, (stored) => mergeEditorChanges(stored, input));

export const listProjects = async (): Promise<ProjectSummary[]> => {
	const files = (await readdir(PROJECTS_DIR)).filter((f) => f.endsWith('.json'));
	const projects = await Promise.all(
		files.map((f) => readJson<Project>(path.join(PROJECTS_DIR, f)).catch(() => null)),
	);
	return summarizeProjects(projects.filter((p): p is Project => p !== null));
};

/** Brings back the most recently deleted copy of a project (the "Undo" after deleting). */
export const restoreProject = async (id: string): Promise<Project> => {
	const file = projectFile(id);
	const trashed = (await readdir(TRASH_DIR)).filter((f) => f.startsWith(`${id}-`)).sort();
	if (trashed.length === 0) {
		throw new UserError('Nothing to restore.', 404);
	}
	await rename(path.join(TRASH_DIR, trashed[trashed.length - 1]), file);
	return readJson<Project>(file);
};

/** Moves the project to data/trash instead of deleting it, so nothing is lost by a mis-click. */
export const trashProject = async (id: string) => {
	const file = projectFile(id);
	if (existsSync(file)) {
		await rename(file, path.join(TRASH_DIR, `${id}-${Date.now()}.json`));
	}
};
