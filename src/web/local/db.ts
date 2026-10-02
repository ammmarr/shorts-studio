// A small promise wrapper around IndexedDB, where the phone app keeps everything: settings,
// projects, deleted projects (for Undo) and files (photos, recordings, music, finished videos).

export type StoreName = 'kv' | 'projects' | 'trash' | 'files';

const NAME = 'tabeba';
const VERSION = 1;
const STORES: StoreName[] = ['kv', 'projects', 'trash', 'files'];

let opening: Promise<IDBDatabase> | null = null;

const open = () => {
	opening ??= new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(NAME, VERSION);
		request.onupgradeneeded = () => {
			for (const store of STORES) {
				if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	}).catch((error) => {
		opening = null;
		throw error;
	});
	return opening;
};

/** Runs one request in its own transaction and resolves once the transaction has committed. */
const run = async <T>(store: StoreName, mode: IDBTransactionMode, make: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
	const db = await open();
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(store, mode);
		const request = make(tx.objectStore(store));
		tx.oncomplete = () => resolve(request.result);
		tx.onerror = () => reject(tx.error ?? request.error);
		tx.onabort = () => reject(tx.error ?? new Error('The phone could not save this. Is its storage full?'));
	});
};

export const idbGet = <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
export const idbPut = (store: StoreName, key: string, value: unknown) => run(store, 'readwrite', (s) => s.put(value, key));
export const idbDelete = (store: StoreName, key: string) => run(store, 'readwrite', (s) => s.delete(key));
export const idbValues = <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
export const idbKeys = (store: StoreName) => run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()).then((keys) => keys.map(String));

/** Asks the browser not to clear the app's data when the phone runs low on space. */
export const keepDataPersistent = () => {
	void navigator.storage?.persist?.().catch(() => undefined);
};
