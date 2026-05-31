import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MediaPreview } from './detail-drawer';

describe('MediaPreview', () => {
  it('renders image previews inline', () => {
    render(<MediaPreview src="https://example.com/photo.jpg" alt="photo" mediaType="image" mimeType="image/jpeg" />);

    expect(screen.getByRole('img', { name: 'photo' })).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('renders video previews inline', () => {
    const { container } = render(<MediaPreview src="https://example.com/clip.mp4" alt="clip" mediaType="video" mimeType="video/mp4" />);

    expect(container.querySelector('video')).toHaveAttribute('src', 'https://example.com/clip.mp4');
  });

  it('renders audio previews inline', () => {
    const { container } = render(<MediaPreview src="https://example.com/voice.m4a" alt="voice" mediaType="audio" mimeType="audio/mp4" />);

    expect(container.querySelector('audio')).toHaveAttribute('src', 'https://example.com/voice.m4a');
  });

  it('shows an explicit empty state when no access url exists', () => {
    render(<MediaPreview src={null} alt="missing" mediaType="image" mimeType="image/jpeg" />);

    expect(screen.getByText('暂无预览地址')).toBeInTheDocument();
  });

  it('shows a fallback link when inline preview loading fails', () => {
    render(<MediaPreview src="https://example.com/broken.jpg" alt="broken" mediaType="image" mimeType="image/jpeg" />);

    fireEvent.error(screen.getByRole('img', { name: 'broken' }));

    expect(screen.getByText('预览加载失败')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开原文件' })).toHaveAttribute('href', 'https://example.com/broken.jpg');
  });
});
