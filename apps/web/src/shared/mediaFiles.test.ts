import { describe, expect, it } from 'vitest';

import { deriveMediaType, isSupportedImageFile, resolveFileMimeType, withResolvedFileMimeType } from './mediaFiles';

describe('mediaFiles', () => {
  it('infers supported image type from filename when the picker returns a generic MIME type', () => {
    const file = new File([new Uint8Array([1])], 'avatar.JPG', { type: 'application/octet-stream' });

    expect(resolveFileMimeType(file)).toBe('image/jpeg');
    expect(deriveMediaType(file)).toBe('image');
    expect(isSupportedImageFile(file)).toBe(true);
  });

  it('accepts Android WebView image wildcard MIME types for avatar uploads', () => {
    const file = new File([new Uint8Array([1])], 'avatar', { type: 'image/*' });

    expect(resolveFileMimeType(file)).toBe('image/jpeg');
    expect(deriveMediaType(file)).toBe('image');
    expect(isSupportedImageFile(file)).toBe(true);
  });

  it('prefers the filename extension when a mobile picker returns a wildcard MIME type', () => {
    const file = new File([new Uint8Array([1])], 'avatar.png', { type: 'image/*' });

    expect(resolveFileMimeType(file)).toBe('image/png');
    expect(withResolvedFileMimeType(file).type).toBe('image/png');
  });

  it('wraps files with inferred MIME type so previews and uploads use image data URLs', async () => {
    const file = new File([new Uint8Array([1])], 'avatar.png', { type: 'application/octet-stream' });
    const normalized = withResolvedFileMimeType(file);

    expect(normalized).not.toBe(file);
    expect(normalized.type).toBe('image/png');
    expect(normalized.name).toBe('avatar.png');
  });

  it('infers mobile video types from filenames when the picker returns a generic MIME type', () => {
    expect(resolveFileMimeType(new File([new Uint8Array([1])], 'birthday.MP4', { type: 'application/octet-stream' }))).toBe('video/mp4');
    expect(deriveMediaType(new File([new Uint8Array([1])], 'camera.MOV', { type: 'application/octet-stream' }))).toBe('video');
  });
});
