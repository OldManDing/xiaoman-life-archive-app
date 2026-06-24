import { useEffect, useState } from 'react';

import { webApi } from './api/webApi';
import { getStoredMediaReferenceNo, resolveStoredMediaUrl } from './localMediaPreview';
import { ensureRemoteMediaCached, getCachedMediaObjectUrl, revokeCachedMediaObjectUrl, type CachedMediaObjectUrl } from './mediaCache';

type MediaAccessUrlEntry = {
  displayUrl: string | null;
  accessUrl: string | null;
};

const mediaAccessUrlCache = new Map<string, MediaAccessUrlEntry>();
const mediaAccessUrlPromises = new Map<string, Promise<MediaAccessUrlEntry>>();
const mediaObjectUrlCache = new Map<string, CachedMediaObjectUrl>();
const MAX_MEDIA_OBJECT_URL_CACHE_SIZE = 80;

const isLocalMediaUrl = (value: string | null | undefined) => Boolean(value?.startsWith('data:') || value?.startsWith('blob:'));
const isRemoteMediaUrl = (value: string | null | undefined) => Boolean(value && /^https?:\/\//i.test(value));

const remoteUrlCacheKey = (url: string) => {
  let hash = 0;
  for (let index = 0; index < url.length; index += 1) {
    hash = (hash * 31 + url.charCodeAt(index)) >>> 0;
  }
  return `url:${hash.toString(36)}`;
};

const emptyMediaAccessUrlEntry: MediaAccessUrlEntry = { displayUrl: null, accessUrl: null };

const rememberMediaObjectUrl = (cacheKey: string, entry: CachedMediaObjectUrl) => {
  const existing = mediaObjectUrlCache.get(cacheKey);
  if (existing?.url && existing.url !== entry.url) revokeCachedMediaObjectUrl(existing.url);
  if (existing) mediaObjectUrlCache.delete(cacheKey);
  mediaObjectUrlCache.set(cacheKey, entry);

  while (mediaObjectUrlCache.size > MAX_MEDIA_OBJECT_URL_CACHE_SIZE) {
    const oldestKey = mediaObjectUrlCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    revokeCachedMediaObjectUrl(mediaObjectUrlCache.get(oldestKey)?.url);
    mediaObjectUrlCache.delete(oldestKey);
  }
};

const getMediaAccessUrl = (mediaNo: string) => {
  if (mediaAccessUrlCache.has(mediaNo)) {
    return Promise.resolve(mediaAccessUrlCache.get(mediaNo) ?? emptyMediaAccessUrlEntry);
  }

  const request =
    mediaAccessUrlPromises.get(mediaNo) ??
    Promise.resolve(webApi.mediaAccessUrl(mediaNo))
      .then((response) => {
        const accessUrl = response?.access_url || null;
        const displayUrl = response?.thumbnail_url || accessUrl;
        return { displayUrl, accessUrl };
      })
      .catch(() => emptyMediaAccessUrlEntry)
      .finally(() => {
        mediaAccessUrlPromises.delete(mediaNo);
      });
  mediaAccessUrlPromises.set(mediaNo, request);
  return request.then((response) => {
    mediaAccessUrlCache.set(mediaNo, response);
    return response;
  });
};

export const clearMediaAccessUrlCache = () => {
  mediaAccessUrlCache.clear();
  mediaAccessUrlPromises.clear();
  mediaObjectUrlCache.forEach((entry) => revokeCachedMediaObjectUrl(entry.url));
  mediaObjectUrlCache.clear();
};

export const useAsyncData = <T,>(loader: () => Promise<T>, deps: unknown[] = []) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (mounted) setData(result);
      })
      .catch((err: unknown) => {
        if (mounted) setError(err instanceof Error ? err.message : '请求失败');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, setData };
};

export const useStoredMediaUrl = (value: string | null | undefined, stableMediaNo?: string | null) => {
  const normalizedStableMediaNo = stableMediaNo?.trim() || null;
  const resolvedLocalUrl = resolveStoredMediaUrl(value);
  const referencedMediaNo = getStoredMediaReferenceNo(value);
  const mediaNo = referencedMediaNo ?? normalizedStableMediaNo;
  const directRemoteUrl = !referencedMediaNo && isRemoteMediaUrl(resolvedLocalUrl) ? resolvedLocalUrl : null;
  const cacheKey = mediaNo ?? (directRemoteUrl ? remoteUrlCacheKey(directRemoteUrl) : null);
  const localPreviewUrl = isLocalMediaUrl(resolvedLocalUrl) ? resolvedLocalUrl : null;
  const initialCachedUrl = cacheKey ? mediaObjectUrlCache.get(cacheKey)?.url ?? null : null;
  const [remoteUrl, setRemoteUrl] = useState<string | null>(() => (mediaNo ? mediaAccessUrlCache.get(mediaNo)?.displayUrl ?? null : directRemoteUrl));
  const [cachedUrl, setCachedUrl] = useState<string | null>(() => initialCachedUrl);
  const [cacheSettled, setCacheSettled] = useState(!cacheKey || Boolean(localPreviewUrl) || Boolean(initialCachedUrl));

  useEffect(() => {
    let mounted = true;
    const retainedCachedUrl = cacheKey ? mediaObjectUrlCache.get(cacheKey)?.url ?? null : null;

    setRemoteUrl(mediaNo ? mediaAccessUrlCache.get(mediaNo)?.displayUrl ?? directRemoteUrl : directRemoteUrl);
    setCachedUrl(retainedCachedUrl);
    setCacheSettled(!cacheKey || Boolean(localPreviewUrl) || Boolean(retainedCachedUrl));

    const setCachedObjectUrl = (nextEntry: CachedMediaObjectUrl | null) => {
      if (cacheKey && nextEntry) rememberMediaObjectUrl(cacheKey, nextEntry);
      if (mounted) setCachedUrl(nextEntry?.url ?? null);
    };

    if (!cacheKey || localPreviewUrl) {
      return () => {
        mounted = false;
      };
    }

    if (retainedCachedUrl) {
      setCacheSettled(true);
      return () => {
        mounted = false;
      };
    }

    const cachedLookup = getCachedMediaObjectUrl(cacheKey).catch(() => null);
    const accessLookup = directRemoteUrl
      ? Promise.resolve({ displayUrl: directRemoteUrl, accessUrl: directRemoteUrl })
      : mediaNo
        ? getMediaAccessUrl(mediaNo)
        : Promise.resolve(emptyMediaAccessUrlEntry);

    void (async () => {
      const cachedTask = cachedLookup.then((existing) => {
        if (!mounted) {
          revokeCachedMediaObjectUrl(existing?.url);
          return existing;
        }

        if (existing?.url) {
          setCachedObjectUrl(existing);
          setCacheSettled(true);
        }
        return existing;
      });

      const accessTask = accessLookup.then((entry) => {
        if (!mounted) return entry;

        if (entry.displayUrl) {
          setRemoteUrl(entry.displayUrl);
          setCacheSettled(true);
        }
        return entry;
      });

      const [existing, accessEntry] = await Promise.all([cachedTask, accessTask]);
      if (!mounted) {
        return;
      }

      if (existing?.url) {
        return;
      }

      const accessUrl = accessEntry.displayUrl ?? accessEntry.accessUrl;
      if (!accessUrl) {
        if (mounted) setCacheSettled(true);
        return;
      }

      setCacheSettled(true);

      const cached = await ensureRemoteMediaCached(cacheKey, accessUrl, 'image').catch(() => false);
      if (!mounted) return;

      if (cached) {
        const next = await getCachedMediaObjectUrl(cacheKey).catch(() => null);
        if (!mounted) {
          revokeCachedMediaObjectUrl(next?.url);
          return;
        }
        if (next?.url) {
          setCachedObjectUrl(next);
          setCacheSettled(true);
          return;
        }
      }

      setCacheSettled(true);
    })().catch(() => {
      if (mounted) setCacheSettled(true);
    });

    return () => {
      mounted = false;
    };
  }, [cacheKey, directRemoteUrl, localPreviewUrl, mediaNo]);

  if (localPreviewUrl) return localPreviewUrl;
  if (cachedUrl) return cachedUrl;
  if (directRemoteUrl) return directRemoteUrl;
  if (remoteUrl) return remoteUrl;
  if (cacheKey && !cacheSettled) return null;
  return remoteUrl ?? resolvedLocalUrl;
};
