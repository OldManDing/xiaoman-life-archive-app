import { afterEach, describe, expect, it } from 'vitest';

import { resolveStoredMediaUrl, saveLocalMediaPreview, toLocalMediaReference } from './localMediaPreview';

describe('resolveStoredMediaUrl', () => {
  afterEach(() => {
    window.localStorage.clear();
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
});
