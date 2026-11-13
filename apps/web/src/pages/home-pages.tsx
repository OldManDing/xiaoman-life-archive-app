import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileText,
  Filter,
  MapPin,
  Mic,
  Play,
  PlayCircle,
  Search,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { formatAgeAtEvent } from '../shared/age';
import { webApi } from '../shared/api/webApi';
import type { RecordSummary, RecordsListResponse } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { useCachedMediaUrl } from '../shared/useCachedMediaUrl';
import { helperTextStyle } from '../shared/ui';
import { EmptyState, normalizeDisplayName } from './shared';
import {
  RefChip,
  refCardStyle,
  refContentStyle,
  refMutedTextStyle,
  refPageStyle,
  refPrimaryButtonStyle,
  refSecondaryButtonStyle,
  referenceAssets,
} from './reference-ui';

const parseSafeDate = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const appTimeZone = 'Asia/Shanghai';
const datePart = (value: string | Date, type: 'year' | 'month' | 'day') => {
  const date = parseSafeDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat('en-US', { timeZone: appTimeZone, [type]: 'numeric' }).formatToParts(date).find((part) => part.type === type)?.value ?? null;
};
const formatDay = (value: string) => parseSafeDate(value)
  ? new Intl.DateTimeFormat('en-US', { timeZone: appTimeZone, day: 'numeric' }).format(parseSafeDate(value) as Date)
  : '—';
const formatMonth = (value: string) => parseSafeDate(value)?.toLocaleDateString('zh-CN', { timeZone: appTimeZone, month: 'short' }) ?? '待定';
const formatArchiveMonthTitle = (value: string) => {
  const date = parseSafeDate(value);
  if (!date) return '未知时间';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: appTimeZone, year: 'numeric', month: '2-digit' }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return year && month ? `${year}.${month}` : '未知时间';
};
const formatWeekdayShort = (value: string) => parseSafeDate(value)?.toLocaleDateString('zh-CN', { timeZone: appTimeZone, weekday: 'short' }).replace('星期', '周') ?? '待定';

const toLocalDateKey = (value: string | Date) => {
  const date = parseSafeDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: appTimeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
};

const formatStreamTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '时间待确认'
    : date.toLocaleTimeString('zh-CN', { timeZone: appTimeZone, hour: '2-digit', minute: '2-digit', hour12: false });
};

const sortHomeRecords = (records: RecordSummary[]) => [...records].sort((left, right) => {
  const leftTime = parseSafeDate(left.event_time)?.getTime() ?? Number.NaN;
  const rightTime = parseSafeDate(right.event_time)?.getTime() ?? Number.NaN;
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  if (!leftValid || !rightValid) return 0;
  return rightTime - leftTime;
});

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const cnNumber = (value: number) => {
  if (value <= 10) return value === 10 ? '十' : CN_DIGITS[value];
  if (value < 20) return `十${CN_DIGITS[value % 10] ?? ''}`;
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${CN_DIGITS[tens]}十${ones ? CN_DIGITS[ones] : ''}`;
};

type HomeDayGroup = {
  key: string;
  label: string;
  records: RecordSummary[];
};

const groupRecordsByDay = (records: RecordSummary[]): HomeDayGroup[] => {
  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);
  const groups: HomeDayGroup[] = [];
  records.forEach((record) => {
    const key = toLocalDateKey(record.event_time) || 'unknown';
    let group = groups.find((item) => item.key === key);
    if (!group) {
      const date = parseSafeDate(record.event_time);
      // 设计稿用中文月日；跨年时补年份避免歧义
      const monthNumber = Number(datePart(record.event_time, 'month'));
      const dayNumber = Number(datePart(record.event_time, 'day'));
      const fallbackLabel = !date || !monthNumber || !dayNumber
        ? '更早'
        : `${cnNumber(monthNumber)}月${cnNumber(dayNumber)}日 ${formatWeekdayShort(record.event_time)}`;
      group = {
        key,
        label: key === todayKey ? '今天' : key === yesterdayKey ? '昨天' : fallbackLabel,
        records: [],
      };
      groups.push(group);
    }
    group.records.push(record);
  });
  return groups;
};

const getMediaKind = (record: RecordSummary) => record.cover_media_type ?? (record.record_type === 'audio' || record.record_type === 'video' ? record.record_type : null);
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
  fallbackLabel = '媒体暂不可用',
  onFailure,
}: {
  src: string | null | undefined;
  fallbackSrc: string | null;
  alt: string;
  loading?: 'eager' | 'lazy';
  style?: CSSProperties;
  fallbackLabel?: string;
  onFailure?: () => void;
}) => {
  const resolvedSrc = src || fallbackSrc;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [resolvedSrc, fallbackSrc]);

  const hasDistinctFallback = Boolean(fallbackSrc && fallbackSrc !== resolvedSrc);
  const displaySrc = failedSrc
    ? (failedSrc === resolvedSrc && hasDistinctFallback ? fallbackSrc : null)
    : resolvedSrc;

  if (!displaySrc) {
    return (
      <span className="nl-home-media-fallback" role="img" aria-label={fallbackLabel}>
        <Camera size={20} strokeWidth={1.7} aria-hidden="true" />
        <span>{fallbackLabel}</span>
      </span>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => {
        setFailedSrc(displaySrc);
        onFailure?.();
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

const getRecordYear = (value: string) => String(parseSafeDate(value)?.getFullYear() ?? '未知');

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
    if (thumbnailUrl) homeVideoThumbnailCache.set(mediaNo, thumbnailUrl);
    return thumbnailUrl;
  });
};

const useHomeRecordCover = (record: RecordSummary | null, mediaKind: string | null, active = true) => {
  const isVideo = mediaKind === 'video';
  const mediaNo = isVideo ? record?.cover_media_no ?? null : null;
  const directVideoUrl = isVideo && /^(https?:\/\/|data:video\/|blob:)/i.test(record?.cover_url ?? '')
    ? record?.cover_url ?? null
    : null;
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(() => mediaNo ? homeVideoThumbnailCache.get(mediaNo) ?? null : null);
  const [videoPreview, setVideoPreview] = useState<string | null>(() => mediaNo ? homeVideoPreviewCache.get(mediaNo) ?? null : null);
  const imageUrl = useCachedMediaUrl(
    isVideo ? null : record?.cover_media_no,
    isVideo ? null : record?.cover_url,
    isVideo ? 'image' : mediaKind ?? 'image',
    { cacheRemote: !isVideo && mediaKind !== 'audio' },
  );

  useEffect(() => {
    let mounted = true;
    setVideoThumbnail(mediaNo ? homeVideoThumbnailCache.get(mediaNo) ?? null : null);
    setVideoPreview(mediaNo ? homeVideoPreviewCache.get(mediaNo) ?? null : null);
    if (mediaNo && active) void getHomeVideoThumbnail(mediaNo).then((thumbnailUrl) => {
      if (mounted) {
        setVideoThumbnail(thumbnailUrl);
        setVideoPreview(homeVideoPreviewCache.get(mediaNo) ?? null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [active, directVideoUrl, mediaNo]);

  return {
    src: isVideo ? videoThumbnail : imageUrl,
    videoPreviewSrc: isVideo ? videoPreview ?? directVideoUrl : null,
  };
};

const HomeVideoFrame = ({ src, active, compact, title, onError }: { src: string; active: boolean; compact: boolean; title: string; onError?: () => void }) => {
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
      onError={onError}
      aria-label={active ? title : undefined}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
};

const HomeTileVisual = ({ tile, active, compact = false, fallbackSrc }: { tile: HomePhotoTile; active: boolean; compact?: boolean; fallbackSrc: string | null }) => {
  const [mediaState, setMediaState] = useState<'ready' | 'thumbnail-failed' | 'preview-failed'>('ready');

  useEffect(() => {
    setMediaState('ready');
  }, [tile.src, tile.videoPreviewSrc]);

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
    const hasPreview = Boolean(tile.videoPreviewSrc);
    const showPreview = hasPreview && (!tile.src || mediaState === 'thumbnail-failed');
    const showFallback = mediaState === 'preview-failed' || (!tile.src && !hasPreview);
    return (
      <span style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'var(--nl-surface-strong)' }}>
        {showFallback ? (
          <span className="nl-home-media-fallback" role="img" aria-label="视频暂不可用">
            <Camera size={20} strokeWidth={1.7} aria-hidden="true" />
            <span>视频暂不可用</span>
          </span>
        ) : showPreview ? (
          <HomeVideoFrame
            src={tile.videoPreviewSrc as string}
            active={active}
            compact={compact}
            title={tile.title}
            onError={() => setMediaState('preview-failed')}
          />
        ) : tile.src ? (
          <HomeImage
            src={tile.src}
            fallbackSrc={null}
            alt={active ? tile.title : ''}
            loading={active ? 'eager' : 'lazy'}
            fallbackLabel="视频缩略图暂不可用"
            onFailure={() => setMediaState(hasPreview ? 'thumbnail-failed' : 'preview-failed')}
          />
        ) : null}
        {!showFallback && Boolean(tile.src || tile.videoPreviewSrc) ? (
          <span aria-hidden="true" style={{ position: 'absolute', width: compact ? 26 : 40, height: compact ? 26 : 40, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--nl-on-dark)', background: 'var(--nl-media-scrim)', boxShadow: 'none' }}>
            <Play size={compact ? 15 : 24} fill="currentColor" strokeWidth={1.4} style={{ marginLeft: compact ? 1 : 2 }} />
          </span>
        ) : null}
      </span>
    );
  }

  if (!tile.src) return <RecordTextThumbnail label="照片" compact={compact} />;

  return <HomeImage src={tile.src} fallbackSrc={fallbackSrc} alt={active ? tile.title : ''} loading={active ? 'eager' : 'lazy'} fallbackLabel="照片暂不可用" />;
};

const MomentMilestoneBadge = () => (
  <span className="nl-moment-milestone">
    <Star aria-hidden="true" size={12} strokeWidth={2.4} fill="currentColor" />
    <span>里程碑</span>
  </span>
);

const HomeStatus = ({ message, action }: { message: string; action?: { label: string; onClick: () => void } }) => (
  <section className="nl-home-status" role="status" aria-live="polite">
    <p>{message}</p>
    {action ? <button type="button" onClick={action.onClick}>{action.label}</button> : null}
  </section>
);

const normalizeMomentCopy = (value: string | null | undefined) => value
  ?.replace(/[\s\p{P}\p{S}]+/gu, '')
  .toLocaleLowerCase() ?? '';

const formatMomentTitle = (title: string | null | undefined, summary: string | null | undefined) => {
  const source = title?.replace(/\s+/g, ' ').trim() || '未命名记录';
  const summaryText = summary?.replace(/\s+/g, ' ').trim();
  if (!summaryText || summaryText.length < 8) return source.replace(/([a-z\d])([A-Z])/g, '$1 $2');

  const summaryIndex = source.toLocaleLowerCase().lastIndexOf(summaryText.toLocaleLowerCase());
  const titlePrefix = summaryIndex > 0 ? source.slice(0, summaryIndex).trim() : '';
  const isAppendedSummary = titlePrefix.length >= 3 && summaryIndex + summaryText.length >= source.length - 1;
  const displayTitle = isAppendedSummary ? titlePrefix.replace(/[\s,，:：;；—–-]+$/u, '') : source;
  return displayTitle.replace(/([a-z\d])([A-Z])/g, '$1 $2');
};

const MomentCard = ({ record, featured = false, onClick }: { record: RecordSummary; featured?: boolean; onClick: () => void }) => {
  const momentRef = useRef<HTMLButtonElement | null>(null);
  const [isVisible, setIsVisible] = useState(featured);
  const mediaKind = getMediaKind(record);
  useEffect(() => {
    if (featured) {
      setIsVisible(true);
      return;
    }
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }
    const node = momentRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [featured]);

  const coverPhoto = useHomeRecordCover(record, mediaKind, featured || isVisible);
  const hasCover = hasVisualCover(record);
  const isVideo = mediaKind === 'video';
  const isAudio = mediaKind === 'audio';
  const isTextCard = !hasCover && !isVideo && !isAudio;
  const title = formatMomentTitle(record.title, record.summary);
  const normalizedSummary = normalizeMomentCopy(record.summary);
  const normalizedTitle = normalizeMomentCopy(title);
  const summary = record.summary && normalizedSummary !== normalizedTitle && !normalizedTitle.includes(normalizedSummary)
    ? record.summary
    : null;
  const videoPreviewSrc = coverPhoto.videoPreviewSrc
    ?? (isVideo && /^(data:video\/|blob:)/i.test(record.cover_url ?? '') ? record.cover_url : null);
  return (
    <button ref={momentRef} type="button" className={`nl-moment-card${featured ? ' is-featured' : ''}${isTextCard ? ' is-text-card' : ''}`} onClick={onClick} aria-label={`查看记录：${title}`}>
      {hasCover || isVideo ? (
        <span className="nl-moment-media" data-moment-media="visual">
          <HomeTileVisual
            tile={{
              src: coverPhoto.src,
              title,
              mediaKind,
              videoPreviewSrc,
            }}
            active={featured || isVisible}
            fallbackSrc={null}
          />
          {!featured && (record.is_milestone || record.record_type === 'milestone') ? <MomentMilestoneBadge /> : null}
          {featured ? (
            <span className="nl-moment-featured-overlay">
              <strong className="nl-moment-featured-title">{title}</strong>
              <span className="nl-moment-featured-rule" aria-hidden="true" />
            </span>
          ) : null}
        </span>
      ) : null}
      {isAudio ? (
        <span className="nl-moment-media is-audio" data-moment-media="audio">
          <Mic size={21} strokeWidth={1.9} />
          <span>{record.cover_media_no ? '语音相册' : '语音记录'}</span>
          {record.is_milestone || record.record_type === 'milestone' ? <MomentMilestoneBadge /> : null}
        </span>
      ) : null}
      <span className="nl-moment-body">
        <span className="nl-moment-meta">
          <span>{formatStreamTime(record.event_time)}</span>
          {record.location_text ? <><span aria-hidden="true">·</span><span>{record.location_text}</span></> : null}
          {isTextCard && (record.is_milestone || record.record_type === 'milestone') ? <span className="nl-moment-milestone-inline"><Star size={12} strokeWidth={2.2} fill="currentColor" />里程碑</span> : null}
        </span>
        <strong className="nl-moment-title">{title}</strong>
        {isTextCard && summary ? (
          <span className="nl-moment-excerpt">{summary}</span>
        ) : isTextCard && !record.summary ? (
          <span className="nl-moment-excerpt">这段记录还没有正文。</span>
        ) : summary ? (
          <span className="nl-moment-summary">{summary}</span>
        ) : null}
      </span>
    </button>
  );
};

export const HomePage = () => {
  const navigate = useNavigate();
  const { activeChild, children, setActiveChild } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const { data: recordData, loading, error } = useAsyncData<RecordsListResponse>(
    async () => {
      if (!activeChild) return emptyHomeRecordsResponse;
      return webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 50, status: 'published' });
    },
    [activeChild?.child_no, reloadKey],
  );

  useEffect(() => {
    if (!activeChild && children.length > 0) setActiveChild(children[0]);
  }, [activeChild, children, setActiveChild]);

  const records = useMemo(() => sortHomeRecords(recordData?.list ?? []), [recordData]);
  const dayGroups = useMemo(() => groupRecordsByDay(records), [records]);
  const totalRecords = recordData?.total ?? records.length;
  const childName = normalizeDisplayName(activeChild?.name, '孩子');
  const switchChild = () => {
    if (children.length > 1 && activeChild) {
      const index = children.findIndex((item) => item.child_no === activeChild.child_no);
      setActiveChild(children[(index + 1) % children.length]);
      return;
    }
    navigate(activeChild ? '/family/child' : '/onboarding/child?mode=add');
  };
  const childRequiredTarget = (path: string) => activeChild ? path : '/onboarding/child?mode=add';
  const showHeaderRecord = Boolean(activeChild && !loading && !error);
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const hasTodayRecord = dayGroups.some((group) => group.key === todayKey);

  return (
    <div className="nl-home-page" style={{ ...refPageStyle, minHeight: 'auto' }}>
      <section className="nl-home-shell">
        <header className="nl-home-header">
          <div className="nl-home-header-row">
            <div className="nl-home-identity-wrap">
              <div className="nl-home-heading">
                <span className="nl-home-avatar" aria-hidden="true">
                  {activeChild?.avatar_url ? <img src={activeChild.avatar_url} alt="" /> : <span>{childName.slice(0, 1)}</span>}
                </span>
                <span className="nl-home-id-text">
                  <h1 className="nl-home-title-row">
                    <span className="nl-home-title">{childName}</span>
                    <span className="nl-home-title-age">· {activeChild?.current_age_display ?? '等待第一份档案'}</span>
                    {children.length > 1 ? <ChevronDown size={17} color="var(--nl-home-muted)" aria-hidden="true" /> : null}
                  </h1>
                </span>
              </div>
              <button
                type="button"
                className="nl-home-identity"
                onClick={switchChild}
                aria-label={children.length > 1 ? `切换孩子，当前为${childName}` : activeChild ? `查看${childName}档案` : '选择孩子档案'}
              />
            </div>
            <span className="nl-home-header-chevron" aria-hidden="true">
              <ChevronRight size={22} strokeWidth={1.8} />
            </span>
          </div>
        </header>

        <main aria-label="成长时刻流" data-home-stream="true" className="nl-home-main nl-home-stream">
          {!activeChild ? <HomeStatus message="请先选择孩子档案。" action={{ label: '选择孩子', onClick: () => navigate('/onboarding/child?mode=add') }} /> : null}
          {activeChild && loading ? <HomeStatus message="正在整理成长时刻…" /> : null}
          {activeChild && !loading && error ? <HomeStatus message="成长时刻暂时无法加载。" action={{ label: '重新加载', onClick: () => setReloadKey((value) => value + 1) }} /> : null}

          {activeChild && !loading && !error && !records.length ? (
            <section className="nl-home-empty-hero" aria-label="还没有记录">
              <span className="nl-home-empty-icon" aria-hidden="true"><Camera size={26} strokeWidth={1.7} /></span>
              <strong className="nl-home-empty-title">
                <span>{childName}的成长故事</span>
                <span>从第一刻开始</span>
              </strong>
              <p className="nl-home-empty-copy">拍一张照片、写一段话，都会成为值得珍藏的回忆。</p>
            </section>
          ) : null}

          {activeChild && !loading && !error && !hasTodayRecord ? (
            <div className="nl-home-today">
              <span className="nl-home-today-text">今天还没记录</span>
              <button type="button" className="nl-home-today-cta" onClick={() => navigate(childRequiredTarget('/record/create'))}>
                记一笔 <span aria-hidden="true">＋</span>
              </button>
            </div>
          ) : null}

          {activeChild && !loading && !error && dayGroups.map((group) => (
            <section key={group.key} className={`nl-home-day-group${group.records.length === 1 ? ' is-single' : ''}`} aria-label={`${group.label}的记录`}>
              <div className="nl-home-day-head">
                <h2 className="nl-home-day-title">{group.label}</h2>
                <span className="nl-home-day-count">{group.records.length} 条</span>
              </div>
              <div className="nl-home-day-cards">
                {group.records.map((record) => (
                  <MomentCard key={record.record_no} record={record} featured={record.record_no === records[0]?.record_no} onClick={() => navigate(`/record/${record.record_no}`)} />
                ))}
              </div>
            </section>
          ))}

          {activeChild && !loading && !error && records.length ? (
            <footer className="nl-home-stream-footer" aria-label="记录统计">
              <span className="nl-home-total">已收录 {totalRecords} 条记录</span>
            </footer>
          ) : null}
        </main>
      </section>
    </div>
  );
};

const searchHistoryKey = 'nianlun.search.history.v1';
const searchHistoryStorageKey = (scope?: string | null) => scope ? `${searchHistoryKey}:${scope}` : searchHistoryKey;
const readSearchHistory = (scope?: string | null) => {
  if (typeof window === 'undefined') return [];

  try {
    const scopedKey = searchHistoryStorageKey(scope);
    const raw = window.localStorage.getItem(scopedKey) ?? (scope ? window.localStorage.getItem(searchHistoryKey) : null);
    if (scope && raw && !window.localStorage.getItem(scopedKey)) window.localStorage.setItem(scopedKey, raw);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 8) : [];
  } catch {
    return [];
  }
};

const writeSearchHistory = (history: string[], scope?: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(searchHistoryStorageKey(scope), JSON.stringify(history.slice(0, 8)));
  } catch {
    // Some embedded WebViews can block localStorage writes; search should still work.
  }
};

const uniqueSearchValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));


const SEARCH_SUGGESTIONS = ['海边', '生日', '公园'];

const formatSearchDate = (value: string) => {
  const date = parseSafeDate(value);
  if (!date) return '日期待定';
  return new Intl.DateTimeFormat('zh-CN', { timeZone: appTimeZone, year: 'numeric', month: 'long', day: 'numeric' }).format(date);
};

const highlightKeyword = (text: string, keyword: string) => {
  const kw = keyword.trim();
  if (!kw) return text;
  const index = text.toLowerCase().indexOf(kw.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + kw.length)}</mark>
      {text.slice(index + kw.length)}
    </>
  );
};

const searchMediaKindLabel = (record: RecordSummary) => {
  const kind = record.cover_media_type ?? (record.record_type === 'video' ? 'video' : record.record_type === 'audio' ? 'audio' : null);
  if (kind === 'video') return '视频';
  if (kind === 'audio') return '语音';
  if (record.cover_url || record.cover_media_no) return '照片';
  return '文字';
};

const SearchResultRow = ({ record, keyword, onClick }: { record: RecordSummary; keyword: string; onClick: () => void }) => {
  const kindLabel = searchMediaKindLabel(record);
  const hasPhoto = kindLabel === '照片';
  return (
    <button type="button" className="search-row" onClick={onClick}>
      {hasPhoto && record.cover_url ? (
        <img className="search-thumb" src={record.cover_url} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="search-thumb" aria-hidden="true">
          <FileText size={28} strokeWidth={1.5} />
        </span>
      )}
      <span className="search-body">
        <span className="search-title">{highlightKeyword(record.title ?? '未命名记录', keyword)}</span>
        <span className="search-meta">{[formatSearchDate(record.event_time), record.location_text].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="search-kind">{kindLabel}</span>
      <ChevronRight size={18} strokeWidth={1.9} className="search-chevron" />
    </button>
  );
};

export const SearchPage = () => {
  const { activeChild, user } = useAuth();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const searchScope = user?.user_no ?? null;
  const [history, setHistory] = useState<string[]>(() => readSearchHistory(searchScope));
  useEffect(() => setHistory(readSearchHistory(searchScope)), [searchScope]);
  const normalizedKeyword = keyword.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchKeyword(normalizedKeyword), normalizedKeyword ? 260 : 0);
    return () => window.clearTimeout(timer);
  }, [normalizedKeyword]);
  const { data, loading, error } = useAsyncData<{ list: RecordSummary[]; total: number }>(
    async () => {
      if (!activeChild) return { list: [], total: 0 };
      const result = await webApi.listRecords({
        child_no: activeChild.child_no,
        page: 1,
        page_size: 50,
        status: 'published',
        keyword: searchKeyword || undefined,
      });
      return { list: result.list, total: result.total };
    },
    [activeChild?.child_no, searchKeyword],
  );
  const records = data?.list ?? [];
  const resultTotal = data?.total ?? records.length;
  const debouncing = normalizedKeyword !== searchKeyword;
  const searchBusy = loading || debouncing;
  const commitSearch = (value: string) => {
    const next = value.trim();
    if (!next) return;
    setKeyword(next);
    setSearchKeyword(next);
    setHistory((current) => {
      const updated = [next, ...current.filter((item) => item !== next)].slice(0, 8);
      writeSearchHistory(updated, searchScope);
      return updated;
    });
  };

  return (
    <div className="search-page">
      <header className="search-head">
        <button type="button" className="search-back" aria-label="返回" onClick={() => navigate(-1)}>
          <ChevronLeft size={22} strokeWidth={1.9} />
        </button>
        <label className="search-field">
          <Search size={18} strokeWidth={1.9} />
          <input
            aria-label="搜索关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitSearch(keyword);
            }}
            placeholder="搜索记录"
          />
          {normalizedKeyword ? (
            <button type="button" className="search-clear" aria-label="清空搜索词" onClick={() => setKeyword('')}>
              <X size={18} strokeWidth={2.1} />
            </button>
          ) : null}
        </label>
        <button type="button" className="search-cancel" onClick={() => navigate(-1)}>取消</button>
      </header>

      <main className="search-main">
        {!normalizedKeyword ? (
        <section>
          <h2 className="search-recent-title">最近搜索</h2>
          <div className="search-chips">
            {(history.length ? history.slice(0, 5) : SEARCH_SUGGESTIONS).map((item) => (
              <button key={item} type="button" className="search-chip" onClick={() => commitSearch(item)}>{item}</button>
            ))}
          </div>
        </section>
        ) : null}

        {!normalizedKeyword ? (
          <section>
            <div className="search-count-row">
              <h2 className="search-count">最近记录</h2>
            </div>
            {loading ? <EmptyState message="正在加载最近记录…" /> : null}
            {error ? <EmptyState message={`加载失败：${error}`} /> : null}
            {!activeChild ? <EmptyState message="还没有孩子档案，先创建一个孩子档案再开始记录。" /> : null}
            {!loading && !error && activeChild && records.length ? (
              <div className="search-list">
                {records.slice(0, 4).map((record) => (
                  <SearchResultRow key={record.record_no} record={record} keyword="" onClick={() => navigate(`/record/${record.record_no}`)} />
                ))}
              </div>
            ) : null}
            {!loading && !error && activeChild && !records.length ? (
              <div style={{ display: 'grid', justifyItems: 'center', gap: 14, padding: '32px 0 12px', textAlign: 'center' }}>
                <EmptyState message="还没有记录，先去记一笔吧。" />
                <button type="button" onClick={() => navigate('/record/create')} style={{ ...refPrimaryButtonStyle, minHeight: 44, padding: '10px 22px', fontSize: 15 }}>
                  去记录
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <section>
            {searchBusy || resultTotal > 0 ? (
              <div className="search-count-row">
                <h2 className="search-count">{searchBusy ? '正在搜索…' : `找到 ${resultTotal} 条${records.length < resultTotal ? ` · 显示前 ${records.length} 条` : ''}`}</h2>
                <span className="search-filter">
                  <Filter size={18} strokeWidth={1.8} />
                  <span>筛选</span>
                </span>
              </div>
            ) : null}
            {error ? <EmptyState message={`搜索失败：${error}`} /> : null}
            {!loading && !error && records.length ? (
              <div className="search-list">
                {records.map((record) => (
                  <SearchResultRow
                    key={record.record_no}
                    record={record}
                    keyword={normalizedKeyword}
                    onClick={() => navigate(`/record/${record.record_no}`)}
                  />
                ))}
              </div>
            ) : null}
            {!loading && !error && !records.length ? (
              <div style={{ display: 'grid', justifyItems: 'center', gap: 14, padding: '48px 0 28px', textAlign: 'center' }}>
                <span aria-hidden="true" style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(255, 250, 244, 0.72)', border: '1px solid rgba(255, 255, 255, 0.72)', display: 'grid', placeItems: 'center', color: 'var(--nl-accent)', boxShadow: '0 12px 30px rgba(146, 96, 52, 0.14)' }}>
                  <SearchX size={36} strokeWidth={1.6} />
                </span>
                <strong style={{ fontFamily: 'var(--nl-font-display)', fontSize: 24, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--nl-ink)', lineHeight: 1.3 }}>没有找到「{normalizedKeyword}」</strong>
                <p style={{ ...helperTextStyle, margin: 0, fontSize: 13, maxWidth: 268 }}>换个词试试，或者去时间轴看看这一年</p>
                <button type="button" onClick={() => navigate('/timeline')} style={{ minHeight: 44, padding: '0 24px', borderRadius: 999, border: 'none', background: 'var(--nl-primary)', color: '#fff', fontSize: 14, fontWeight: 600 }}>
                  去时间轴看看
                </button>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
};

const TimelineDayThumb = ({ record, ageLabel, onClick }: { record: RecordSummary; ageLabel: string; onClick: () => void }) => {
  const mediaKind = getMediaKind(record);
  const thumbRef = useRef<HTMLButtonElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }
    const node = thumbRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '180px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const cover = useHomeRecordCover(record, mediaKind, isVisible);
  const hasCover = hasVisualCover(record);
  const isVideo = mediaKind === 'video';
  const isMilestone = record.is_milestone || record.record_type === 'milestone';

  if (!hasCover && !isVideo && mediaKind !== 'audio') {
    return (
      <button ref={thumbRef} type="button" className="tl-textcard" aria-label={`查看记录：${record.title ?? '未命名记录'}`} onClick={onClick}>
        <strong>{record.title ?? '未命名记录'}</strong>
        {record.summary ? <span className="tl-textcard-excerpt">{record.summary}</span> : null}
        <span className="tl-textcard-meta">{formatStreamTime(record.event_time)} · {ageLabel}</span>
      </button>
    );
  }

  return (
    <button ref={thumbRef} type="button" className="tl-thumb" aria-label={`查看记录：${record.title ?? '成长媒体'}`} onClick={onClick}>
      {hasCover || isVideo ? (
        <HomeTileVisual
          tile={{ src: cover.src, title: record.title ?? '成长照片', mediaKind, videoPreviewSrc: cover.videoPreviewSrc }}
          active={isVisible}
          compact
          fallbackSrc={null}
        />
      ) : (
        <span className="tl-thumb-audio" aria-hidden="true">
          <PlayCircle size={22} strokeWidth={1.9} />
          <span>语音</span>
        </span>
      )}
      {isMilestone ? (
        <span className="tl-thumb-badge" aria-hidden="true">
          <Star size={11} strokeWidth={2.4} fill="currentColor" />
        </span>
      ) : null}
      <span className="tl-thumb-date">{formatDay(record.event_time)}日</span>
    </button>
  );
};

const TimelineWallTile = ({ record, onClick }: { record: RecordSummary; onClick: () => void }) => {
  const mediaKind = getMediaKind(record);
  const coverUrl = useCachedMediaUrl(record.cover_media_no, record.cover_url, mediaKind ?? 'image', {
    cacheRemote: mediaKind !== 'audio',
  });
  const isMilestone = record.is_milestone || record.record_type === 'milestone';
  const src = coverUrl || record.cover_url || null;
  const hasCover = Boolean(src) && mediaKind !== 'audio';
  const month = Number(datePart(record.event_time, 'month'));
  const day = Number(datePart(record.event_time, 'day'));
  const dateLabel = month && day ? `${month}月${day}日` : '日期待定';

  return (
    <button
      type="button"
      className={`tl-tile${hasCover ? '' : ' is-text'}`}
      onClick={onClick}
      aria-label={`${dateLabel}，${record.title ?? '未命名记录'}`}
    >
      {hasCover ? (
        <img className="tl-tile-img" src={src as string} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="tl-tile-text">
          <FileText size={22} strokeWidth={1.5} aria-hidden="true" />
          <span>{record.title ?? '未命名记录'}</span>
        </span>
      )}
      <span className="tl-tile-scrim" aria-hidden="true" />
      <span className="tl-tile-date">
        {isMilestone ? <span className="tl-tile-dot" aria-hidden="true" /> : null}
        {dateLabel}
      </span>
    </button>
  );
};

const TIMELINE_PAGE_SIZE = 100;

export const TimelinePage = () => {
  const navigate = useNavigate();
  const { activeChild } = useAuth();
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [extraRecords, setExtraRecords] = useState<RecordSummary[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedPage, setLoadedPage] = useState(1);
  const { data, loading, error } = useAsyncData(
    async () => {
      if (!activeChild) return null;
      return webApi.listRecords({
        child_no: activeChild.child_no,
        page: 1,
        page_size: TIMELINE_PAGE_SIZE,
        status: 'published',
      });
    },
    [activeChild?.child_no],
  );

  const firstPageRecords = data?.list ?? [];
  const records = [...firstPageRecords, ...extraRecords];
  const totalRecords = data?.total ?? records.length;
  const hasMoreRecords = records.length < totalRecords;

  const loadMoreRecords = async () => {
    if (!activeChild || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await webApi.listRecords({
        child_no: activeChild.child_no,
        page: loadedPage + 1,
        page_size: TIMELINE_PAGE_SIZE,
        status: 'published',
      });
      setExtraRecords((current) => [...current, ...next.list]);
      setLoadedPage((current) => current + 1);
    } finally {
      setLoadingMore(false);
    }
  };
  const yearOptions = Array.from(new Set(records.map((record) => getRecordYear(record.event_time))))
    .filter((year) => Boolean(year) && /^\d{4}$/.test(year))
    .sort((left, right) => Number(right) - Number(left));
  const didDefaultYearRef = useRef(false);
  useEffect(() => {
    setExtraRecords([]);
    setLoadedPage(1);
  }, [activeChild?.child_no]);
  useEffect(() => {
    if (didDefaultYearRef.current || !records.length) return;
    didDefaultYearRef.current = true;
    if (yearOptions.length && !yearOptions.includes(selectedYear)) setSelectedYear(yearOptions[0]);
  }, [records.length, selectedYear, yearOptions]);

  const activeYear = selectedYear || yearOptions[0] || String(new Date().getFullYear());
  const yearRecords = records.filter((record) => getRecordYear(record.event_time) === activeYear);
  const monthOptions = Array.from(new Set(yearRecords.map((record) => Number(datePart(record.event_time, 'month')))))
    .filter((month) => Number.isFinite(month) && month > 0)
    .sort((left, right) => right - left);
  const monthKeyList = monthOptions.join(',');
  useEffect(() => {
    if (!monthOptions.length) return;
    if (selectedMonth === 'all') return;
    if (!monthOptions.some((month) => String(month) === selectedMonth)) {
      setSelectedMonth(String(monthOptions[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKeyList, selectedMonth]);
  const activeMonth = selectedMonth || String(monthOptions[0] ?? '');
  const monthRecords = activeMonth === 'all'
    ? yearRecords
    : yearRecords.filter((record) => String(Number(datePart(record.event_time, 'month'))) === activeMonth);
  const sortedRecords = [...monthRecords].sort((left, right) => (
    (parseSafeDate(right.event_time)?.getTime() ?? 0) - (parseSafeDate(left.event_time)?.getTime() ?? 0)
  ));
  const milestoneCount = yearRecords.filter((record) => record.is_milestone || record.record_type === 'milestone').length;
  const currentYearKey = String(new Date().getFullYear());
  const yearLabel = activeYear === currentYearKey ? '今年' : `${activeYear}年`;
  const bigTitle = activeMonth && activeMonth !== 'all' ? `${cnNumber(Number(activeMonth))}月` : `${activeYear}年`;

  return (
    <div className="tl-page">
      <header className="tl-head">
        <div className="tl-controls">
          <div className="tl-years" role="tablist" aria-label="年份">
            {yearOptions.map((year) => (
              <button
                key={year}
                type="button"
                role="tab"
                aria-selected={year === activeYear}
                className={`tl-year${year === activeYear ? ' is-active' : ''}`}
                onClick={() => {
                  setSelectedYear(year);
                  setSelectedMonth('all');
                }}
              >
                {year}
              </button>
            ))}
          </div>
          <label className="tl-month-select">
            <select
              aria-label="月份"
              value={activeMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              <option value="all">全年</option>
              {monthOptions.map((month) => (
                <option key={month} value={String(month)}>{month}月</option>
              ))}
            </select>
            <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
          </label>
        </div>
        <h1 className="tl-big-title">{bigTitle}</h1>
        <p className="tl-summary">{yearLabel} {yearRecords.length} 条 · 里程碑 {milestoneCount} 个</p>
      </header>

      <main className="tl-main">
        {!activeChild ? <EmptyState message="请先选择孩子。" /> : null}
        {loading ? <EmptyState message="正在加载记录列表…" /> : null}
        {error ? <EmptyState message={`加载失败：${error}`} /> : null}
        {!loading && !error && activeChild && sortedRecords.length ? (
          <div className="tl-grid">
            {sortedRecords.map((record) => (
              <TimelineWallTile
                key={record.record_no}
                record={record}
                onClick={() => navigate(`/record/${record.record_no}`)}
              />
            ))}
          </div>
        ) : null}
        {!loading && !error && activeChild && !sortedRecords.length ? (
          <div className="tl-empty">
            <EmptyState message={records.length ? `${bigTitle}还没有记录。` : '还没有记录，去记下第一刻吧。'} />
            <button type="button" className="tl-empty-cta" onClick={() => navigate('/record/create')}>去记录</button>
          </div>
        ) : null}
        {hasMoreRecords ? (
          <button
            type="button"
            onClick={() => void loadMoreRecords()}
            disabled={loadingMore}
            style={{ display: 'block', margin: '18px auto 6px', minHeight: 44, padding: '0 22px', borderRadius: 999, border: '1px solid rgba(var(--nl-shadow-rgb),0.14)', background: 'rgba(255,251,245,0.7)', color: 'var(--nl-ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {loadingMore ? '加载中…' : `加载更多（已显示 ${records.length}/${totalRecords}）`}
          </button>
        ) : null}
      </main>
    </div>
  );
};
