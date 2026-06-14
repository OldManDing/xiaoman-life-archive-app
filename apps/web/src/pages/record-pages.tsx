import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import { AlertCircle, BookOpen, Check, CheckCircle2, ChevronRight, Clock, Eye, FileAudio, Image, ImagePlus, MapPin, Maximize2, Mic, PlayCircle, Ruler, Sparkles, Star, Tag, Video, X } from 'lucide-react';
import { Camera, CameraResultType, CameraSource, type GalleryPhoto, type Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { AiJobDetail, LocationSuggestion, RecordDetail } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { aiJobStatusLabel, mediaTypeLabel, recordStatusLabel, recordTypeLabel, visibilityScopeLabel } from '../shared/labels';
import { createPersistableMediaPreview, removeRuntimeMediaPreview, resolveMediaPreviewUrl, resolveStoredMediaUrl, saveLocalMediaPreview, saveRuntimeMediaPreview } from '../shared/localMediaPreview';
import { getCurrentDeviceLocation } from '../shared/deviceLocation';
import { AppSelect, AppTopBar, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, formSubmitSpacingStyle, formatDateTimeLocal, rowStyle } from './shared';
import { referenceAssets } from './reference-ui';
import { deriveMediaType, normalizeMimeType, resolveFileMimeType, withResolvedFileMimeType } from '../shared/mediaFiles';

type MediaPreview = {
  media_no: string;
  preview_url: string;
  media_type: 'image' | 'video' | 'audio';
  original_name?: string | null;
  is_local?: boolean;
  upload_status?: 'uploading' | 'ready' | 'failed';
  error_message?: string | null;
};

type MediaType = MediaPreview['media_type'];
type NativeImageAsset = Pick<Photo | GalleryPhoto, 'webPath' | 'format'>;

const tagOptions = ['生日纪念', '户外日常', '语言发育', '大动作发展', '睡前时光', '亲子陪伴', '第一次', '家庭日常', '身高记录', '体重记录'];

const locationOptions = ['家里', '小区', '公园', '学校', '医院', '游乐场', '爷爷奶奶家', '外婆家'];
const PERSISTABLE_NON_IMAGE_PREVIEW_BYTES = 4_200_000;

const createPendingMediaNo = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pending-${crypto.randomUUID()}`;
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const revokeObjectUrl = (url?: string | null) => {
  if (url?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
};

const normalizePromptMessage = (message: string) =>
  /google\s*play|play services|gms|service_version|service missing|service disabled/i.test(message)
    ? '当前手机定位服务不可用，可手动填写地点或选择常用地点。'
    : message;

const formatMetricNumber = (value: string) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return '';
  return normalized.toFixed(1).replace(/\.0$/, '');
};

const normalizeMetricInput = (value: string) => value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 6);

const metadataSelectStyle = {
  minHeight: '44px',
  borderRadius: '999px',
  background: 'rgba(var(--nl-surface-rgb),0.82)',
  border: '1px solid var(--nl-border)',
} as const;

const metadataIconSelectStyle = {
  ...metadataSelectStyle,
  paddingLeft: '36px',
} as const;

const compactPillButtonStyle = {
  ...secondaryButtonStyle,
  minHeight: '44px',
  padding: '8px 13px',
  borderRadius: '999px',
  fontSize: '12px',
  boxShadow: 'none',
} as const;

const selectedChipButtonStyle = {
  minHeight: '44px',
  border: '1px solid var(--nl-border)',
  borderRadius: '999px',
  background: 'rgba(var(--nl-surface-rgb),0.74)',
  color: 'var(--nl-muted-strong)',
  padding: '7px 11px',
  fontSize: '12px',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  cursor: 'pointer',
  boxShadow: 'none',
} as const;

const mediaActionButtonStyle: CSSProperties = {
  minHeight: '50px',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  borderRadius: '13px',
  border: '1px solid var(--nl-border)',
  background: 'rgba(var(--nl-surface-rgb),0.78)',
  color: 'var(--nl-ink)',
  padding: '6px 4px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  textAlign: 'center',
  cursor: 'pointer',
  boxShadow: 'none',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease',
};

const mediaActionIconStyle: CSSProperties = {
  width: '22px',
  height: '22px',
  borderRadius: '9px',
  background: 'rgba(var(--nl-accent-rgb),0.14)',
  color: 'var(--nl-accent)',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
};

const mediaActionLabelStyle: CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 800,
  lineHeight: 1.2,
  letterSpacing: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const MediaActionButton = ({
  icon,
  label,
  displayLabel,
  description,
  onClick,
  disabled,
  style,
}: {
  icon: ReactNode;
  label: string;
  displayLabel?: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    style={{
      ...mediaActionButtonStyle,
      opacity: disabled ? 0.65 : 1,
      ...style,
    }}
    title={description}
  >
    <span style={mediaActionIconStyle}>{icon}</span>
    <span style={mediaActionLabelStyle}>{displayLabel ?? label}</span>
  </button>
);

const NoticeDialog = ({
  tone,
  message,
  onClose,
}: {
  tone: 'success' | 'error';
  message: string;
  onClose: () => void;
}) => {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  const color = tone === 'error' ? 'var(--nl-danger)' : 'var(--nl-success)';
  const background = tone === 'error' ? 'rgba(255,118,148,0.14)' : 'rgba(var(--nl-success-rgb),0.14)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="操作提示"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        background: 'rgba(5,9,24,0.58)',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
      }}
    >
      <section
        style={{
          width: 'min(100%, 340px)',
          borderRadius: '22px',
          background: 'var(--nl-surface-strong)',
          border: '1px solid var(--nl-border)',
          boxShadow: 'var(--nl-shadow-float)',
          padding: '18px',
          display: 'grid',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ width: 38, height: 38, borderRadius: '999px', background, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon size={19} strokeWidth={2.3} />
          </span>
          <div style={{ display: 'grid', gap: '5px', minWidth: 0, flex: 1 }}>
            <strong style={{ color: 'var(--nl-ink)', fontSize: '16px', fontWeight: 900 }}>操作提示</strong>
            <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '14px', lineHeight: 1.65, fontWeight: 650 }}>{normalizePromptMessage(message)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            minHeight: '44px',
            border: 'none',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--nl-primary), var(--nl-primary-2))',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          知道了
        </button>
      </section>
    </div>
  );
};

type RenderableMediaPreview = {
  media_no: string;
  preview_url?: string | null;
  access_url?: string | null;
  media_type: string;
  original_name?: string | null;
  duration_seconds?: number | null;
  upload_status?: 'uploading' | 'ready' | 'failed';
  error_message?: string | null;
};

type FullscreenMediaPreview = RenderableMediaPreview & {
  preview_url?: string | null;
};

const mediaPreviewLabel = (mediaType: string) => {
  if (mediaType === 'video') return '视频预览';
  if (mediaType === 'audio') return '语音预览';
  return '照片预览';
};

const mediaPreviewHelp = (mediaType: string) => {
  if (mediaType === 'video') return '可直接播放确认画面和声音';
  if (mediaType === 'audio') return '可直接播放确认录音内容';
  return '可放大查看构图和清晰度';
};

const mediaFullscreenActionLabel = (mediaType: string) => {
  if (mediaType === 'video') return '全屏查看视频';
  if (mediaType === 'audio') return '全屏播放语音';
  return '全屏查看照片';
};

const mediaPreviewCardBaseStyle: CSSProperties = {
  position: 'relative',
  minHeight: '156px',
  borderRadius: '18px',
  overflow: 'hidden',
  border: '1px solid var(--nl-border)',
  background: 'var(--nl-surface-soft)',
  boxShadow: '0 8px 22px rgba(var(--nl-shadow-rgb),0.24)',
};

const MediaPreviewTile = ({
  media,
  compact,
  onRemove,
  onOpen,
}: {
  media: RenderableMediaPreview;
  compact?: boolean;
  onRemove?: (mediaNo: string) => void;
  onOpen?: (media: FullscreenMediaPreview) => void;
}) => {
  const mediaUrl = resolveMediaPreviewUrl(media.media_no, media.preview_url ?? media.access_url ?? null) ?? media.preview_url ?? media.access_url ?? '';
  const label = mediaPreviewLabel(media.media_type);
  const statusLabel = media.upload_status === 'uploading' ? '上传中' : media.upload_status === 'failed' ? '上传失败' : null;

  return (
    <div
      aria-label={label}
      title={mediaPreviewHelp(media.media_type)}
      style={{
        ...mediaPreviewCardBaseStyle,
        minHeight: compact ? '132px' : media.media_type === 'audio' ? '156px' : '168px',
        height: compact ? '132px' : media.media_type === 'audio' ? '156px' : '168px',
        borderRadius: compact ? '14px' : '18px',
      }}
    >
      {media.media_type === 'image' && mediaUrl ? (
        <img src={mediaUrl} alt={media.original_name ?? '已上传照片'} loading={compact ? 'lazy' : 'eager'} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : null}
      {media.media_type === 'video' && mediaUrl ? (
        <>
          <video src={mediaUrl} muted playsInline preload="none" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'var(--nl-surface-soft)' }} />
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--nl-ink)', pointerEvents: 'none' }}>
            <PlayCircle size={compact ? 34 : 42} strokeWidth={1.8} fill="rgba(var(--nl-primary-rgb),0.18)" />
          </span>
        </>
      ) : null}
      {media.media_type === 'audio' && mediaUrl ? (
        <div style={{ width: '100%', height: '100%', minHeight: compact ? '132px' : '156px', display: 'grid', alignContent: 'center', gap: '12px', padding: compact ? '14px' : '16px', background: 'var(--nl-surface-soft)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--nl-muted-strong)', fontSize: compact ? '12px' : '13px', fontWeight: 800, minWidth: 0 }}>
            <PlayCircle size={19} strokeWidth={2.2} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.original_name ?? '语音记录'}</span>
          </div>
          <audio src={mediaUrl} controls style={{ width: '100%', height: '32px' }} />
          {media.duration_seconds ? <span style={{ fontSize: '12px', color: '#a8a29e' }}>{media.duration_seconds} 秒</span> : null}
        </div>
      ) : null}
      {!mediaUrl || !['image', 'video', 'audio'].includes(media.media_type) ? (
        <div style={{ minHeight: compact ? '132px' : '156px', display: 'grid', placeItems: 'center', color: 'var(--nl-muted)', padding: '14px', boxSizing: 'border-box' }}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: '8px', textAlign: 'center' }}>
            <Image size={28} strokeWidth={1.8} />
            <span style={{ fontSize: '12px', fontWeight: 800 }}>{mediaTypeLabel(media.media_type)}</span>
          </div>
        </div>
      ) : null}
      {media.media_type !== 'audio' && mediaUrl ? (
        <span style={{ position: 'absolute', left: '10px', bottom: '10px', borderRadius: '999px', background: 'rgba(var(--nl-surface-rgb),0.9)', border: '1px solid var(--nl-border)', color: 'var(--nl-muted-strong)', padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>
          {label}
        </span>
      ) : null}
      {statusLabel ? (
        <span style={{ position: 'absolute', right: '10px', bottom: '10px', borderRadius: '999px', background: media.upload_status === 'failed' ? 'rgba(255,118,148,0.14)' : 'rgba(var(--nl-success-rgb),0.14)', color: media.upload_status === 'failed' ? 'var(--nl-danger)' : 'var(--nl-success)', border: '1px solid var(--nl-border)', padding: '6px 10px', fontSize: '11px', fontWeight: 850 }}>
          {statusLabel}
        </span>
      ) : null}
      {media.upload_status === 'failed' && media.error_message ? (
        <span style={{ position: 'absolute', left: '10px', right: '10px', top: '10px', borderRadius: '12px', background: 'rgba(255,118,148,0.16)', color: 'var(--nl-danger)', border: '1px solid rgba(255,118,148,0.24)', padding: '7px 9px', fontSize: '11px', lineHeight: 1.45, fontWeight: 750 }}>
          {media.error_message}
        </span>
      ) : null}
      {mediaUrl && onOpen ? (
          <button
            type="button"
            aria-label={mediaFullscreenActionLabel(media.media_type)}
            onClick={() => onOpen({ ...media, preview_url: mediaUrl })}
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '44px',
              height: '44px',
              borderRadius: '999px',
              border: '1px solid var(--nl-border)',
              background: 'rgba(var(--nl-surface-rgb),0.9)',
              color: 'var(--nl-ink)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
          <Maximize2 size={15} strokeWidth={2.4} />
        </button>
      ) : null}
      {onRemove ? (
          <button
            type="button"
            aria-label="移除媒体"
            onClick={() => onRemove(media.media_no)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '44px',
              height: '44px',
              borderRadius: '999px',
              border: '1px solid var(--nl-border)',
              background: 'rgba(var(--nl-surface-rgb),0.9)',
              color: 'var(--nl-ink)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
          <X size={15} strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  );
};

const MediaFullscreenDialog = ({
  media,
  onClose,
}: {
  media: FullscreenMediaPreview | null;
  onClose: () => void;
}) => {
  const mediaUrl = media ? resolveMediaPreviewUrl(media.media_no, media.preview_url ?? media.access_url ?? null) ?? media.preview_url ?? media.access_url ?? '' : '';
  const label = media ? mediaPreviewLabel(media.media_type) : '媒体预览';

  useEffect(() => {
    if (!media) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [media, onClose]);

  if (!media || !mediaUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`全屏${label}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(5,9,24,0.94)',
        display: 'grid',
        placeItems: 'center',
        padding: 'calc(42px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom))',
      }}
    >
      <button
        type="button"
        aria-label="关闭全屏预览"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 'calc(42px + env(safe-area-inset-top))',
          right: '12px',
          width: '44px',
          height: '44px',
          borderRadius: '999px',
          border: '1px solid var(--nl-border)',
          background: 'rgba(var(--nl-surface-rgb),0.74)',
          color: 'var(--nl-ink)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <X size={20} strokeWidth={2.4} />
      </button>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          padding: '42px 0 10px',
          boxSizing: 'border-box',
        }}
      >
        {media.media_type === 'image' ? (
          <img
            src={mediaUrl}
            alt={media.original_name ?? label}
            decoding="async"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', borderRadius: '10px' }}
          />
        ) : null}
        {media.media_type === 'video' ? (
          <video
            src={mediaUrl}
            controls
            autoPlay
            playsInline
            preload="auto"
            style={{ width: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', background: '#000000', borderRadius: '10px' }}
          />
        ) : null}
        {media.media_type === 'audio' ? (
          <div style={{ width: 'min(100%, 420px)', display: 'grid', gap: '16px', color: '#ffffff', textAlign: 'center' }}>
            <FileAudio size={44} strokeWidth={1.8} style={{ justifySelf: 'center' }} />
            <strong style={{ fontSize: '16px', fontWeight: 850 }}>{media.original_name ?? label}</strong>
            <audio src={mediaUrl} controls autoPlay style={{ width: '100%' }} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

const isGeneratedSvgAvatar = (src?: string | null) => Boolean(src?.trim().startsWith('data:image/svg+xml'));

const isNativeAppRuntime = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const normalizeImageExtension = (format?: string, mimeType?: string) => {
  const normalizedMime = normalizeMimeType(mimeType);
  if (normalizedMime.includes('png')) return 'png';
  if (normalizedMime.includes('webp')) return 'webp';
  if (normalizedMime.includes('heic')) return 'heic';
  if (normalizedMime.includes('heif')) return 'heif';
  const normalizedFormat = format?.toLowerCase().replace(/^\./, '').trim();
  if (normalizedFormat === 'jpg') return 'jpg';
  if (normalizedFormat && ['jpeg', 'png', 'webp', 'heic', 'heif'].includes(normalizedFormat)) return normalizedFormat;
  return 'jpeg';
};

const nativeImageToFile = async (asset: NativeImageAsset, prefix: 'camera' | 'gallery') => {
  if (!asset.webPath) {
    throw new Error('系统没有返回可读取的图片地址，请重试或改用相册选择。');
  }

  const response = await fetch(asset.webPath);
  if (!response.ok) {
    throw new Error('读取系统图片失败，请重试或改用相册选择。');
  }

  const blob = await response.blob();
  const normalizedType = normalizeMimeType(blob.type);
  const extension = normalizeImageExtension(asset.format, normalizedType);
  const mimeType = normalizedType || `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  return new File([blob], `nianlun-${prefix}-${Date.now()}.${extension}`, { type: mimeType });
};

const isNativePickerCancelled = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /cancel|cancelled|canceled|user cancelled|no image/i.test(message);
};

const formatLocationText = (location: LocationSuggestion) => {
  const name = location.name.trim();
  const address = location.address?.trim();
  if (location.source.endsWith('-regeo') && (address || name)) return normalizeLocationText(address || name);
  if (address && !name.includes(address) && !address.includes(name)) return `${name} · ${address}`;
  return normalizeLocationText(name || address || '当前位置');
};

const coordinateLocationPattern = /^(?:手机定位|当前位置)?\s*(?:[·:：-]\s*)?[-+]?\d{1,2}(?:\.\d{3,})?\s*,\s*[-+]?\d{1,3}(?:\.\d{3,})?$/;

const normalizeLocationText = (value?: string | null) => {
  const text = value?.trim() ?? '';
  if (!text) return '';
  return coordinateLocationPattern.test(text) ? '当前位置附近' : text;
};

const normalizeLocationSuggestions = (value?: LocationSuggestion[] | null) => (Array.isArray(value) ? value : []);

const splitTags = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const formatDateTimeDisplay = (value: string) => {
  if (!value) return '请选择发生时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '请选择发生时间';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay(date, today)) return `今天 ${time}`;
  if (sameDay(date, yesterday)) return `昨天 ${time}`;
  return date.toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

type RecordFormInitialValue = {
  child_no: string;
  record_type: string;
  title: string;
  content_text: string;
  media_nos: string[];
  media_items: MediaPreview[];
  tags: string;
  location_text: string;
  visibility_scope: string;
  event_time: string;
  status: string;
};

const normalizeRecordFormInitialValue = (value: RecordFormInitialValue): RecordFormInitialValue => {
  const looseValue = value as Partial<RecordFormInitialValue>;
  return {
    child_no: looseValue.child_no ?? '',
    record_type: looseValue.record_type || 'text',
    title: looseValue.title ?? '',
    content_text: looseValue.content_text ?? '',
    media_nos: Array.isArray(looseValue.media_nos) ? looseValue.media_nos : [],
    media_items: Array.isArray(looseValue.media_items) ? looseValue.media_items : [],
    tags: looseValue.tags ?? '',
    location_text: looseValue.location_text ?? '',
    visibility_scope: looseValue.visibility_scope || 'family',
    event_time: looseValue.event_time ?? '',
    status: looseValue.status || 'published',
  };
};

const RecordForm = ({
  mode,
  initialValue,
  initialFocus,
  initialMetricMode,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initialFocus?: 'media' | 'content' | null;
  initialMetricMode?: 'height' | null;
  initialValue: RecordFormInitialValue;
  onSubmit: (value: {
    child_no: string;
    record_type: string;
    title?: string;
    content_text?: string;
    media_nos?: string[];
    tags: string[];
    location_text?: string;
    visibility_scope?: string;
    event_time?: string;
    is_milestone?: boolean;
    status: string;
  }) => Promise<void>;
}) => {
  const navigate = useNavigate();
  const { activeChild, children } = useAuth();
  const normalizedInitialValue = useMemo(() => normalizeRecordFormInitialValue(initialValue), [initialValue]);
  const [form, setForm] = useState(normalizedInitialValue);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<'publish' | 'draft' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectorMessage, setSelectorMessage] = useState<string | null>(null);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [tagSelectValue, setTagSelectValue] = useState('');
  const [poiSuggestions, setPoiSuggestions] = useState<LocationSuggestion[]>([]);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiSearchFailed, setPoiSearchFailed] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [aiPreviewLoading, setAiPreviewLoading] = useState(false);
  const [aiPreviewSummary, setAiPreviewSummary] = useState<string | null>(null);
  const [aiPreviewTags, setAiPreviewTags] = useState<string[]>([]);
  const [heightValue, setHeightValue] = useState('');
  const [weightValue, setWeightValue] = useState('');
  const [metricNote, setMetricNote] = useState('');
  const [mediaNos, setMediaNos] = useState<string[]>(normalizedInitialValue.media_nos);
  const [mediaPreviews, setMediaPreviews] = useState<MediaPreview[]>(normalizedInitialValue.media_items);
  const [fullscreenMedia, setFullscreenMedia] = useState<FullscreenMediaPreview | null>(null);
  const mediaPreviewsRef = useRef<MediaPreview[]>(normalizedInitialValue.media_items);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const contentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const timeInputRef = useRef<HTMLInputElement | null>(null);
  const photoCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const videoCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const audioCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const audioLibraryInputRef = useRef<HTMLInputElement | null>(null);
  const selectedChildNoRef = useRef('');

  const currentChild = children.find((child) => child.child_no === form.child_no) ?? activeChild ?? children[0] ?? null;
  const currentChildName = currentChild?.name?.trim() || '请选择孩子';
  const currentChildAvatar = referenceAssets.childAvatar;
  const selectedTags = splitTags(form.tags);
  const isHeightRecord = mode === 'create' && initialMetricMode === 'height';

  useEffect(() => {
    if (!form.child_no && currentChild?.child_no) {
      setForm((current) => ({ ...current, child_no: currentChild.child_no }));
      setError((current) => (current === '发布前请选择孩子档案' ? null : current));
    }
  }, [currentChild?.child_no, form.child_no]);

  useEffect(() => {
    selectedChildNoRef.current = form.child_no || currentChild?.child_no || '';
  }, [currentChild?.child_no, form.child_no]);

  const waitForSelectedChildNo = async () => {
    if (selectedChildNoRef.current) return selectedChildNoRef.current;

    const startedAt = Date.now();
    while (!selectedChildNoRef.current && Date.now() - startedAt < 2000) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }

    return selectedChildNoRef.current;
  };

  useEffect(() => {
    const nextInitialValue = normalizeRecordFormInitialValue(initialValue);
    setForm(nextInitialValue);
    setMediaNos(nextInitialValue.media_nos);
    setMediaPreviews(nextInitialValue.media_items);
    if (initialMetricMode !== 'height') {
      setHeightValue('');
      setWeightValue('');
      setMetricNote('');
    }
  }, [initialMetricMode, initialValue]);

  useEffect(() => {
    mediaPreviewsRef.current = mediaPreviews;
  }, [mediaPreviews]);

  useEffect(() => {
    const keyword = form.location_text.trim();
    if (keyword.length < 2) {
      setPoiSuggestions([]);
      setPoiLoading(false);
      setPoiSearchFailed(false);
      return;
    }

    let cancelled = false;
    setPoiLoading(true);
    setPoiSearchFailed(false);
    const timer = window.setTimeout(() => {
      void webApi
        .searchLocations({ keyword })
        .then((result) => {
          if (!cancelled) {
            setPoiSuggestions(normalizeLocationSuggestions(result?.list));
            setPoiSearchFailed(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPoiSuggestions([]);
            setPoiSearchFailed(true);
            setSelectorMessage('地点搜索暂时不可用，可继续手动填写或选择常用地点。');
          }
        })
        .finally(() => {
          if (!cancelled) setPoiLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.location_text]);

  useEffect(() => {
    if (initialFocus === 'content') {
      titleInputRef.current?.focus({ preventScroll: true });
    }
    if (initialFocus === 'media') {
      titleInputRef.current?.blur();
      contentInputRef.current?.blur();
    }
  }, [initialFocus]);

  useEffect(() => {
    return () => {
      mediaPreviewsRef.current.forEach((item) => {
        if (item.is_local) {
          revokeObjectUrl(item.preview_url);
        }
      });
    };
  }, []);

  const switchChild = () => {
    if (!children.length) {
      navigate('/onboarding/child?mode=add');
      return;
    }

    if (children.length === 1) {
      navigate('/family/child');
      return;
    }

    const currentIndex = children.findIndex((child) => child.child_no === form.child_no);
    const nextChild = children[(currentIndex + 1 + children.length) % children.length];
    setForm((current) => ({ ...current, child_no: nextChild.child_no }));
    setSelectorMessage(`已切换为 ${nextChild.name}`);
  };

  const triggerMediaInput = (input: HTMLInputElement | null, message?: string) => {
    if (uploading || !input) return;
    setError(null);
    setSelectorMessage(message ?? null);
    input.value = '';
    input.click();
  };

  const persistConfirmedMediaPreview = async (mediaNo: string, file: File, mediaType: MediaType, objectUrl: string) => {
    if (mediaType !== 'image' && file.size > PERSISTABLE_NON_IMAGE_PREVIEW_BYTES) return;

    try {
      const persistedPreview = await createPersistableMediaPreview(file);
      if (!persistedPreview || !saveLocalMediaPreview(mediaNo, persistedPreview)) return;

      removeRuntimeMediaPreview(mediaNo);
      setMediaPreviews((current) =>
        current.map((item) =>
          item.media_no === mediaNo
            ? {
                ...item,
                preview_url: persistedPreview,
                is_local: false,
              }
            : item,
        ),
      );
      revokeObjectUrl(objectUrl);
    } catch {
      // Keep the runtime blob preview when a compact persisted preview cannot be generated.
    }
  };

  const uploadMediaFile = async (file: File) => {
    const childNo = form.child_no || currentChild?.child_no || (await waitForSelectedChildNo());
    if (!childNo) {
      setError('发布前请选择孩子档案');
      return;
    }

    const mediaType = deriveMediaType(file) as MediaType | null;
    if (!mediaType) {
      setError('暂不支持该媒体格式，请选择图片、视频或语音文件。');
      return;
    }

    const uploadFile = withResolvedFileMimeType(file);
    setUploading(true);
    setError(null);
    const pendingMediaNo = createPendingMediaNo();
    const previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(uploadFile) : '';
    if (previewUrl) saveRuntimeMediaPreview(pendingMediaNo, previewUrl);
    setMediaPreviews((current) => [
      ...current,
      {
        media_no: pendingMediaNo,
        preview_url: previewUrl,
        media_type: mediaType,
        original_name: uploadFile.name,
        is_local: Boolean(previewUrl),
        upload_status: 'uploading',
      },
    ]);

    try {
      const uploadToken = await webApi.createUploadToken({
        child_no: childNo,
        file_name: uploadFile.name,
        mime_type: resolveFileMimeType(uploadFile) || uploadFile.type,
        size_bytes: uploadFile.size,
        media_type: mediaType,
      });

      if (previewUrl) saveRuntimeMediaPreview(uploadToken.media_no, previewUrl);

      if (!uploadToken.mock_upload) {
        const uploadResponse = await fetch(uploadToken.upload_url, {
          method: uploadToken.method,
          headers: uploadToken.headers,
          body: uploadFile,
        });
        if (!uploadResponse.ok) {
          throw new Error(`媒体上传失败：HTTP ${uploadResponse.status}`);
        }
      }

      await webApi.confirmUpload({ media_no: uploadToken.media_no });
      setForm((current) => {
        if (mediaType === 'audio') return { ...current, record_type: 'audio' };
        if (mediaType === 'video') return { ...current, record_type: 'video' };
        if (current.record_type === 'text' || current.record_type === 'audio' || current.record_type === 'video') {
          return { ...current, record_type: 'mixed' };
        }
        return current;
      });
      setMediaNos((current) => [...current, uploadToken.media_no]);
      setMediaPreviews((current) =>
        current.map((item) =>
          item.media_no === pendingMediaNo
            ? {
                media_no: uploadToken.media_no,
                preview_url: previewUrl,
                media_type: mediaType,
                original_name: uploadFile.name,
                is_local: false,
                upload_status: 'ready',
              }
            : item,
        ),
      );
      removeRuntimeMediaPreview(pendingMediaNo);
      if (previewUrl) void persistConfirmedMediaPreview(uploadToken.media_no, uploadFile, mediaType, previewUrl);
    } catch (err) {
      removeRuntimeMediaPreview(pendingMediaNo);
      const message = err instanceof Error ? err.message : '上传失败';
      setMediaPreviews((current) =>
        current.map((item) =>
          item.media_no === pendingMediaNo
            ? {
                ...item,
                upload_status: 'failed',
                error_message: message,
              }
            : item,
        ),
      );
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    for (const file of files) {
      await uploadMediaFile(file);
    }
    event.target.value = '';
  };

  const uploadNativeImage = async (asset: NativeImageAsset, prefix: 'camera' | 'gallery') => {
    const file = await nativeImageToFile(asset, prefix);
    await uploadMediaFile(file);
  };

  const openNativePhotoCapture = async () => {
    if (!isNativeAppRuntime()) {
      triggerMediaInput(photoCaptureInputRef.current, '请在系统相机中拍照，保存后会自动加入记录。');
      return;
    }

    if (uploading) return;

    setError(null);
    setSelectorMessage('正在打开系统相机…');
    try {
      const photo = await Camera.getPhoto({
        quality: 86,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        saveToGallery: false,
        allowEditing: false,
        correctOrientation: true,
        presentationStyle: 'fullscreen',
        promptLabelHeader: '拍照记录',
        promptLabelCancel: '取消',
        promptLabelPicture: '打开相机',
        promptLabelPhoto: '从相册选择',
      });
      await uploadNativeImage(photo, 'camera');
      setSelectorMessage('已从系统相机加入照片。');
    } catch (err) {
      if (isNativePickerCancelled(err)) {
        setSelectorMessage(null);
        return;
      }
      setError(err instanceof Error ? `无法打开系统相机：${err.message}` : '无法打开系统相机，请检查相机权限后重试。');
      setSelectorMessage('也可以从相册选择已有照片。');
    }
  };

  const openNativeGalleryImages = async () => {
    if (!isNativeAppRuntime()) {
      triggerMediaInput(galleryInputRef.current, '请从相册选择照片或视频素材。');
      return;
    }

    if (uploading) return;

    setError(null);
    setSelectorMessage('正在打开系统相册…');
    try {
      const result = await Camera.pickImages({
        quality: 86,
        limit: 20,
        correctOrientation: true,
        presentationStyle: 'fullscreen',
      });
      if (!result.photos.length) {
        setSelectorMessage(null);
        return;
      }
      for (const photo of result.photos) {
        await uploadNativeImage(photo, 'gallery');
      }
      setSelectorMessage(`已从系统相册加入 ${result.photos.length} 张照片。`);
    } catch (err) {
      if (isNativePickerCancelled(err)) {
        setSelectorMessage(null);
        return;
      }
      setError(err instanceof Error ? `无法打开系统相册：${err.message}` : '无法打开系统相册，请检查照片权限后重试。');
      setSelectorMessage('如果需要添加视频，请使用“拍摄视频”或系统文件选择入口。');
    }
  };

  const removeMedia = (mediaNo: string) => {
    removeRuntimeMediaPreview(mediaNo);
    setMediaNos((current) => current.filter((item) => item !== mediaNo));
    setMediaPreviews((current) => {
      const removed = current.find((item) => item.media_no === mediaNo);
      if (removed?.is_local || removed?.preview_url?.startsWith('blob:')) {
        revokeObjectUrl(removed.preview_url);
      }
      return current.filter((item) => item.media_no !== mediaNo);
    });
  };

  const buildHeightRecordPayload = () => {
    const heightText = formatMetricNumber(heightValue);
    const weightText = formatMetricNumber(weightValue);
    const noteText = metricNote.trim();
    const title = heightText ? `${currentChildName}身高 ${heightText}cm` : form.title.trim();
    const contentLines = [
      heightText ? `身高：${heightText} cm` : null,
      weightText ? `体重：${weightText} kg` : null,
      noteText ? `备注：${noteText}` : null,
    ].filter(Boolean) as string[];
    const tags = new Set([...splitTags(form.tags), '身高记录']);
    if (weightText) tags.add('体重记录');

    return {
      title,
      contentText: contentLines.join('\n'),
      tags: Array.from(tags),
    };
  };

  const submitRecord = async (nextStatus = form.status) => {
    if (uploading) {
      setError('媒体还在上传，请等预览标记为完成后再发布。');
      return;
    }

    const childNo = form.child_no || currentChild?.child_no || (await waitForSelectedChildNo());
    const heightRecordPayload = isHeightRecord ? buildHeightRecordPayload() : null;
    if (nextStatus === 'published') {
      const title = heightRecordPayload?.title ?? form.title.trim();
      const contentText = heightRecordPayload?.contentText ?? form.content_text.trim();
      if (!childNo) {
        setError('发布前请选择孩子档案');
        return;
      }
      if (isHeightRecord && !formatMetricNumber(heightValue)) {
        setError('请先填写本次身高');
        return;
      }
      if (!title) {
        setError('发布前请填写标题');
        titleInputRef.current?.focus();
        return;
      }
      if (!contentText) {
        setError('发布前请填写正文');
        contentInputRef.current?.focus();
        return;
      }
      if (!form.event_time) {
        setError('发布前请选择发生时间');
        window.setTimeout(() => timeInputRef.current?.focus(), 0);
        return;
      }
      if (form.record_type === 'video' && mediaNos.length === 0) {
        setError('视频记录发布前请上传一段视频');
        return;
      }
      if (form.record_type === 'audio' && mediaNos.length === 0) {
        setError('语音记录发布前请录制或上传一段语音');
        return;
      }
    }

    setSubmitting(true);
    setPendingAction(nextStatus === 'draft' ? 'draft' : 'publish');
    setError(null);
    try {
      const nextRecordType = isHeightRecord ? 'text' : form.record_type === 'mixed' && mediaNos.length === 0 ? 'text' : form.record_type;
      const nextMediaNos = nextRecordType === 'text' ? [] : mediaNos;
      const locationText = normalizeLocationText(form.location_text);
      await onSubmit({
        child_no: childNo,
        record_type: nextRecordType,
        title: (heightRecordPayload?.title ?? form.title.trim()) || undefined,
        content_text: (heightRecordPayload?.contentText ?? form.content_text.trim()) || undefined,
        media_nos: nextMediaNos,
        tags: heightRecordPayload?.tags ?? splitTags(form.tags),
        location_text: locationText || undefined,
        visibility_scope: form.visibility_scope,
        event_time: form.event_time ? new Date(form.event_time).toISOString() : undefined,
        is_milestone: !isHeightRecord && form.record_type === 'milestone',
        status: nextStatus,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
      setPendingAction(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await submitRecord('published');
  };

  const addSelectedTag = (tag: string) => {
    if (!tag || selectedTags.includes(tag)) return;
    setForm((current) => ({ ...current, tags: [...selectedTags, tag].join(', ') }));
    setTagSelectValue('');
  };

  const removeSelectedTag = (tag: string) => {
    setForm((current) => ({ ...current, tags: splitTags(current.tags).filter((item) => item !== tag).join(', ') }));
  };

  const generateAiPreview = async () => {
    if (!form.title.trim() && !form.content_text.trim()) {
      setError('请先输入标题或正文，再使用 AI 建议');
      contentInputRef.current?.focus();
      return;
    }

    setAiPreviewLoading(true);
    setError(null);
    try {
      const preview = await webApi.previewAi({
        title: form.title.trim() || undefined,
        content_text: form.content_text.trim() || undefined,
        tags: selectedTags,
      });
      setForm((current) => ({
        ...current,
        title: current.title.trim() || preview.suggested_title || current.title,
        tags: Array.from(new Set([...splitTags(current.tags), ...preview.tags])).join(', '),
      }));
      setAiPreviewSummary(preview.summary);
      setAiPreviewTags(preview.tags);
      setSelectorMessage('AI 已生成标题建议、摘要和标签，可继续编辑后发布。');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 建议生成失败');
    } finally {
      setAiPreviewLoading(false);
    }
  };

  const safePoiSuggestions = normalizeLocationSuggestions(poiSuggestions);
  const filteredLocationOptions = locationOptions.filter((item) => item.includes(form.location_text.trim()) || form.location_text.trim().includes(item));
  const mergedLocationSuggestions: LocationSuggestion[] = [
    ...filteredLocationOptions.map((name, index) => ({
      id: `local-${index}-${name}`,
      name,
      address: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null,
      source: 'local',
    })),
    ...safePoiSuggestions.filter((suggestion) => !filteredLocationOptions.includes(suggestion.name)),
  ].slice(0, 5);
  const manualLocationText = normalizeLocationText(form.location_text);
  const hasManualLocationSuggestion =
    manualLocationText.length >= 2 &&
    !mergedLocationSuggestions.some((location) => {
      const locationText = formatLocationText(location);
      return locationText === manualLocationText || location.name.trim() === manualLocationText;
    });
  const showMediaSection = !isHeightRecord && form.record_type !== 'text';
  const showPhotoVideoAction = showMediaSection && form.record_type !== 'audio';
  const showAudioAction = showMediaSection && form.record_type !== 'video';
  const photoVideoAccept =
    form.record_type === 'video'
      ? 'video/*,video/mp4,video/webm,video/quicktime,video/3gpp'
      : 'image/*,video/*,image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/3gpp';
  const mediaHint =
    form.record_type === 'video'
      ? '支持常见视频格式'
      : form.record_type === 'audio'
        ? '支持常见音频格式'
        : form.record_type === 'mixed'
          ? '可选，支持图片、视频和语音'
          : '支持图片、视频和语音';
  const emptyMediaPreviewLabel = form.record_type === 'mixed' ? '可不添加' : '尚未添加';
  const noticeMessage = error ?? selectorMessage;

  const useCurrentLocation = async () => {
    setLocationLoading(true);
    setError(null);
    setSelectorMessage('正在请求手机定位…');
    try {
      const location = await getCurrentDeviceLocation();
      const accuracyText = location.accuracy ? `，精度约 ${Math.round(location.accuracy)} 米` : '';
      const nearby = await webApi.searchLocations({
        keyword: '附近地点',
        latitude: location.latitude,
        longitude: location.longitude,
      }).catch(() => null);
      const nearbySuggestions = normalizeLocationSuggestions(nearby?.list);
      setPoiSuggestions(nearbySuggestions.slice(0, 5));
      const nearestLocation = nearbySuggestions.find((item) => item.name.trim() || item.address?.trim());
      const locationText = nearestLocation ? formatLocationText(nearestLocation) : '当前位置';
      setForm((current) => ({ ...current, location_text: locationText }));
      setSelectorMessage(
        nearestLocation
          ? `已读取手机定位${accuracyText}，已填入「${locationText}」。`
          : `已读取手机定位${accuracyText}，但暂未解析到中文地址，已标记为当前位置，可手动补充。`,
      );
    } catch (error) {
      setSelectorMessage(error instanceof Error ? error.message : '定位失败，请检查手机定位服务和应用定位权限。');
    } finally {
      setLocationLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #050918 0%, #0b1130 52%, #050918 100%)',
        color: 'var(--nl-ink)',
        padding: '0 16px calc(86px + env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
        <AppTopBar
          title={isHeightRecord ? '记录身高' : mode === 'create' ? '记录时光' : '编辑记录'}
          backLabel={mode === 'create' ? '取消' : '返回'}
          backVariant={mode === 'create' ? 'text' : 'icon'}
          onBack={() => {
            if (mode === 'create') {
              navigate('/home');
              return;
            }
            navigate(-1);
          }}
          background="rgba(5, 9, 24, 0.88)"
          style={{ position: 'relative', top: 'auto', margin: '0 -16px 8px', padding: 'calc(28px + env(safe-area-inset-top)) 16px 10px' }}
          action={
            <button
              type="submit"
              form="record-form"
              aria-label={mode === 'create' ? '发布' : '保存'}
              style={{
                minHeight: '44px',
                border: 'none',
                background: 'transparent',
                color: 'var(--nl-primary)',
                padding: '0 2px',
                fontSize: '15px',
                fontWeight: 850,
                cursor: submitting || uploading ? 'not-allowed' : 'pointer',
                opacity: submitting || uploading ? 0.72 : 1,
              }}
              disabled={submitting || uploading}
            >
              {pendingAction === 'publish' ? (mode === 'create' ? '发布中…' : '保存中…') : mode === 'create' ? '发布' : '保存'}
            </button>
          }
        />
        <form id="record-form" onSubmit={handleSubmit} style={{ ...rowStyle, gap: '10px', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
          <section
            style={{
              order: 0,
              padding: '0 2px 9px',
              background: 'transparent',
              borderBottom: '1px solid var(--nl-border)',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <button
              type="button"
              aria-label={`切换孩子：${currentChildName}`}
              onClick={switchChild}
              style={{
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                padding: 0,
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '999px',
                  background: currentChildAvatar ? 'var(--nl-surface-soft)' : 'rgba(var(--nl-accent-rgb),0.14)',
                  border: '1px solid var(--nl-border)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--nl-accent)',
                  fontWeight: 800,
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {currentChildAvatar ? <img src={currentChildAvatar} alt={currentChildName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (currentChild?.name?.slice(0, 1) ?? '宝')}
              </div>
              <span style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
                <strong style={{ fontSize: '15px', color: 'var(--nl-ink)', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentChildName}</strong>
                <span style={{ fontSize: '12px', color: 'var(--nl-muted)', lineHeight: 1.4, fontWeight: 650 }}>记录对象</span>
              </span>
            </button>
            <label
              style={{
                position: 'relative',
                minHeight: '44px',
                borderRadius: '999px',
                border: '1px solid var(--nl-border)',
                background: 'rgba(var(--nl-surface-rgb),0.74)',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '0 10px',
                boxSizing: 'border-box',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={() => {
                const picker = timeInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
                try {
                  picker?.showPicker?.();
                } catch {
                  picker?.focus();
                }
              }}
            >
              <input
                ref={timeInputRef}
                className="app-date-time-input"
                aria-label="发生时间 *"
                style={{ position: 'fixed', left: '-100vw', top: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', colorScheme: 'light', background: 'transparent' }}
                type="datetime-local"
                value={form.event_time}
                onChange={(event) => {
                  setError(null);
                  setForm((current) => ({ ...current, event_time: event.target.value }));
                }}
              />
              <Clock size={14} strokeWidth={2.2} color="var(--nl-muted)" />
              <span style={{ flex: 1, minWidth: 0, color: form.event_time ? 'var(--nl-ink)' : 'var(--nl-muted)', fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
                {form.event_time ? formatDateTimeDisplay(form.event_time) : '选择时间'}
              </span>
            </label>
          </section>

          {isHeightRecord ? (
            <section
              style={{
                order: 1,
                display: 'grid',
                gap: '13px',
                borderRadius: '20px',
                border: '1px solid var(--nl-border)',
                background: 'var(--nl-surface)',
                padding: '15px 16px 16px',
              }}
            >
              <div style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '13px', background: 'rgba(var(--nl-accent-rgb),0.14)', color: 'var(--nl-accent)', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 0 18px rgba(var(--nl-accent-rgb),0.18)' }}>
                  <Ruler size={18} strokeWidth={2.3} />
                </span>
                <span style={{ minWidth: 0, display: 'grid', gap: '3px' }}>
                  <strong style={{ color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 900 }}>身高记录</strong>
                  <span style={{ color: 'var(--nl-muted)', fontSize: '12px', lineHeight: 1.45, fontWeight: 650 }}>记录本次测量结果，发布后会进入最近记录和时间轴。</span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                <label style={{ display: 'grid', gap: '7px', minWidth: 0 }}>
                  <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 850 }}>身高 cm</span>
                  <input
                    aria-label="身高 cm"
                    inputMode="decimal"
                    value={heightValue}
                    onChange={(event) => {
                      setError(null);
                      setHeightValue(normalizeMetricInput(event.target.value));
                    }}
                    placeholder="例如 92.5"
                    style={{ ...inputStyle, minHeight: '48px', borderRadius: '16px', fontWeight: 850 }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '7px', minWidth: 0 }}>
                  <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 850 }}>体重 kg</span>
                  <input
                    aria-label="体重 kg"
                    inputMode="decimal"
                    value={weightValue}
                    onChange={(event) => {
                      setError(null);
                      setWeightValue(normalizeMetricInput(event.target.value));
                    }}
                    placeholder="可选"
                    style={{ ...inputStyle, minHeight: '48px', borderRadius: '16px', fontWeight: 850 }}
                  />
                </label>
              </div>
              <label style={{ display: 'grid', gap: '7px' }}>
                <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 850 }}>备注</span>
                <textarea
                  aria-label="身高记录备注"
                  value={metricNote}
                  onChange={(event) => {
                    setError(null);
                    setMetricNote(event.target.value);
                  }}
                  placeholder="例如早晨测量、穿薄衣、最近长高很明显"
                  style={{ ...inputStyle, minHeight: '82px', resize: 'none', lineHeight: 1.65, borderRadius: '16px' }}
                />
              </label>
            </section>
          ) : null}

          {showMediaSection ? (
            <section
              style={{
                order: 2,
                display: 'grid',
                gap: '8px',
                borderRadius: '20px',
                border: '1px solid var(--nl-border)',
                background: 'rgba(var(--nl-surface-rgb),0.72)',
                padding: '11px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
                <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 900 }}>{form.record_type === 'mixed' ? '素材（可选）' : '素材'}</strong>
                <span style={{ minWidth: 0, color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 750, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{uploading ? '正在上传…' : mediaHint}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: showPhotoVideoAction && showAudioAction ? 'repeat(5, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
                {showPhotoVideoAction ? (
                  form.record_type === 'video' ? (
                    <>
                      <MediaActionButton icon={<Video size={17} strokeWidth={2.2} />} label="拍摄视频" displayLabel="视频" description="打开系统相机录制" onClick={() => triggerMediaInput(videoCaptureInputRef.current, '请在系统相机中完成拍摄，保存后会自动加入记录。')} disabled={uploading} />
                      <MediaActionButton icon={<ImagePlus size={17} strokeWidth={2.2} />} label="从相册选择" displayLabel="相册" description="导入已有视频素材" onClick={() => triggerMediaInput(galleryInputRef.current, '请从相册选择视频素材。')} disabled={uploading} />
                    </>
                  ) : (
                    <>
                      <MediaActionButton icon={<ImagePlus size={17} strokeWidth={2.2} />} label="拍照记录" displayLabel="拍照" description="打开原生相机拍照" onClick={() => void openNativePhotoCapture()} disabled={uploading} />
                      <MediaActionButton icon={<Image size={17} strokeWidth={2.2} />} label="从相册添加" displayLabel="相册" description="原生相册多选照片" onClick={() => void openNativeGalleryImages()} disabled={uploading} />
                      <MediaActionButton icon={<Video size={17} strokeWidth={2.2} />} label="拍摄视频" displayLabel="视频" description="打开系统相机录像" onClick={() => triggerMediaInput(videoCaptureInputRef.current, '请在系统相机中完成拍摄，保存后会自动加入记录。')} disabled={uploading} />
                    </>
                  )
                ) : null}
                {showAudioAction ? (
                  <>
                    <MediaActionButton icon={<Mic size={17} strokeWidth={2.2} />} label="录制语音" displayLabel="录音" description="打开系统录音入口" onClick={() => triggerMediaInput(audioCaptureInputRef.current, '请使用系统录音入口录制，保存后会自动加入记录。')} disabled={uploading} />
                    <MediaActionButton icon={<FileAudio size={17} strokeWidth={2.2} />} label="上传语音" displayLabel="上传" description="选择已有录音或音频" onClick={() => triggerMediaInput(audioLibraryInputRef.current, '请选择已有录音或音频文件。')} disabled={uploading} />
                  </>
                ) : null}
              </div>

              <section
                aria-label="媒体预览"
                style={{
                  borderRadius: '14px',
                  border: mediaPreviews.length ? '1px solid var(--nl-border)' : 'none',
                  background: mediaPreviews.length ? 'rgba(var(--nl-surface-rgb),0.58)' : 'transparent',
                  padding: mediaPreviews.length ? '8px' : 0,
                  display: 'grid',
                  gap: '8px',
                }}
              >
                {mediaPreviews.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                    {mediaPreviews.map((media) => (
                      <MediaPreviewTile key={media.media_no} media={media} compact onRemove={removeMedia} onOpen={setFullscreenMedia} />
                    ))}
                  </div>
                ) : (
                  <div
                    data-testid="record-media-preview-empty"
                    style={{
                      minHeight: '42px',
                      borderRadius: '12px',
                      border: '1px dashed var(--nl-border)',
                      background: 'rgba(var(--nl-surface-rgb),0.52)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '0 12px',
                      color: 'var(--nl-muted)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 800 }}>
                      <ImagePlus size={15} strokeWidth={2.2} />
                      媒体预览
                    </span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: 650 }}>{mediaPreviews.length ? `${mediaPreviews.length} 个素材` : emptyMediaPreviewLabel}</span>
                  </div>
                )}
              </section>

              <input ref={photoCaptureInputRef} aria-label="拍照记录" type="file" accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={(event) => void onFileChange(event)} disabled={uploading} style={{ display: 'none' }} />
              <input ref={videoCaptureInputRef} aria-label="拍摄视频" type="file" accept="video/*,video/mp4,video/webm,video/quicktime,video/3gpp" capture="environment" onChange={(event) => void onFileChange(event)} disabled={uploading} style={{ display: 'none' }} />
              <input ref={galleryInputRef} aria-label={form.record_type === 'video' ? '从相册选择视频' : '从相册添加'} type="file" accept={photoVideoAccept} multiple onChange={(event) => void onFileChange(event)} disabled={uploading} style={{ display: 'none' }} />
              <input ref={audioCaptureInputRef} aria-label="录制语音" type="file" accept="audio/*,audio/mpeg,audio/mp4,audio/m4a,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/3gpp,audio/amr" capture onChange={(event) => void onFileChange(event)} disabled={uploading} style={{ display: 'none' }} />
              <input ref={audioLibraryInputRef} aria-label="上传语音" type="file" accept="audio/*,audio/mpeg,audio/mp4,audio/m4a,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/3gpp,audio/amr" onChange={(event) => void onFileChange(event)} disabled={uploading} style={{ display: 'none' }} />
            </section>
          ) : null}

          {!isHeightRecord ? (
          <div style={{ order: 1, display: 'grid', gap: '10px', borderRadius: '20px', border: '1px solid var(--nl-border)', background: 'rgba(var(--nl-surface-rgb),0.72)', padding: '13px 15px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--nl-border)', paddingBottom: '10px' }}>
              <input
                ref={titleInputRef}
                className="record-title-input"
                style={{
                  width: '100%',
                  minWidth: 0,
                  minHeight: '36px',
                  border: 'none',
                  padding: '6px 0',
                  fontSize: '16px',
                  fontWeight: 800,
                  lineHeight: 1.35,
                  color: 'var(--nl-ink)',
                  outline: 'none',
                  background: 'transparent',
                  boxSizing: 'border-box',
                }}
                placeholder="给这一刻起个名字"
                value={form.title}
                onChange={(event) => {
                  setError(null);
                  setForm((current) => ({ ...current, title: event.target.value }));
                }}
              />
              <button
                type="button"
                aria-label="AI 智能建议"
                onClick={() => void generateAiPreview()}
                disabled={aiPreviewLoading}
                style={{
                  minHeight: '34px',
                  border: '1px solid var(--nl-border)',
                  borderRadius: '999px',
                  background: 'rgba(var(--nl-surface-rgb),0.74)',
                  color: 'var(--nl-ink)',
                  padding: '7px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: aiPreviewLoading ? 'not-allowed' : 'pointer',
                  opacity: aiPreviewLoading ? 0.72 : 1,
                  boxShadow: 'none',
                }}
              >
                <Sparkles size={14} strokeWidth={2.2} />
                {aiPreviewLoading ? '整理中…' : 'AI 整理'}
              </button>
            </div>
            <textarea
              ref={contentInputRef}
              className="record-body-input"
              style={{
                width: '100%',
                minHeight: '104px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                background: 'transparent',
                padding: 0,
                fontSize: '15px',
                lineHeight: 1.9,
                color: 'var(--nl-muted-strong)',
                boxSizing: 'border-box',
              }}
              placeholder="在想什么呢？记录一下这一刻发生的故事…"
              value={form.content_text}
              onChange={(event) => {
                setError(null);
                setForm((current) => ({ ...current, content_text: event.target.value }));
              }}
            />
            {aiPreviewSummary || aiPreviewTags.length ? (
              <section
                style={{
                  borderRadius: '18px',
                  background: 'rgba(var(--nl-primary-rgb),0.14)',
                  border: '1px solid var(--nl-border)',
                  padding: '14px 14px 13px',
                  display: 'grid',
                  gap: '10px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#818cf8' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '2px' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '999px', background: 'rgba(var(--nl-accent-rgb),0.14)', color: 'var(--nl-accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Sparkles size={15} strokeWidth={2.2} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--nl-ink)', fontSize: '12px', fontWeight: 800 }}>AI 智能建议</strong>
                    {aiPreviewSummary ? <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '13px', lineHeight: 1.7 }}>{aiPreviewSummary}</p> : null}
                  </div>
                </div>
                {aiPreviewTags.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', paddingLeft: '38px' }}>
                    {aiPreviewTags.map((tag, index) => (
                      <span key={`${tag}-${index}`} style={{ borderRadius: '999px', background: 'rgba(var(--nl-surface-rgb),0.72)', border: '1px solid var(--nl-border)', color: 'var(--nl-accent)', padding: '5px 9px', fontSize: '11px', fontWeight: 700 }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
          ) : null}

          <div style={{ order: 3, display: 'grid', gap: '8px', borderRadius: '20px', border: '1px solid var(--nl-border)', background: 'rgba(var(--nl-surface-rgb),0.72)', padding: '12px 13px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 850 }}>更多设置</span>
              <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 750 }}>可选</span>
            </div>
            <button
              type="button"
              aria-expanded={visibilityOpen}
              onClick={() => {
                setVisibilityOpen((current) => !current);
                setSelectorMessage(null);
              }}
              style={{
                minHeight: '44px',
                borderRadius: '15px',
                border: '1px solid var(--nl-border)',
                background: visibilityOpen ? 'rgba(var(--nl-primary-rgb),0.14)' : 'rgba(var(--nl-surface-rgb),0.74)',
                padding: '0 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: 'none',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--nl-ink)', fontSize: '13px', fontWeight: 800 }}>
                <Eye size={16} strokeWidth={2.2} />
                可见范围
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--nl-ink)', fontSize: '13px', fontWeight: 800 }}>
                家庭成员可见
                <ChevronRight size={16} strokeWidth={2.2} style={{ transform: visibilityOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.16s ease' }} />
              </span>
            </button>
            {visibilityOpen ? (
              <div
                style={{
                  borderRadius: '16px',
                  border: '1px solid var(--nl-border)',
                  background: 'rgba(var(--nl-surface-rgb),0.58)',
                  padding: '10px',
                  display: 'grid',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  aria-pressed="true"
                  style={{
                    width: '100%',
                    border: '1px solid var(--nl-border)',
                    borderRadius: '14px',
                    background: 'rgba(var(--nl-surface-rgb),0.74)',
                    color: 'var(--nl-ink)',
                    padding: '12px 13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: 'none',
                  }}
                  onClick={() => {
                    setForm((current) => ({ ...current, visibility_scope: 'family' }));
                    setSelectorMessage('已设为家庭成员可见。');
                  }}
                >
                  <span style={{ display: 'grid', gap: '3px' }}>
                    <span>家庭成员可见</span>
                    <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 600 }}>与后台权限保持一致，家庭成员可查看这条记录。</span>
                  </span>
                  <Check size={18} strokeWidth={2.5} color="var(--nl-accent)" />
                </button>
                <p style={{ ...helperTextStyle, lineHeight: 1.65 }}>当前记录默认仅对家庭成员可见，和家庭成员角色权限保持一致。</p>
              </div>
            ) : null}

            <section style={{ display: 'grid', gap: '8px' }}>
              <div
                style={{
                  minHeight: '46px',
                  borderRadius: '15px',
                  border: '1px solid var(--nl-border)',
                  background: 'rgba(var(--nl-surface-rgb),0.66)',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  alignItems: 'stretch',
                  overflow: 'hidden',
                }}
              >
                <label style={{ position: 'relative', minWidth: 0, display: 'flex', alignItems: 'center' }}>
                  <MapPin size={15} strokeWidth={2.2} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--nl-muted)', pointerEvents: 'none' }} />
                  <input
                    aria-label="搜索地点"
                    style={{
                      width: '100%',
                      minWidth: 0,
                      minHeight: '46px',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: 'var(--nl-ink)',
                      padding: '0 10px 0 38px',
                      boxSizing: 'border-box',
                      fontSize: '13px',
                      fontWeight: 800,
                    }}
                    value={form.location_text}
                    onChange={(event) => {
                      setError(null);
                      setSelectorMessage(null);
                      setForm((current) => ({ ...current, location_text: event.target.value }));
                    }}
                    placeholder="添加地点"
                  />
                </label>
                <button
                  type="button"
                  aria-label="手机定位"
                  style={{
                    minWidth: '68px',
                    minHeight: '46px',
                    border: 'none',
                    borderLeft: '1px solid var(--nl-border)',
                    background: 'transparent',
                    color: 'var(--nl-accent)',
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    fontWeight: 850,
                    cursor: locationLoading ? 'not-allowed' : 'pointer',
                    opacity: locationLoading ? 0.72 : 1,
                  }}
                  onClick={() => void useCurrentLocation()}
                  disabled={locationLoading}
                >
                  <MapPin size={13} strokeWidth={2.2} />
                  {locationLoading ? '定位中' : '定位'}
                </button>
              </div>

              {form.location_text.trim() || poiLoading ? (
                <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', paddingTop: '1px' }}>
                  {hasManualLocationSuggestion ? (
                    <button
                      type="button"
                      aria-label={`使用手动地点：${manualLocationText}`}
                      style={{ ...compactPillButtonStyle, minHeight: '36px', padding: '6px 10px', fontSize: '11px' }}
                      onClick={() => {
                        setForm((current) => ({ ...current, location_text: manualLocationText }));
                        setSelectorMessage(
                          poiSearchFailed
                            ? `已使用手动填写的地点「${manualLocationText}」，地图恢复后可再搜索更精确地址。`
                            : `已使用手动填写的地点「${manualLocationText}」。`,
                        );
                      }}
                    >
                      使用：{manualLocationText}
                    </button>
                  ) : null}
                  {mergedLocationSuggestions.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      style={{ ...compactPillButtonStyle, minHeight: '36px', padding: '6px 10px', fontSize: '11px' }}
                      title={[location.name, location.district, location.address].filter(Boolean).join(' · ')}
                      onClick={() => {
                        setForm((current) => ({ ...current, location_text: formatLocationText(location) }));
                        setSelectorMessage(location.source === 'amap' ? '已选择地图搜索结果。' : null);
                      }}
                    >
                      {location.name}
                    </button>
                  ))}
                  {poiLoading ? <span style={{ ...helperTextStyle, alignSelf: 'center' }}>搜索地点中…</span> : null}
                </div>
              ) : null}

              <div style={{ position: 'relative' }}>
                <Tag size={15} strokeWidth={2.2} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--nl-muted)', pointerEvents: 'none', zIndex: 1 }} />
                <AppSelect
                  aria-label="选择标签"
                  value={tagSelectValue}
                  onChange={(event) => {
                    setTagSelectValue(event.target.value);
                    addSelectedTag(event.target.value);
                  }}
                  selectStyle={{
                    ...metadataIconSelectStyle,
                    minHeight: '46px',
                    borderRadius: '15px',
                    border: '1px solid var(--nl-border)',
                    background: 'rgba(var(--nl-surface-rgb),0.66)',
                    padding: '0 13px 0 38px',
                    fontSize: '13px',
                    fontWeight: 800,
                    boxShadow: 'none',
                  }}
                >
                  <option value="">添加标签</option>
                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag} disabled={selectedTags.includes(tag)}>
                      {tag}
                    </option>
                  ))}
                </AppSelect>
              </div>

              {selectedTags.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', paddingTop: '1px' }}>
                  {selectedTags.map((tag, index) => (
                    <button key={`${tag}-${index}`} type="button" onClick={() => removeSelectedTag(tag)} style={{ ...selectedChipButtonStyle, minHeight: '34px', padding: '5px 9px', fontSize: '11px' }}>
                      #{tag}
                      <X size={12} strokeWidth={2.4} />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <button
            type="button"
            aria-label="切换里程碑记录"
            aria-pressed={form.record_type === 'milestone'}
            style={{
              order: 4,
              width: '100%',
              minHeight: '50px',
              border: form.record_type === 'milestone' ? '1px solid rgba(var(--nl-primary-rgb),0.42)' : '1px solid var(--nl-border)',
              borderRadius: '18px',
              background: form.record_type === 'milestone' ? 'rgba(var(--nl-primary-rgb),0.16)' : 'var(--nl-surface)',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'left',
              cursor: 'pointer',
              boxShadow: 'none',
            }}
            onClick={() => setForm((current) => ({ ...current, record_type: current.record_type === 'milestone' ? 'mixed' : 'milestone' }))}
          >
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '12px',
                background: form.record_type === 'milestone' ? 'rgba(var(--nl-primary-rgb),0.2)' : 'rgba(var(--nl-surface-rgb),0.74)',
                display: 'grid',
                placeItems: 'center',
                color: form.record_type === 'milestone' ? 'var(--nl-primary-2)' : 'var(--nl-muted)',
                flexShrink: 0,
                boxShadow: form.record_type === 'milestone' ? 'inset 0 -1px 0 rgba(var(--nl-primary-rgb),0.18)' : 'none',
              }}
            >
              <Star size={18} strokeWidth={2.3} fill={form.record_type === 'milestone' ? 'currentColor' : 'none'} />
            </span>
            <span style={{ display: 'grid', gap: '3px', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '13px', fontWeight: 850, color: 'var(--nl-ink)' }}>里程碑</span>
            </span>
            <span
              aria-hidden="true"
              style={{
                minWidth: '58px',
                minHeight: '32px',
                borderRadius: '999px',
                background: form.record_type === 'milestone' ? 'linear-gradient(135deg, var(--nl-primary), var(--nl-primary-2))' : 'rgba(var(--nl-surface-rgb),0.74)',
                color: form.record_type === 'milestone' ? '#ffffff' : 'var(--nl-muted)',
                border: form.record_type === 'milestone' ? '1px solid var(--nl-primary)' : '1px solid var(--nl-border)',
                padding: '7px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 850,
                flexShrink: 0,
              }}
            >
              {form.record_type === 'milestone' ? '已标记' : '标记'}
            </span>
          </button>

          {mediaNos.length ? <p style={{ ...helperTextStyle, order: 5 }}>已选择 {mediaNos.length} 个媒体，将随记录一起保存。</p> : null}
          {uploading ? <p style={{ ...helperTextStyle, order: 5 }}>正在上传媒体…</p> : null}

        </form>
        {noticeMessage ? (
          <NoticeDialog
            tone={error ? 'error' : 'success'}
            message={noticeMessage}
            onClose={() => {
              if (error) {
                setError(null);
                return;
              }
              setSelectorMessage(null);
            }}
          />
        ) : null}
        <MediaFullscreenDialog media={fullscreenMedia} onClose={() => setFullscreenMedia(null)} />
    </div>
  );
};

export const CreateRecordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeChild } = useAuth();
  const [defaultEventTime] = useState(() => formatDateTimeLocal(new Date().toISOString()));
  const requestedType = searchParams.get('type');
  const requestedFocus = searchParams.get('focus');
  const initialMetricMode = requestedType === 'height' ? 'height' : null;
  const initialRecordType = initialMetricMode ? 'text' : ['mixed', 'text', 'video', 'audio', 'milestone'].includes(requestedType ?? '') ? requestedType! : 'mixed';
  const initialFocus = requestedFocus === 'media' || requestedFocus === 'content' ? requestedFocus : null;
  const initialValue = useMemo(() => ({
    child_no: activeChild?.child_no ?? '',
    record_type: initialRecordType,
    title: '',
    content_text: '',
    media_nos: [],
    media_items: [],
    tags: '',
    location_text: '',
    visibility_scope: 'family',
    event_time: defaultEventTime,
    status: 'published',
  }), [activeChild?.child_no, defaultEventTime, initialRecordType]);

  return (
    <RecordForm
      mode="create"
      initialFocus={initialFocus}
      initialMetricMode={initialMetricMode}
      initialValue={initialValue}
      onSubmit={async (value) => {
        const record = await webApi.createRecord(value);
        navigate(`/record/${record.record_no}`, { replace: true });
      }}
    />
  );
};

export const ViewRecordPage = () => {
  const navigate = useNavigate();
  const params = useParams<{ record_no: string }>();
  const { data, loading, error, setData } = useAsyncData<RecordDetail | null>(
    async () => {
      if (!params.record_no) return null;
      return webApi.detailRecord(params.record_no);
    },
    [params.record_no],
  );
  const [aiJob, setAiJob] = useState<AiJobDetail | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiActionLabel, setAiActionLabel] = useState('AI 摘要');
  const [aiError, setAiError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<FullscreenMediaPreview | null>(null);

  useEffect(() => {
    if (!aiJob || !['pending', 'processing'].includes(aiJob.status)) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const next = await webApi.detailAiJob(aiJob.job_no);
        if (cancelled) return;
        setAiJob(next);
        if (next.status === 'success' && params.record_no) {
          const refreshed = await webApi.detailRecord(params.record_no);
          if (!cancelled) {
            setData(refreshed);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setAiError(err instanceof Error ? err.message : 'AI 状态查询失败');
        }
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [aiJob, params.record_no, setData]);

  const onGenerateAi = async (
    jobType: 'record_title' | 'record_summary' | 'record_tags',
    actionLabel: string,
    fallbackError: string,
  ) => {
    if (!data || !params.record_no) return;
    setAiLoading(true);
    setAiActionLabel(actionLabel);
    setAiError(null);
    try {
      const result = await webApi.createAiJob(params.record_no, { job_types: [jobType] });
      setAiJob(result.list[0] ?? null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setAiLoading(false);
    }
  };

  const onDelete = async () => {
    if (!data) return;
    const confirmed = window.confirm('确认删除这条记录吗？删除后将从时间轴中移除。');
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await webApi.deleteRecord(data.record_no);
      navigate('/timeline', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const primaryMedia = data?.media_list[0] ?? null;
  const primaryMediaUrl = primaryMedia ? resolveMediaPreviewUrl(primaryMedia.media_no, primaryMedia.access_url) ?? primaryMedia.access_url : null;
  const primaryFullscreenMedia = primaryMedia && primaryMediaUrl ? { ...primaryMedia, preview_url: primaryMediaUrl } : null;
  const aiJobSuggestedTitle =
    aiJob?.status === 'success' && aiJob.job_type === 'record_title' && typeof aiJob.output_json?.suggested_title === 'string'
      ? aiJob.output_json.suggested_title.trim()
      : null;
  const generatedTitle = data?.ai_generated_title?.trim() || aiJobSuggestedTitle || null;
  const displayTitle = data ? (data.title?.trim() || generatedTitle || '未命名记录') : '未命名记录';
  const aiJobProcessing = aiJob?.status === 'pending' || aiJob?.status === 'processing';

  return (
    <PageShell
      title="记录详情"
      backTo="/timeline"
      onBack={() => {
        if (window.history.length > 1) {
          navigate(-1);
          return;
        }
        navigate('/timeline');
      }}
    >
      {loading ? <Panel><EmptyState message="正在加载记录详情…" /></Panel> : null}
      {error ? <Panel><EmptyState message={`加载失败：${error}`} /></Panel> : null}
      {data ? (
        <article style={{ display: 'grid', gap: '16px' }}>
          <section style={{ borderRadius: '24px', border: '1px solid var(--nl-border)', background: 'var(--nl-surface)', overflow: 'hidden', boxShadow: 'var(--nl-shadow-sm)' }}>
            {primaryMedia && primaryMediaUrl ? (
              primaryMedia.media_type === 'audio' ? (
                <div data-testid="record-primary-media-preview" style={{ padding: '14px', background: 'var(--nl-surface-soft)' }}>
                  <MediaPreviewTile media={{ ...primaryMedia, preview_url: primaryMediaUrl }} onOpen={setFullscreenMedia} />
                </div>
              ) : (
                <div data-testid="record-primary-media-preview" style={{ position: 'relative', background: 'var(--nl-surface-soft)' }}>
                  {primaryMedia.media_type === 'video' ? (
        <video src={primaryMediaUrl} controls playsInline preload="none" style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block', background: 'var(--nl-surface-soft)' }} />
                  ) : (
                    <img src={primaryMediaUrl} alt={displayTitle || primaryMedia.original_name || '记录封面'} loading="eager" decoding="async" style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
                  )}
                  {primaryFullscreenMedia ? (
                    <button
                      type="button"
                      aria-label={mediaFullscreenActionLabel(primaryMedia.media_type)}
                      onClick={() => setFullscreenMedia(primaryFullscreenMedia)}
                      style={{
                        position: 'absolute',
                        top: '14px',
                        right: '14px',
                        width: '44px',
                        height: '44px',
                        borderRadius: '999px',
                        border: '1px solid rgba(197,190,255,0.58)',
                        background: 'rgba(5,9,24,0.74)',
                        color: 'var(--nl-ink)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <Maximize2 size={16} strokeWidth={2.4} />
                    </button>
                  ) : null}
                  <span style={{ position: 'absolute', left: '14px', bottom: '14px', borderRadius: '999px', background: 'rgba(5,9,24,0.74)', color: 'var(--nl-ink)', padding: '6px 10px', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(197,190,255,0.42)', backdropFilter: 'blur(12px)' }}>
                    {mediaPreviewLabel(primaryMedia.media_type)}
                  </span>
                </div>
              )
            ) : null}
            <div style={{ padding: '18px', display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', background: data.is_milestone ? 'rgba(var(--nl-primary-rgb),0.18)' : 'rgba(var(--nl-surface-rgb),0.72)', color: data.is_milestone ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)', border: '1px solid var(--nl-border)', padding: '6px 10px', fontSize: '12px', fontWeight: 700 }}>
                  {data.is_milestone ? <Star size={13} fill="currentColor" /> : null}
                  {recordTypeLabel(data.record_type, data.is_milestone)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', background: 'rgba(var(--nl-surface-rgb),0.72)', color: 'var(--nl-muted-strong)', border: '1px solid var(--nl-border)', padding: '6px 10px', fontSize: '12px', fontWeight: 700 }}>
                  {recordStatusLabel(data.status)}
                </span>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: '23px', lineHeight: 1.28, fontWeight: 800 }}>{displayTitle}</h2>
                <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '15px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{data.content_text ?? '暂无正文'}</p>
              </div>
              <section style={{ borderRadius: '20px', background: 'rgba(var(--nl-primary-rgb),0.1)', border: '1px solid var(--nl-border)', padding: '14px 14px 13px', display: 'grid', gap: '12px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'linear-gradient(180deg, var(--nl-primary), var(--nl-primary-2))' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '2px' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '999px', background: 'rgba(var(--nl-accent-rgb),0.14)', color: 'var(--nl-accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Sparkles size={15} strokeWidth={2.2} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--nl-ink)', fontSize: '12px', fontWeight: 800 }}>AI 智能提取</strong>
                    <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '13px', lineHeight: 1.7 }}>
                      {data.ai_summary ?? (aiJobProcessing ? `${aiActionLabel}正在处理中，请稍候…` : generatedTitle ? 'AI 标题已生成，可以继续生成摘要或标签。' : '当前还没有 AI 摘要，可以点击下方按钮生成标题、摘要或标签。')}
                    </p>
                    {generatedTitle ? (
                      <p style={{ margin: '6px 0 0', color: 'var(--nl-ink)', fontSize: '13px', lineHeight: 1.65, fontWeight: 700 }}>
                        AI 标题：{generatedTitle}
                      </p>
                    ) : null}
                    {data.ai_status ? <p style={{ ...helperTextStyle, marginTop: '6px', color: 'var(--nl-accent)' }}>AI 状态：{aiJobStatusLabel(data.ai_status)}</p> : null}
                    {aiJob?.status === 'success' ? <p style={{ ...helperTextStyle, marginTop: '6px', color: '#0f766e' }}>{aiActionLabel}已生成并同步到记录详情。</p> : null}
        {aiJob?.status === 'failed' ? <p style={{ ...helperTextStyle, marginTop: '6px', color: 'var(--nl-danger)' }}>AI 处理失败：{aiJob.error_message ?? '未知错误'}</p> : null}
        {aiError ? <p style={{ ...helperTextStyle, marginTop: '6px', color: 'var(--nl-danger)' }}>{aiError}</p> : null}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  <button style={{ ...secondaryButtonStyle, minHeight: '36px', justifyContent: 'center', borderRadius: '999px', minWidth: 0, paddingInline: '6px', fontSize: '12px', background: 'rgba(var(--nl-surface-rgb),0.72)' }} onClick={() => void onGenerateAi('record_title', 'AI 标题', 'AI 标题生成失败')} disabled={aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing'}>
                    {aiLoading && aiActionLabel === 'AI 标题' ? '生成中…' : '标题'}
                  </button>
                  <button style={{ ...secondaryButtonStyle, minHeight: '36px', justifyContent: 'center', borderRadius: '999px', minWidth: 0, paddingInline: '6px', fontSize: '12px', background: 'rgba(var(--nl-surface-rgb),0.72)' }} onClick={() => void onGenerateAi('record_summary', 'AI 摘要', 'AI 摘要生成失败')} disabled={aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing'}>
                    {aiLoading && aiActionLabel === 'AI 摘要' ? '生成中…' : '摘要'}
                  </button>
                  <button style={{ ...secondaryButtonStyle, minHeight: '36px', justifyContent: 'center', borderRadius: '999px', minWidth: 0, paddingInline: '6px', fontSize: '12px', background: 'rgba(var(--nl-surface-rgb),0.72)' }} onClick={() => void onGenerateAi('record_tags', 'AI 标签', 'AI 标签生成失败')} disabled={aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing'}>
                    {aiLoading && aiActionLabel === 'AI 标签' ? '生成中…' : '标签'}
                  </button>
                </div>
              </section>
              <div style={{ display: 'grid', gap: '8px' }}>
                <p style={helperTextStyle}>媒体数量：{data.media_list.length}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', background: 'rgba(var(--nl-surface-rgb),0.72)', border: '1px solid var(--nl-border)', padding: '7px 10px', color: 'var(--nl-muted-strong)', fontSize: '12px', fontWeight: 700 }}>
                    <Clock size={13} />
                    {new Date(data.event_time).toLocaleString('zh-CN', { hour12: false })}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', background: 'rgba(var(--nl-surface-rgb),0.72)', border: '1px solid var(--nl-border)', padding: '7px 10px', color: 'var(--nl-muted-strong)', fontSize: '12px', fontWeight: 700 }}>
                    <Eye size={13} />
                    {visibilityScopeLabel(data.visibility_scope)}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', background: 'rgba(var(--nl-surface-rgb),0.72)', border: '1px solid var(--nl-border)', padding: '7px 10px', color: 'var(--nl-muted-strong)', fontSize: '12px', fontWeight: 700 }}>
                    <MapPin size={13} />
                    {normalizeLocationText(data.location_text) || '未填写地点'}
                  </span>
                </div>
                {data.tags.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {data.tags.map((tag, index) => (
                      <span key={`${data.record_no}-${tag}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '10px', background: 'rgba(var(--nl-surface-rgb),0.72)', border: '1px solid var(--nl-border)', padding: '5px 8px', color: 'var(--nl-muted-strong)', fontSize: '11px', fontWeight: 700 }}>
                        <Tag size={10} />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {data.media_list.length ? (
            <Panel>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'grid', gap: '3px' }}>
                  <strong style={{ color: 'var(--nl-ink)' }}>全部媒体预览</strong>
                  <span style={{ color: 'var(--nl-muted-strong)', fontSize: '12px', lineHeight: 1.6 }}>照片、视频和语音都可以在这里直接查看或播放。</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                  {data.media_list.map((media) => {
                    const mediaUrl = resolveMediaPreviewUrl(media.media_no, media.access_url) ?? media.access_url;
                    return (
                      <MediaPreviewTile key={media.media_no} media={{ ...media, preview_url: mediaUrl }} compact onOpen={setFullscreenMedia} />
                    );
                  })}
                </div>
              </div>
            </Panel>
          ) : null}

          <div style={{ ...buttonRowStyle, paddingBottom: '10px' }}>
            <button style={primaryButtonStyle} onClick={() => navigate(`/record/${data.record_no}/edit`)}>
              编辑记录
            </button>
          <button style={{ ...secondaryButtonStyle, color: 'var(--nl-danger)' }} onClick={() => void onDelete()} disabled={deleting}>
              {deleting ? '删除中…' : '删除记录'}
            </button>
          </div>
        </article>
      ) : null}
      <MediaFullscreenDialog media={fullscreenMedia} onClose={() => setFullscreenMedia(null)} />
    </PageShell>
  );
};

export const EditRecordPage = () => {
  const navigate = useNavigate();
  const params = useParams<{ record_no: string }>();
  const { data, loading, error } = useAsyncData<RecordDetail | null>(
    async () => {
      if (!params.record_no) return null;
      return webApi.detailRecord(params.record_no);
    },
    [params.record_no],
  );

  const initialValue = useMemo(() => {
    if (!data) return null;
    return {
      child_no: data.child_no,
      record_type: data.record_type,
      title: data.title ?? '',
      content_text: data.content_text ?? '',
      media_nos: data.media_list.map((item) => item.media_no),
      media_items: data.media_list.map((item) => ({
        media_no: item.media_no,
        preview_url: resolveMediaPreviewUrl(item.media_no, item.access_url) ?? item.access_url,
        media_type: (item.media_type === 'audio' || item.media_type === 'video' ? item.media_type : 'image') as MediaType,
        original_name: item.original_name,
      })),
      tags: data.tags.join(', '),
      location_text: normalizeLocationText(data.location_text),
      visibility_scope: data.visibility_scope,
      event_time: formatDateTimeLocal(data.event_time),
      status: data.status,
    };
  }, [data]);

  if (loading) {
    return (
      <PageShell title="编辑记录" description="正在加载记录详情。" backTo={params.record_no ? `/record/${params.record_no}` : '/timeline'}>
        <Panel>
          <EmptyState message="加载中…" />
        </Panel>
      </PageShell>
    );
  }

  if (error || !data || !initialValue) {
    return (
      <PageShell title="编辑记录" description="记录加载失败。" backTo="/timeline">
        <Panel>
          <EmptyState message={error ?? '记录不存在'} />
        </Panel>
      </PageShell>
    );
  }

  return (
    <RecordForm
      mode="edit"
      initialValue={initialValue}
      onSubmit={async (value) => {
        if (!params.record_no) return;
        const record = await webApi.updateRecord(params.record_no, value);
        navigate(`/record/${record.record_no}`, { replace: true });
      }}
    />
  );
};
