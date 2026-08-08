import { BadRequestException } from '@nestjs/common';

export type RecordMediaPolicyType = 'image' | 'video' | 'audio';

export const DEFAULT_RECORD_MEDIA_LIMITS = {
  imageMaxCount: 9,
  videoMaxCount: 1,
  audioMaxCount: 1,
  videoMaxDurationSeconds: 5 * 60,
  audioMaxDurationSeconds: 10 * 60,
} as const;

const readPositiveInteger = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const getRecordMediaLimits = () => ({
  imageMaxCount: readPositiveInteger('UPLOAD_IMAGE_MAX_COUNT_PER_RECORD', DEFAULT_RECORD_MEDIA_LIMITS.imageMaxCount),
  videoMaxCount: readPositiveInteger('UPLOAD_VIDEO_MAX_COUNT_PER_RECORD', DEFAULT_RECORD_MEDIA_LIMITS.videoMaxCount),
  audioMaxCount: readPositiveInteger('UPLOAD_AUDIO_MAX_COUNT_PER_RECORD', DEFAULT_RECORD_MEDIA_LIMITS.audioMaxCount),
  videoMaxDurationSeconds: readPositiveInteger('UPLOAD_VIDEO_MAX_DURATION_SECONDS', DEFAULT_RECORD_MEDIA_LIMITS.videoMaxDurationSeconds),
  audioMaxDurationSeconds: readPositiveInteger('UPLOAD_AUDIO_MAX_DURATION_SECONDS', DEFAULT_RECORD_MEDIA_LIMITS.audioMaxDurationSeconds),
});

export const getRecordMediaCountLimit = (mediaType: RecordMediaPolicyType) => {
  const limits = getRecordMediaLimits();
  if (mediaType === 'image') return limits.imageMaxCount;
  if (mediaType === 'video') return limits.videoMaxCount;
  return limits.audioMaxCount;
};

export const getRecordMediaDurationLimit = (mediaType: RecordMediaPolicyType) => {
  const limits = getRecordMediaLimits();
  if (mediaType === 'video') return limits.videoMaxDurationSeconds;
  if (mediaType === 'audio') return limits.audioMaxDurationSeconds;
  return null;
};

export const formatMediaDurationLimit = (seconds: number) => {
  if (seconds % 60 === 0) return `${seconds / 60}分钟`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes ? `${minutes}分${remainingSeconds}秒` : `${remainingSeconds}秒`;
};

export const ensureRecordMediaCountLimits = (media: ReadonlyArray<{ mediaType: string }>) => {
  const counts: Record<RecordMediaPolicyType, number> = { image: 0, video: 0, audio: 0 };
  for (const item of media) {
    if (item.mediaType === 'image' || item.mediaType === 'video' || item.mediaType === 'audio') {
      counts[item.mediaType] += 1;
    }
  }

  for (const mediaType of ['image', 'video', 'audio'] as const) {
    const count = counts[mediaType];
    const limit = getRecordMediaCountLimit(mediaType);
    if (count > limit) {
      const label = mediaType === 'image' ? '图片' : mediaType === 'video' ? '视频' : '语音';
      const unit = mediaType === 'image' ? '张' : '条';
      throw new BadRequestException(`每条记录最多上传${limit}${unit}${label}`);
    }
  }
};

export const ensureMediaDurationLimit = (mediaType: RecordMediaPolicyType, durationSeconds: number | null | undefined) => {
  if (mediaType === 'image') return;

  const label = mediaType === 'video' ? '视频' : '语音';
  const limit = getRecordMediaDurationLimit(mediaType) as number;
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new BadRequestException(`${label}时长读取失败，请重新选择可播放的${label}文件`);
  }
  if (durationSeconds > limit) {
    throw new BadRequestException(`${label}时长不能超过${formatMediaDurationLimit(limit)}`);
  }
};
