import { afterEach, describe, expect, it } from 'vitest';

import {
  createPersistableMediaPreview,
  removeRuntimeMediaPreview,
  resolveStoredMediaUrl,
  saveLocalMediaPreview,
  saveRuntimeMediaPreview,
  toLocalMediaReference,
  toStoredMediaReference,
} from './localMediaPreview';

describe('resolveStoredMediaUrl', () => {
  afterEach(() => {
    window.localStorage.clear();
    removeRuntimeMediaPreview('m_runtime');
  });

  it('returns null for blank stored media values so callers can use fallbacks', () => {
    expect(resolveStoredMediaUrl('')).toBeNull();
    expect(resolveStoredMediaUrl('   ')).toBeNull();
  });

  it('resolves persisted local media references', () => {
    const dataUrl = 'data:image/png;base64,preview';
    expect(saveLocalMediaPreview('m_001', dataUrl)).toBe(true);
    expect(resolveStoredMediaUrl(toLocalMediaReference('m_001'))).toBe(dataUrl);
  });

  it('resolves stable media references from local preview cache', () => {
    const dataUrl = 'data:image/png;base64,avatar';
    expect(saveLocalMediaPreview('m_002', dataUrl)).toBe(true);
    expect(resolveStoredMediaUrl(toStoredMediaReference('m_002'))).toBe(dataUrl);
  });

  it('prefers runtime media previews for newly uploaded files', () => {
    saveRuntimeMediaPreview('m_runtime', 'blob:record-video-preview');

    expect(resolveStoredMediaUrl(toStoredMediaReference('m_runtime'))).toBe('blob:record-video-preview');

    removeRuntimeMediaPreview('m_runtime');
  });

  it('prefers persisted previews over runtime blob URLs when both exist', () => {
    const dataUrl = 'data:image/png;base64,avatar';
    saveRuntimeMediaPreview('m_runtime', 'blob:revoked-avatar-preview');
    expect(saveLocalMediaPreview('m_runtime', dataUrl)).toBe(true);

    expect(resolveStoredMediaUrl(toStoredMediaReference('m_runtime'))).toBe(dataUrl);

    removeRuntimeMediaPreview('m_runtime');
  });

  it('does not read large non-image files into persisted data URLs', async () => {
    const file = new File([new Uint8Array(4_300_001)], 'clip.mp4', { type: 'video/mp4' });

    await expect(createPersistableMediaPreview(file)).resolves.toBeNull();
  });
});
