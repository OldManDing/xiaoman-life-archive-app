import type { SupportedMediaType } from './mediaFiles';
import { resolveFileMimeType } from './mediaFiles';

export type MediaUploadMetadata = {
  width?: number;
  height?: number;
  duration_seconds?: number | null;
};

const MEDIA_METADATA_TIMEOUT_MS = 10_000;
const PLAYABLE_AUDIO_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg']);
const UNPLAYABLE_AUDIO_MIME_TYPES = new Set(['audio/3gpp', 'audio/amr']);

export const UNSUPPORTED_AUDIO_PLAYBACK_MESSAGE = '当前录音格式在手机内置播放器中无法播放，请选择 m4a、mp3、wav 或 aac 格式的语音文件。';

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timer));
  });

const normalizePositiveInteger = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.max(1, Math.round(value));
};

const normalizeDurationSeconds = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.max(0, Math.round(value));
};

const readImageMetadata = (url: string) =>
  withTimeout(
    new Promise<MediaUploadMetadata>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => {
        const width = normalizePositiveInteger(image.naturalWidth || image.width);
        const height = normalizePositiveInteger(image.naturalHeight || image.height);
        if (!width || !height) {
          reject(new Error('图片尺寸读取失败，请重新选择一张图片。'));
          return;
        }
        resolve({ width, height });
      };
      image.onerror = () => reject(new Error('图片尺寸读取失败，请重新选择一张图片。'));
      image.src = url;
    }),
    MEDIA_METADATA_TIMEOUT_MS,
    '图片尺寸读取超时，请重新选择一张图片。',
  );

const readMediaElementMetadata = (url: string, mediaType: 'video' | 'audio', durationFallbackSeconds?: number | null) =>
  withTimeout(
    new Promise<MediaUploadMetadata>((resolve, reject) => {
      const element = mediaType === 'video' ? document.createElement('video') : document.createElement('audio');
      const fallbackDurationSeconds = normalizeDurationSeconds(durationFallbackSeconds);
      element.preload = 'metadata';
      element.muted = true;
      element.onloadedmetadata = () => {
        const durationSeconds = normalizeDurationSeconds(element.duration) ?? fallbackDurationSeconds;
        if (mediaType === 'video') {
          const video = element as HTMLVideoElement;
          const width = normalizePositiveInteger(video.videoWidth);
          const height = normalizePositiveInteger(video.videoHeight);
          if (typeof durationSeconds !== 'number' || !width || !height) {
            reject(new Error('视频信息读取失败，请重新选择可播放的视频。'));
            return;
          }
          resolve({ width, height, duration_seconds: durationSeconds });
          return;
        }

        if (typeof durationSeconds !== 'number') {
          resolve({ duration_seconds: null });
          return;
        }
        resolve({ duration_seconds: durationSeconds });
      };
      element.onerror = () => {
        if (mediaType === 'audio' && typeof fallbackDurationSeconds === 'number') {
          resolve({ duration_seconds: fallbackDurationSeconds });
          return;
        }
        reject(new Error(mediaType === 'video' ? '视频信息读取失败，请重新选择可播放的视频。' : '录音无法播放，请选择 m4a、mp3、wav 或 aac 格式的语音文件。'));
      };
      element.src = url;
      element.load();
    }),
    MEDIA_METADATA_TIMEOUT_MS,
    mediaType === 'video' ? '视频信息读取超时，请重新选择可播放的视频。' : '录音信息读取超时，请重新选择可播放的语音文件。',
  );

export const readUploadMetadata = (
  mediaType: SupportedMediaType,
  url: string | null | undefined,
  options: { durationFallbackSeconds?: number | null } = {},
) => {
  if (!url) {
    if (mediaType === 'image') return Promise.reject(new Error('图片尺寸读取失败，请重新选择一张图片。'));
    if (mediaType === 'video') return Promise.reject(new Error('视频信息读取失败，请重新选择可播放的视频。'));
    return Promise.reject(new Error('录音无法播放，请选择 m4a、mp3、wav 或 aac 格式的语音文件。'));
  }
  if (mediaType === 'image') return readImageMetadata(url);
  if (mediaType === 'video') return readMediaElementMetadata(url, 'video');
  return readMediaElementMetadata(url, 'audio', options.durationFallbackSeconds);
};

export const ensurePlayableAudioFile = (file: File) => {
  const mimeType = resolveFileMimeType(file);
  if (UNPLAYABLE_AUDIO_MIME_TYPES.has(mimeType)) {
    throw new Error(UNSUPPORTED_AUDIO_PLAYBACK_MESSAGE);
  }
  if (mimeType.startsWith('audio/') && !PLAYABLE_AUDIO_MIME_TYPES.has(mimeType)) {
    const audio = document.createElement('audio');
    if (audio.canPlayType(mimeType) === '') {
      throw new Error(UNSUPPORTED_AUDIO_PLAYBACK_MESSAGE);
    }
  }
};

export const normalizeUploadErrorMessage = (message: string, mediaType: SupportedMediaType) => {
  if (/图片需?要?提供宽高信息|width|height/i.test(message) && mediaType === 'image') {
    return '图片尺寸读取失败，请重新选择一张图片。';
  }
  if (/视频需?要?提供时长信息|duration/i.test(message) && mediaType === 'video') {
    return '视频时长读取失败，请重新选择可播放的视频。';
  }
  if (/录音无法播放|音频|audio|duration/i.test(message) && mediaType === 'audio') {
    return '录音无法播放，请选择 m4a、mp3、wav 或 aac 格式的语音文件。';
  }
  return message;
};
