import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useCachedMediaUrl } from './useCachedMediaUrl';
import { ensureRemoteMediaCached, getCachedMediaObjectUrl } from './mediaCache';

vi.mock('./mediaCache', () => ({
  ensureRemoteMediaCached: vi.fn(),
  getCachedMediaObjectUrl: vi.fn(),
  revokeCachedMediaObjectUrl: vi.fn(),
}));

const getCachedMediaObjectUrlMock = vi.mocked(getCachedMediaObjectUrl);
const ensureRemoteMediaCachedMock = vi.mocked(ensureRemoteMediaCached);

const RemoteMediaProbe = ({ mediaNo = 'm_001', accessUrl = 'https://media.example.com/photo.jpg' }) => {
  const mediaUrl = useCachedMediaUrl(mediaNo, accessUrl, 'image', { cacheRemote: true });
  return <output aria-label="media-url">{mediaUrl ?? ''}</output>;
};

const AudioMediaProbe = () => {
  const mediaUrl = useCachedMediaUrl('m_audio', 'https://media.example.com/story.mp3', 'audio', { cacheRemote: true });
  return <output aria-label="media-url">{mediaUrl ?? ''}</output>;
};

describe('useCachedMediaUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not expose a remote media URL before an existing local cache lookup completes', async () => {
    getCachedMediaObjectUrlMock.mockResolvedValueOnce({
      url: 'blob:cached-photo',
      size: 128,
      mimeType: 'image/jpeg',
    });

    render(<RemoteMediaProbe mediaNo="m_cached" accessUrl="https://media.example.com/cached.jpg" />);

    expect(screen.getByLabelText('media-url').textContent).toBe('');

    await waitFor(() => {
      expect(screen.getByLabelText('media-url').textContent).toBe('blob:cached-photo');
    });
    expect(ensureRemoteMediaCachedMock).not.toHaveBeenCalled();
  });

  it('falls back to the remote URL only when caching cannot produce a local object URL', async () => {
    getCachedMediaObjectUrlMock.mockResolvedValueOnce(null);
    ensureRemoteMediaCachedMock.mockResolvedValueOnce(false);

    render(<RemoteMediaProbe mediaNo="m_cache_miss" accessUrl="https://media.example.com/cache-miss.jpg" />);

    expect(screen.getByLabelText('media-url').textContent).toBe('');

    await waitFor(() => {
      expect(screen.getByLabelText('media-url').textContent).toBe('https://media.example.com/cache-miss.jpg');
    });
  });

  it('keeps audio playable while checking the optional cache in the background', () => {
    getCachedMediaObjectUrlMock.mockResolvedValueOnce(null);

    render(<AudioMediaProbe />);

    expect(screen.getByLabelText('media-url').textContent).toBe('https://media.example.com/story.mp3');
  });
});
