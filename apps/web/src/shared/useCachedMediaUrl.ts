import { useEffect, useMemo, useState } from 'react';

import { resolveMediaPreviewUrl } from './localMediaPreview';
import { ensureRemoteMediaCached, getCachedMediaObjectUrl, revokeCachedMediaObjectUrl, type CachedMediaObjectUrl } from './mediaCache';

type UseCachedMediaUrlOptions = {
  cacheRemote?: boolean;
};

const isLocalResolvedUrl = (url: string | null | undefined) => Boolean(url?.startsWith('data:') || url?.startsWith('blob:'));
const isRemoteResolvedUrl = (url: string | null | undefined) => Boolean(url && /^https?:\/\//i.test(url));
const mediaObjectUrlCache = new Map<string, CachedMediaObjectUrl>();
const MAX_MEDIA_OBJECT_URL_CACHE_SIZE = 80;

const rememberMediaObjectUrl = (mediaNo: string, entry: CachedMediaObjectUrl) => {
  const existing = mediaObjectUrlCache.get(mediaNo);
  if (existing?.url && existing.url !== entry.url) revokeCachedMediaObjectUrl(existing.url);
  if (existing) mediaObjectUrlCache.delete(mediaNo);
  mediaObjectUrlCache.set(mediaNo, entry);

  while (mediaObjectUrlCache.size > MAX_MEDIA_OBJECT_URL_CACHE_SIZE) {
    const oldestKey = mediaObjectUrlCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    revokeCachedMediaObjectUrl(mediaObjectUrlCache.get(oldestKey)?.url);
    mediaObjectUrlCache.delete(oldestKey);
  }
};

export const useCachedMediaUrl = (
  mediaNo: string | null | undefined,
  accessUrl: string | null | undefined,
  mediaType: string | null | undefined = 'image',
  options: UseCachedMediaUrlOptions = {},
) => {
  const fallbackUrl = useMemo(() => resolveMediaPreviewUrl(mediaNo, accessUrl), [mediaNo, accessUrl]);
  const shouldCacheRemote = options.cacheRemote ?? mediaType === 'image';
  const shouldCheckCache = Boolean(mediaNo && accessUrl && !isLocalResolvedUrl(fallbackUrl));
  const canHoldRemoteMedia = mediaType === 'image' || mediaType === 'video';
  const shouldHoldRemoteUntilCacheSettles = shouldCheckCache && shouldCacheRemote && canHoldRemoteMedia && isRemoteResolvedUrl(accessUrl);
  const retainedCachedUrl = mediaNo ? mediaObjectUrlCache.get(mediaNo)?.url ?? null : null;
  const [cachedUrl, setCachedUrl] = useState<string | null>(() => retainedCachedUrl);
  const [cacheSettled, setCacheSettled] = useState(!shouldHoldRemoteUntilCacheSettles || Boolean(retainedCachedUrl));

  useEffect(() => {
    let cancelled = false;
    const retainedUrl = mediaNo ? mediaObjectUrlCache.get(mediaNo)?.url ?? null : null;

    setCachedUrl(retainedUrl);
    setCacheSettled(!shouldHoldRemoteUntilCacheSettles || Boolean(retainedUrl));

    const setObjectUrl = (nextEntry: CachedMediaObjectUrl | null) => {
      if (mediaNo && nextEntry) rememberMediaObjectUrl(mediaNo, nextEntry);
      if (!cancelled) setCachedUrl(nextEntry?.url ?? null);
    };

    if (!shouldCheckCache || !mediaNo || !accessUrl) {
      return () => {
        cancelled = true;
      };
    }

    if (retainedUrl) {
      setCacheSettled(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const existing = await getCachedMediaObjectUrl(mediaNo);
      if (cancelled) {
        revokeCachedMediaObjectUrl(existing?.url);
        return;
      }

      if (existing?.url) {
        setObjectUrl(existing);
        setCacheSettled(true);
        return;
      }

      if (!shouldCacheRemote) {
        setCacheSettled(true);
        return;
      }

      const cached = await ensureRemoteMediaCached(mediaNo, accessUrl, mediaType ?? 'image');
      if (!cached || cancelled) {
        if (!cancelled) setCacheSettled(true);
        return;
      }

      const next = await getCachedMediaObjectUrl(mediaNo);
      if (cancelled) {
        revokeCachedMediaObjectUrl(next?.url);
        return;
      }
      setObjectUrl(next ?? null);
      setCacheSettled(true);
    })().catch(() => {
      if (!cancelled) setCacheSettled(true);
    });

    return () => {
      cancelled = true;
    };
  }, [accessUrl, fallbackUrl, mediaNo, mediaType, shouldCacheRemote, shouldCheckCache, shouldHoldRemoteUntilCacheSettles]);

  if (cachedUrl) return cachedUrl;
  if (shouldHoldRemoteUntilCacheSettles && !cacheSettled) return null;
  return fallbackUrl;
};
