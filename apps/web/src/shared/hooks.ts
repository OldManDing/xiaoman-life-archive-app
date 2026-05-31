import { useEffect, useState } from 'react';

import { webApi } from './api/webApi';
import { getStoredMediaReferenceNo, resolveStoredMediaUrl } from './localMediaPreview';

const mediaAccessUrlCache = new Map<string, string | null>();
const mediaAccessUrlPromises = new Map<string, Promise<string | null>>();

export const clearMediaAccessUrlCache = () => {
  mediaAccessUrlCache.clear();
  mediaAccessUrlPromises.clear();
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

export const useStoredMediaUrl = (value: string | null | undefined) => {
  const resolvedLocalUrl = resolveStoredMediaUrl(value);
  const mediaNo = getStoredMediaReferenceNo(value);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(() => (mediaNo ? mediaAccessUrlCache.get(mediaNo) ?? null : null));

  useEffect(() => {
    let mounted = true;
    setRemoteUrl(mediaNo ? mediaAccessUrlCache.get(mediaNo) ?? null : null);

    if (!mediaNo || resolvedLocalUrl) {
      return () => {
        mounted = false;
      };
    }

    if (mediaAccessUrlCache.has(mediaNo)) {
      return () => {
        mounted = false;
      };
    }

    const request =
      mediaAccessUrlPromises.get(mediaNo) ??
      webApi
        .mediaAccessUrl(mediaNo)
        .then((response) => response.access_url || null)
        .catch(() => null)
        .finally(() => {
          mediaAccessUrlPromises.delete(mediaNo);
        });
    mediaAccessUrlPromises.set(mediaNo, request);

    request
      .then((response) => {
        mediaAccessUrlCache.set(mediaNo, response);
        if (mounted) setRemoteUrl(response);
      });

    return () => {
      mounted = false;
    };
  }, [mediaNo, resolvedLocalUrl]);

  return resolvedLocalUrl ?? remoteUrl;
};
