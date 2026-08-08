import { describe, expect, it } from 'vitest';

import {
  getMediaCountLimitMessage,
  getMediaDurationLimitMessage,
  getMediaLimitHint,
  RECORD_MEDIA_LIMITS,
} from './mediaLimits';

describe('media limits', () => {
  it('exposes the record count and duration limits used by the editor', () => {
    expect(RECORD_MEDIA_LIMITS).toMatchObject({
      imageMaxCount: 9,
      videoMaxCount: 1,
      audioMaxCount: 1,
      videoMaxDurationSeconds: 300,
      audioMaxDurationSeconds: 600,
    });
    expect(getMediaCountLimitMessage('image')).toBe('每条记录最多上传9张图片');
    expect(getMediaCountLimitMessage('video')).toBe('每条记录最多上传1条视频');
    expect(getMediaDurationLimitMessage('video')).toBe('视频最长支持5分钟');
    expect(getMediaDurationLimitMessage('audio')).toBe('语音最长支持10分钟');
    expect(getMediaLimitHint()).toBe('图片 9 张 · 视频 1 条 / 5分钟 · 语音 1 条 / 10分钟');
  });
});
