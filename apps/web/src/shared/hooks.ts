import { useEffect, useState } from 'react';

import { webApi } from './api/webApi';
import { getStoredMediaReferenceNo, resolveStoredMediaUrl } from './localMediaPreview';

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
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setRemoteUrl(null);

    if (!mediaNo || resolvedLocalUrl) {
      return () => {
        mounted = false;
      };
    }

    webApi
      .mediaAccessUrl(mediaNo)
      .then((response) => {
        if (mounted) setRemoteUrl(response.access_url || null);
      })
      .catch(() => {
        if (mounted) setRemoteUrl(null);
      });

    return () => {
      mounted = false;
    };
  }, [mediaNo, resolvedLocalUrl]);

  return resolvedLocalUrl ?? remoteUrl;
};
