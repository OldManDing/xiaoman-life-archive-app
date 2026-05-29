import { describe, expect, it } from 'vitest';

import { deriveMediaType, isSupportedImageFile, resolveFileMimeType, withResolvedFileMimeType } from './mediaFiles';

describe('mediaFiles', () => {
  it('infers supported image type from filename when the picker returns a generic MIME type', () => {
    const file = new File([new Uint8Array([1])], 'avatar.JPG', { type: 'application/octet-stream' });

    expect(resolveFileMimeType(file)).toBe('image/jpeg');
    expect(deriveMediaType(file)).toBe('image');
    expect(isSupportedImageFile(file)).toBe(true);
  });

  it('wraps files with inferred MIME type so previews and uploads use image data URLs', async () => {
    const file = new File([new Uint8Array([1])], 'avatar.png', { type: 'application/octet-stream' });
    const normalized = withResolvedFileMimeType(file);

    expect(normalized).not.toBe(file);
    expect(normalized.type).toBe('image/png');
    expect(normalized.name).toBe('avatar.png');
  });
});
