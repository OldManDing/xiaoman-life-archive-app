import type { SupportedMediaType } from './mediaFiles';

export const RECORD_MEDIA_LIMITS = {
  imageMaxCount: 9,
  videoMaxCount: 1,
  audioMaxCount: 1,
  videoMaxDurationSeconds: 5 * 60,
  audioMaxDurationSeconds: 10 * 60,
} as const;

export const getMediaCountLimit = (mediaType: SupportedMediaType) => {
  if (mediaType === 'image') return RECORD_MEDIA_LIMITS.imageMaxCount;
  if (mediaType === 'video') return RECORD_MEDIA_LIMITS.videoMaxCount;
  return RECORD_MEDIA_LIMITS.audioMaxCount;
};

export const getMediaDurationLimit = (mediaType: SupportedMediaType) => {
  if (mediaType === 'video') return RECORD_MEDIA_LIMITS.videoMaxDurationSeconds;
  if (mediaType === 'audio') return RECORD_MEDIA_LIMITS.audioMaxDurationSeconds;
  return null;
};

export const formatMediaDurationLimit = (seconds: number) => {
  if (seconds % 60 === 0) return `${seconds / 60}分钟`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes ? `${minutes}分${remainingSeconds}秒` : `${remainingSeconds}秒`;
};

export const getMediaCountLimitMessage = (mediaType: SupportedMediaType) => {
  const limit = getMediaCountLimit(mediaType);
  const label = mediaType === 'image' ? '图片' : mediaType === 'video' ? '视频' : '语音';
  const unit = mediaType === 'image' ? '张' : '条';
  return `每条记录最多上传${limit}${unit}${label}`;
};

export const getMediaDurationLimitMessage = (mediaType: SupportedMediaType) => {
  const limit = getMediaDurationLimit(mediaType);
  if (!limit) return '';
  const label = mediaType === 'video' ? '视频' : '语音';
  return `${label}最长支持${formatMediaDurationLimit(limit)}`;
};

export const getMediaLimitHint = () =>
  `图片 ${RECORD_MEDIA_LIMITS.imageMaxCount} 张 · 视频 ${RECORD_MEDIA_LIMITS.videoMaxCount} 条 / ${formatMediaDurationLimit(RECORD_MEDIA_LIMITS.videoMaxDurationSeconds)} · 语音 ${RECORD_MEDIA_LIMITS.audioMaxCount} 条 / ${formatMediaDurationLimit(RECORD_MEDIA_LIMITS.audioMaxDurationSeconds)}`;
