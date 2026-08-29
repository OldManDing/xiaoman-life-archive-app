import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppUpdateCheckResponse } from './api/types';
import {
  cancelAppUpdateDownload,
  downloadAppUpdate,
  installDownloadedAppUpdate,
  type AppUpdateDownloadState,
} from './appUpdater';

export const useAppUpdateDownload = (update: AppUpdateCheckResponse | null) => {
  const [state, setState] = useState<AppUpdateDownloadState>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [downloadedPath, setDownloadedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const cancelRequestedRef = useRef(false);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const startDownload = useCallback(async () => {
    if (!update?.apk_url) {
      setError('更新包暂不可下载，请稍后重试。');
      setState('error');
      return null;
    }

    setState('downloading');
    cancelRequestedRef.current = false;
    setProgress(0);
    setDownloadedBytes(0);
    setTotalBytes(update.apk_size_bytes ?? null);
    setDownloadedPath(null);
    setError(null);

    try {
      const result = await downloadAppUpdate(update, (event) => {
        if (!mountedRef.current) return;
        const nextProgress = Number.isFinite(event.progress) ? Math.max(0, Math.min(100, event.progress)) : 0;
        setProgress(nextProgress);
        setDownloadedBytes(Number.isFinite(event.downloaded_bytes) ? event.downloaded_bytes : 0);
        setTotalBytes(Number.isFinite(event.total_bytes) && event.total_bytes > 0 ? event.total_bytes : (update.apk_size_bytes ?? null));
        if (event.state === 'verifying') setState('verifying');
        else if (event.state === 'downloading') setState('downloading');
      });
      if (!mountedRef.current) return result;
      setDownloadedPath(result.path ?? null);
      setProgress(100);
      if (result.status === 'permissionRequired') {
        setState('permission');
        setError('请在系统设置中允许年轮安装未知来源应用，然后返回此处再次点击安装。');
      } else {
        // The Android bridge opens the system installer as soon as verification finishes.
        setState('installing');
      }
      return result;
    } catch (cause) {
      if (!mountedRef.current) return null;
      if (cancelRequestedRef.current) return null;
      const message = cause instanceof Error ? cause.message : '更新下载失败，请重试。';
      setError(message || '更新下载失败，请重试。');
      setState('error');
      return null;
    }
  }, [update]);

  const cancelDownload = useCallback(async () => {
    cancelRequestedRef.current = true;
    try {
      await cancelAppUpdateDownload();
    } finally {
      if (mountedRef.current) {
        setState('idle');
        setProgress(0);
        setDownloadedBytes(0);
        setDownloadedPath(null);
      }
    }
  }, []);

  const install = useCallback(async () => {
    if (!downloadedPath && state !== 'permission') return false;
    setState('installing');
    setError(null);
    try {
      const result = await installDownloadedAppUpdate(downloadedPath ?? undefined);
      if (!mountedRef.current) return result.started;
      if (result.requires_permission || result.status === 'permissionRequired') {
        setState('permission');
        setError('请在系统设置中允许年轮安装未知来源应用，然后返回此处再次点击安装。');
        return false;
      }
      return result.started ?? result.status === 'installPrompt';
    } catch (cause) {
      if (mountedRef.current) {
        setState('error');
        setError(cause instanceof Error ? cause.message : '无法打开系统安装器，请重试。');
      }
      return false;
    }
  }, [downloadedPath, state]);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setDownloadedBytes(0);
    setDownloadedPath(null);
    setError(null);
  }, []);

  return {
    state,
    progress,
    downloadedBytes,
    totalBytes,
    downloadedPath,
    error,
    startDownload,
    cancelDownload,
    install,
    reset,
  };
};

export const formatUpdateBytes = (bytes: number | null | undefined) => {
  if (!Number.isFinite(bytes) || !bytes || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
};

export const updateDownloadStateLabel = (state: AppUpdateDownloadState) => {
  if (state === 'downloading') return '正在下载';
  if (state === 'verifying') return '正在校验安装包';
  if (state === 'ready') return '已下载，等待安装';
  if (state === 'installing') return '正在打开系统安装器';
  if (state === 'permission') return '等待安装权限';
  if (state === 'error') return '更新失败';
  return '准备更新';
};
