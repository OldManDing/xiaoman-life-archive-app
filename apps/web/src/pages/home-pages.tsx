import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Film,
  FileText,
  MapPin,
  Play,
  PlayCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
} from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { formatAgeAtEvent } from '../shared/age';
import { webApi } from '../shared/api/webApi';
import type { RecordSummary, RecordsListResponse } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { recordTypeLabel } from '../shared/labels';
import { loadLocalSettings } from '../shared/localSettings';
import { useCachedMediaUrl } from '../shared/useCachedMediaUrl';
import { compactPrimaryButtonStyle } from '../shared/ui';
import { EmptyState, normalizeDisplayName } from './shared';
import {
  RefAvatar,
  RefChip,
  isReferencePlaceholderAvatar,
  refCardStyle,
  refContentStyle,
  refMutedTextStyle,
  refPageStyle,
  refPrimaryButtonStyle,
  refSecondaryButtonStyle,
  refSoftCardStyle,
  referenceAssets,
} from './reference-ui';

const iconButtonStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: '8px',
  border: '1px solid var(--nl-border-strong)',
  background: 'var(--nl-control-bg)',
  color: 'var(--nl-ink)',
  display: 'grid',
  placeItems: 'center',
  boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
  cursor: 'pointer',
};

const formatDay = (value: string) => new Date(value).getDate();
const formatMonth = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'short' });
const formatShortDate = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const formatAnniversaryDate = (value: string) => new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
const formatArchiveMonthTitle = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const formatWeekdayShort = (value: string) => new Date(value).toLocaleDateString('zh-CN', { weekday: 'short' }).replace('星期', '周');
const formatMonthTitle = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
};

const getOneYearAgoWindow = () => {
  const target = new Date();
  target.setFullYear(target.getFullYear() - 1);
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

const getMediaKind = (record: RecordSummary) => record.cover_media_type ?? (record.record_type === 'audio' || record.record_type === 'video' ? record.record_type : null);
const getRecordLabel = (record: RecordSummary) => recordTypeLabel(record.record_type, record.is_milestone);

const referenceAvatarFor = (src: string | null | undefined, fallbackSrc: string) => {
  if (!src || isReferencePlaceholderAvatar(src)) return fallbackSrc;
  return src;
};

const childAvatarFor = (src?: string | null) => referenceAvatarFor(src, referenceAssets.childAvatar);
const momAvatarFor = (src?: string | null) => referenceAvatarFor(src, referenceAssets.momAvatar);

const hasVisualCover = (record: RecordSummary) => {
  const mediaKind = getMediaKind(record);
  return mediaKind !== 'audio' && Boolean(record.cover_media_no || record.cover_url);
};

const homeImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const HomeImage = ({
  src,
  fallbackSrc,
  alt,
  loading = 'lazy',
  style,
}: {
  src: string | null | undefined;
  fallbackSrc: string | null;
  alt: string;
  loading?: 'eager' | 'lazy';
  style?: CSSProperties;
}) => {
  const resolvedSrc = src || fallbackSrc;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [resolvedSrc]);

  const displaySrc = failedSrc === resolvedSrc ? fallbackSrc : resolvedSrc;

  if (!displaySrc) return null;

  return (
    <img
      src={displaySrc}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => {
        if (displaySrc !== fallbackSrc) setFailedSrc(resolvedSrc);
      }}
      style={{ ...homeImageStyle, ...style }}
    />
  );
};

const RecordTextThumbnail = ({ label = '文字', compact = false }: { label?: string; compact?: boolean }) => (
  <span
    aria-hidden="true"
    style={{
      width: '100%',
      height: '100%',
      display: 'grid',
      placeItems: 'center',
      gap: compact ? 3 : 5,
      background: 'rgba(var(--nl-surface-strong-rgb),0.34)',
      color: 'var(--nl-muted-strong)',
    }}
  >
    <FileText size={compact ? 17 : 20} strokeWidth={1.8} />
    <span style={{ fontSize: compact ? 9 : 10, lineHeight: 1, fontWeight: 620, letterSpacing: 0 }}>{label}</span>
  </span>
);

const RecordSummaryCard = ({ record, onClick }: { record: RecordSummary; onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{ width: '100%', minHeight: 82, border: '1px solid var(--nl-border-muted)', borderRadius: 8, background: 'rgba(var(--nl-surface-rgb),0.14)', padding: '12px', display: 'flex', gap: 13, alignItems: 'center', textAlign: 'left', cursor: 'pointer', boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)' }}>
    <span style={{ width: 42, display: 'grid', justifyItems: 'start', flexShrink: 0 }}>
      <strong style={{ color: 'var(--nl-ink)', fontSize: 18, lineHeight: 1, fontWeight: 600 }}>{formatDay(record.event_time)}</strong>
      <span style={{ marginTop: 5, color: 'var(--nl-muted)', fontSize: 11, fontWeight: 500 }}>{formatMonth(record.event_time)}</span>
    </span>
    <span style={{ minWidth: 0, display: 'grid', gap: 6, flex: 1 }}>
      <strong style={{ color: 'var(--nl-ink)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title ?? '未命名记录'}</strong>
      <span style={{ ...refMutedTextStyle, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.summary ?? '这条记录还没有摘要。'}</span>
      <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 500 }}>{record.tags?.length ? `${record.tags.length} 个标签` : normalizeDisplayName(record.creator_name, '家人')}</span>
    </span>
  </button>
);

const HomeTimelineCard = ({ record, onClick, index }: { record: RecordSummary; onClick: () => void; index: number }) => {
  const mediaKind = getMediaKind(record);
  const coverUrl = useCachedMediaUrl(record.cover_media_no, record.cover_url, mediaKind ?? 'image', {
    cacheRemote: mediaKind !== 'audio',
  });
  const isMilestone = record.is_milestone || record.record_type === 'milestone';
  const hasCover = hasVisualCover(record);
  const fallbackImage = index % 2 === 0 ? referenceAssets.childPhoto : referenceAssets.parkPhoto;

  return (
    <button type="button" onClick={onClick} className="nl-pressable" style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--nl-border-soft)', borderRadius: 0, background: 'transparent', padding: '15px 0', textAlign: 'left', cursor: 'pointer', boxShadow: 'none' }}>
      <span style={{ display: 'grid', gridTemplateColumns: '68px minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
        <span style={{ position: 'relative', width: 68, height: 54, borderRadius: 8, overflow: 'hidden', background: 'var(--nl-surface-soft)', display: 'block', flexShrink: 0, border: '1px solid var(--nl-border-muted)', boxShadow: '0 12px 24px rgba(var(--nl-shadow-rgb),0.18)' }}>
          {mediaKind === 'audio' ? (
            <span style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'rgba(var(--nl-primary-rgb),0.1)', color: 'var(--nl-primary-2)' }}>
              <PlayCircle size={22} strokeWidth={2.2} />
            </span>
          ) : hasCover ? (
            <HomeImage src={coverUrl} fallbackSrc={fallbackImage} alt={record.title ?? '成长记录'} />
          ) : (
            <RecordTextThumbnail label={getRecordLabel(record)} compact />
          )}
          {isMilestone ? <span style={{ position: 'absolute', right: 5, top: 5, width: 20, height: 20, borderRadius: '6px', background: 'var(--nl-media-scrim)', color: 'var(--nl-primary-2)', display: 'grid', placeItems: 'center' }}><Star size={11} fill="currentColor" /></span> : null}
        </span>
        <span style={{ minWidth: 0, display: 'grid', gap: 5 }}>
          <span style={{ color: 'var(--nl-muted)', fontSize: 11, lineHeight: 1.1, fontWeight: 520 }}>{formatMonth(record.event_time)} {formatDay(record.event_time)} · {getRecordLabel(record)}</span>
          <strong style={{ color: 'var(--nl-ink)', fontSize: 15, lineHeight: 1.28, fontWeight: 720, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title ?? '未命名记录'}</strong>
          <span style={{ color: 'var(--nl-muted-strong)', fontSize: 12, lineHeight: 1.48, fontWeight: 460, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.summary ?? `${normalizeDisplayName(record.creator_name, '家人')} 留下的一条成长记录。`}</span>
        </span>
      </span>
    </button>
  );
};

const getRecordYear = (value: string) => String(new Date(value).getFullYear());

const TimelineRecordRow = ({
  record,
  index,
  ageLabel,
  onClick,
}: {
  record: RecordSummary;
  index: number;
  ageLabel: string;
  onClick: () => void;
}) => {
  const mediaKind = getMediaKind(record);
  const coverUrl = useCachedMediaUrl(record.cover_media_no, record.cover_url, mediaKind ?? 'image', {
    cacheRemote: mediaKind !== 'audio',
  });
  const isMilestone = record.is_milestone || record.record_type === 'milestone';
  const hasCover = hasVisualCover(record);
  const fallbackImage = index % 3 === 1 ? referenceAssets.parkPhoto : index % 3 === 2 ? referenceAssets.roomPhoto : referenceAssets.childPhoto;
  return (
    <button type="button" onClick={onClick} className="nl-pressable" style={{ width: '100%', minHeight: 112, border: 'none', borderBottom: '1px solid rgba(var(--nl-shadow-rgb),0.07)', borderRadius: 0, background: 'transparent', padding: '18px 0', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 82px', gap: 14, alignItems: 'center', textAlign: 'left', cursor: 'pointer', boxShadow: 'none' }}>
      <span style={{ minWidth: 0, display: 'grid', gap: 8 }}>
        <strong style={{ color: 'var(--nl-ink)', fontSize: 17, lineHeight: 1.22, fontWeight: 780, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.title ?? '未命名记录'}</strong>
        {mediaKind === 'audio' ? (
          <span style={{ width: '100%', maxWidth: 144, minHeight: 34, borderRadius: 8, background: 'transparent', border: '1px solid rgba(var(--nl-primary-rgb),0.2)', color: 'var(--nl-primary-2)', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 520 }}>
            <PlayCircle size={14} fill="currentColor" />
            <span style={{ flex: 1, height: 16, display: 'flex', alignItems: 'center', gap: 3 }}>
              {[10, 16, 8, 20, 12, 18, 9].map((height, waveIndex) => <span key={waveIndex} style={{ width: 3, height, borderRadius: 2, background: 'rgba(var(--nl-primary-rgb),0.28)' }} />)}
            </span>
            00:06
          </span>
        ) : (
          <span style={{ color: 'var(--nl-muted-strong)', fontSize: 13, lineHeight: 1.52, fontWeight: 460, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{record.summary ?? '这条记录还没有正文。'}</span>
        )}
        <span style={{ color: 'var(--nl-muted)', fontSize: 11, lineHeight: 1.15, fontWeight: 560 }}>{ageLabel || formatShortDate(record.event_time)} · {getRecordLabel(record)}</span>
      </span>
      <span style={{ position: 'relative', width: 82, height: 82, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--nl-border-image)', background: 'var(--nl-surface-soft)', boxShadow: '0 14px 32px rgba(var(--nl-shadow-rgb),0.12)' }}>
        {hasCover ? (
          <HomeImage src={coverUrl} fallbackSrc={fallbackImage} alt={record.title ?? '成长照片'} />
        ) : (
          <RecordTextThumbnail label={getRecordLabel(record)} />
        )}
        {isMilestone ? <span style={{ position: 'absolute', right: 6, top: 6, width: 22, height: 22, borderRadius: '8px', background: 'var(--nl-media-scrim)', color: 'var(--nl-on-dark)', display: 'grid', placeItems: 'center', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}><Star size={12} fill="currentColor" /></span> : null}
      </span>
    </button>
  );
};

type HomePhotoTile = {
  src: string | null;
  title: string;
  recordNo?: string;
  meta?: string;
  target?: string;
  placeholder?: boolean;
  mediaKind?: string | null;
  videoPreviewSrc?: string | null;
  textOnly?: boolean;
  excerpt?: string | null;
};

const homePhotoFallbacks = [referenceAssets.childPhoto, referenceAssets.roomPhoto, referenceAssets.parkPhoto];
const HOME_PHOTO_AUTOPLAY_MS = 2000;
const HOME_PHOTO_TURN_MS = 420;
const emptyHomeRecordsResponse: RecordsListResponse = { list: [], page: 1, page_size: 12, total: 0, has_more: false };
const homeVideoThumbnailCache = new Map<string, string | null>();
const homeVideoPreviewCache = new Map<string, string | null>();
const homeVideoThumbnailPromises = new Map<string, Promise<string | null>>();

const getHomeVideoThumbnail = (mediaNo: string) => {
  if (homeVideoThumbnailCache.has(mediaNo)) return Promise.resolve(homeVideoThumbnailCache.get(mediaNo) ?? null);
  const request = homeVideoThumbnailPromises.get(mediaNo) ?? webApi.mediaAccessUrl(mediaNo)
    .then((response) => {
      homeVideoPreviewCache.set(mediaNo, response.access_url || null);
      return response.thumbnail_url || null;
    })
    .catch(() => null)
    .finally(() => homeVideoThumbnailPromises.delete(mediaNo));
  homeVideoThumbnailPromises.set(mediaNo, request);
  return request.then((thumbnailUrl) => {
    homeVideoThumbnailCache.set(mediaNo, thumbnailUrl);
    return thumbnailUrl;
  });
};

const useHomeRecordCover = (record: RecordSummary | null, mediaKind: string | null) => {
  const isVideo = mediaKind === 'video';
  const mediaNo = isVideo ? record?.cover_media_no ?? null : null;
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(() => mediaNo ? homeVideoThumbnailCache.get(mediaNo) ?? null : null);
  const [videoPreview, setVideoPreview] = useState<string | null>(() => mediaNo ? homeVideoPreviewCache.get(mediaNo) ?? null : null);
  const imageUrl = useCachedMediaUrl(
    isVideo ? null : record?.cover_media_no,
    isVideo ? null : record?.cover_url,
    isVideo ? 'image' : mediaKind ?? 'image',
    { cacheRemote: !isVideo && mediaKind !== 'audio' },
  );

  useEffect(() => {
    let active = true;
    setVideoThumbnail(mediaNo ? homeVideoThumbnailCache.get(mediaNo) ?? null : null);
    setVideoPreview(mediaNo ? homeVideoPreviewCache.get(mediaNo) ?? null : null);
    if (mediaNo) void getHomeVideoThumbnail(mediaNo).then((thumbnailUrl) => {
      if (active) {
        setVideoThumbnail(thumbnailUrl);
        setVideoPreview(homeVideoPreviewCache.get(mediaNo) ?? null);
      }
    });
    return () => {
      active = false;
    };
  }, [mediaNo]);

  return {
    src: isVideo ? videoThumbnail : imageUrl,
    videoPreviewSrc: isVideo ? videoPreview : null,
  };
};

const HomeVideoFrame = ({ src, active, compact, title }: { src: string; active: boolean; compact: boolean; title: string }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (active && !compact && !navigator.userAgent.includes('jsdom')) videoRef.current?.load();
  }, [active, compact, src]);

  const seekToFirstFrame = (video: HTMLVideoElement) => {
    if (video.duration > 0.05 && video.currentTime === 0) video.currentTime = Math.min(0.1, video.duration / 10);
  };

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      preload={active && !compact ? 'auto' : 'metadata'}
      onLoadedMetadata={(event) => seekToFirstFrame(event.currentTarget)}
      onLoadedData={(event) => seekToFirstFrame(event.currentTarget)}
      aria-label={active ? title : undefined}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
};

const HomeTileVisual = ({ tile, active, compact = false, fallbackSrc }: { tile: HomePhotoTile; active: boolean; compact?: boolean; fallbackSrc: string }) => {
  if (tile.textOnly) {
    return (
      <span
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          alignContent: compact ? 'center' : 'start',
          justifyItems: compact ? 'center' : 'start',
          gap: compact ? 4 : 18,
          padding: compact ? 8 : '54px 34px 150px',
          boxSizing: 'border-box',
          background: 'var(--nl-primary-2)',
          color: 'var(--nl-on-dark)',
          overflow: 'hidden',
        }}
      >
        <FileText size={compact ? 20 : 28} strokeWidth={1.5} />
        {!compact ? (
          <p style={{ margin: 0, maxWidth: '18em', color: 'var(--nl-on-dark-muted)', fontFamily: 'var(--nl-font-display)', fontSize: 18, lineHeight: 1.75, fontWeight: 520, display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {tile.excerpt || tile.title}
          </p>
        ) : null}
      </span>
    );
  }

  if (tile.mediaKind === 'video') {
    return (
      <span style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'var(--nl-surface-strong)' }}>
        {tile.src ? (
          <HomeImage src={tile.src} fallbackSrc={null} alt={active ? tile.title : ''} loading={active ? 'eager' : 'lazy'} />
        ) : tile.videoPreviewSrc ? (
          <HomeVideoFrame src={tile.videoPreviewSrc} active={active} compact={compact} title={tile.title} />
        ) : (
          <span style={{ display: 'grid', justifyItems: 'center', gap: compact ? 5 : 10, color: 'var(--nl-muted-strong)' }}>
            <Film size={compact ? 22 : 38} strokeWidth={1.5} />
            {!compact ? <span style={{ fontSize: 10, lineHeight: 1, fontWeight: 740, letterSpacing: '0.08em' }}>VIDEO ARCHIVE</span> : null}
          </span>
        )}
        <span aria-hidden="true" style={{ position: 'absolute', width: compact ? 28 : 46, height: compact ? 28 : 46, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--nl-on-dark)', background: 'var(--nl-media-scrim)', boxShadow: '0 10px 24px rgba(var(--nl-shadow-rgb),0.18)' }}>
          <Play size={compact ? 15 : 24} fill="currentColor" strokeWidth={1.4} style={{ marginLeft: compact ? 1 : 2 }} />
        </span>
      </span>
    );
  }

  return <HomeImage src={tile.src} fallbackSrc={fallbackSrc} alt={active ? tile.title : ''} loading={active ? 'eager' : 'lazy'} />;
};

const HomePhotoDrawer = ({ tiles, onOpen }: { tiles: HomePhotoTile[]; onOpen: (tile: HomePhotoTile) => void }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreClickRef = useRef(false);
  // Media cache URLs can change from remote to blob URLs after mount. Keep the
  // carousel identity tied to records so cache hydration cannot reset autoplay.
  const tileKey = tiles.map((tile) => tile.recordNo ?? tile.target ?? tile.title).join('|');
  const canScrollDrawer = tiles.length > 3;
  const drawerTileWidth = 88;
  const drawerTileHeight = 58;
  const drawerVisibleRatio = 0.3;
  const drawerVisibleWidth = drawerTileWidth * drawerVisibleRatio;
  const centeredStride = drawerVisibleWidth;
  const centeredStackWidth = tiles.length > 0 ? drawerTileWidth + centeredStride * (tiles.length - 1) : 0;
  const normalizeIndex = (index: number) => {
    if (!tiles.length) return 0;
    return ((index % tiles.length) + tiles.length) % tiles.length;
  };
  const activeTileIndex = normalizeIndex(activeIndex);
  const activeTile = tiles[activeTileIndex] ?? tiles[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [tileKey]);

  useEffect(() => {
    if (tiles.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => index + 1);
    }, HOME_PHOTO_AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [tileKey, tiles.length]);

  const onDrawerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    ignoreClickRef.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures from cancelled or synthetic pointer events.
    }
  };

  const onDrawerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;
    const deltaX = Math.abs(event.clientX - start.x);
    const deltaY = Math.abs(event.clientY - start.y);
    if (deltaX > 8 && deltaX > deltaY) ignoreClickRef.current = true;
  };

  const clearDrawerPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore release failures if the browser already released the pointer.
    }
    if (start) {
      const deltaX = event.clientX - start.x;
      const deltaY = Math.abs(event.clientY - start.y);
      if (Math.abs(deltaX) > 28 && Math.abs(deltaX) > deltaY) {
        setActiveIndex((index) => index + (deltaX < 0 ? 1 : -1));
      }
    }
    if (!ignoreClickRef.current) return;
    window.setTimeout(() => {
      ignoreClickRef.current = false;
    }, 120);
  };

  const selectTile = (index: number) => {
    if (ignoreClickRef.current) return;
    if (canScrollDrawer) {
      setActiveIndex((current) => current + getLoopOffset(index));
      return;
    }
    setActiveIndex(index);
  };

  const getLoopOffset = (index: number, centerIndex = activeTileIndex) => {
    const rawOffset = index - centerIndex;
    if (!canScrollDrawer) return rawOffset;
    if (rawOffset > tiles.length / 2) return rawOffset - tiles.length;
    if (rawOffset < -tiles.length / 2) return rawOffset + tiles.length;
    return rawOffset;
  };

  return (
    <section aria-label="最近照片" style={{ display: 'grid', gap: 12, width: '100%', overflow: 'hidden', contain: 'layout paint' }}>
      <button
        className="nl-media-interaction"
        type="button"
        onClick={() => onOpen(activeTile)}
        style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', minHeight: 244, maxHeight: 318, borderRadius: 8, border: '1px solid var(--nl-border-muted)', background: 'var(--nl-surface-soft)', overflow: 'hidden', padding: 0, cursor: 'pointer', boxShadow: '0 30px 74px rgba(var(--nl-shadow-rgb),0.34)', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
      >
        <HomeImage key={activeTile.src} src={activeTile.src} fallbackSrc={homePhotoFallbacks[activeTileIndex % homePhotoFallbacks.length]} alt={activeTile.title} loading="eager" style={{ transition: 'opacity 0.18s ease' }} />
      </button>
      {canScrollDrawer ? (
        <div
          data-photo-drawer="true"
          onPointerDown={onDrawerPointerDown}
          onPointerMove={onDrawerPointerMove}
          onPointerUp={clearDrawerPointer}
          onPointerCancel={clearDrawerPointer}
          style={{
            position: 'relative',
            width: '100%',
            height: drawerTileHeight + 20,
            overflow: 'hidden',
            padding: '2px 0 9px',
            margin: 0,
            contain: 'layout paint',
            touchAction: 'pan-y',
            perspective: 820,
            perspectiveOrigin: '50% 48%',
          }}
        >
          {tiles.map((tile, index) => {
            const active = index === activeTileIndex;
            const loopOffset = getLoopOffset(index);
            const visible = Math.abs(loopOffset) <= 2;
            const absOffset = Math.abs(loopOffset);
            const translateX = loopOffset * drawerVisibleWidth;
            const rotateY = active ? 0 : loopOffset < 0 ? 32 : -32;
            const rotateZ = active ? 0 : loopOffset * -2.2;
            const translateY = active ? 0 : 4 + absOffset;
            const scale = 1;
            return (
              <button
                className="nl-media-interaction"
                key={`${tile.recordNo ?? tile.title}-${index}`}
                type="button"
                data-photo-index={index}
                aria-label={`选择照片：${tile.title}`}
                aria-pressed={active}
                onClick={() => selectTile(index)}
                style={{
                  ['--nl-media-active-transform' as string]: `translate3d(${translateX}px, 0, ${active ? 22 : -absOffset * 18}px) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
                  position: 'absolute',
                  left: `calc(50% - ${drawerTileWidth / 2}px)`,
                  top: translateY,
                  width: drawerTileWidth,
                  minWidth: drawerTileWidth,
                  height: drawerTileHeight,
                  borderRadius: 8,
                  border: active ? '1px solid rgba(var(--nl-primary-rgb),0.32)' : '1px solid var(--nl-border-muted)',
                  background: 'var(--nl-surface-soft)',
                  overflow: 'hidden',
                  padding: 0,
                  cursor: 'pointer',
                  boxShadow: active ? '0 18px 34px rgba(var(--nl-shadow-rgb),0.26), 0 0 0 1px rgba(var(--nl-primary-rgb),0.12)' : '0 12px 24px rgba(var(--nl-shadow-rgb),0.2)',
                  zIndex: active ? tiles.length + 4 : tiles.length + 2 - absOffset,
                  opacity: visible ? (active ? 1 : 0.72 - absOffset * 0.16) : 0,
                  pointerEvents: visible && absOffset <= 1 ? 'auto' : 'none',
                  transform: `translate3d(${translateX}px, 0, ${active ? 22 : -absOffset * 18}px) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
                  transformOrigin: loopOffset < 0 ? 'right center' : 'left center',
                  willChange: 'transform, opacity',
                  backfaceVisibility: 'hidden',
                  transition: 'opacity 0.24s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.18s ease, top 0.24s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <HomeImage src={tile.src} fallbackSrc={homePhotoFallbacks[index % homePhotoFallbacks.length]} alt="" />
              </button>
            );
          })}
        </div>
      ) : (
        <div
          data-photo-drawer="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            overflowX: 'hidden',
            overflowY: 'hidden',
            width: '100%',
            padding: '5px 0 7px',
            margin: 0,
            scrollbarWidth: 'none',
          }}
        >
          <div
            data-photo-stack="centered"
            style={{
              position: 'relative',
              width: centeredStackWidth,
              maxWidth: '100%',
              height: drawerTileHeight + 8,
              margin: '0 auto',
            }}
          >
            {tiles.map((tile, index) => {
              const active = index === activeIndex;
              return (
                <button
                  className="nl-media-interaction"
                  key={`${tile.recordNo ?? tile.title}-${index}`}
                  type="button"
                  data-photo-index={index}
                  aria-label={`选择照片：${tile.title}`}
                  aria-pressed={active}
                  onClick={() => selectTile(index)}
                  style={{
                    ['--nl-media-active-transform' as string]: active ? 'translateY(-1px) scale(1.04)' : 'translateY(0) scale(0.98)',
                    position: 'absolute',
                    left: index * centeredStride,
                    top: active ? 0 : 3,
                    width: drawerTileWidth,
                    height: drawerTileHeight,
                    borderRadius: 8,
                    border: active ? '1px solid rgba(var(--nl-primary-rgb),0.32)' : '1px solid var(--nl-border-muted)',
                    background: 'var(--nl-surface-soft)',
                    overflow: 'hidden',
                    padding: 0,
                    cursor: 'pointer',
                    boxShadow: active ? '0 18px 34px rgba(var(--nl-shadow-rgb),0.28), 0 0 0 1px rgba(var(--nl-primary-rgb),0.14)' : '0 10px 22px rgba(var(--nl-shadow-rgb),0.2)',
                    zIndex: active ? tiles.length + 2 : tiles.length - index,
                    opacity: active ? 1 : 0.78,
                    transform: active ? 'translateY(-1px) scale(1.04)' : 'translateY(0) scale(0.98)',
                    transformOrigin: 'center',
                    transition: 'opacity 0.16s ease, transform 0.16s ease, border-color 0.16s ease, top 0.16s ease',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <HomeImage src={tile.src} fallbackSrc={homePhotoFallbacks[index % homePhotoFallbacks.length]} alt="" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

const HomePhotoCarousel = ({ tiles, onOpen }: { tiles: HomePhotoTile[]; onOpen: (tile: HomePhotoTile) => void }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [turning, setTurning] = useState<{ from: number; to: number; direction: 1 | -1 } | null>(null);
  const activeIndexRef = useRef(0);
  const turningRef = useRef<{ from: number; to: number; direction: 1 | -1 } | null>(null);
  const queuedTurnRef = useRef<{ to: number; direction: 1 | -1 } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreClickRef = useRef(false);
  const interactionPauseUntilRef = useRef(0);
  const flipTimeoutRef = useRef<number | null>(null);
  const flipFrameRef = useRef<number | null>(null);
  // Media cache URLs can change from remote to blob URLs after mount. Keep the
  // carousel identity tied to records so cache hydration cannot reset autoplay.
  const tileKey = tiles.map((tile) => tile.recordNo ?? tile.target ?? tile.title).join('|');
  const canLoop = tiles.length > 1;
  const usesSparseRail = tiles.length > 1 && tiles.length <= 3;
  const thumbWidth = usesSparseRail ? 112 : 104;
  const thumbHeight = usesSparseRail ? 76 : 72;
  const thumbStride = Math.round(thumbWidth * 0.3);
  const visibleThumbCount = Math.min(tiles.length, 5);
  const thumbRailWidth = visibleThumbCount > 0 ? Math.min(thumbWidth + thumbStride * (visibleThumbCount - 1), usesSparseRail ? 210 : 326) : 0;

  const normalizeIndex = (index: number) => {
    if (!tiles.length) return 0;
    return ((index % tiles.length) + tiles.length) % tiles.length;
  };
  const activeTileIndex = normalizeIndex(activeIndex);
  const drawerActiveIndex = turning ? turning.to : activeTileIndex;
  const activeTile = tiles[activeTileIndex] ?? tiles[0];
  const displayTile = tiles[drawerActiveIndex] ?? activeTile;
  const layoutMode = activeTile?.placeholder ? 'empty' : tiles.length === 1 ? 'single' : usesSparseRail ? 'sparse' : 'drawer';

  useEffect(() => {
    setActiveIndex(0);
    activeIndexRef.current = 0;
    turningRef.current = null;
    queuedTurnRef.current = null;
    setTurning(null);
    if (flipTimeoutRef.current !== null) {
      window.clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = null;
    }
    if (flipFrameRef.current !== null) {
      window.cancelAnimationFrame(flipFrameRef.current);
      flipFrameRef.current = null;
    }
  }, [tileKey]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => () => {
    if (flipTimeoutRef.current !== null) window.clearTimeout(flipTimeoutRef.current);
    if (flipFrameRef.current !== null) window.cancelAnimationFrame(flipFrameRef.current);
  }, []);

  useEffect(() => {
    if (tiles.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      if (Date.now() < interactionPauseUntilRef.current) return;
      if (turningRef.current || queuedTurnRef.current) return;
      requestTurn(activeIndexRef.current + 1, 1);
    }, HOME_PHOTO_AUTOPLAY_MS);

    return () => window.clearInterval(timer);
  }, [tileKey, tiles.length]);

  if (!activeTile) return null;

  const getLoopOffset = (index: number, centerIndex = activeTileIndex) => {
    const rawOffset = index - centerIndex;
    if (!canLoop) return rawOffset;
    if (rawOffset > tiles.length / 2) return rawOffset - tiles.length;
    if (rawOffset < -tiles.length / 2) return rawOffset + tiles.length;
    return rawOffset;
  };

  function startTurn(nextIndex: number, direction: 1 | -1) {
    if (!canLoop) return;
    const currentIndex = activeIndexRef.current;
    const normalizedFrom = normalizeIndex(currentIndex);
    const normalizedTo = normalizeIndex(nextIndex);
    if (normalizedFrom === normalizedTo) return;
    const nextTurn = { from: normalizedFrom, to: normalizedTo, direction };
    turningRef.current = nextTurn;
    setTurning(nextTurn);
    flipTimeoutRef.current = window.setTimeout(() => {
      activeIndexRef.current = normalizedTo;
      setActiveIndex(normalizedTo);
      turningRef.current = null;
      setTurning(null);
      flipTimeoutRef.current = null;

      const queuedTurn = queuedTurnRef.current;
      queuedTurnRef.current = null;
      if (!queuedTurn || queuedTurn.to === normalizedTo) return;
      flipFrameRef.current = window.requestAnimationFrame(() => {
        flipFrameRef.current = null;
        startTurn(queuedTurn.to, queuedTurn.direction);
      });
    }, HOME_PHOTO_TURN_MS);
  }

  function requestTurn(nextIndex: number, direction: 1 | -1) {
    if (!canLoop) return;
    const normalizedTo = normalizeIndex(nextIndex);
    interactionPauseUntilRef.current = Date.now() + 1500;
    if (turningRef.current) {
      queuedTurnRef.current = { to: normalizedTo, direction };
      return;
    }
    startTurn(normalizedTo, direction);
  }

  const moveBy = (delta: number) => {
    if (!canLoop) return;
    const projectedIndex = queuedTurnRef.current?.to ?? turningRef.current?.to ?? activeIndexRef.current;
    requestTurn(projectedIndex + delta, delta > 0 ? 1 : -1);
  };

  const selectTile = (index: number) => {
    if (ignoreClickRef.current) return;
    const offset = getLoopOffset(index, drawerActiveIndex);
    if (offset === 0) return;
    requestTurn(index, offset > 0 ? 1 : -1);
  };

  const onCarouselPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    interactionPauseUntilRef.current = Date.now() + 1300;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    ignoreClickRef.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures from cancelled or synthetic pointer events.
    }
  };

  const onCarouselPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;
    const deltaX = Math.abs(event.clientX - start.x);
    const deltaY = Math.abs(event.clientY - start.y);
    if (deltaX > 8 && deltaX > deltaY) ignoreClickRef.current = true;
  };

  const clearCarouselPointer = (event: ReactPointerEvent<HTMLElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore release failures if the browser already released the pointer.
    }

    if (start) {
      const deltaX = event.clientX - start.x;
      const deltaY = Math.abs(event.clientY - start.y);
      if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > deltaY) {
        ignoreClickRef.current = true;
        interactionPauseUntilRef.current = Date.now() + 1300;
        moveBy(deltaX < 0 ? 1 : -1);
      }
    }

    if (!ignoreClickRef.current) return;
    interactionPauseUntilRef.current = Date.now() + 1300;
  };

  return (
    <section
      aria-label="最近照片"
      data-photo-carousel="true"
      data-photo-active-index={drawerActiveIndex}
      data-photo-turning={turning ? 'true' : 'false'}
      data-photo-layout={layoutMode}
      style={{ display: 'grid', gap: 0, width: '100%', justifyItems: 'center', overflow: 'visible', contain: 'layout paint' }}
    >
      <button
        className="nl-media-interaction"
        type="button"
        data-photo-stage="true"
        onPointerDown={onCarouselPointerDown}
        onPointerMove={onCarouselPointerMove}
        onPointerUp={clearCarouselPointer}
        onPointerCancel={clearCarouselPointer}
        onClick={() => {
          if (ignoreClickRef.current) {
            ignoreClickRef.current = false;
            return;
          }
          onOpen(displayTile);
        }}
        style={{
          position: 'relative',
          width: '100%',
          justifySelf: 'center',
          aspectRatio: activeTile.placeholder ? '16 / 10' : '4 / 5.45',
          minHeight: activeTile.placeholder ? 232 : 440,
          maxHeight: activeTile.placeholder ? 268 : 'min(572px, calc(100svh - 238px))',
          borderRadius: 0,
          border: 'none',
          background: 'var(--nl-bg-warm)',
          overflow: 'hidden',
          padding: 0,
          cursor: 'pointer',
          boxShadow: '0 24px 52px rgba(var(--nl-shadow-rgb),0.12)',
          textAlign: 'left',
          touchAction: 'pan-y',
          contain: 'layout paint',
          perspective: 1450,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {tiles.map((tile, index) => {
          const active = index === activeTileIndex;
          const turningFrom = turning?.from === index;
          const turningTo = turning?.to === index;
          const slideClass = turningTo
            ? turning.direction === 1 ? 'home-photo-incoming-forward' : 'home-photo-incoming-backward'
            : turningFrom
              ? turning.direction === 1 ? 'home-photo-outgoing-forward' : 'home-photo-outgoing-backward'
              : undefined;
          const visible = active || turningFrom || turningTo;
          return (
            <span
              key={`${tile.recordNo ?? tile.title}-${index}`}
              className={slideClass}
              data-photo-slide={index}
              aria-hidden={!visible}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'block',
                borderRadius: 0,
                overflow: 'hidden',
                opacity: visible ? 1 : 0,
                transform: 'translate3d(0, 0, 0)',
                transition: slideClass ? undefined : 'opacity 0.28s ease',
                zIndex: turningTo ? 4 : turningFrom ? 3 : active ? 2 : 1,
                willChange: slideClass ? 'transform, opacity' : active ? 'opacity' : undefined,
                backfaceVisibility: 'hidden',
                background: tile.placeholder ? 'transparent' : 'var(--nl-surface-soft)',
                boxShadow: 'none',
              }}
            >
              {tile.placeholder ? (
                <span style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                  <span style={{ display: 'grid', justifyItems: 'center', gap: 12, transform: 'translateY(-2px)' }}>
                    <span style={{ width: 86, height: 86, display: 'block', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--nl-border-image)', boxShadow: '0 14px 30px rgba(var(--nl-shadow-rgb),0.12)' }}>
                      <HomeImage src={tile.src} fallbackSrc={referenceAssets.childAvatar} alt={active ? tile.title : ''} loading="eager" />
                    </span>
                    <span style={{ display: 'grid', gap: 5, justifyItems: 'center', textAlign: 'center' }}>
                      <strong style={{ color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: 21, lineHeight: 1.08, fontWeight: 800 }}>{tile.title}</strong>
                    </span>
                  </span>
                </span>
              ) : <HomeTileVisual tile={tile} active={active || turningTo} fallbackSrc={homePhotoFallbacks[index % homePhotoFallbacks.length]} />}
            </span>
          );
        })}
        {!activeTile.placeholder ? <span
          style={{
            position: 'absolute',
            left: 18,
            right: 18,
            bottom: 112,
            zIndex: 4,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(34px, auto)',
            gap: 10,
            alignItems: 'end',
            pointerEvents: 'none',
          }}
        >
          <span style={{ minWidth: 0, display: 'grid', gap: 4 }}>
            <span style={{ color: 'var(--nl-on-dark-muted)', fontSize: 10, lineHeight: 1, fontWeight: 760, letterSpacing: '0.08em', textShadow: 'var(--nl-text-shadow-hero)' }}>
              {displayTile.meta ?? `${drawerActiveIndex + 1} / ${tiles.length}`}
            </span>
            <strong style={{ color: 'var(--nl-on-dark)', fontFamily: 'var(--nl-font-display)', fontSize: 28, lineHeight: 1.12, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: 'var(--nl-text-shadow-hero)' }}>
              {displayTile.title}
            </strong>
          </span>
          {tiles.length > 1 ? (
            <span style={{ color: 'var(--nl-on-dark-muted)', fontSize: 11, lineHeight: 1, fontWeight: 760, textShadow: 'var(--nl-text-shadow-hero)' }}>
              {String(drawerActiveIndex + 1).padStart(2, '0')} / {String(tiles.length).padStart(2, '0')}
            </span>
          ) : null}
        </span> : null}
      </button>

      {tiles.length > 1 ? <div
        data-photo-drawer="true"
        style={{
          position: 'relative',
          zIndex: 6,
          display: 'grid',
          placeItems: 'center',
          overflowX: 'hidden',
          overflowY: 'hidden',
          width: '100%',
          minHeight: thumbHeight + 28,
          padding: '10px 0 12px',
          margin: tiles.length > 1 ? '-92px 0 0' : 0,
          scrollbarWidth: 'none',
        }}
      >
        <div
          data-photo-index-rail="true"
          style={{
            position: 'relative',
            width: thumbRailWidth,
            maxWidth: '100%',
            height: thumbHeight + 24,
            margin: '0 auto',
            overflow: 'visible',
            contain: 'layout paint',
          }}
        >
          {tiles.map((tile, index) => {
            const active = index === drawerActiveIndex;
            const loopOffset = getLoopOffset(index, drawerActiveIndex);
            const absOffset = Math.abs(loopOffset);
            const visualOffset = usesSparseRail ? index - (tiles.length - 1) / 2 : loopOffset;
            const visible = usesSparseRail || absOffset <= 3;
            const thumbScale = active ? 1.04 : usesSparseRail ? 0.97 : absOffset === 1 ? 0.96 : absOffset === 2 ? 0.88 : 0.8;
            const turningFrom = turning?.from === index;
            return (
              <button
                className="nl-media-interaction"
                key={`${tile.recordNo ?? tile.title}-${index}`}
                type="button"
                data-photo-index={index}
                aria-label={`选择照片：${tile.title}`}
                aria-pressed={active}
                onClick={() => selectTile(index)}
                style={{
                  ['--nl-media-active-transform' as string]: `translate3d(${visualOffset * thumbStride}px, 0, 0) scale(${thumbScale})`,
                  position: 'absolute',
                  left: `calc(50% - ${thumbWidth / 2}px)`,
                  top: active ? 0 : usesSparseRail ? 5 : absOffset === 1 ? 7 : 12,
                  width: thumbWidth,
                  height: thumbHeight,
                   borderRadius: 8,
                   border: active ? '2px solid var(--nl-border-image)' : '2px solid rgba(255,255,252,0.76)',
                  background: 'var(--nl-surface-soft)',
                  overflow: 'hidden',
                  padding: 0,
                  cursor: 'pointer',
                   boxShadow: active ? '0 24px 48px rgba(var(--nl-shadow-rgb),0.34)' : '0 12px 24px rgba(var(--nl-shadow-rgb),0.2)',
                  zIndex: active ? tiles.length + 3 : turningFrom ? tiles.length + 2 : usesSparseRail ? index + 1 : tiles.length + 1 - absOffset,
                  opacity: visible ? (active ? 1 : usesSparseRail ? 0.82 : absOffset === 1 ? 0.86 : absOffset === 2 ? 0.64 : 0.42) : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                  transform: `translate3d(${visualOffset * thumbStride}px, 0, 0) scale(${thumbScale})`,
                  transformOrigin: 'center',
                  transition: 'opacity 0.42s cubic-bezier(0.22, 1, 0.36, 1), transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.18s ease, top 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'relative',
                    display: 'block',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <HomeTileVisual tile={tile} active={active} compact fallbackSrc={homePhotoFallbacks[index % homePhotoFallbacks.length]} />
                </span>
              </button>
            );
          })}
        </div>
      </div> : null}
    </section>
  );
};

export const HomePage = () => {
  const navigate = useNavigate();
  const { user, activeChild, children, setActiveChild, refreshChildren } = useAuth();
  const anniversaryWindow = useMemo(() => getOneYearAgoWindow(), []);
  const { data: recordData, loading, error } = useAsyncData<RecordsListResponse>(
    async () => {
      if (!activeChild) return emptyHomeRecordsResponse;
      return webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 12, status: 'published' });
    },
    [activeChild?.child_no],
  );
  const { data: anniversaryData } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({
        child_no: activeChild.child_no,
        page: 1,
        page_size: 1,
        status: 'published',
        start_time: anniversaryWindow.startIso,
        end_time: anniversaryWindow.endIso,
      });
      return result.list;
    },
    [activeChild?.child_no, anniversaryWindow.startIso, anniversaryWindow.endIso],
  );

  useEffect(() => {
    if (loadLocalSettings().autoRefreshHome) void refreshChildren();
  }, [refreshChildren]);

  useEffect(() => {
    if (!activeChild && children.length > 0) setActiveChild(children[0]);
  }, [activeChild, children, setActiveChild]);

  const records = recordData?.list ?? [];
  const totalRecordCount = recordData?.total ?? records.length;
  const anniversaryRecord = anniversaryData?.[0] ?? null;
  const childName = normalizeDisplayName(activeChild?.name, '孩子');
  const timelinePreviewRecords = records.slice(0, 3);
  const timelineMonthTitle = timelinePreviewRecords[0] ? formatMonthTitle(timelinePreviewRecords[0].event_time) : formatMonthTitle(new Date().toISOString());
  const switchChild = () => {
    if (children.length > 1 && activeChild) {
      const index = children.findIndex((item) => item.child_no === activeChild.child_no);
      setActiveChild(children[(index + 1) % children.length]);
      return;
    }
    navigate(activeChild ? '/family/child' : '/onboarding/child?mode=add');
  };
  const childRequiredTarget = (path: string) => activeChild ? path : '/onboarding/child?mode=add';
  const homeChildAvatar = childAvatarFor(activeChild?.avatar_url);
  const heroVisualRecords = [
    ...records.filter(hasVisualCover),
    ...(anniversaryRecord && hasVisualCover(anniversaryRecord) ? [anniversaryRecord] : []),
  ].filter((record, index, list) => list.findIndex((item) => item.record_no === record.record_no) === index).slice(0, 6);
  const primaryHeroRecord = heroVisualRecords[0] ?? null;
  const leftHeroRecord = heroVisualRecords[1] ?? null;
  const rightHeroRecord = heroVisualRecords[2] ?? null;
  const fourthHeroRecord = heroVisualRecords[3] ?? null;
  const fifthHeroRecord = heroVisualRecords[4] ?? null;
  const sixthHeroRecord = heroVisualRecords[5] ?? null;
  const primaryHeroMediaKind = primaryHeroRecord ? getMediaKind(primaryHeroRecord) : null;
  const leftHeroMediaKind = leftHeroRecord ? getMediaKind(leftHeroRecord) : null;
  const rightHeroMediaKind = rightHeroRecord ? getMediaKind(rightHeroRecord) : null;
  const fourthHeroMediaKind = fourthHeroRecord ? getMediaKind(fourthHeroRecord) : null;
  const fifthHeroMediaKind = fifthHeroRecord ? getMediaKind(fifthHeroRecord) : null;
  const sixthHeroMediaKind = sixthHeroRecord ? getMediaKind(sixthHeroRecord) : null;
  const primaryHeroPhoto = useHomeRecordCover(primaryHeroRecord, primaryHeroMediaKind);
  const leftHeroPhoto = useHomeRecordCover(leftHeroRecord, leftHeroMediaKind);
  const rightHeroPhoto = useHomeRecordCover(rightHeroRecord, rightHeroMediaKind);
  const fourthHeroPhoto = useHomeRecordCover(fourthHeroRecord, fourthHeroMediaKind);
  const fifthHeroPhoto = useHomeRecordCover(fifthHeroRecord, fifthHeroMediaKind);
  const sixthHeroPhoto = useHomeRecordCover(sixthHeroRecord, sixthHeroMediaKind);
  const recordCountText = loading ? '正在同步' : error ? '暂未同步' : `${totalRecordCount} 条记录`;
  const heroMedia = [primaryHeroPhoto, leftHeroPhoto, rightHeroPhoto, fourthHeroPhoto, fifthHeroPhoto, sixthHeroPhoto];
  const realPhotoTiles = heroVisualRecords.map((record, index) => ({
    src: heroMedia[index].src,
    title: record.title ?? `成长照片 ${index + 1}`,
    recordNo: record.record_no,
    meta: `${formatMonth(record.event_time)} ${formatDay(record.event_time)} · ${formatAgeAtEvent(activeChild?.birthday, record.event_time) || '成长片段'}`,
    mediaKind: getMediaKind(record),
    videoPreviewSrc: heroMedia[index].videoPreviewSrc
      ?? (getMediaKind(record) === 'video' && /^(data:video\/|blob:)/i.test(record.cover_url ?? '') ? record.cover_url : null),
  }));
  const textRecordTiles: HomePhotoTile[] = records
    .filter((record) => !hasVisualCover(record))
    .slice(0, Math.max(0, 6 - realPhotoTiles.length))
    .map((record) => ({
      src: null,
      title: record.title ?? '文字记录',
      recordNo: record.record_no,
      meta: `${formatMonth(record.event_time)} ${formatDay(record.event_time)} · ${formatAgeAtEvent(activeChild?.birthday, record.event_time) || '成长片段'}`,
      mediaKind: getMediaKind(record),
      textOnly: true,
      excerpt: record.summary,
    }));
  const archiveTiles = realPhotoTiles.length ? [...realPhotoTiles, ...textRecordTiles] : [];
  const recentPhotoTiles: HomePhotoTile[] = archiveTiles.length
    ? archiveTiles
    : [{ src: homeChildAvatar, title: '记录第一刻', meta: '私家成长档案', target: childRequiredTarget('/record/create'), placeholder: true }];

  return (
    <div style={refPageStyle}>
      <section className="home-cover-page" style={{ padding: 'calc(20px + env(safe-area-inset-top)) 0 0', display: 'grid', gap: 0 }}>
        <div className="home-identity-bar" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 14, alignItems: 'center', padding: '0 16px 18px' }}>
          <button type="button" onClick={switchChild} style={{ minWidth: 0, border: 'none', background: 'transparent', padding: 0, display: 'grid', gap: 5, textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <h1 style={{ margin: 0, color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-sans)', fontSize: 26, lineHeight: 1.1, fontWeight: 700, letterSpacing: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{childName}</h1>
              <ChevronDown size={17} color="var(--nl-muted)" />
            </span>
            <strong style={{ color: 'var(--nl-muted)', fontSize: 11.5, lineHeight: 1.2, fontWeight: 540 }}>{activeChild?.current_age_display ?? user?.nickname ?? '家庭档案'} · 私家成长档案</strong>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => navigate(childRequiredTarget('/record/create'))} aria-label="记录" style={{ width: 42, height: 42, border: '1px solid var(--nl-primary-line)', borderRadius: 8, background: 'transparent', color: 'var(--nl-primary-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <Edit3 size={17} />
            </button>
            <button type="button" aria-label="切换孩子" onClick={switchChild} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
              <RefAvatar src={homeChildAvatar} mediaNo={activeChild?.avatar_media_no} label={childName} size={52} fallbackSrc={referenceAssets.childAvatar} />
            </button>
          </div>
        </div>

        <section aria-label="成长记录" className="home-cover-meta" style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 14, padding: '0 16px 14px' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: 'var(--nl-accent)', fontSize: 10, lineHeight: 1, fontWeight: 780, letterSpacing: '0.13em' }}>PRIVATE ARCHIVE</span>
            <strong style={{ color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: 22, lineHeight: 1.05, fontWeight: 780 }}>成长封面</strong>
          </div>
          <span style={{ color: 'var(--nl-muted-strong)', fontSize: 11.5, lineHeight: 1.35, fontWeight: 620, textAlign: 'right' }}>
            {recordCountText}<br />{activeChild?.current_age_display ?? '年龄待完善'} · {timelinePreviewRecords[0] ? `最新 ${formatMonth(timelinePreviewRecords[0].event_time)}` : '等待第一条记录'}
          </span>
        </section>

        <HomePhotoCarousel
          tiles={recentPhotoTiles}
          onOpen={(tile) => navigate(tile.recordNo ? `/record/${tile.recordNo}` : tile.target ?? '/timeline')}
        />

      </section>

    </div>
  );
};

const searchHistoryKey = 'nianlun.search.history.v1';
const readSearchHistory = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(searchHistoryKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 8) : [];
  } catch {
    return [];
  }
};

const writeSearchHistory = (history: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(searchHistoryKey, JSON.stringify(history.slice(0, 8)));
  } catch {
    // Some embedded WebViews can block localStorage writes; search should still work.
  }
};

const uniqueSearchValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));

export const SearchPage = () => {
  const { activeChild } = useAuth();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [history, setHistory] = useState<string[]>(() => readSearchHistory());
  const normalizedKeyword = keyword.trim();
  const { data, loading, error } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({
        child_no: activeChild.child_no,
        page: 1,
        page_size: 50,
        status: 'published',
        keyword: normalizedKeyword || undefined,
      });
      return result.list;
    },
    [activeChild?.child_no, normalizedKeyword],
  );
  const records = data ?? [];
  const resultTags = uniqueSearchValues(records.flatMap((record) => record.tags ?? [])).slice(0, 8);
  const resultLocations = uniqueSearchValues(records.map((record) => record.location_text)).slice(0, 8);
  const commitSearch = (value: string) => {
    const next = value.trim();
    if (!next) return;
    setKeyword(next);
    setHistory((current) => {
      const updated = [next, ...current.filter((item) => item !== next)].slice(0, 8);
      writeSearchHistory(updated);
      return updated;
    });
  };
  const clearSearchHistory = () => {
    setHistory([]);
    writeSearchHistory([]);
  };

  return (
    <div style={refPageStyle}>
      <header style={{ position: 'sticky', top: 0, zIndex: 4, minHeight: 'calc(64px + env(safe-area-inset-top))', padding: 'calc(10px + env(safe-area-inset-top)) 14px 10px', borderBottom: '1px solid transparent', background: 'var(--nl-topbar-bg)', WebkitBackdropFilter: 'blur(18px) saturate(1.02)', backdropFilter: 'blur(18px) saturate(1.02)', display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) 48px', gap: 8, alignItems: 'center', boxShadow: 'none' }}>
        <button type="button" aria-label="返回" onClick={() => navigate(-1)} style={{ border: 'none', background: 'transparent', width: 44, height: 44, display: 'grid', placeItems: 'center', color: 'var(--nl-ink)', cursor: 'pointer' }}>
          <ChevronLeft size={19} />
        </button>
        <label style={{ minWidth: 0, height: 44, borderRadius: 8, background: 'rgba(var(--nl-surface-rgb),0.12)', border: '1px solid var(--nl-border-soft)', display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', color: 'var(--nl-muted)', boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)' }}>
          <Search size={15} />
          <input
            aria-label="搜索关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitSearch(keyword);
            }}
            placeholder="搜索记录"
            style={{ width: '100%', minWidth: 0, minHeight: 44, border: 'none', outline: 'none', background: 'transparent', color: 'var(--nl-ink)', fontSize: 13, fontWeight: 520, textOverflow: 'ellipsis' }}
          />
        </label>
        <button type="button" onClick={() => commitSearch(keyword)} style={{ minWidth: 48, minHeight: 44, borderRadius: 8, border: '1px solid rgba(var(--nl-primary-rgb),0.24)', background: 'transparent', color: 'var(--nl-primary-2)', fontSize: 12, fontWeight: 560, cursor: 'pointer' }}>搜索</button>
      </header>
      <main style={{ ...refContentStyle, paddingTop: 18 }}>
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: 14, fontWeight: 620 }}>搜索历史</h2>
            {history.length ? <button type="button" onClick={clearSearchHistory} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: 'var(--nl-muted)', fontSize: 12, fontWeight: 520, cursor: 'pointer' }}>清空</button> : null}
          </div>
          {history.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {history.map((item) => (
                <button key={item} type="button" onClick={() => commitSearch(item)} style={{ minHeight: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                  <RefChip>{item}</RefChip>
                </button>
              ))}
            </div>
          ) : null}
        </section>
        {!normalizedKeyword && loading ? (
          <section style={{ borderTop: '1px solid var(--nl-border-muted)', padding: '14px 0 0', display: 'grid', gap: 13 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--nl-muted-strong)', fontSize: 13, fontWeight: 560 }}>
              <Search size={15} />
              正在搜索
            </span>
            <div style={{ display: 'grid', gap: 9 }}>
              {[0, 1].map((item) => (
                <span key={item} style={{ height: 52, borderRadius: 8, border: '1px solid var(--nl-border-muted)', background: 'transparent' }} />
              ))}
            </div>
          </section>
        ) : null}
        {!normalizedKeyword && records.length ? (
          <section style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: 14, fontWeight: 620 }}>最近记录</h2>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {records.slice(0, 2).map((record) => (
                <RecordSummaryCard key={record.record_no} record={record} onClick={() => navigate(`/record/${record.record_no}`)} />
              ))}
            </div>
          </section>
        ) : null}
        {!normalizedKeyword && !loading && !records.length ? (
          <section style={{ borderTop: '1px solid var(--nl-border-muted)', padding: '14px 0 0', display: 'grid', gap: 13 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--nl-ink)', fontSize: 14, fontWeight: 620 }}>
              <Sparkles size={16} />
              暂无记录
            </span>
            <button type="button" onClick={() => navigate('/record/create')} style={{ ...refSecondaryButtonStyle, width: '100%', minHeight: 42 }}>
              记录
            </button>
          </section>
        ) : null}
        {normalizedKeyword ? (
          <section style={{ display: 'grid', gap: 10 }}>
            <h2 style={{ margin: '0 0 2px', color: 'var(--nl-ink)', fontSize: 14, fontWeight: 620 }}>搜索结果</h2>
            {loading ? <EmptyState message="正在查找匹配的成长记录…" /> : null}
            {error ? <EmptyState message={`搜索失败：${error}`} /> : null}
            {!loading && !error && records.length ? (
              <>
                {resultTags.length ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <h3 style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: 12, fontWeight: 560 }}>标签结果</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {resultTags.map((item) => (
                      <button key={item} type="button" onClick={() => commitSearch(item)} style={{ minHeight: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                        <span style={{ display: 'inline-flex', minHeight: 40, borderRadius: 8, padding: '9px 12px', alignItems: 'center', color: 'var(--nl-primary-2)', background: 'transparent', border: '1px solid rgba(var(--nl-primary-rgb),0.22)', fontSize: 12, fontWeight: 520 }}>#{item}</span>
                      </button>
                    ))}
                  </div>
                </div>
                ) : null}

                {resultLocations.length ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <h3 style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: 12, fontWeight: 560 }}>地点结果</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {resultLocations.map((item) => (
                      <button key={item} type="button" onClick={() => commitSearch(item)} style={{ minHeight: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                        <span style={{ display: 'inline-flex', minHeight: 40, borderRadius: 8, padding: '9px 12px', alignItems: 'center', gap: 6, color: 'var(--nl-primary-2)', background: 'transparent', border: '1px solid rgba(var(--nl-primary-rgb),0.22)', fontSize: 12, fontWeight: 520 }}>
                          <MapPin size={13} />
                          {item}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                ) : null}

                <div style={{ display: 'grid', gap: 10 }}>
                  <h3 style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: 12, fontWeight: 560 }}>匹配记录</h3>
                  {records.map((record) => <RecordSummaryCard key={record.record_no} record={record} onClick={() => navigate(`/record/${record.record_no}`)} />)}
                </div>
              </>
            ) : null}
            {!loading && !error && !records.length ? <EmptyState message="没有匹配记录。" /> : null}
          </section>
        ) : null}
      </main>
    </div>
  );
};

export const TimelinePage = () => {
  const navigate = useNavigate();
  const { activeChild } = useAuth();
  const [filterOpen, setFilterOpen] = useState(false);
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'mixed' | 'video' | 'text' | 'audio' | 'milestone'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const { data, loading, error } = useAsyncData(
    async () => {
      if (!activeChild) return null;
      return webApi.listRecords({
        child_no: activeChild.child_no,
        page: 1,
        page_size: 40,
        status: 'published',
        record_type: recordTypeFilter === 'all' || recordTypeFilter === 'milestone' ? undefined : recordTypeFilter,
        tag: tagFilter ?? undefined,
      });
    },
    [activeChild?.child_no, recordTypeFilter, tagFilter],
  );

  const filters = [
    { label: '全部', value: 'all' as const },
    { label: '照片', value: 'mixed' as const },
    { label: '视频', value: 'video' as const },
    { label: '文字', value: 'text' as const },
    { label: '语音', value: 'audio' as const },
    { label: '里程碑', value: 'milestone' as const },
  ];
  const records = data?.list ?? [];
  const typeFilteredRecords = recordTypeFilter === 'milestone' ? records.filter((record) => record.is_milestone || record.record_type === 'milestone') : records;
  const visibleRecords = typeFilteredRecords;
  const tags = Array.from(new Set(records.flatMap((record) => record.tags ?? [])));
  const activeTypeLabel = filters.find((filter) => filter.value === recordTypeFilter)?.label ?? '全部';
  const hasActiveFilter = recordTypeFilter !== 'all' || Boolean(tagFilter);
  const activeFilterText = `${activeTypeLabel}${tagFilter ? ` / #${tagFilter}` : ''}`;
  const clearFilters = () => {
    setRecordTypeFilter('all');
    setTagFilter(null);
  };
  const visibleYearOptions = Array.from(new Set(visibleRecords.map((record) => getRecordYear(record.event_time)))).sort((a, b) => Number(b) - Number(a));
  const fallbackYear = new Date().getFullYear();
  const yearOptions = Array.from(new Set([...visibleYearOptions, ...Array.from({ length: 4 }, (_, index) => String(fallbackYear - index))])).sort((a, b) => Number(b) - Number(a)).slice(0, 4);
  const yearRecordCount = useMemo(() => {
    const counts = new Map<string, number>();
    visibleRecords.forEach((record) => {
      const year = getRecordYear(record.event_time);
      counts.set(year, (counts.get(year) ?? 0) + 1);
    });
    return counts;
  }, [visibleRecords]);
  useEffect(() => {
    const firstYear = yearOptions[0];
    if (firstYear && !yearOptions.includes(selectedYear)) {
      setSelectedYear(firstYear);
    }
  }, [selectedYear, yearOptions]);
  const timelineRecords = visibleRecords.filter((record) => getRecordYear(record.event_time) === selectedYear);
  const timelineMonthGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      label: string;
      days: Array<{ key: string; day: string; weekday: string; records: RecordSummary[] }>;
    }> = [];
    timelineRecords.forEach((record) => {
      const monthKey = formatArchiveMonthTitle(record.event_time);
      let monthGroup = groups.find((item) => item.key === monthKey);
      if (!monthGroup) {
        monthGroup = { key: monthKey, label: monthKey, days: [] };
        groups.push(monthGroup);
      }
      const date = new Date(record.event_time);
      const dayKey = Number.isNaN(date.getTime())
        ? record.event_time.slice(0, 10)
        : `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      let dayGroup = monthGroup.days.find((item) => item.key === dayKey);
      if (!dayGroup) {
        const nextDayGroup = { key: dayKey, day: String(formatDay(record.event_time)), weekday: formatWeekdayShort(record.event_time), records: [] as RecordSummary[] };
        monthGroup.days.push(nextDayGroup);
        dayGroup = nextDayGroup;
      }
      dayGroup.records.push(record);
    });
    return groups;
  }, [timelineRecords]);
  const showFilterEmptyState = Boolean(activeChild && !loading && !error && hasActiveFilter && visibleRecords.length === 0);
  const showNoRecordsState = Boolean(activeChild && !loading && !error && !hasActiveFilter && records.length === 0);
  return (
    <div style={refPageStyle}>
      <header style={{ position: 'sticky', top: 0, zIndex: 4, background: 'var(--nl-topbar-bg)', WebkitBackdropFilter: 'blur(18px) saturate(1.02)', backdropFilter: 'blur(18px) saturate(1.02)', padding: 'calc(20px + env(safe-area-inset-top)) var(--nl-content-inline) 10px', borderBottom: filterOpen ? '1px solid var(--nl-border-soft)' : '1px solid transparent', transition: 'border-color 0.18s ease', boxShadow: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'end', gap: 14, marginBottom: 12 }}>
          <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1 }}>
            <span style={{ color: 'var(--nl-accent)', fontSize: 10, lineHeight: 1, fontWeight: 760, letterSpacing: '0.12em' }}>TIMELINE</span>
            <h1 style={{ margin: 0, color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: 38, fontWeight: 780, lineHeight: 0.96, fontVariantNumeric: 'tabular-nums' }}>{selectedYear}</h1>
            <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 560 }}>{normalizeDisplayName(activeChild?.name, '孩子')}的成长时间线</span>
          </div>
          <button type="button" aria-label="筛选记录" aria-pressed={filterOpen} onClick={() => setFilterOpen((current) => !current)} style={{ width: 42, height: 42, border: 'none', borderRadius: 0, flexShrink: 0, background: 'transparent', color: filterOpen || hasActiveFilter ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: 'none' }}>
            <SlidersHorizontal size={20} />
          </button>
        </div>
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(58px, 1fr)', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {yearOptions.map((year) => {
            const active = selectedYear === year;
            const count = yearRecordCount.get(year) ?? 0;
            return (
              <button key={year} type="button" aria-label={`${year}年`} aria-pressed={active} onClick={() => setSelectedYear(year)} style={{ minWidth: 62, minHeight: 36, border: 'none', borderBottom: active ? '2px solid var(--nl-accent)' : '2px solid transparent', borderRadius: 0, background: 'transparent', color: active ? 'var(--nl-primary-2)' : count > 0 ? 'var(--nl-muted-strong)' : 'var(--nl-muted)', padding: '4px 3px 6px', display: 'grid', gap: 2, placeItems: 'center', fontSize: 11, fontWeight: active ? 700 : 500, boxShadow: 'none', cursor: 'pointer', flexShrink: 0, opacity: count > 0 || active ? 1 : 0.56 }}>
                <span>{year}</span>
                <span style={{ fontSize: 9, lineHeight: 1, fontWeight: 500 }}>{count > 0 ? `${count}条` : '暂无'}</span>
              </button>
            );
          })}
        </div>
        {hasActiveFilter && !filterOpen ? (
          <button
            type="button"
            aria-label="清除当前筛选"
            onClick={clearFilters}
            style={{
              minHeight: 34,
              border: 'none',
              borderBottom: '1px solid var(--nl-border-strong)',
              borderRadius: 0,
              background: 'transparent',
              color: 'var(--nl-muted-strong)',
              padding: '6px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 520,
              cursor: 'pointer',
            }}
          >
            筛选：{activeFilterText}
          </button>
        ) : null}
      </header>

      <main style={{ ...refContentStyle, display: 'flex', flexDirection: 'column', minHeight: 'calc(var(--nl-page-min-height, 100dvh) - 132px)', boxSizing: 'border-box', padding: '14px var(--nl-content-inline) 50px', gap: 14 }}>
        {filterOpen ? (
          <div
            style={{
              borderRadius: 8,
              border: '1px solid var(--nl-border-soft)',
              background: 'rgba(var(--nl-surface-rgb),0.52)',
              padding: 14,
              display: 'grid',
              gap: 14,
              boxShadow: 'var(--nl-shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: 14, fontWeight: 620 }}>筛选记录</strong>
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{ minHeight: 32, border: '1px solid rgba(var(--nl-primary-rgb),0.22)', borderRadius: 8, background: 'transparent', color: 'var(--nl-primary-2)', padding: '0 10px', fontSize: 12, fontWeight: 560, cursor: 'pointer' }}
                >
                  清除
                </button>
              ) : null}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 520, letterSpacing: 0 }}>记录类型</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {filters.map((filter) => {
                  const active = recordTypeFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setRecordTypeFilter(filter.value)}
                      style={{
                        minHeight: 38,
                        border: active ? '1px solid rgba(var(--nl-primary-rgb),0.3)' : '1px solid var(--nl-border-muted)',
                        borderRadius: 8,
                        background: active ? 'rgba(var(--nl-primary-rgb),0.12)' : 'transparent',
                        color: active ? 'var(--nl-primary-2)' : 'var(--nl-ink)',
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: active ? 620 : 520,
                        cursor: 'pointer',
                        boxShadow: 'none',
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 520, letterSpacing: 0 }}>标签</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tags.length ? tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={tagFilter === tag}
                    onClick={() => setTagFilter((current) => (current === tag ? null : tag))}
                    style={{
                      minHeight: 36,
                      border: tagFilter === tag ? '1px solid rgba(var(--nl-primary-rgb),0.3)' : '1px solid var(--nl-border-muted)',
                      borderRadius: 8,
                      background: tagFilter === tag ? 'rgba(var(--nl-primary-rgb),0.12)' : 'transparent',
                      color: tagFilter === tag ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)',
                      padding: '7px 11px',
                      fontSize: 12,
                      fontWeight: tagFilter === tag ? 620 : 520,
                      cursor: 'pointer',
                    }}
                  >
                    #{tag}
                  </button>
                )) : <span style={{ color: 'var(--nl-muted)', fontSize: 12, fontWeight: 520 }}>当前记录还没有可用标签。</span>}
              </div>
            </div>
          </div>
        ) : null}
        {!activeChild ? <EmptyState message="请先选择孩子。" /> : null}
        {loading ? <EmptyState message="正在加载记录列表…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {!loading && !error && activeChild && timelineRecords.length ? (
          <div style={{ display: 'grid', gap: 24, padding: '4px 0 18px' }}>
            {timelineMonthGroups.map((group) => (
              <section key={group.key} style={{ display: 'grid', gap: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '0 0 14px' }}>
                  <strong style={{ color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: 25, lineHeight: 1, fontWeight: 760 }}>{group.label}</strong>
                  <span style={{ color: 'var(--nl-muted)', fontSize: 12, fontWeight: 700 }}>{group.days.reduce((count, day) => count + day.records.length, 0)} 条记录</span>
                </div>
                {group.days.map((day) => (
                  <section key={day.key} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr)', gap: 0, alignItems: 'stretch' }}>
                    <span style={{ paddingTop: 18, display: 'grid', alignContent: 'start', justifyItems: 'start', gap: 5, color: 'var(--nl-primary-2)' }}>
                      <strong style={{ fontFamily: 'var(--nl-font-sans)', fontSize: 24, lineHeight: 1, fontWeight: 720, fontVariantNumeric: 'tabular-nums' }}>{day.day}</strong>
                      <span style={{ color: 'var(--nl-muted)', fontSize: 10, lineHeight: 1, fontWeight: 640 }}>{day.weekday}</span>
                    </span>
                    <div style={{ minWidth: 0, borderLeft: '1px solid rgba(var(--nl-accent-rgb),0.28)', paddingLeft: 18, position: 'relative' }}>
                      <span aria-hidden="true" style={{ position: 'absolute', left: -4, top: 25, width: 7, height: 7, borderRadius: '50%', background: 'var(--nl-page-bg)', border: '2px solid var(--nl-accent)' }} />
                      {day.records.map((record, index) => (
                        <TimelineRecordRow
                          key={record.record_no}
                          record={record}
                          index={index}
                          ageLabel={formatAgeAtEvent(activeChild.birthday, record.event_time)}
                          onClick={() => navigate(`/record/${record.record_no}`)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </section>
            ))}
          </div>
        ) : null}
        {activeChild && !loading && !error && visibleRecords.length > 0 && !timelineRecords.length ? (
          <div style={{ ...refCardStyle, padding: 18, display: 'grid', gap: 12 }}>
            <EmptyState message={`${selectedYear}年还没有记录。`} />
          </div>
        ) : null}
        {showFilterEmptyState ? (
          <div style={{ ...refCardStyle, padding: 18, display: 'grid', gap: 12 }}>
            <EmptyState message={`没有符合「${activeFilterText}」的记录。`} />
            <button type="button" onClick={clearFilters} style={refPrimaryButtonStyle}>清除筛选</button>
          </div>
        ) : null}
        {showNoRecordsState ? (
          <div style={{ ...refCardStyle, padding: 18, display: 'grid', gap: 12 }}>
            <EmptyState message="暂无记录。" />
            <button type="button" onClick={() => navigate('/record/create')} style={refPrimaryButtonStyle}>记录</button>
          </div>
        ) : null}
        {activeChild && !loading && !error && timelineRecords.length ? (
          <button
            type="button"
            onClick={() => navigate('/record/create')}
            style={{
              border: 'none',
              borderTop: '1px solid var(--nl-border-muted)',
              borderRadius: 0,
              background: 'transparent',
              marginTop: 2,
              minHeight: 68,
              padding: '11px 0',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 12,
              alignItems: 'center',
              textAlign: 'left',
              cursor: 'pointer',
              boxShadow: 'none',
            }}
          >
            <span style={{ minWidth: 0, display: 'grid', gap: 4, paddingLeft: 2 }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: 14, lineHeight: 1.16, fontWeight: 600 }}>补一条记录</strong>
            </span>
            <ChevronRight size={17} color="var(--nl-muted)" style={{ marginRight: 2 }} />
          </button>
        ) : null}
      </main>
    </div>
  );
};
