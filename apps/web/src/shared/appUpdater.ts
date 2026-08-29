import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

import type { AppUpdateCheckResponse } from './api/types';

export const hasVerifiedAppUpdateMetadata = (update: AppUpdateCheckResponse | null | undefined) =>
  Boolean(
    update?.apk_url &&
      Number.isSafeInteger(update.apk_size_bytes) &&
      (update.apk_size_bytes ?? 0) > 0 &&
      typeof update.apk_sha256 === 'string' &&
      /^[a-f0-9]{64}$/i.test(update.apk_sha256),
  );

export type AppUpdateDownloadProgress = {
  downloaded_bytes: number;
  total_bytes: number;
  progress: number;
  state?: 'downloading' | 'verifying' | 'ready' | 'error' | string;
};

export type AppUpdateDownloadResult = {
  status?: 'installPrompt' | 'permissionRequired' | string;
  path?: string;
  downloaded_bytes?: number;
  total_bytes?: number;
  sha256?: string;
  fileName?: string;
};

export type AppUpdateInstallResult = {
  started?: boolean;
  status?: 'installPrompt' | 'permissionRequired' | string;
  requires_permission?: boolean;
  path?: string;
};

type AppUpdaterPlugin = {
  downloadAndInstall(options: {
    url: string;
    fileName?: string;
    expectedSizeBytes?: number;
    expectedSha256?: string;
    packageName?: string;
    versionCode?: number;
  }): Promise<AppUpdateDownloadResult>;
  cancelDownload(): Promise<void>;
  installDownloaded(): Promise<AppUpdateInstallResult>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: AppUpdateDownloadProgress) => void,
  ): Promise<PluginListenerHandle>;
};

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export type AppUpdateDownloadState =
  | 'idle'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'installing'
  | 'permission'
  | 'error';

export const isNativeAppUpdaterAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('AppUpdater');

const normalizeHash = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized || undefined;
};

const validateUpdateUrl = (value: string) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('更新地址无效，请联系管理员。');
  }
  const localAndroidHost = ['localhost', '127.0.0.1', '10.0.2.2'].includes(parsed.hostname);
  const allowNativeLocalHttp =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && localAndroidHost;
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && allowNativeLocalHttp)) {
    throw new Error('更新包必须通过 HTTPS 下载。');
  }
  return parsed.toString();
};

export const downloadAppUpdate = async (
  update: AppUpdateCheckResponse,
  onProgress?: (progress: AppUpdateDownloadProgress) => void,
) => {
  if (!update.apk_url) throw new Error('更新包暂不可下载，请稍后重试。');
  if (!hasVerifiedAppUpdateMetadata(update)) {
    throw new Error('更新包校验信息不完整，请联系管理员。');
  }
  if (!isNativeAppUpdaterAvailable()) {
    throw new Error('请在 Android 应用内执行更新。');
  }

  const url = validateUpdateUrl(update.apk_url);
  let progressHandle: PluginListenerHandle | null = null;
  if (onProgress) {
    progressHandle = await AppUpdater.addListener('downloadProgress', (event) => {
      const downloadedBytes = Number.isFinite(event.downloaded_bytes)
        ? event.downloaded_bytes
        : Number((event as unknown as { receivedBytes?: number }).receivedBytes ?? 0);
      const rawTotalBytes = Number.isFinite(event.total_bytes)
        ? event.total_bytes
        : Number((event as unknown as { totalBytes?: number }).totalBytes ?? 0);
      const rawProgress = Number(event.progress ?? 0);
      onProgress({
        ...event,
        downloaded_bytes: downloadedBytes,
        total_bytes: rawTotalBytes,
        progress: rawProgress <= 1 ? rawProgress * 100 : rawProgress,
        state: event.state ?? (event as unknown as { phase?: string }).phase,
      });
    });
  }

  try {
    return await AppUpdater.downloadAndInstall({
      url,
      fileName: `nianlun-${update.latest_version}-${update.latest_build_number}.apk`,
      expectedSizeBytes: update.apk_size_bytes ?? undefined,
      expectedSha256: normalizeHash(update.apk_sha256),
      packageName: 'com.xmlga.nianlun',
      versionCode: update.latest_build_number,
    });
  } finally {
    await progressHandle?.remove();
  }
};

export const cancelAppUpdateDownload = async () => {
  if (!isNativeAppUpdaterAvailable()) return;
  await AppUpdater.cancelDownload();
};

export const installDownloadedAppUpdate = async (_path?: string): Promise<AppUpdateInstallResult> => {
  if (!isNativeAppUpdaterAvailable()) throw new Error('请在 Android 应用内执行更新。');
  return AppUpdater.installDownloaded();
};
