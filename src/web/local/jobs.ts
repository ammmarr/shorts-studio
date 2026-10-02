import type {JobStatus} from '../../shared/types';

// Long tasks on the phone (captions, making the video) run in the background of the page and are
// followed the same way as the server's jobs: by id, with progress.

const jobs = new Map<string, JobStatus>();

export const startJob = <T>(kind: JobStatus['kind'], work: (progress: (p: number) => void) => Promise<T>): JobStatus<T> => {
	const job: JobStatus<T> = {id: crypto.randomUUID(), kind, status: 'running', progress: 0, result: null, error: null};
	jobs.set(job.id, job as JobStatus);
	work((p) => {
		job.progress = Math.min(1, Math.max(job.progress, p));
	})
		.then((result) => {
			job.result = result;
			job.progress = 1;
			job.status = 'done';
		})
		.catch((error: unknown) => {
			console.error(error);
			job.error = error instanceof Error ? error.message : String(error);
			job.status = 'error';
		});
	return job;
};

export const getJob = <T>(id: string): JobStatus<T> => {
	const job = jobs.get(id);
	if (!job) throw new Error('This task is no longer running. Please try again.');
	return {...job} as JobStatus<T>;
};
