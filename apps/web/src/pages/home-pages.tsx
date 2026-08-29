import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  Edit3,
  FileText,
  MapPin,
  Mic,
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
const formatDay = (value: string) => parseSafeDate(value)?.toLocaleString('zh-CN', { timeZone: appTimeZone, day: 'numeric' }) ?? '—';
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
      const fallbackLabel = !date
        ? '更早'
        : `${datePart(record.event_time, 'month')}月${datePart(record.event_time, 'day')}日 ${formatWeekdayShort(record.event_time)}`;
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
          {record.is_milestone || record.record_type === 'milestone' ? <MomentMilestoneBadge /> : null}
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
                    {children.length > 1 ? <ChevronDown size={17} color="var(--nl-home-muted)" aria-hidden="true" /> : null}
                  </h1>
                  <span className="nl-home-subtitle">{today.getMonth() + 1}月{today.getDate()}日 · {activeChild?.current_age_display ?? '等待第一份档案'}</span>
                </span>
              </div>
              <button
                type="button"
                className="nl-home-identity"
                onClick={switchChild}
                aria-label={children.length > 1 ? `切换孩子，当前为${childName}` : activeChild ? `查看${childName}档案` : '选择孩子档案'}
              />
            </div>
            {showHeaderRecord ? (
              <div className="nl-home-header-actions">
                <button type="button" className="nl-home-record-button" onClick={() => navigate(childRequiredTarget('/record/create'))}>
                  <Edit3 size={17} strokeWidth={2} aria-hidden="true" />
                  <span>记录</span>
                </button>
              </div>
            ) : null}
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

          {activeChild && !loading && !error && dayGroups.map((group) => (
            <section key={group.key} className={`nl-home-day-group${group.records.length === 1 ? ' is-single' : ''}`} aria-label={`${group.label}的记录`}>
              <div className="nl-home-day-head">
                <h2 className="nl-home-day-title">{group.label}</h2>
                {group.records.length > 1 ? <span className="nl-home-day-count">{group.records.length} 条</span> : null}
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
  const [searchKeyword, setSearchKeyword] = useState('');
  const [history, setHistory] = useState<string[]>(() => readSearchHistory());
  const normalizedKeyword = keyword.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchKeyword(normalizedKeyword), normalizedKeyword ? 260 : 0);
    return () => window.clearTimeout(timer);
  }, [normalizedKeyword]);
  const { data, loading, error } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({
        child_no: activeChild.child_no,
        page: 1,
        page_size: 50,
        status: 'published',
        keyword: searchKeyword || undefined,
      });
      return result.list;
    },
    [activeChild?.child_no, searchKeyword],
  );
  const records = data ?? [];
  const resultTags = uniqueSearchValues(records.flatMap((record) => record.tags ?? [])).slice(0, 8);
  const resultLocations = uniqueSearchValues(records.map((record) => record.location_text)).slice(0, 8);
  const commitSearch = (value: string) => {
    const next = value.trim();
    if (!next) return;
    setKeyword(next);
    setSearchKeyword(next);
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
      <header style={{ position: 'sticky', top: 0, zIndex: 4, minHeight: 'calc(64px + var(--nl-statusbar-top))', padding: 'calc(var(--nl-statusbar-top) + 2px) 14px 10px', borderBottom: '1px solid transparent', background: 'var(--nl-topbar-bg)', WebkitBackdropFilter: 'blur(18px) saturate(1.02)', backdropFilter: 'blur(18px) saturate(1.02)', display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) 48px', gap: 8, alignItems: 'center', boxShadow: 'none' }}>
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
                {records.length >= 50 ? <p style={{ ...helperTextStyle, margin: 0 }}>仅展示前 50 条结果，可继续缩小关键词范围。</p> : null}
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
      <button ref={thumbRef} type="button" className="tl-textcard" onClick={onClick}>
        <strong>{record.title ?? '未命名记录'}</strong>
        {record.summary ? <span className="tl-textcard-excerpt">{record.summary}</span> : null}
        <span className="tl-textcard-meta">{formatStreamTime(record.event_time)} · {ageLabel}</span>
      </button>
    );
  }

  return (
    <button ref={thumbRef} type="button" className="tl-thumb" onClick={onClick}>
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
    </button>
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
      const dayKey = toLocalDateKey(record.event_time) || record.event_time.slice(0, 10);
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
      <header style={{ position: 'sticky', top: 0, zIndex: 4, background: 'var(--nl-topbar-bg)', WebkitBackdropFilter: 'blur(18px) saturate(1.02)', backdropFilter: 'blur(18px) saturate(1.02)', padding: 'calc(var(--nl-statusbar-top) + 6px) var(--nl-content-inline) 12px', borderBottom: '1px solid var(--nl-border-soft)', transition: 'border-color 0.18s ease', boxShadow: '0 8px 22px rgba(var(--nl-shadow-rgb),0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 13 }}>
          <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1 }}>
            <span style={{ color: 'var(--nl-primary)', fontSize: 10, lineHeight: 1, fontWeight: 800, letterSpacing: '0.12em' }}>GROWTH / TIMELINE</span>
            <h1 style={{ margin: 0, color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: 30, fontWeight: 780, lineHeight: 1.04 }}>时间轴</h1>
            <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 560 }}>{normalizeDisplayName(activeChild?.name, '孩子')}的成长时间线</span>
          </div>
          <button type="button" aria-label="筛选记录" aria-pressed={filterOpen} onClick={() => setFilterOpen((current) => !current)} style={{ width: 44, height: 44, border: filterOpen || hasActiveFilter ? '1px solid var(--nl-primary)' : '1px solid var(--nl-border-muted)', borderRadius: 8, flexShrink: 0, background: filterOpen || hasActiveFilter ? 'var(--nl-primary)' : 'var(--nl-card-bg-strong)', color: filterOpen || hasActiveFilter ? 'var(--nl-on-primary)' : 'var(--nl-ink)', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 7px 16px rgba(var(--nl-shadow-rgb),0.06)' }}>
            <SlidersHorizontal size={20} />
          </button>
        </div>
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(64px, 1fr)', gap: 7, overflowX: 'auto', paddingBottom: 10 }}>
          {yearOptions.map((year) => {
            const active = selectedYear === year;
            const count = yearRecordCount.get(year) ?? 0;
            return (
              <button key={year} type="button" aria-label={`${year}年`} aria-pressed={active} onClick={() => setSelectedYear(year)} style={{ minWidth: 64, minHeight: 43, border: active ? '1px solid rgba(var(--nl-primary-rgb),0.24)' : '1px solid var(--nl-border-soft)', borderRadius: 8, background: active ? 'var(--nl-plan-lilac)' : 'var(--nl-card-bg-strong)', color: active ? 'var(--nl-primary-2)' : count > 0 ? 'var(--nl-muted-strong)' : 'var(--nl-muted)', padding: '5px 6px', display: 'grid', gap: 2, placeItems: 'center', fontSize: 11, fontWeight: active ? 750 : 550, boxShadow: active ? '0 7px 16px rgba(var(--nl-primary-rgb),0.1)' : 'none', cursor: 'pointer', flexShrink: 0, opacity: count > 0 || active ? 1 : 0.58 }}>
                <span>{year}</span>
                <span style={{ fontSize: 9, lineHeight: 1, fontWeight: 500 }}>{count > 0 ? `${count}条` : '暂无'}</span>
              </button>
            );
          })}
        </div>
        <div aria-label="快速筛选记录类型" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {filters.map((filter) => {
            const active = recordTypeFilter === filter.value;
            return (
              <button
                key={`quick-${filter.value}`}
                type="button"
                aria-label={`快速筛选：${filter.label}`}
                aria-pressed={active}
                onClick={() => setRecordTypeFilter(filter.value)}
                style={{ minHeight: 34, minWidth: 54, border: active ? '1px solid var(--nl-primary)' : '1px solid var(--nl-border-muted)', borderRadius: 999, background: active ? 'var(--nl-primary)' : 'var(--nl-surface-soft)', color: active ? 'var(--nl-on-primary)' : 'var(--nl-muted-strong)', padding: '6px 11px', fontSize: 11, fontWeight: active ? 750 : 560, whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: active ? '0 7px 16px rgba(var(--nl-primary-rgb),0.18)' : 'none' }}
              >
                {filter.label}
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
          <div style={{ display: 'grid', gap: 22, padding: '5px 0 18px' }}>
            {timelineMonthGroups.map((group) => (
              <section key={group.key} style={{ display: 'grid', gap: 12 }}>
                <header className="tl-month-head">
                  <h2>{group.label.replace('.', ' 年 ')} 月</h2>
                  <span>{group.days.reduce((count, day) => count + day.records.length, 0)} 条记录</span>
                </header>
                {group.days.map((day) => (
                  <section key={day.key} className="tl-day">
                    <div className="tl-day-head">
                      <strong>{day.day}日</strong>
                      <span>{day.weekday}{day.records.length > 1 ? ` · ${day.records.length} 条` : ''}</span>
                    </div>
                    <div className="tl-day-grid">
                      {day.records.map((record) => (
                        <TimelineDayThumb
                          key={record.record_no}
                          record={record}
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
      </main>
    </div>
  );
};
