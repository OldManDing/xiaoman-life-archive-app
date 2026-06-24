const DB_NAME = 'nianlun-media-cache';
const STORE_NAME = 'media';
const DB_VERSION = 2;

const MAX_IMAGE_CACHE_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_VIDEO_CACHE_BYTES = 96 * 1024 * 1024;
const MAX_TOTAL_CACHE_BYTES = 220 * 1024 * 1024;

type CachedMediaEntry = {
  mediaNo: string;
  mediaType: string;
  mimeType: string;
  size: number;
  cachedAt: number;
  lastAccessAt: number;
  blob: Blob;
};

export type CachedMediaObjectUrl = {
  url: string;
  size: number;
  mimeType: string;
};

const remoteCachePromises = new Map<string, Promise<boolean>>();

const isIndexedDbAvailable = () => typeof window !== 'undefined' && Boolean(window.indexedDB);

const isRemoteUrl = (url: string) => /^https?:\/\//i.test(url);

const requestAsPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

const transactionAsPromise = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });

let dbPromise: Promise<IDBDatabase> | null = null;

const deleteMediaCacheDb = () =>
  new Promise<void>((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      resolve();
      return;
    }

    const request = window.indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed'));
    request.onblocked = () => reject(new Error('IndexedDB delete blocked'));
  });

const openMediaCacheDb = (repairAttempted = false): Promise<IDBDatabase | null> => {
  if (!isIndexedDbAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'mediaNo' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        reject(new Error('IndexedDB media store missing'));
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  }).catch(async (error) => {
    dbPromise = null;
    if (!repairAttempted && error instanceof Error && error.message === 'IndexedDB media store missing') {
      await deleteMediaCacheDb().catch(() => undefined);
      return openMediaCacheDb(true);
    }
    throw error;
  }) as Promise<IDBDatabase>;

  return dbPromise;
};

const getMaxCacheBytes = (mediaType: string) => {
  if (mediaType === 'video') return MAX_VIDEO_CACHE_BYTES;
  if (mediaType === 'audio') return MAX_AUDIO_CACHE_BYTES;
  return MAX_IMAGE_CACHE_BYTES;
};

const readCachedMediaEntry = async (mediaNo: string) => {
  if (!mediaNo) return null;
  const db = await openMediaCacheDb().catch(() => null);
  if (!db) return null;

  const transaction = db.transaction(STORE_NAME, 'readonly');
  const entry = await requestAsPromise<CachedMediaEntry | undefined>(transaction.objectStore(STORE_NAME).get(mediaNo));
  return entry ?? null;
};

const touchCachedMediaEntry = async (entry: CachedMediaEntry) => {
  const db = await openMediaCacheDb().catch(() => null);
  if (!db) return;

  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).put({ ...entry, lastAccessAt: Date.now() });
  await transactionAsPromise(transaction);
};

const listCachedMediaEntries = async () => {
  const db = await openMediaCacheDb().catch(() => null);
  if (!db) return [];

  const transaction = db.transaction(STORE_NAME, 'readonly');
  return requestAsPromise<CachedMediaEntry[]>(transaction.objectStore(STORE_NAME).getAll());
};

const pruneMediaCache = async () => {
  const entries = await listCachedMediaEntries();
  let totalBytes = entries.reduce((total, entry) => total + (Number(entry.size) || 0), 0);
  if (totalBytes <= MAX_TOTAL_CACHE_BYTES) return;

  const db = await openMediaCacheDb().catch(() => null);
  if (!db) return;

  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const removable = [...entries].sort((left, right) => left.lastAccessAt - right.lastAccessAt);

  for (const entry of removable) {
    if (totalBytes <= MAX_TOTAL_CACHE_BYTES) break;
    store.delete(entry.mediaNo);
    totalBytes -= Number(entry.size) || 0;
  }

  await transactionAsPromise(transaction);
};

const writeCachedMediaEntry = async (entry: CachedMediaEntry) => {
  const db = await openMediaCacheDb().catch(() => null);
  if (!db) return false;

  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).put(entry);
  await transactionAsPromise(transaction);
  await pruneMediaCache().catch(() => undefined);
  return true;
};

export const getCachedMediaObjectUrl = async (mediaNo?: string | null): Promise<CachedMediaObjectUrl | null> => {
  if (!mediaNo || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;

  const entry = await readCachedMediaEntry(mediaNo).catch(() => null);
  if (!entry?.blob) return null;

  void touchCachedMediaEntry(entry).catch(() => undefined);
  return {
    url: URL.createObjectURL(entry.blob),
    size: entry.size,
    mimeType: entry.mimeType,
  };
};

export const revokeCachedMediaObjectUrl = (url?: string | null) => {
  if (url?.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
};

const ensureRemoteMediaCachedInternal = async (mediaNo: string, accessUrl: string, mediaType: string) => {
  if (!mediaNo || !accessUrl || !isRemoteUrl(accessUrl)) return false;
  if (await readCachedMediaEntry(mediaNo).catch(() => null)) return true;

  const maxBytes = getMaxCacheBytes(mediaType);
  const response = await fetch(accessUrl, {
    method: 'GET',
    credentials: 'omit',
    cache: 'default',
  });

  if (!response.ok) return false;

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    return false;
  }

  const blob = await response.blob();
  if (!blob.size || blob.size > maxBytes) return false;

  const now = Date.now();
  return writeCachedMediaEntry({
    mediaNo,
    mediaType,
    mimeType: blob.type || response.headers.get('content-type') || 'application/octet-stream',
    size: blob.size,
    cachedAt: now,
    lastAccessAt: now,
    blob,
  }).catch(() => false);
};

export const ensureRemoteMediaCached = (mediaNo?: string | null, accessUrl?: string | null, mediaType = 'image') => {
  if (!mediaNo || !accessUrl || !isRemoteUrl(accessUrl)) return Promise.resolve(false);

  const existing = remoteCachePromises.get(mediaNo);
  if (existing) return existing;

  const promise = ensureRemoteMediaCachedInternal(mediaNo, accessUrl, mediaType).finally(() => {
    remoteCachePromises.delete(mediaNo);
  });
  remoteCachePromises.set(mediaNo, promise);
  return promise;
};
