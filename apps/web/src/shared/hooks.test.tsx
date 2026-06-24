import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearMediaAccessUrlCache, useStoredMediaUrl } from './hooks';
import { webApi } from './api/webApi';
import { ensureRemoteMediaCached, getCachedMediaObjectUrl } from './mediaCache';

vi.mock('./api/webApi', () => ({
  webApi: {
    mediaAccessUrl: vi.fn(),
  },
}));

vi.mock('./mediaCache', () => ({
  ensureRemoteMediaCached: vi.fn(),
  getCachedMediaObjectUrl: vi.fn(),
  revokeCachedMediaObjectUrl: vi.fn(),
}));

const mediaAccessUrlMock = vi.mocked(webApi.mediaAccessUrl);
const getCachedMediaObjectUrlMock = vi.mocked(getCachedMediaObjectUrl);
const ensureRemoteMediaCachedMock = vi.mocked(ensureRemoteMediaCached);

const StoredMediaProbe = ({ value = 'media:m_avatar', mediaNo }: { value?: string; mediaNo?: string }) => {
  const url = useStoredMediaUrl(value, mediaNo);
  return <output aria-label="stored-media-url">{url ?? ''}</output>;
};

describe('useStoredMediaUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMediaAccessUrlCache();
    window.localStorage.clear();
  });

  it('uses an existing cached avatar blob without waiting for a remote access URL', async () => {
    getCachedMediaObjectUrlMock.mockResolvedValueOnce({
      url: 'blob:cached-avatar',
      size: 512,
      mimeType: 'image/jpeg',
    });
    mediaAccessUrlMock.mockReturnValueOnce(new Promise(() => undefined));

    render(<StoredMediaProbe />);

    expect(screen.getByLabelText('stored-media-url').textContent).toBe('');

    await waitFor(() => {
      expect(screen.getByLabelText('stored-media-url').textContent).toBe('blob:cached-avatar');
    });
    expect(mediaAccessUrlMock).toHaveBeenCalledWith('m_avatar');
    expect(ensureRemoteMediaCachedMock).not.toHaveBeenCalled();
  });

  it('reuses cached avatar object URLs immediately after remounting', async () => {
    getCachedMediaObjectUrlMock.mockResolvedValue({
      url: 'blob:cached-avatar',
      size: 512,
      mimeType: 'image/jpeg',
    });
    mediaAccessUrlMock.mockReturnValue(new Promise(() => undefined));

    const firstRender = render(<StoredMediaProbe />);

    await waitFor(() => {
      expect(screen.getByLabelText('stored-media-url').textContent).toBe('blob:cached-avatar');
    });
    firstRender.unmount();

    render(<StoredMediaProbe />);

    expect(screen.getByLabelText('stored-media-url').textContent).toBe('blob:cached-avatar');
  });

  it('stores a remote avatar locally before exposing it after a cache miss', async () => {
    getCachedMediaObjectUrlMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        url: 'blob:downloaded-avatar',
        size: 768,
        mimeType: 'image/jpeg',
      });
    mediaAccessUrlMock.mockResolvedValueOnce({
      media_no: 'm_avatar',
      access_url: 'https://cdn.example.test/avatar.jpg',
      expires_in: 3600,
    });
    ensureRemoteMediaCachedMock.mockResolvedValueOnce(true);

    render(<StoredMediaProbe />);

    expect(screen.getByLabelText('stored-media-url').textContent).toBe('');

    await waitFor(() => {
      expect(screen.getByLabelText('stored-media-url').textContent).toBe('blob:downloaded-avatar');
    });
    expect(mediaAccessUrlMock).toHaveBeenCalledWith('m_avatar');
    expect(ensureRemoteMediaCachedMock).toHaveBeenCalledWith('m_avatar', 'https://cdn.example.test/avatar.jpg', 'image');
  });

  it('shows the remote avatar while the local cache write is still pending', async () => {
    getCachedMediaObjectUrlMock.mockResolvedValueOnce(null);
    mediaAccessUrlMock.mockResolvedValueOnce({
      media_no: 'm_avatar',
      access_url: 'https://cdn.example.test/avatar.jpg',
      expires_in: 3600,
    });
    ensureRemoteMediaCachedMock.mockReturnValueOnce(new Promise<boolean>(() => undefined));

    render(<StoredMediaProbe />);

    await waitFor(() => {
      expect(screen.getByLabelText('stored-media-url').textContent).toBe('https://cdn.example.test/avatar.jpg');
    });
    expect(ensureRemoteMediaCachedMock).toHaveBeenCalledWith('m_avatar', 'https://cdn.example.test/avatar.jpg', 'image');
  });

  it('prefers a thumbnail access URL for stored media avatars', async () => {
    getCachedMediaObjectUrlMock.mockResolvedValueOnce(null);
    mediaAccessUrlMock.mockResolvedValueOnce({
      media_no: 'm_avatar',
      access_url: 'https://cdn.example.test/avatar-original.jpg',
      thumbnail_url: 'https://cdn.example.test/avatar-thumb.jpg',
      expires_in: 3600,
    });
    ensureRemoteMediaCachedMock.mockReturnValueOnce(new Promise<boolean>(() => undefined));

    render(<StoredMediaProbe />);

    await waitFor(() => {
      expect(screen.getByLabelText('stored-media-url').textContent).toBe('https://cdn.example.test/avatar-thumb.jpg');
    });
    expect(ensureRemoteMediaCachedMock).toHaveBeenCalledWith('m_avatar', 'https://cdn.example.test/avatar-thumb.jpg', 'image');
  });

  it('uses an existing cached direct avatar URL without fetching it again', async () => {
    getCachedMediaObjectUrlMock.mockResolvedValueOnce({
      url: 'blob:cached-direct-avatar',
      size: 640,
      mimeType: 'image/jpeg',
    });

    render(<StoredMediaProbe value="https://cdn.example.test/avatar-v1.jpg" />);

    await waitFor(() => {
      expect(screen.getByLabelText('stored-media-url').textContent).toBe('blob:cached-direct-avatar');
    });
    expect(mediaAccessUrlMock).not.toHaveBeenCalled();
    expect(ensureRemoteMediaCachedMock).not.toHaveBeenCalled();
  });

  it('caches a signed avatar URL with its stable media number', async () => {
    getCachedMediaObjectUrlMock.mockResolvedValueOnce(null);
    ensureRemoteMediaCachedMock.mockResolvedValueOnce(false);

    render(<StoredMediaProbe value="https://cdn.example.test/avatar-v1.jpg?sign=temporary" mediaNo="m_avatar_stable" />);

    expect(screen.getByLabelText('stored-media-url').textContent).toBe('https://cdn.example.test/avatar-v1.jpg?sign=temporary');

    await waitFor(() => {
      expect(getCachedMediaObjectUrlMock).toHaveBeenCalledWith('m_avatar_stable');
    });
    expect(mediaAccessUrlMock).not.toHaveBeenCalled();
    expect(ensureRemoteMediaCachedMock).toHaveBeenCalledWith('m_avatar_stable', 'https://cdn.example.test/avatar-v1.jpg?sign=temporary', 'image');
  });

  it('requests a fresh avatar when the stored media reference changes', async () => {
    getCachedMediaObjectUrlMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        url: 'blob:avatar-v1',
        size: 512,
        mimeType: 'image/jpeg',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        url: 'blob:avatar-v2',
        size: 768,
        mimeType: 'image/jpeg',
      });
    mediaAccessUrlMock
      .mockResolvedValueOnce({
        media_no: 'm_avatar_v1',
        access_url: 'https://cdn.example.test/avatar-v1.jpg',
        expires_in: 3600,
      })
      .mockResolvedValueOnce({
        media_no: 'm_avatar_v2',
        access_url: 'https://cdn.example.test/avatar-v2.jpg',
        expires_in: 3600,
      });
    ensureRemoteMediaCachedMock.mockResolvedValue(true);

    const { rerender } = render(<StoredMediaProbe value="media:m_avatar_v1" />);

    await waitFor(() => {
      expect(screen.getByLabelText('stored-media-url').textContent).toBe('blob:avatar-v1');
    });

    rerender(<StoredMediaProbe value="media:m_avatar_v2" />);

    await waitFor(() => {
      expect(screen.getByLabelText('stored-media-url').textContent).toBe('blob:avatar-v2');
    });
    expect(mediaAccessUrlMock).toHaveBeenCalledWith('m_avatar_v1');
    expect(mediaAccessUrlMock).toHaveBeenCalledWith('m_avatar_v2');
  });
});
