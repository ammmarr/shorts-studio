import type {JobStatus} from '../src/shared/types';

const jobs = new Map<string, JobStatus>();
// Transcribing and rendering both max out the CPU, so each kind runs one at a time.
const queues: Record<JobStatus['kind'], Promise<unknown>> = {
	transcribe: Promise.resolve(),
	render: Promise.resolve(),
};

export const startJob = <T>(
	kind: JobStatus['kind'],
	run: (progress: (p: number) => void) => Promise<T>,
): JobStatus<T> => {
	const job: JobStatus<T> = {id: crypto.randomUUID(), kind, status: 'running', progress: 0, result: null, error: null};
	jobs.set(job.id, job);
	const task = queues[kind].then(() =>
		run((p) => {
			job.progress = Math.max(job.progress, Math.min(0.99, p));
		}),
	);
	queues[kind] = task.catch(() => undefined);
	task.then(
		(result) => {
			job.result = result;
			job.progress = 1;
			job.status = 'done';
		},
		(error: unknown) => {
			job.error = error instanceof Error ? error.message : String(error);
			job.status = 'error';
			console.error(`[${kind}]`, error);
		},
	);
	return job;
};

export const getJob = (id: string) => jobs.get(id) ?? null;
