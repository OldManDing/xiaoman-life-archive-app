import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, Clock, Eye, FileAudio, FileText, Image, ImagePlus, MapPin, Mic, MoreHorizontal, PlayCircle, RotateCcw, Ruler, Sparkles, Square, Star, Tag, Video, X } from 'lucide-react';
import { Camera, CameraResultType, CameraSource, type GalleryPhoto, type Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { AiJobDetail, LocationSuggestion, RecordDetail } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { aiJobStatusLabel, recordStatusLabel, recordTypeLabel, visibilityScopeLabel } from '../shared/labels';
import { createPersistableMediaPreview, removeRuntimeMediaPreview, resolveMediaPreviewUrl, resolveStoredMediaUrl, saveLocalMediaPreview, saveRuntimeMediaPreview } from '../shared/localMediaPreview';
import { useCachedMediaUrl } from '../shared/useCachedMediaUrl';
import { getCurrentDeviceLocation } from '../shared/deviceLocation';
import { AppDateInput, AppSelect, AppTopBar, PageShell, Panel, compactSecondaryButtonStyle, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, formSubmitSpacingStyle, formatAppDate, formatAppDateTime, formatDateTimeLocal, normalizeDisplayName, rowStyle } from './shared';
import { referenceAssets } from './reference-ui';
import { deriveMediaType, normalizeMimeType, resolveFileMimeType, withResolvedFileMimeType } from '../shared/mediaFiles';
import { ensurePlayableAudioFile, normalizeUploadErrorMessage, readUploadMetadata, UNSUPPORTED_AUDIO_PLAYBACK_MESSAGE } from '../shared/mediaMetadata';
import { getMediaCountLimit, getMediaCountLimitMessage, getMediaDurationLimit, getMediaDurationLimitMessage, getMediaLimitHint, RECORD_MEDIA_LIMITS } from '../shared/mediaLimits';

type MediaPreview = {
  media_no: string;
  preview_url: string;
  media_type: 'image' | 'video' | 'audio';
  original_name?: string | null;
  is_local?: boolean;
  upload_status?: 'uploading' | 'ready' | 'failed';
  error_message?: string | null;
};

const refreshAiRecordDetail = async (
  recordNo: string,
  onRefresh: (detail: RecordDetail) => void,
  onError?: (message: string) => void,
) => {
  try {
    const refreshed = await webApi.detailRecord(recordNo);
    onRefresh(refreshed);
    window.setTimeout(() => {
      void webApi.detailRecord(recordNo)
        .then(onRefresh)
        .catch((err) => {
          if (onError) {
            onError(normalizeAiErrorMessage(err instanceof Error ? err.message : null, '整理状态暂时无法更新，请稍后再试。'));
          }
        });
    }, 1200);
  } catch (err) {
    if (onError) {
      onError(normalizeAiErrorMessage(err instanceof Error ? err.message : null, '整理状态暂时无法更新，请稍后再试。'));
    }
  }
};

type MediaType = MediaPreview['media_type'];
type NativeImageAsset = Pick<Photo | GalleryPhoto, 'webPath' | 'format'>;

const tagOptions = ['生日纪念', '户外日常', '语言发育', '大动作发展', '睡前时光', '亲子陪伴', '第一次', '家庭日常', '身高记录', '体重记录'];

const recordTypeOptions = [
  { value: 'text' as const, label: '文字', icon: FileText },
  { value: 'mixed' as const, label: '照片', icon: Image },
  { value: 'video' as const, label: '视频', icon: Video },
  { value: 'audio' as const, label: '语音', icon: Mic },
];

const locationOptions = ['家里', '小区', '公园', '学校', '医院', '游乐场', '爷爷奶奶家', '外婆家'];
const PERSISTABLE_NON_IMAGE_PREVIEW_BYTES = 4_200_000;
const AUDIO_UPLOAD_ACCEPT = 'audio/mpeg,audio/mp4,audio/m4a,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/webm,audio/ogg';
const AUDIO_FORMAT_HINT = `支持 m4a、mp3、wav、aac、webm、ogg；AMR/部分 3GP 无法在应用内播放；${getMediaDurationLimitMessage('audio')}。`;
const AUDIO_RECORDING_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
const normalizeAudioDurationFallback = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value));
};

const hasAiPlusAccess = (user: { membership_type?: string; membership_expire_at?: string | null } | null | undefined) => {
  if (user?.membership_type !== 'ai_plus') return false;
  if (!user.membership_expire_at) return true;

  const expireAt = Date.parse(user.membership_expire_at);
  return Number.isFinite(expireAt) && expireAt > Date.now();
};

const AI_UNAVAILABLE_MESSAGE = '整理建议暂时不可用，请手动填写内容后继续。';
const AI_ERROR_DETAIL_PATTERN = /AI\s*服务调用失败|HTTP\s*\d+|key|token|secret|provider|Forbidden|InvalidEndpoint|NotFound|所属分组|completions/i;

const normalizeAiErrorMessage = (message: string | null | undefined, fallback = AI_UNAVAILABLE_MESSAGE) => {
  const normalized = message?.trim();
  if (!normalized) return fallback;
  if (AI_ERROR_DETAIL_PATTERN.test(normalized)) return fallback;
  if (normalized.includes('智能整理暂时不可用') || normalized.includes('整理建议暂时不可用')) return fallback;
  return normalized;
};

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

const resolveAudioRecordingMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const canCheckSupport = typeof MediaRecorder.isTypeSupported === 'function';
  if (!canCheckSupport) return '';
  return AUDIO_RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
};

const audioRecordingExtension = (mimeType: string) => {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === 'audio/mp4' || normalized === 'audio/x-m4a') return 'm4a';
  if (normalized === 'audio/aac') return 'aac';
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') return 'wav';
  if (normalized === 'audio/mpeg') return 'mp3';
  if (normalized === 'audio/ogg') return 'ogg';
  return 'webm';
};

const stopMediaStream = (stream?: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop());
};

const formatRecordingTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const normalizePromptMessage = (message: string) => {
  if (/google\s*play|play services|gms|service_version|service missing|service disabled/i.test(message)) {
    return '当前手机定位服务不可用，可手动填写地点或选择常用地点。';
  }
  if (/location accuracy insufficient|location accuracy unavailable/i.test(message)) {
    const reportedAccuracy = message.match(/(?:insufficient\s*:\s*|accuracy\s*[=:]?\s*)(\d+(?:\.\d+)?)\s*m?/i)?.[1];
    const accuracy = reportedAccuracy ? Number(reportedAccuracy) : null;
    const accuracyText = accuracy === null ? '' : Number.isInteger(accuracy) ? String(accuracy) : accuracy.toFixed(1);
    return reportedAccuracy
      ? `当前定位精度约 ${accuracyText} 米，未达到 10 米要求，请移至开阔处后重试。`
      : '当前定位精度未达到 10 米要求，请移至开阔处后重试。';
  }
  if (/precise location permission|required.*precise location/i.test(message)) {
    return '请在手机系统权限中开启“精确定位”，然后再点手机定位。';
  }
  return message;
};

const formatMetricNumber = (value: string) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return '';
  return normalized.toFixed(1).replace(/\.0$/, '');
};

const normalizeMetricInput = (value: string) => value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 6);

const metadataSelectStyle = {
  minHeight: '44px',
  borderRadius: '8px',
  background: 'rgba(var(--nl-surface-strong-rgb),0.48)',
  border: '1px solid var(--nl-border-strong)',
  boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
} as const;

const metadataIconSelectStyle = {
  ...metadataSelectStyle,
  paddingLeft: '36px',
} as const;

const compactChoiceButtonStyle = {
  ...compactSecondaryButtonStyle,
  minHeight: '44px',
  padding: '8px 13px',
  fontSize: '12px',
} as const;

const selectedChipButtonStyle = {
  minHeight: '44px',
  border: '1px solid var(--nl-border-strong)',
  borderRadius: '8px',
  background: 'rgba(var(--nl-surface-strong-rgb),0.42)',
  color: 'var(--nl-muted-strong)',
  padding: '7px 11px',
  fontSize: '12px',
  fontWeight: 560,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
} as const;

const mediaActionButtonStyle: CSSProperties = {
  minHeight: '84px',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  borderRadius: '16px',
  border: '1px solid rgba(var(--nl-primary-rgb), 0.14)',
  background: 'rgba(var(--nl-primary-rgb), 0.05)',
  color: 'var(--nl-ink)',
  padding: '12px 4px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  textAlign: 'center',
  cursor: 'pointer',
  boxShadow: 'none',
  transition: 'transform 0.18s ease, border-color 0.18s ease, background 0.18s ease',
};

const mediaActionIconStyle: CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '999px',
  background: 'rgba(var(--nl-primary-rgb), 0.12)',
  color: 'var(--nl-primary)',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  boxShadow: 'none',
};

const mediaActionLabelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 620,
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
  onClick,
  disabled,
  ariaExpanded,
  style,
}: {
  icon: ReactNode;
  label: string;
  displayLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  ariaExpanded?: boolean;
  style?: CSSProperties;
}) => (
  <button
    type="button"
    aria-label={label}
    aria-expanded={ariaExpanded}
    onClick={onClick}
    disabled={disabled}
    style={{
      ...mediaActionButtonStyle,
      opacity: disabled ? 0.65 : 1,
      ...style,
    }}
  >
    <span style={mediaActionIconStyle}>{icon}</span>
    <span style={mediaActionLabelStyle}>{displayLabel ?? label}</span>
  </button>
);

const dialogFocusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const useDialogFocus = (open: boolean, dialogRef: RefObject<HTMLElement | null>, restoreRef?: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const frame = window.requestAnimationFrame(() => {
      const first = dialog?.querySelector<HTMLElement>(dialogFocusableSelector);
      (first ?? dialog)?.focus?.();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(dialogFocusableSelector));
      if (!focusables.length) {
        event.preventDefault();
        dialog.focus?.();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      (restoreRef?.current ?? previous)?.focus?.();
    };
  }, [dialogRef, open, restoreRef]);
};

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
  const background = tone === 'error' ? 'var(--nl-danger-soft)' : 'rgba(var(--nl-success-rgb),0.14)';
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(true, dialogRef);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="状态"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        background: 'var(--nl-overlay-scrim)',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
      }}
    >
      <section
        style={{
          width: 'min(100%, 340px)',
          borderRadius: '8px',
          background: 'var(--nl-dialog-bg)',
          border: '1px solid var(--nl-border-strong)',
          boxShadow: 'var(--nl-dialog-shadow)',
          padding: '18px',
          display: 'grid',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ width: 38, height: 38, borderRadius: '8px', background, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon size={19} strokeWidth={2.3} />
          </span>
          <div style={{ display: 'grid', gap: '5px', minWidth: 0, flex: 1 }}>
            <strong style={{ color: 'var(--nl-ink)', fontSize: '16px', fontWeight: 760 }}>状态</strong>
            <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '14px', lineHeight: 1.65, fontWeight: 650 }}>{normalizePromptMessage(message)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            minHeight: '44px',
            border: '1px solid var(--nl-primary-border)',
            borderRadius: '8px',
            background: 'var(--nl-primary-gradient)',
            color: 'var(--nl-on-primary)',
            fontSize: '14px',
            fontWeight: 750,
            cursor: 'pointer',
            boxShadow: '0 10px 20px rgba(var(--nl-primary-rgb),0.09), inset 0 1px 0 var(--nl-inset-highlight-faint)',
          }}
        >
          知道了
        </button>
      </section>
    </div>
  );
};

const ConfirmActionDialog = ({
  ariaLabel,
  tone,
  title,
  message,
  cancelLabel = '取消',
  confirmLabel,
  confirmingLabel,
  confirming,
  error,
  onCancel,
  onConfirm,
}: {
  ariaLabel: string;
  tone: 'danger' | 'warning';
  title: string;
  message: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  confirmingLabel?: string;
  confirming?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const isDanger = tone === 'danger';
  const iconColor = isDanger ? 'var(--nl-danger)' : 'var(--nl-primary-2)';
  const iconBackground = isDanger ? 'var(--nl-danger-soft)' : 'rgba(var(--nl-primary-rgb),0.14)';
  const confirmBackground = isDanger ? 'var(--nl-danger)' : 'var(--nl-primary-gradient)';
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(true, dialogRef);

  return (
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel}
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 70,
      background: 'var(--nl-overlay-scrim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      boxSizing: 'border-box',
    }}
  >
    <section
      style={{
        width: 'min(100%, 340px)',
        boxSizing: 'border-box',
        borderRadius: '8px',
        background: 'var(--nl-dialog-bg)',
        border: '1px solid var(--nl-border-strong)',
        boxShadow: 'var(--nl-dialog-shadow)',
        padding: '18px',
        display: 'grid',
        gap: '16px',
        isolation: 'isolate',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '38px minmax(0, 1fr)', gap: '12px', alignItems: 'start' }}>
        <span style={{ width: 38, height: 38, borderRadius: '8px', background: iconBackground, color: iconColor, display: 'grid', placeItems: 'center' }}>
          <AlertCircle size={19} strokeWidth={2.3} />
        </span>
        <div style={{ display: 'grid', gap: '6px', minWidth: 0, flex: 1 }}>
          <strong style={{ color: 'var(--nl-ink)', fontSize: '16px', lineHeight: 1.35, fontWeight: 760 }}>{title}</strong>
          <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '14px', lineHeight: 1.65, fontWeight: 650 }}>
            {message}
          </p>
          {error ? <p style={{ ...helperTextStyle, margin: 0, color: 'var(--nl-danger)' }}>{error}</p> : null}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button type="button" style={{ ...secondaryButtonStyle, justifyContent: 'center', minHeight: '44px' }} onClick={onCancel} disabled={confirming}>
          {cancelLabel}
        </button>
        <button type="button" style={{ ...primaryButtonStyle, justifyContent: 'center', minHeight: '44px', background: confirmBackground }} onClick={onConfirm} disabled={confirming}>
          {confirming ? confirmingLabel ?? confirmLabel : confirmLabel}
        </button>
      </div>
    </section>
  </div>
  );
};

const DeleteRecordConfirmDialog = ({
  recordTitle,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  recordTitle: string;
  deleting: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <ConfirmActionDialog
    ariaLabel="删除记录确认"
    tone="danger"
    title="确认删除这条记录？"
    message={`「${recordTitle}」删除后会从时间轴中移除，已关联的媒体也不会再作为记录展示。`}
    confirmLabel="确认删除"
    confirmingLabel="删除中…"
    confirming={deleting}
    error={error}
    onCancel={onCancel}
    onConfirm={onConfirm}
  />
);

const DiscardDraftConfirmDialog = ({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) => (
  <ConfirmActionDialog
    ariaLabel="离开记录编辑确认"
    tone="warning"
    title="当前记录还没有保存"
    message="离开后这些内容不会自动保留。如需保留，请先返回并保存草稿。"
    cancelLabel="继续编辑"
    confirmLabel="直接离开"
    onCancel={onCancel}
    onConfirm={onConfirm}
  />
);

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

const mediaPreviewCardBaseStyle: CSSProperties = {
  position: 'relative',
  minHeight: '156px',
  borderRadius: '8px',
  overflow: 'hidden',
  border: '1px solid var(--nl-border-soft)',
  background: 'rgba(var(--nl-surface-rgb),0.08)',
  boxShadow: '0 14px 34px rgba(var(--nl-shadow-rgb),0.12)',
};

const MediaPreviewTile = ({
  media,
  compact,
  featured,
  style,
  onRemove,
  onRetry,
  onOpen,
}: {
  media: RenderableMediaPreview;
  compact?: boolean;
  featured?: boolean;
  style?: CSSProperties;
  onRemove?: (mediaNo: string) => void;
  onRetry?: (mediaNo: string) => void;
  onOpen?: (media: FullscreenMediaPreview) => void;
}) => {
  const mediaUrl = useCachedMediaUrl(media.media_no, media.preview_url ?? media.access_url ?? null, media.media_type, {
    cacheRemote: media.media_type === 'image' || !compact,
  }) ?? media.preview_url ?? media.access_url ?? '';
  const [mediaLoadFailed, setMediaLoadFailed] = useState(false);
  useEffect(() => {
    setMediaLoadFailed(false);
  }, [mediaUrl]);
  const label = mediaPreviewLabel(media.media_type);
  const canOpenFullscreen = Boolean(onOpen && mediaUrl && media.media_type !== 'audio');
  const hasNestedActions = Boolean(onRemove || onRetry);
  const statusLabel = media.upload_status === 'uploading' ? '上传中' : media.upload_status === 'failed' ? '上传失败' : null;
  const openFullscreen = () => {
    if (!onOpen || !mediaUrl) return;
    onOpen({ ...media, preview_url: mediaUrl });
  };

  return (
    <div
      className="nl-media-interaction"
      aria-label={label}
      role={canOpenFullscreen && !hasNestedActions ? 'button' : undefined}
      tabIndex={canOpenFullscreen && !hasNestedActions ? 0 : undefined}
      onClick={canOpenFullscreen && !hasNestedActions ? openFullscreen : undefined}
      onKeyDown={
        canOpenFullscreen && !hasNestedActions
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openFullscreen();
              }
            }
          : undefined
      }
      style={{
        ...mediaPreviewCardBaseStyle,
        minHeight: featured && media.media_type !== 'audio' ? '220px' : compact ? '136px' : media.media_type === 'audio' ? '156px' : '176px',
        height: featured && media.media_type !== 'audio' ? '220px' : compact ? '136px' : media.media_type === 'audio' ? '156px' : '176px',
        borderRadius: '8px',
        cursor: canOpenFullscreen ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      {media.media_type === 'image' && mediaUrl && !mediaLoadFailed ? (
        <img
          src={mediaUrl}
          alt={media.original_name ?? '已上传照片'}
          loading={compact && !featured ? 'lazy' : 'eager'}
          decoding="async"
          onError={() => setMediaLoadFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: canOpenFullscreen ? 'none' : 'auto', WebkitTapHighlightColor: 'transparent' }}
        />
      ) : null}
      {media.media_type === 'video' && mediaUrl && !mediaLoadFailed ? (
        <>
          <video
            src={mediaUrl}
            muted
            playsInline
            preload="none"
            onError={() => setMediaLoadFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'var(--nl-surface-soft)', pointerEvents: canOpenFullscreen ? 'none' : 'auto', WebkitTapHighlightColor: 'transparent' }}
          />
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--nl-ink)', pointerEvents: 'none' }}>
            <PlayCircle size={compact ? 34 : 42} strokeWidth={1.8} fill="rgba(var(--nl-primary-rgb),0.18)" />
          </span>
        </>
      ) : null}
      {media.media_type === 'audio' && mediaUrl ? (
        <div style={{ width: '100%', height: '100%', minHeight: compact ? '136px' : '156px', display: 'grid', alignContent: 'center', gap: '12px', padding: compact ? '14px' : '16px', background: 'var(--nl-surface-soft)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--nl-muted-strong)', fontSize: compact ? '12px' : '13px', fontWeight: 650, minWidth: 0 }}>
            <PlayCircle size={19} strokeWidth={2.2} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.original_name ?? '语音记录'}</span>
          </div>
          <audio src={mediaUrl} controls style={{ width: '100%', height: '32px' }} />
          {media.duration_seconds ? <span style={{ fontSize: '12px', color: 'var(--nl-muted)' }}>{media.duration_seconds} 秒</span> : null}
        </div>
      ) : null}
      {!mediaUrl || mediaLoadFailed || !['image', 'video', 'audio'].includes(media.media_type) ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: '8px', color: 'var(--nl-muted)', padding: '14px', boxSizing: 'border-box', background: 'var(--nl-surface-soft)' }}>
          <Image size={28} strokeWidth={1.8} />
          <span style={{ fontSize: '12px', fontWeight: 650 }}>{mediaLoadFailed ? '媒体暂时无法加载' : '暂无预览'}</span>
        </div>
      ) : null}
      {statusLabel ? (
        <span style={{ position: 'absolute', right: '10px', bottom: '10px', borderRadius: '8px', background: media.upload_status === 'failed' ? 'var(--nl-danger-soft)' : 'rgba(var(--nl-success-rgb),0.14)', color: media.upload_status === 'failed' ? 'var(--nl-danger)' : 'var(--nl-success)', border: '1px solid var(--nl-border-muted)', padding: '6px 10px', fontSize: '11px', fontWeight: 700 }}>
          {statusLabel}
        </span>
      ) : null}
      {media.upload_status === 'failed' && media.error_message ? (
        <span style={{ position: 'absolute', left: '10px', right: '10px', top: '10px', borderRadius: '8px', background: 'var(--nl-danger-soft)', color: 'var(--nl-danger)', border: '1px solid var(--nl-danger-line)', padding: '7px 9px', fontSize: '11px', lineHeight: 1.45, fontWeight: 750 }}>
          {media.error_message}
        </span>
      ) : null}
      {media.upload_status === 'failed' && onRetry ? (
        <button
          type="button"
          aria-label="重试上传"
          onClick={(event) => {
            event.stopPropagation();
            onRetry(media.media_no);
          }}
          style={{
            position: 'absolute',
            left: '10px',
            bottom: '10px',
            minHeight: '38px',
            borderRadius: '8px',
            border: '1px solid var(--nl-danger-line)',
            background: 'var(--nl-dialog-bg)',
            color: 'var(--nl-danger)',
            padding: '8px 11px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={14} strokeWidth={2.2} />
          重试
        </button>
      ) : null}
      {canOpenFullscreen && hasNestedActions ? (
        <button
          type="button"
          aria-label={media.media_type === 'video' ? undefined : label}
          onClick={(event) => {
            event.stopPropagation();
            openFullscreen();
          }}
          style={{
            position: 'absolute',
            left: '10px',
            top: '10px',
            minHeight: '38px',
            borderRadius: '8px',
            border: '1px solid var(--nl-border-strong)',
            background: 'var(--nl-surface-soft)',
            color: 'var(--nl-ink)',
            padding: '8px 11px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          查看
        </button>
      ) : null}
      {onRemove ? (
          <button
            type="button"
            aria-label="移除媒体"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(media.media_no);
            }}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              border: '1px solid var(--nl-border-strong)',
              background: 'var(--nl-surface-soft)',
              color: 'var(--nl-ink)',
              WebkitBackdropFilter: 'blur(10px)',
              backdropFilter: 'blur(10px)',
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
  mediaList,
  onClose,
}: {
  media: FullscreenMediaPreview | null;
  mediaList?: RenderableMediaPreview[];
  onClose: () => void;
}) => {
  const galleryMedia = useMemo(() => {
    const visualMedia = (mediaList ?? []).filter((item) => (
      (item.media_type === 'image' || item.media_type === 'video')
      && Boolean(item.preview_url || item.access_url)
    ));
    const mergedMedia = media && (media.media_type === 'image' || media.media_type === 'video')
      ? visualMedia.some((item) => item.media_no === media.media_no)
        ? visualMedia.map((item) => item.media_no === media.media_no ? { ...item, ...media } : item)
        : [...visualMedia, media]
      : visualMedia;
    return Array.from(new Map(mergedMedia.map((item) => [item.media_no, item])).values());
  }, [media, mediaList]);
  const seedMediaNo = media?.media_no ?? null;
  const [galleryState, setGalleryState] = useState<{ seedMediaNo: string | null; activeMediaNo: string | null }>({
    seedMediaNo: null,
    activeMediaNo: null,
  });
  const [pageDirection, setPageDirection] = useState<1 | -1 | 0>(0);
  const effectiveMediaNo = galleryState.seedMediaNo === seedMediaNo ? galleryState.activeMediaNo : seedMediaNo;
  const activeMedia = galleryMedia.find((item) => item.media_no === effectiveMediaNo) ?? media;
  const activeMediaIndex = activeMedia ? galleryMedia.findIndex((item) => item.media_no === activeMedia.media_no) : -1;
  const canSwipeMedia = galleryMedia.length > 1 && activeMediaIndex >= 0;
  const mediaUrl = useCachedMediaUrl(activeMedia?.media_no, activeMedia?.preview_url ?? activeMedia?.access_url ?? null, activeMedia?.media_type, {
    cacheRemote: true,
  }) ?? activeMedia?.preview_url ?? activeMedia?.access_url ?? '';
  const label = activeMedia ? mediaPreviewLabel(activeMedia.media_type) : '媒体预览';
  const [imageZoomed, setImageZoomed] = useState(false);
  const [imageZoomOrigin, setImageZoomOrigin] = useState('50% 50%');
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const [imageDragging, setImageDragging] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const imageClickTimerRef = useRef<number | null>(null);
  const imagePointerRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const videoPointerRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    ignoreControls: boolean;
  } | null>(null);
  const backdropPointerRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const suppressVideoClickRef = useRef(false);
  const suppressBackdropClickRef = useRef(false);
  const lastImageTapRef = useRef<{ at: number; x: number; y: number } | null>(null);

  const imageDoubleTapWindowMs = 280;

  const clearImageClickTimer = () => {
    if (imageClickTimerRef.current === null) return;
    window.clearTimeout(imageClickTimerRef.current);
    imageClickTimerRef.current = null;
  };

  const closeAfterSingleImageTap = () => {
    clearImageClickTimer();
    imageClickTimerRef.current = window.setTimeout(() => {
      imageClickTimerRef.current = null;
      lastImageTapRef.current = null;
      onClose();
    }, imageDoubleTapWindowMs + 20);
  };

  const moveMedia = (delta: 1 | -1) => {
    if (!canSwipeMedia) return false;
    const nextIndex = (activeMediaIndex + delta + galleryMedia.length) % galleryMedia.length;
    const nextMedia = galleryMedia[nextIndex];
    if (!nextMedia) return false;
    clearImageClickTimer();
    lastImageTapRef.current = null;
    imagePointerRef.current = null;
    videoPointerRef.current = null;
    setPageDirection(delta);
    setGalleryState({ seedMediaNo, activeMediaNo: nextMedia.media_no });
    return true;
  };

  const toggleImageZoom = (element: HTMLImageElement, clientX: number, clientY: number) => {
    if (!imageZoomed) {
      const bounds = element.getBoundingClientRect();
      const x = bounds.width ? ((clientX - bounds.left) / bounds.width) * 100 : 50;
      const y = bounds.height ? ((clientY - bounds.top) / bounds.height) * 100 : 50;
      setImageZoomOrigin(`${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`);
    } else {
      setImageZoomOrigin('50% 50%');
    }
    setImagePan({ x: 0, y: 0 });
    setImageZoomed((current) => !current);
  };

  const clampImagePan = (element: HTMLImageElement, x: number, y: number) => {
    const baseWidth = element.offsetWidth || element.naturalWidth || Math.max(1, window.innerWidth - 32);
    const baseHeight = element.offsetHeight || element.naturalHeight || Math.max(1, window.innerHeight - 144);
    const maxX = baseWidth * 0.5;
    const maxY = baseHeight * 0.5;
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const onImagePointerDown = (event: ReactPointerEvent<HTMLImageElement>) => {
    event.stopPropagation();
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    imagePointerRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      startPanX: imagePan.x,
      startPanY: imagePan.y,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional in older Android WebViews.
    }
  };

  const onImagePointerMove = (event: ReactPointerEvent<HTMLImageElement>) => {
    const pointer = imagePointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    if (Math.hypot(deltaX, deltaY) > 10) {
      pointer.moved = true;
      clearImageClickTimer();
      lastImageTapRef.current = null;
    }
    if (imageZoomed && pointer.moved) {
      event.preventDefault();
      setImageDragging(true);
      setImagePan(clampImagePan(event.currentTarget, pointer.startPanX + deltaX, pointer.startPanY + deltaY));
    }
  };

  const clearImagePointer = (event: ReactPointerEvent<HTMLImageElement>) => {
    const pointer = imagePointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return null;
    imagePointerRef.current = null;
    setImageDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may release capture before pointerup/pointercancel.
    }
    return pointer;
  };

  const onImagePointerUp = (event: ReactPointerEvent<HTMLImageElement>) => {
    event.stopPropagation();
    const pointer = clearImagePointer(event);
    if (!pointer) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    const isHorizontalSwipe = !imageZoomed
      && Math.abs(deltaX) >= 48
      && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;
    if (isHorizontalSwipe) {
      moveMedia(deltaX < 0 ? 1 : -1);
      return;
    }
    if (pointer.moved) {
      return;
    }

    const now = Date.now();
    const lastTap = lastImageTapRef.current;
    const isDoubleTap = Boolean(
      lastTap
      && now - lastTap.at <= imageDoubleTapWindowMs
      && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= 28,
    );

    if (isDoubleTap) {
      clearImageClickTimer();
      lastImageTapRef.current = null;
      toggleImageZoom(event.currentTarget, event.clientX, event.clientY);
      return;
    }

    lastImageTapRef.current = { at: now, x: event.clientX, y: event.clientY };
    closeAfterSingleImageTap();
  };

  const onVideoPointerDown = (event: ReactPointerEvent<HTMLVideoElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const controlsHeight = bounds.height > 0 ? Math.min(72, bounds.height * 0.28) : 0;
    const ignoreControls = controlsHeight > 0 && event.clientY >= bounds.bottom - controlsHeight;
    videoPointerRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ignoreControls,
    };
    if (ignoreControls) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional in older Android WebViews.
    }
  };

  const onVideoPointerMove = (event: ReactPointerEvent<HTMLVideoElement>) => {
    const pointer = videoPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.ignoreControls) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
      suppressVideoClickRef.current = true;
    }
  };

  const clearVideoPointer = (event: ReactPointerEvent<HTMLVideoElement>) => {
    const pointer = videoPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return null;
    videoPointerRef.current = null;
    if (!pointer.ignoreControls) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may release capture before pointerup/pointercancel.
      }
    }
    return pointer;
  };

  const onVideoPointerUp = (event: ReactPointerEvent<HTMLVideoElement>) => {
    event.stopPropagation();
    const pointer = clearVideoPointer(event);
    if (!pointer || pointer.ignoreControls) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      event.preventDefault();
      moveMedia(deltaX < 0 ? 1 : -1);
    }
  };

  const onBackdropPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('img,video')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    suppressBackdropClickRef.current = false;
    backdropPointerRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional in older Android WebViews.
    }
  };

  const onBackdropPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = backdropPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    backdropPointerRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may release capture before pointerup/pointercancel.
    }
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) return;
    event.preventDefault();
    suppressBackdropClickRef.current = true;
    moveMedia(deltaX < 0 ? 1 : -1);
  };

  useEffect(() => {
    setImageLoadFailed(false);
    setImageZoomed(false);
    setImageZoomOrigin('50% 50%');
    setImagePan({ x: 0, y: 0 });
    setImageDragging(false);
    imagePointerRef.current = null;
    videoPointerRef.current = null;
    lastImageTapRef.current = null;
    clearImageClickTimer();
  }, [activeMedia?.media_no]);

  const isOpen = Boolean(media);

  useDialogFocus(isOpen, dialogRef);

  useEffect(() => {
    if (!isOpen) return undefined;
    const scrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      clearImageClickTimer();
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      if (!/jsdom/i.test(navigator.userAgent)) {
        window.scrollTo(0, scrollY);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setGalleryState({ seedMediaNo: null, activeMediaNo: null });
      setPageDirection(0);
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') moveMedia(-1);
      if (event.key === 'ArrowRight') moveMedia(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeMediaIndex, galleryMedia.length, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onNativeBack = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    window.addEventListener('nianlun:native-back-button', onNativeBack);
    return () => window.removeEventListener('nianlun:native-back-button', onNativeBack);
  }, [isOpen, onClose]);

  if (!activeMedia || !mediaUrl) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="nl-media-interaction"
      role="dialog"
      aria-modal="true"
      aria-label={`全屏${label}`}
      data-media-index={activeMediaIndex >= 0 ? String(activeMediaIndex) : '0'}
      data-media-total={String(Math.max(galleryMedia.length, 1))}
      onClick={(event) => {
        if (suppressBackdropClickRef.current) {
          suppressBackdropClickRef.current = false;
          return;
        }
        onClose();
      }}
      onPointerDown={onBackdropPointerDown}
      onPointerUp={onBackdropPointerUp}
      onPointerCancel={() => {
        backdropPointerRef.current = null;
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--nl-media-overlay-bg)',
        display: 'grid',
        placeItems: 'center',
        padding: 'calc(72px + env(safe-area-inset-top)) 16px calc(72px + env(safe-area-inset-bottom))',
        overscrollBehavior: 'contain',
        touchAction: 'manipulation',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <button
        type="button"
        aria-label="关闭媒体预览"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        style={{
          position: 'absolute',
          top: 'calc(18px + env(safe-area-inset-top))',
          right: '16px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(0,0,0,0.34)',
          color: 'var(--nl-on-dark)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          zIndex: 2,
        }}
      >
        <X size={20} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <div
        key={activeMedia.media_no}
        className={pageDirection === 1 ? 'record-media-page-forward' : pageDirection === -1 ? 'record-media-page-backward' : undefined}
        onClick={(event) => event.stopPropagation()}
        style={{
          display: 'inline-grid',
          placeItems: 'center',
          padding: 0,
          boxSizing: 'border-box',
          border: 'none',
          background: 'transparent',
          overflow: 'visible',
          overscrollBehavior: 'contain',
          touchAction: activeMedia.media_type === 'video' ? 'pan-y' : 'manipulation',
          ...(imageLoadFailed ? {
            width: 'min(82vw, 360px)',
            minHeight: '220px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '12px',
            color: 'rgba(255,255,255,0.78)',
            gap: '10px',
          } : {}),
          willChange: pageDirection ? 'transform, opacity' : undefined,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {activeMedia.media_type === 'image' ? (
          <>
            <img
            src={imageLoadFailed ? 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22220%22 viewBox=%220 0 320 220%22%3E%3Crect width=%22320%22 height=%22220%22 rx=%2218%22 fill=%22%232b2924%22/%3E%3Cpath d=%22M78 148l48-52 38 38 26-26 52 60H78z%22 fill=%22%239b8b72%22/%3E%3Ccircle cx=%22120%22 cy=%2278%22 r=%2224%22 fill=%22%23c6b89f%22/%3E%3C/svg%3E' : mediaUrl}
            alt={activeMedia.original_name ?? label}
            decoding="async"
            draggable={false}
            data-zoomed={imageZoomed ? 'true' : 'false'}
            data-pan-x={String(Math.round(imagePan.x))}
            data-pan-y={String(Math.round(imagePan.y))}
            onClick={(event) => event.stopPropagation()}
            onError={() => setImageLoadFailed(true)}
            onPointerDown={onImagePointerDown}
            onPointerMove={onImagePointerMove}
            onPointerUp={onImagePointerUp}
            onPointerCancel={(event) => {
              event.stopPropagation();
              clearImagePointer(event);
            }}
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100dvh - 144px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
              objectFit: 'contain',
              display: 'block',
              borderRadius: 0,
              transform: `translate3d(${imagePan.x}px, ${imagePan.y}px, 0) scale(${imageZoomed ? 2 : 1})`,
              transformOrigin: imageZoomOrigin,
              transition: imageDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
              cursor: imageZoomed ? (imageDragging ? 'grabbing' : 'grab') : 'zoom-in',
              touchAction: imageZoomed ? 'none' : 'pan-y',
              WebkitTapHighlightColor: 'transparent',
            }}
            />
            {imageLoadFailed ? <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: '13px', lineHeight: 1.5 }}>媒体暂时无法加载</span> : null}
          </>
        ) : null}
        {activeMedia.media_type === 'video' ? (
          <video
            src={mediaUrl}
            controls
            autoPlay
            playsInline
            preload="auto"
            onClick={(event) => {
              event.stopPropagation();
              if (!suppressVideoClickRef.current) return;
              event.preventDefault();
              suppressVideoClickRef.current = false;
            }}
            onPointerDown={onVideoPointerDown}
            onPointerMove={onVideoPointerMove}
            onPointerUp={onVideoPointerUp}
            onPointerCancel={(event) => {
              event.stopPropagation();
              clearVideoPointer(event);
              suppressVideoClickRef.current = false;
            }}
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100dvh - 144px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
              objectFit: 'contain',
              display: 'block',
              background: 'transparent',
              borderRadius: 0,
              touchAction: 'pan-y',
            }}
          />
        ) : null}
        {activeMedia.media_type === 'audio' ? (
          <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 420px)', display: 'grid', gap: '16px', color: 'var(--nl-on-primary)', textAlign: 'center' }}>
            <FileAudio size={44} strokeWidth={1.8} style={{ justifySelf: 'center' }} />
            <strong style={{ fontSize: '16px', fontWeight: 720 }}>{activeMedia.original_name ?? label}</strong>
            <audio src={mediaUrl} controls autoPlay style={{ width: '100%' }} />
          </div>
        ) : null}
      </div>
      {canSwipeMedia ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 'calc(26px + env(safe-area-inset-bottom))',
            transform: 'translateX(-50%)',
            color: 'var(--nl-on-dark-muted)',
            fontSize: 11,
            lineHeight: 1,
            fontWeight: 700,
            pointerEvents: 'none',
          }}
        >
          {String(activeMediaIndex + 1).padStart(2, '0')} / {String(galleryMedia.length).padStart(2, '0')}
        </span>
      ) : null}
    </div>,
    document.body,
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

const buildRecordDraftSignature = (
  value: RecordFormInitialValue,
  mediaNos: string[],
  metricState: { heightValue: string; weightValue: string; metricNote: string },
) =>
  JSON.stringify({
    record_type: value.record_type,
    title: value.title,
    content_text: value.content_text,
    media_nos: mediaNos,
    tags: value.tags,
    location_text: value.location_text,
    visibility_scope: value.visibility_scope,
    event_time: value.event_time,
    status: value.status,
    heightValue: metricState.heightValue,
    weightValue: metricState.weightValue,
    metricNote: metricState.metricNote,
  });

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
  const { activeChild, children, user } = useAuth();
  const normalizedInitialValue = useMemo(() => normalizeRecordFormInitialValue(initialValue), [initialValue]);
  const [form, setForm] = useState(normalizedInitialValue);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<'publish' | 'draft' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [audioRecording, setAudioRecording] = useState(false);
  const [audioRecordingSeconds, setAudioRecordingSeconds] = useState(0);
  const [selectorMessage, setSelectorMessage] = useState<string | null>(null);
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
  const [moreMediaOpen, setMoreMediaOpen] = useState(normalizedInitialValue.record_type === 'audio' || normalizedInitialValue.record_type === 'video');
  const [fullscreenMedia, setFullscreenMedia] = useState<FullscreenMediaPreview | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const mediaPreviewsRef = useRef<MediaPreview[]>(normalizedInitialValue.media_items);
  const failedUploadFilesRef = useRef(new Map<string, { file: File; options: { durationFallbackSeconds?: number | null } }>());
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const contentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const timeInputRef = useRef<HTMLInputElement | null>(null);
  const photoCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const videoCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const audioCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const audioLibraryInputRef = useRef<HTMLInputElement | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecordingStreamRef = useRef<MediaStream | null>(null);
  const audioRecordingChunksRef = useRef<Blob[]>([]);
  const audioRecordingStartedAtRef = useRef<number | null>(null);
  const audioRecordingDiscardRef = useRef(false);
  const audioRecordingLimitTriggeredRef = useRef(false);
  const selectedChildNoRef = useRef('');
  const allowNavigationWithoutPromptRef = useRef(false);

  const currentChild = children.find((child) => child.child_no === form.child_no) ?? activeChild ?? children[0] ?? null;
  const currentChildName = normalizeDisplayName(currentChild?.name, currentChild ? '宝宝' : '请选择孩子');
  const currentChildInitial = normalizeDisplayName(currentChild?.name, '宝').slice(0, 1);
  const currentChildAvatar = referenceAssets.childAvatar;
  const selectedTags = splitTags(form.tags);
  const isHeightRecord = mode === 'create' && initialMetricMode === 'height';
  const canUseAi = hasAiPlusAccess(user);
  const initialDraftSignature = useMemo(
    () =>
      buildRecordDraftSignature(normalizedInitialValue, normalizedInitialValue.media_nos, {
        heightValue: '',
        weightValue: '',
        metricNote: '',
      }),
    [normalizedInitialValue],
  );
  const currentDraftSignature = useMemo(
    () =>
      buildRecordDraftSignature(form, mediaNos, {
        heightValue,
        weightValue,
        metricNote,
      }),
    [form, heightValue, mediaNos, metricNote, weightValue],
  );
  const hasUnsavedChanges = currentDraftSignature !== initialDraftSignature && !submitting;

  const leaveAfterDiscard = () => {
    setDiscardConfirmOpen(false);
    allowNavigationWithoutPromptRef.current = true;
    if (mode === 'create') {
      navigate('/home');
      return;
    }
    navigate(-1);
  };

  const leaveRecordForm = () => {
    if (!hasUnsavedChanges || allowNavigationWithoutPromptRef.current) {
      leaveAfterDiscard();
      return;
    }
    setDiscardConfirmOpen(true);
  };

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
    allowNavigationWithoutPromptRef.current = false;
    setForm(nextInitialValue);
    setMediaNos(nextInitialValue.media_nos);
    setMediaPreviews(nextInitialValue.media_items);
    setMoreMediaOpen(nextInitialValue.record_type === 'audio' || nextInitialValue.record_type === 'video');
    failedUploadFilesRef.current.clear();
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
    if (!hasUnsavedChanges || allowNavigationWithoutPromptRef.current) return undefined;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const onNativeBack = (event: Event) => {
      if (!hasUnsavedChanges || allowNavigationWithoutPromptRef.current) return;
      event.preventDefault();
      setDiscardConfirmOpen(true);
    };

    window.addEventListener('nianlun:native-back-button', onNativeBack);
    return () => window.removeEventListener('nianlun:native-back-button', onNativeBack);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!audioRecording) return undefined;
    const timer = window.setInterval(() => {
      const startedAt = audioRecordingStartedAtRef.current;
      const elapsedSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      setAudioRecordingSeconds(elapsedSeconds);
      if (elapsedSeconds >= RECORD_MEDIA_LIMITS.audioMaxDurationSeconds && !audioRecordingLimitTriggeredRef.current) {
        audioRecordingLimitTriggeredRef.current = true;
        setSelectorMessage(`已达到${getMediaDurationLimitMessage('audio')}，录音将自动停止并上传。`);
        const recorder = audioRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
          audioRecordingDiscardRef.current = false;
          recorder.requestData?.();
          recorder.stop();
        }
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [audioRecording]);

  useEffect(() => {
    return () => {
      const recorder = audioRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        audioRecordingDiscardRef.current = true;
        recorder.stop();
      }
      stopMediaStream(audioRecordingStreamRef.current);
    };
  }, []);

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
    setSelectorMessage(`已切换为 ${normalizeDisplayName(nextChild.name, '宝宝')}`);
  };

  const triggerMediaInput = (input: HTMLInputElement | null) => {
    if (uploading || audioRecording || !input) return;
    setError(null);
    setSelectorMessage(null);
    input.value = '';
    input.click();
  };

  const currentMediaCount = (mediaType: MediaType) =>
    mediaPreviewsRef.current.filter((item) => item.media_type === mediaType && item.upload_status !== 'failed').length;

  const ensureMediaCountAvailable = (mediaType: MediaType) => {
    if (currentMediaCount(mediaType) >= getMediaCountLimit(mediaType)) {
      setError(getMediaCountLimitMessage(mediaType));
      return false;
    }
    return true;
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

  const uploadMediaFile = async (file: File, options: { durationFallbackSeconds?: number | null } = {}) => {
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
    if (!ensureMediaCountAvailable(mediaType)) return;
    if (mediaType === 'audio') {
      try {
        ensurePlayableAudioFile(uploadFile);
      } catch (err) {
        setError(err instanceof Error ? err.message : UNSUPPORTED_AUDIO_PLAYBACK_MESSAGE);
        return;
      }
    }
    setUploading(true);
    setError(null);
    const pendingMediaNo = createPendingMediaNo();
    const previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(uploadFile) : '';
    if (previewUrl) saveRuntimeMediaPreview(pendingMediaNo, previewUrl);
    const pendingPreview: MediaPreview = {
      media_no: pendingMediaNo,
      preview_url: previewUrl,
      media_type: mediaType,
      original_name: uploadFile.name,
      is_local: Boolean(previewUrl),
      upload_status: 'uploading',
    };
    mediaPreviewsRef.current = [...mediaPreviewsRef.current, pendingPreview];
    setMediaPreviews((current) => [
      ...current,
      pendingPreview,
    ]);

    try {
      const durationFallbackSeconds = mediaType === 'audio' ? normalizeAudioDurationFallback(options.durationFallbackSeconds) : null;
      const metadata = await readUploadMetadata(mediaType, previewUrl, { durationFallbackSeconds });
      const durationLimit = getMediaDurationLimit(mediaType);
      const durationSeconds = metadata.duration_seconds ?? durationFallbackSeconds;
      if (durationLimit && (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds))) {
        throw new Error(`${mediaType === 'video' ? '视频' : '语音'}时长读取失败，请重新选择可播放的文件。`);
      }
      if (durationLimit && typeof durationSeconds === 'number' && durationSeconds > durationLimit) {
        throw new Error(`${getMediaDurationLimitMessage(mediaType)}，请重新选择较短的文件。`);
      }
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

      await webApi.confirmUpload({ media_no: uploadToken.media_no, ...metadata });
      setForm((current) => {
        if (current.record_type === 'text' || current.record_type === 'milestone') return { ...current, record_type: 'mixed' };
        if (mediaType === 'audio') return { ...current, record_type: 'audio' };
        if (mediaType === 'video') return { ...current, record_type: 'video' };
        if (current.record_type === 'text' || current.record_type === 'audio' || current.record_type === 'video') {
          return { ...current, record_type: 'mixed' };
        }
        return current;
      });
      setMediaNos((current) => [...current, uploadToken.media_no]);
      const readyPreview = {
        media_no: uploadToken.media_no,
        preview_url: previewUrl,
        media_type: mediaType,
        original_name: uploadFile.name,
        is_local: false,
        upload_status: 'ready' as const,
        duration_seconds: metadata.duration_seconds ?? durationFallbackSeconds ?? null,
      };
      mediaPreviewsRef.current = mediaPreviewsRef.current.map((item) => item.media_no === pendingMediaNo ? readyPreview : item);
      setMediaPreviews((current) => current.map((item) => item.media_no === pendingMediaNo ? readyPreview : item));
      removeRuntimeMediaPreview(pendingMediaNo);
      failedUploadFilesRef.current.delete(pendingMediaNo);
      if (previewUrl) void persistConfirmedMediaPreview(uploadToken.media_no, uploadFile, mediaType, previewUrl);
    } catch (err) {
      removeRuntimeMediaPreview(pendingMediaNo);
      const message = normalizeUploadErrorMessage(err instanceof Error ? err.message : '上传失败', mediaType);
      failedUploadFilesRef.current.set(pendingMediaNo, { file: uploadFile, options });
      mediaPreviewsRef.current = mediaPreviewsRef.current.map((item) => item.media_no === pendingMediaNo ? { ...item, upload_status: 'failed', error_message: message } : item);
      setMediaPreviews((current) => current.map((item) => item.media_no === pendingMediaNo ? { ...item, upload_status: 'failed', error_message: message } : item));
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

  const startAudioRecording = async () => {
    if (uploading || audioRecording) return;
    if (!ensureMediaCountAvailable('audio')) return;

    setError(null);
    setSelectorMessage(null);

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      triggerMediaInput(audioCaptureInputRef.current);
      setSelectorMessage('当前设备不支持应用内录音，已打开系统录音文件选择。');
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = resolveAudioRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      audioRecordingChunksRef.current = [];
      audioRecordingStreamRef.current = stream;
      audioRecorderRef.current = recorder;
      audioRecordingStartedAtRef.current = Date.now();
      audioRecordingDiscardRef.current = false;
      audioRecordingLimitTriggeredRef.current = false;
      setAudioRecordingSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioRecordingChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setAudioRecording(false);
        setAudioRecordingSeconds(0);
        audioRecordingStartedAtRef.current = null;
        stopMediaStream(audioRecordingStreamRef.current);
        audioRecordingStreamRef.current = null;
        audioRecorderRef.current = null;
        audioRecordingChunksRef.current = [];
        audioRecordingDiscardRef.current = false;
        setError('录音中断，请检查麦克风权限后重试，或改用上传语音文件。');
      };
      recorder.onstop = () => {
        const shouldDiscard = audioRecordingDiscardRef.current;
        const chunks = [...audioRecordingChunksRef.current];
        const recordedMimeType = normalizeMimeType(recorder.mimeType || mimeType || chunks[0]?.type) || 'audio/webm';
        const recordingStartedAt = audioRecordingStartedAtRef.current;
        const measuredDurationSeconds = normalizeAudioDurationFallback(recordingStartedAt ? (Date.now() - recordingStartedAt) / 1000 : audioRecordingSeconds);
        const recordedDurationSeconds = audioRecordingLimitTriggeredRef.current
          ? RECORD_MEDIA_LIMITS.audioMaxDurationSeconds
          : measuredDurationSeconds;
        audioRecordingChunksRef.current = [];
        audioRecordingDiscardRef.current = false;
        audioRecordingLimitTriggeredRef.current = false;
        setAudioRecording(false);
        setAudioRecordingSeconds(0);
        audioRecordingStartedAtRef.current = null;
        stopMediaStream(audioRecordingStreamRef.current);
        audioRecordingStreamRef.current = null;
        audioRecorderRef.current = null;

        if (shouldDiscard) {
          return;
        }

        if (!chunks.length) {
          setError('没有录到声音，请重新录制。');
          return;
        }

        const audioFile = new File([new Blob(chunks, { type: recordedMimeType })], `voice-${Date.now()}.${audioRecordingExtension(recordedMimeType)}`, {
          type: recordedMimeType,
        });
        void uploadMediaFile(audioFile, { durationFallbackSeconds: recordedDurationSeconds });
      };

      recorder.start(1000);
      setAudioRecording(true);
    } catch (err) {
      stopMediaStream(stream);
      audioRecordingStreamRef.current = null;
      audioRecorderRef.current = null;
      audioRecordingChunksRef.current = [];
      audioRecordingDiscardRef.current = false;
      setAudioRecording(false);
      setAudioRecordingSeconds(0);
      audioRecordingStartedAtRef.current = null;
      const message =
        err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
          ? '无法使用麦克风，请在系统权限中允许录音，或改用上传语音文件。'
          : '录音启动失败，请检查麦克风权限后重试，或改用上传语音文件。';
      setError(message);
    }
  };

  const stopAudioRecording = () => {
    const recorder = audioRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    audioRecordingDiscardRef.current = false;
    if (typeof recorder.requestData === 'function') {
      recorder.requestData();
    }
    recorder.stop();
  };

  const uploadNativeImage = async (asset: NativeImageAsset, prefix: 'camera' | 'gallery') => {
    const file = await nativeImageToFile(asset, prefix);
    await uploadMediaFile(file);
  };

  const openNativePhotoCapture = async () => {
    if (!isNativeAppRuntime()) {
      triggerMediaInput(photoCaptureInputRef.current);
      return;
    }

    if (uploading) return;
    if (!ensureMediaCountAvailable('image')) return;

    setError(null);
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
    } catch (err) {
      if (isNativePickerCancelled(err)) {
        return;
      }
      setError(err instanceof Error ? `无法打开系统相机：${err.message}` : '无法打开系统相机，请检查相机权限后重试。');
    }
  };

  const openNativeGalleryImages = async () => {
    if (!isNativeAppRuntime()) {
      triggerMediaInput(galleryInputRef.current);
      return;
    }

    if (uploading) return;
    if (!ensureMediaCountAvailable('image')) return;

    setError(null);
    try {
      const result = await Camera.pickImages({
        quality: 86,
        limit: Math.max(1, getMediaCountLimit('image') - currentMediaCount('image')),
        correctOrientation: true,
        presentationStyle: 'fullscreen',
      });
      if (!result.photos.length) {
        return;
      }
      for (const photo of result.photos) {
        await uploadNativeImage(photo, 'gallery');
      }
    } catch (err) {
      if (isNativePickerCancelled(err)) {
        return;
      }
      setError(err instanceof Error ? `无法打开系统相册：${err.message}` : '无法打开系统相册，请检查照片权限后重试。');
    }
  };

  const removeMedia = (mediaNo: string) => {
    removeRuntimeMediaPreview(mediaNo);
    failedUploadFilesRef.current.delete(mediaNo);
    mediaPreviewsRef.current = mediaPreviewsRef.current.filter((item) => item.media_no !== mediaNo);
    setMediaNos((current) => current.filter((item) => item !== mediaNo));
    setMediaPreviews((current) => {
      const removed = current.find((item) => item.media_no === mediaNo);
      if (removed?.is_local || removed?.preview_url?.startsWith('blob:')) {
        revokeObjectUrl(removed.preview_url);
      }
      return current.filter((item) => item.media_no !== mediaNo);
    });
  };

  const retryFailedMedia = (mediaNo: string) => {
    if (uploading || audioRecording) return;
    const retryEntry = failedUploadFilesRef.current.get(mediaNo);
    if (!retryEntry) {
      setError('原文件已不可用，请重新选择素材。');
      return;
    }
    const { file, options } = retryEntry;
    removeMedia(mediaNo);
    void uploadMediaFile(file, options);
  };

  const resolveSubmitRecordType = () => {
    if (isHeightRecord) return 'text';
    if (mediaNos.length === 0) return form.record_type === 'mixed' ? 'text' : form.record_type;
    if (form.record_type === 'text') return 'mixed';
    return form.record_type;
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
      setError('媒体还在上传，请完成后再发布。');
      return;
    }
    if (audioRecording) {
      setError('录音还在进行，请先停止录音。');
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
    allowNavigationWithoutPromptRef.current = true;
    try {
      const nextRecordType = resolveSubmitRecordType();
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
      allowNavigationWithoutPromptRef.current = false;
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
    if (!canUseAi) {
      setError('当前账号暂未启用 AI 整理权限');
      return;
    }

    if (!form.title.trim() && !form.content_text.trim()) {
      setError('请先输入标题或正文，再使用整理建议');
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
    } catch (err) {
      setError(normalizeAiErrorMessage(err instanceof Error ? err.message : null, '整理建议暂时不可用，请手动填写内容后继续。'));
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
  const showMediaSection = !isHeightRecord && (form.record_type !== 'text' || mode === 'edit' || mediaNos.length > 0);
  const showAudioAction = showMediaSection && form.record_type !== 'video';
  const photoVideoAccept =
    form.record_type === 'video'
      ? 'video/*,video/mp4,video/webm,video/quicktime,video/3gpp'
      : 'image/*,video/*,image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/3gpp';
  const noticeMessage = error ?? selectorMessage;
  const isDraftRecord = form.status === 'draft';
  const primarySubmitLabel = mode === 'create' || isDraftRecord ? '发布' : '保存';

  const useCurrentLocation = async () => {
    setLocationLoading(true);
    setError(null);
    setSelectorMessage('正在请求手机定位…');
    try {
      const location = await getCurrentDeviceLocation();
      const accuracyText = location.accuracy !== null ? `，精度约 ${Math.round(location.accuracy)} 米` : '';
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
        background: 'var(--nl-page-bg)',
        color: 'var(--nl-ink)',
        padding: '0 18px calc(40px + env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
        <AppTopBar
          title=""
          backLabel={mode === 'create' ? '取消' : '返回'}
          backVariant={mode === 'create' ? 'text' : 'icon'}
          onBack={leaveRecordForm}
          style={{ position: 'relative', top: 'auto', margin: '0 -18px 8px', padding: 'calc(var(--nl-statusbar-top) + 12px) 18px 10px' }}
          action={
            <button
              type="submit"
              form="record-form"
              aria-label={primarySubmitLabel}
              style={{
                minHeight: '38px',
                border: 'none',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #b06a4a 0%, #8f4f36 70%)',
                color: '#ffffff',
                padding: '0 20px',
                fontSize: '14px',
                fontWeight: 740,
                letterSpacing: '0.04em',
                cursor: submitting || uploading || audioRecording ? 'not-allowed' : 'pointer',
                opacity: submitting || uploading || audioRecording ? 0.65 : 1,
                boxShadow: '0 8px 18px rgba(143, 79, 54, 0.28)',
              }}
              disabled={submitting || uploading || audioRecording}
            >
              {pendingAction === 'publish' ? `${primarySubmitLabel}中…` : primarySubmitLabel}
            </button>
          }
        />
        <header className="record-workspace-masthead" style={{ display: 'grid', gap: '6px', padding: '2px 2px 14px' }}>
          <span aria-hidden="true" style={{ width: '30px', height: '2px', background: 'var(--nl-primary-2)' }} />
          <h1
            aria-label={isHeightRecord ? '记录身高' : mode === 'create' ? '记录时光' : '编辑记录'}
            style={{ margin: 0, color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: '26px', lineHeight: 1.08, fontWeight: 780 }}
          >
            {isHeightRecord ? '身高记录' : mode === 'create' ? '新记录' : '编辑记录'}
          </h1>
          <span style={{ color: 'var(--nl-muted)', fontSize: '12px', lineHeight: 1.4, fontWeight: 560 }}>
            {currentChildName} · {form.event_time ? formatDateTimeDisplay(form.event_time) : '选择时间'}
          </span>
        </header>
        <form id="record-form" onSubmit={handleSubmit} style={{ ...rowStyle, gap: '18px', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
          <section
            style={{
              order: -1,
              padding: '0 2px 12px',
              background: 'transparent',
              borderBottom: '1px solid var(--nl-border-muted)',
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
                  width: '44px',
                  height: '44px',
                  borderRadius: '999px',
                  background: currentChildAvatar ? 'var(--nl-surface-soft)' : 'rgba(var(--nl-primary-rgb),0.1)',
                  border: '1px solid var(--nl-border-muted)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--nl-primary-2)',
                  fontWeight: 560,
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {currentChildAvatar ? <img src={currentChildAvatar} alt={currentChildName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : currentChildInitial}
              </div>
              <span style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
                <strong style={{ fontSize: '16px', color: 'var(--nl-ink)', fontWeight: 680, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentChildName}</strong>
              </span>
            </button>
            <AppDateInput
              ref={timeInputRef}
              type="datetime-local"
              aria-label="发生时间 *"
              value={form.event_time}
              displayValue={form.event_time ? formatDateTimeDisplay(form.event_time) : undefined}
              placeholder="选择时间"
              variant="line"
              onChange={(event) => {
                setError(null);
                setForm((current) => ({ ...current, event_time: event.target.value }));
              }}
            />
            </section>

          {!isHeightRecord ? (
            <section aria-label="记录类型" style={{ order: 3, display: 'grid', gap: '10px', padding: '2px 0 14px', borderBottom: '1px solid var(--nl-border-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 680 }}>记录方式</span>
                <span style={{ color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 520 }}>{recordTypeOptions.find((option) => option.value === form.record_type)?.label ?? '文字'}</span>
              </div>
              <div role="group" aria-label="选择记录方式" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
                {recordTypeOptions.map((option) => {
                  const active = form.record_type === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`记录方式：${option.label}`}
                      aria-pressed={active}
                      onClick={() => {
                        setError(null);
                        setForm((current) => ({ ...current, record_type: option.value }));
                        if (option.value === 'audio' || option.value === 'video') setMoreMediaOpen(true);
                        if (option.value === 'text') setMoreMediaOpen(false);
                      }}
                      style={{
                        minWidth: 0,
                        minHeight: '58px',
                        border: active ? '1px solid rgba(var(--nl-primary-rgb),0.42)' : '1px solid var(--nl-border-muted)',
                        borderRadius: '8px',
                        background: active ? 'rgba(var(--nl-primary-rgb),0.11)' : 'rgba(var(--nl-surface-rgb),0.22)',
                        color: active ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)',
                        padding: '8px 4px',
                        display: 'grid',
                        placeItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: active ? 700 : 560,
                        cursor: 'pointer',
                        boxShadow: active ? 'inset 0 1px 0 var(--nl-inset-highlight)' : 'none',
                      }}
                    >
                      <Icon size={18} strokeWidth={2.1} />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {isHeightRecord ? (
            <section
              style={{
                order: 1,
                display: 'grid',
                gap: '13px',
                borderRadius: 0,
                border: 'none',
                borderBottom: '1px solid var(--nl-border-muted)',
                background: 'transparent',
                padding: '8px 0 18px',
              }}
            >
              <div style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(var(--nl-primary-rgb),0.12)', color: 'var(--nl-primary-2)', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: 'none' }}>
                  <Ruler size={18} strokeWidth={2.3} />
                </span>
                <span style={{ minWidth: 0, display: 'grid', gap: '3px' }}>
                  <strong style={{ color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 620 }}>身高记录</strong>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                <label style={{ display: 'grid', gap: '7px', minWidth: 0 }}>
                  <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 520 }}>身高 cm</span>
                  <input
                    aria-label="身高 cm"
                    inputMode="decimal"
                    value={heightValue}
                    onChange={(event) => {
                      setError(null);
                      setHeightValue(normalizeMetricInput(event.target.value));
                    }}
                    placeholder="例如 92.5"
                    style={{ ...inputStyle, minHeight: '48px', borderRadius: '8px', fontWeight: 520 }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '7px', minWidth: 0 }}>
                  <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 520 }}>体重 kg</span>
                  <input
                    aria-label="体重 kg"
                    inputMode="decimal"
                    value={weightValue}
                    onChange={(event) => {
                      setError(null);
                      setWeightValue(normalizeMetricInput(event.target.value));
                    }}
                    style={{ ...inputStyle, minHeight: '48px', borderRadius: '8px', fontWeight: 520 }}
                  />
                </label>
              </div>
              <label style={{ display: 'grid', gap: '7px' }}>
                <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 520 }}>备注</span>
                <textarea
                  aria-label="身高记录备注"
                  value={metricNote}
                  onChange={(event) => {
                    setError(null);
                    setMetricNote(event.target.value);
                  }}
                  placeholder="备注"
                  style={{ ...inputStyle, minHeight: '82px', resize: 'none', lineHeight: 1.65, borderRadius: '8px' }}
                />
              </label>
            </section>
          ) : null}

          {showMediaSection ? (
            <section
              style={{
                order: 0,
                display: 'grid',
                gap: '12px',
                minHeight: mediaPreviews.length ? undefined : '210px',
                margin: '2px 0 0',
                borderRadius: '18px',
                border: '1px solid var(--nl-border-soft)',
                background: 'var(--nl-surface-soft)',
                padding: '16px 16px 18px',
                boxShadow: '0 12px 26px rgba(var(--nl-shadow-rgb), 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
                <strong style={{ color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-sans)', fontSize: '16px', lineHeight: 1.2, fontWeight: 720 }}>影像与声音</strong>
                {uploading ? <span style={{ minWidth: 0, color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>正在上传…</span> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                {form.record_type === 'video' ? (
                  <>
                    <MediaActionButton icon={<Video size={17} strokeWidth={2.2} />} label="拍摄视频" displayLabel="视频" onClick={() => { if (ensureMediaCountAvailable('video')) triggerMediaInput(videoCaptureInputRef.current); }} disabled={uploading || audioRecording} />
                    <MediaActionButton icon={<ImagePlus size={17} strokeWidth={2.2} />} label="从相册选择" displayLabel="相册" onClick={() => triggerMediaInput(galleryInputRef.current)} disabled={uploading || audioRecording} />
                  </>
                ) : form.record_type === 'audio' ? (
                  <>
                    <MediaActionButton
                      icon={audioRecording ? <Square size={16} strokeWidth={2.4} fill="currentColor" /> : <Mic size={17} strokeWidth={2.2} />}
                      label={audioRecording ? '停止录音' : '录制语音'}
                      displayLabel={audioRecording ? `停止 ${formatRecordingTime(audioRecordingSeconds)}` : '录制语音'}
                      onClick={() => (audioRecording ? stopAudioRecording() : void startAudioRecording())}
                      disabled={uploading}
                      style={audioRecording ? { color: 'var(--nl-danger)', background: 'var(--nl-danger-soft)', border: '1px solid var(--nl-danger-line)' } : undefined}
                    />
                    <MediaActionButton icon={<FileAudio size={17} strokeWidth={2.2} />} label="上传语音" displayLabel="上传语音" onClick={() => triggerMediaInput(audioLibraryInputRef.current)} disabled={uploading || audioRecording} />
                  </>
                ) : (
                  <>
                    <MediaActionButton icon={<ImagePlus size={17} strokeWidth={2.2} />} label="拍照记录" displayLabel="拍照" onClick={() => void openNativePhotoCapture()} disabled={uploading || audioRecording} />
                    <MediaActionButton icon={<Image size={17} strokeWidth={2.2} />} label="从相册添加" displayLabel="相册" onClick={() => void openNativeGalleryImages()} disabled={uploading || audioRecording} />
                    <MediaActionButton icon={<MoreHorizontal size={18} strokeWidth={2.2} />} label="更多媒体" displayLabel={moreMediaOpen ? '收起' : '更多'} ariaExpanded={moreMediaOpen} onClick={() => setMoreMediaOpen((current) => !current)} disabled={uploading || audioRecording} />
                  </>
                )}
              </div>
              <p style={{ margin: '0', color: 'var(--nl-muted)', fontSize: '10.5px', lineHeight: 1.45, fontWeight: 500, textAlign: 'center' }}>{getMediaLimitHint()}</p>
              {form.record_type !== 'audio' && form.record_type !== 'video' && moreMediaOpen ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', borderTop: '1px solid var(--nl-border-soft)', paddingTop: '12px' }}>
                  <MediaActionButton icon={<Video size={17} strokeWidth={2.2} />} label="拍摄视频" displayLabel="视频" onClick={() => { if (ensureMediaCountAvailable('video')) triggerMediaInput(videoCaptureInputRef.current); }} disabled={uploading || audioRecording} />
                  <MediaActionButton
                    icon={audioRecording ? <Square size={16} strokeWidth={2.4} fill="currentColor" /> : <Mic size={17} strokeWidth={2.2} />}
                    label={audioRecording ? '停止录音' : '录制语音'}
                    displayLabel={audioRecording ? `停止 ${formatRecordingTime(audioRecordingSeconds)}` : '录音'}
                    onClick={() => (audioRecording ? stopAudioRecording() : void startAudioRecording())}
                    disabled={uploading}
                    style={audioRecording ? { color: 'var(--nl-danger)', background: 'var(--nl-danger-soft)', border: '1px solid var(--nl-danger-line)' } : undefined}
                  />
                  <MediaActionButton icon={<FileAudio size={17} strokeWidth={2.2} />} label="上传语音" displayLabel="上传" onClick={() => triggerMediaInput(audioLibraryInputRef.current)} disabled={uploading || audioRecording} />
                </div>
              ) : null}
              {showAudioAction && (form.record_type === 'audio' || moreMediaOpen) ? (
                <p style={{ margin: '0', color: 'var(--nl-muted)', fontSize: '11.5px', lineHeight: 1.55, fontWeight: 500 }}>
                  {audioRecording ? '正在录音，点停止后自动上传。' : AUDIO_FORMAT_HINT}
                </p>
              ) : null}

              {mediaPreviews.length ? (
                <section
                  aria-label="媒体预览"
                  style={{
                    borderRadius: 0,
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    display: 'grid',
                    gap: '10px',
                    maxWidth: '100%',
                    boxShadow: 'none',
                  }}
                >
                  {mediaPreviews.length === 1 ? (
                    <div style={{ width: '100%' }}>
                      <MediaPreviewTile key={mediaPreviews[0].media_no} media={mediaPreviews[0]} featured style={mediaPreviews[0].media_type === 'audio' ? undefined : { height: 'auto', minHeight: 0, aspectRatio: '4 / 3', borderRadius: '14px' }} onRemove={removeMedia} onRetry={retryFailedMedia} onOpen={setFullscreenMedia} />
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', maxWidth: '100%' }}>
                      {mediaPreviews.map((media) => (
                        <MediaPreviewTile key={media.media_no} media={media} compact style={media.media_type === 'audio' ? undefined : { height: 'auto', minHeight: 0, aspectRatio: '1 / 1', borderRadius: '12px' }} onRemove={removeMedia} onRetry={retryFailedMedia} onOpen={setFullscreenMedia} />
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              <input ref={photoCaptureInputRef} aria-label="拍照记录" type="file" accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={(event) => void onFileChange(event)} disabled={uploading || audioRecording} style={{ display: 'none' }} />
              <input ref={videoCaptureInputRef} aria-label="拍摄视频" type="file" accept="video/*,video/mp4,video/webm,video/quicktime,video/3gpp" capture="environment" onChange={(event) => void onFileChange(event)} disabled={uploading || audioRecording} style={{ display: 'none' }} />
              <input ref={galleryInputRef} aria-label={form.record_type === 'video' ? '从相册选择视频' : '从相册添加'} type="file" accept={photoVideoAccept} multiple onChange={(event) => void onFileChange(event)} disabled={uploading || audioRecording} style={{ display: 'none' }} />
              <input ref={audioCaptureInputRef} aria-label="录制语音文件" type="file" accept={AUDIO_UPLOAD_ACCEPT} capture onChange={(event) => void onFileChange(event)} disabled={uploading || audioRecording} style={{ display: 'none' }} />
              <input ref={audioLibraryInputRef} aria-label="上传语音" type="file" accept={AUDIO_UPLOAD_ACCEPT} onChange={(event) => void onFileChange(event)} disabled={uploading || audioRecording} style={{ display: 'none' }} />
            </section>
          ) : null}

          {!isHeightRecord ? (
          <div className="record-editor-card" style={{ order: 1, display: 'grid', gap: '12px', borderRadius: 0, border: 'none', background: 'transparent', padding: '8px 0 10px', boxShadow: 'none' }}>
            <div className="record-editor-title-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--nl-border-soft)', padding: '0 0 14px' }}>
              <input
                ref={titleInputRef}
                className="record-title-input"
                style={{
                  width: '100%',
                  minWidth: 0,
                  minHeight: '42px',
                  border: 'none',
                  padding: '4px 0 2px',
                  fontFamily: 'var(--nl-font-display)',
                  fontSize: '25px',
                  fontWeight: 760,
                  lineHeight: 1.22,
                  color: 'var(--nl-ink)',
                  outline: 'none',
                  background: 'transparent',
                  boxSizing: 'border-box',
                }}
                placeholder="标题"
                value={form.title}
                onChange={(event) => {
                  setError(null);
                  setForm((current) => ({ ...current, title: event.target.value }));
                }}
              />
              {canUseAi ? (
                <button
                  type="button"
                  aria-label="整理建议"
                  onClick={() => void generateAiPreview()}
                  disabled={aiPreviewLoading}
                  style={{
                    ...compactSecondaryButtonStyle,
                    minHeight: '34px',
                    padding: '7px 10px',
                    gap: '5px',
                    fontSize: '11.5px',
                    fontWeight: 620,
                    whiteSpace: 'nowrap',
                    cursor: aiPreviewLoading ? 'not-allowed' : 'pointer',
                    opacity: aiPreviewLoading ? 0.72 : 1,
                  }}
                >
                  <Sparkles size={14} strokeWidth={2.2} />
                  {aiPreviewLoading ? '整理中…' : '整理建议'}
                </button>
              ) : null}
            </div>
              <textarea
                ref={contentInputRef}
                className="record-body-input"
                style={{
                  width: '100%',
                  minHeight: '172px',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  background: 'transparent',
                  padding: '2px 0 0',
                  fontSize: '16.5px',
                  lineHeight: 1.88,
                  color: 'var(--nl-muted-strong)',
                  boxSizing: 'border-box',
                }}
                placeholder="正文"
              value={form.content_text}
              onChange={(event) => {
                setError(null);
                setForm((current) => ({ ...current, content_text: event.target.value }));
              }}
            />
              {canUseAi ? (
                <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.58, fontSize: '11.5px' }}>
                  整理建议仅作参考，失败不影响记录。
                </p>
              ) : null}
              {canUseAi && (aiPreviewSummary || aiPreviewTags.length) ? (
                <section
                  style={{
                    borderRadius: 0,
                    background: 'transparent',
                    border: 'none',
                    borderTop: '1px solid var(--nl-border-soft)',
                    padding: '12px 0 0',
                    display: 'grid',
                    gap: '10px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(var(--nl-primary-rgb),0.1)', color: 'var(--nl-primary-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Sparkles size={15} strokeWidth={2.2} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--nl-ink)', fontSize: '12px', fontWeight: 620 }}>整理建议</strong>
                      {aiPreviewSummary ? <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '13px', lineHeight: 1.72 }}>{aiPreviewSummary}</p> : null}
                    </div>
                  </div>
                  {aiPreviewTags.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', paddingLeft: '38px' }}>
                      {aiPreviewTags.map((tag, index) => (
                        <span key={`${tag}-${index}`} style={{ borderRadius: '8px', background: 'transparent', border: '1px solid var(--nl-border-muted)', color: 'var(--nl-primary-2)', padding: '5px 9px', fontSize: '11px', fontWeight: 540 }}>
                          #{tag}
                        </span>
                      ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
          ) : null}

          <div style={{ order: 2, display: 'grid', gap: '6px', borderRadius: 0, border: 'none', borderBottom: '1px solid var(--nl-border-muted)', background: 'transparent', padding: '0 0 11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 620 }}>补充详情</span>
            </div>

            <section style={{ display: 'grid', gap: '8px' }}>
              <div
                style={{
                  minHeight: '46px',
                  borderRadius: 0,
                  border: 'none',
                  borderBottom: '1px solid var(--nl-border-soft)',
                  background: 'transparent',
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
                      fontWeight: 650,
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
                    borderLeft: '1px solid var(--nl-border-soft)',
                    background: 'transparent',
                    color: 'var(--nl-primary-2)',
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    fontWeight: 560,
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
                      style={{ ...compactChoiceButtonStyle, minHeight: '36px', padding: '6px 10px', fontSize: '11px' }}
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
                      style={{ ...compactChoiceButtonStyle, minHeight: '36px', padding: '6px 10px', fontSize: '11px' }}
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
                    borderRadius: 0,
                    border: 'none',
                    borderBottom: '1px solid var(--nl-border-soft)',
                    background: 'transparent',
                    padding: '0 13px 0 38px',
                    fontSize: '13px',
                      fontWeight: 520,
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
              border: 'none',
              borderTop: '1px solid var(--nl-border-soft)',
              borderBottom: '1px solid var(--nl-border-soft)',
              borderRadius: 0,
              background: 'transparent',
              padding: '9px 0',
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
                borderRadius: '8px',
                background: 'transparent',
                display: 'grid',
                placeItems: 'center',
                color: form.record_type === 'milestone' ? 'var(--nl-primary-2)' : 'var(--nl-muted)',
                flexShrink: 0,
                boxShadow: 'none',
              }}
            >
              <Star size={18} strokeWidth={2.3} fill={form.record_type === 'milestone' ? 'currentColor' : 'none'} />
            </span>
            <span style={{ display: 'grid', gap: '3px', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--nl-ink)' }}>里程碑</span>
            </span>
            <span
              aria-hidden="true"
              style={{
                minWidth: '58px',
                minHeight: '30px',
                borderRadius: 0,
                background: 'transparent',
                color: form.record_type === 'milestone' ? 'var(--nl-primary-2)' : 'var(--nl-muted)',
                border: 'none',
                borderBottom: form.record_type === 'milestone' ? '1px solid rgba(var(--nl-primary-rgb),0.26)' : '1px solid var(--nl-border-soft)',
                padding: '3px 0',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 620,
                flexShrink: 0,
              }}
            >
              {form.record_type === 'milestone' ? '已标记' : '标记'}
            </span>
          </button>

          {mode === 'create' || isDraftRecord ? (
            <button
              type="button"
              className="nl-form-draft-button"
              style={{ order: 5, width: '100%', marginTop: '2px' }}
              onClick={() => void submitRecord('draft')}
              disabled={submitting || uploading || audioRecording}
            >
              {pendingAction === 'draft' ? '保存中…' : '保存草稿'}
            </button>
          ) : null}

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
        {discardConfirmOpen ? (
          <DiscardDraftConfirmDialog
            onCancel={() => setDiscardConfirmOpen(false)}
            onConfirm={leaveAfterDiscard}
          />
        ) : null}
        <MediaFullscreenDialog media={fullscreenMedia} mediaList={mediaPreviews} onClose={() => setFullscreenMedia(null)} />
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
  const { user } = useAuth();
  const [primaryMediaRetryKey, setPrimaryMediaRetryKey] = useState(0);
  const { data, loading, error, setData } = useAsyncData<RecordDetail | null>(
    async () => {
      if (!params.record_no) return null;
      return webApi.detailRecord(params.record_no);
    },
    [params.record_no, primaryMediaRetryKey],
  );
  const [aiJob, setAiJob] = useState<AiJobDetail | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiActionLabel, setAiActionLabel] = useState('摘要');
  const [aiError, setAiError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<FullscreenMediaPreview | null>(null);
  const [primaryMediaLoadFailed, setPrimaryMediaLoadFailed] = useState(false);

  useEffect(() => {
    if (!aiJob || !['pending', 'processing'].includes(aiJob.status)) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const next = await webApi.detailAiJob(aiJob.job_no);
        if (cancelled) return;
        setAiJob(next);
        if (next.status === 'success' && params.record_no) {
          if (!cancelled) {
            await refreshAiRecordDetail(params.record_no, setData, setAiError);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setAiError(normalizeAiErrorMessage(err instanceof Error ? err.message : null, '整理状态暂时无法更新，请稍后再试。'));
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
    if (!canUseAi) {
      setAiError('当前账号暂未启用整理建议权限');
      return;
    }
    setAiLoading(true);
    setAiActionLabel(actionLabel);
    setAiError(null);
    try {
      const result = await webApi.createAiJob(params.record_no, { job_types: [jobType] });
      const nextJob = result.list[0] ?? null;
      setAiJob(nextJob);
      if (nextJob?.status === 'success') {
        await refreshAiRecordDetail(params.record_no, setData, setAiError);
      }
    } catch (err) {
      setAiError(normalizeAiErrorMessage(err instanceof Error ? err.message : null, fallbackError));
    } finally {
      setAiLoading(false);
    }
  };

  const onDelete = async () => {
    if (!data) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await webApi.deleteRecord(data.record_no);
      setDeleteConfirmOpen(false);
      navigate('/timeline', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const primaryMedia = data?.media_list[0] ?? null;
  const primaryMediaUrl = useCachedMediaUrl(primaryMedia?.media_no, primaryMedia?.access_url ?? null, primaryMedia?.media_type, {
    cacheRemote: Boolean(primaryMedia),
  }) ?? primaryMedia?.access_url ?? null;
  useEffect(() => {
    setPrimaryMediaLoadFailed(false);
  }, [primaryMedia?.media_no, primaryMediaUrl]);
  const primaryMediaOpenable = Boolean(primaryMedia && (primaryMediaUrl || primaryMedia.access_url) && primaryMedia.media_type !== 'audio');
  const primaryMediaPreviewUrl = primaryMediaUrl ?? primaryMedia?.access_url ?? null;
  const retryPrimaryMedia = () => {
    setPrimaryMediaLoadFailed(false);
    setPrimaryMediaRetryKey((current) => current + 1);
  };
  const canUseAi = hasAiPlusAccess(user);
  const aiJobSuggestedTitle =
    aiJob?.status === 'success' && aiJob.job_type === 'record_title' && typeof aiJob.output_json?.suggested_title === 'string'
      ? aiJob.output_json.suggested_title.trim()
      : null;
  const generatedTitle = canUseAi ? data?.ai_generated_title?.trim() || aiJobSuggestedTitle || null : null;
  const displayTitle = data ? (data.title?.trim() || generatedTitle || '未命名记录') : '未命名记录';
  const aiJobProcessing = aiJob?.status === 'pending' || aiJob?.status === 'processing';
  const secondaryMediaList = data?.media_list.slice(primaryMedia ? 1 : 0) ?? [];
  const detailDateText = data ? formatAppDate(data.event_time) : '';
  const detailCreatorName = data
    ? data.creator_user_no === user?.user_no
      ? '我'
      : /^(?:codex(?:ui)?\d[a-z0-9]*|native_[a-z0-9_]+|1\d{10})$/i.test(data.creator_name.trim())
        ? '家人'
        : normalizeDisplayName(data.creator_name, '家人')
    : '';
  const detailMetaText = [detailDateText, detailCreatorName].filter(Boolean).join(' · ');
  const detailMetadataItems = data ? [
    { label: '类型', value: recordTypeLabel(data.record_type, data.is_milestone) },
    { label: '时间', value: formatAppDateTime(data.event_time) },
    { label: '可见范围', value: data.status === 'draft' ? '仅自己可见（草稿）' : visibilityScopeLabel(data.visibility_scope) },
    { label: '地点', value: normalizeLocationText(data.location_text) || '未填写' },
    { label: '状态', value: recordStatusLabel(data.status) },
  ] : [];

  return (
    <PageShell
      title="记录详情"
      hideHeader
    >
      <AppTopBar
        title=""
        backTo="/timeline"
        onBack={() => {
        if (window.history.length > 1) {
          navigate(-1);
          return;
        }
        navigate('/timeline');
      }}
        style={{ margin: '0 calc(var(--nl-content-inline) * -1)' }}
      />
      {loading ? <Panel><EmptyState message="正在加载记录详情…" /></Panel> : null}
      {error ? <Panel><EmptyState message={`加载失败：${error}`} /></Panel> : null}
      {data ? (
        <article style={{ display: 'grid', gap: '22px', paddingBottom: '10px' }}>
          <section style={{ borderRadius: 0, border: 'none', background: 'transparent', overflow: 'visible', boxShadow: 'none', padding: 0 }}>
            {primaryMedia ? (
              primaryMedia.media_type === 'audio' ? (
                <div data-testid="record-primary-media-preview" style={{ padding: 0, borderRadius: 8, background: 'transparent', border: 'none' }}>
                  <MediaPreviewTile media={{ ...primaryMedia, preview_url: primaryMediaUrl ?? primaryMedia.access_url }} onOpen={setFullscreenMedia} />
                </div>
              ) : (
                <div
                  className="nl-media-interaction"
                  data-testid="record-primary-media-preview"
                  aria-label={mediaPreviewLabel(primaryMedia.media_type)}
                  role={primaryMediaOpenable ? 'button' : undefined}
                  tabIndex={primaryMediaOpenable ? 0 : undefined}
                   onClick={primaryMediaOpenable ? () => setFullscreenMedia({ ...primaryMedia, preview_url: primaryMediaPreviewUrl }) : undefined}
                  onKeyDown={
                    primaryMediaOpenable
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                           setFullscreenMedia({ ...primaryMedia, preview_url: primaryMediaPreviewUrl });
                          }
                        }
                      : undefined
                  }
                  style={{ position: 'relative', margin: '0 calc(var(--nl-content-inline) * -1)', background: 'var(--nl-bg-warm)', cursor: primaryMediaOpenable ? 'pointer' : 'default', borderRadius: 0, overflow: 'hidden', border: 'none', boxShadow: '0 26px 64px rgba(var(--nl-shadow-rgb),0.16)', WebkitTapHighlightColor: 'transparent' }}
                >
                  {!primaryMediaUrl ? (
                    <div style={{ width: '100%', aspectRatio: '4 / 4.55', display: 'grid', placeItems: 'center', alignContent: 'center', gap: '10px', padding: '24px', color: 'var(--nl-muted)', background: 'var(--nl-surface-soft)', textAlign: 'center', boxSizing: 'border-box' }}>
                      <Image size={34} strokeWidth={1.7} />
                      <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 700 }}>媒体正在准备</strong>
                      <span style={{ maxWidth: '240px', fontSize: '12px', lineHeight: 1.55 }}>原始媒体仍可在下方关联媒体中查看状态。</span>
                      <button type="button" onClick={(event) => { event.stopPropagation(); retryPrimaryMedia(); }} style={{ minHeight: '38px', border: '1px solid var(--nl-border-muted)', borderRadius: '8px', background: 'var(--nl-dialog-bg)', color: 'var(--nl-primary-2)', padding: '0 13px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>重新加载</button>
                    </div>
                  ) : !primaryMediaLoadFailed && primaryMedia.media_type === 'video' ? (
                    <>
                      <video key={`primary-video-${primaryMedia.media_no}-${primaryMediaRetryKey}-${primaryMediaUrl}`} src={primaryMediaUrl} muted playsInline preload="metadata" onError={() => setPrimaryMediaLoadFailed(true)} style={{ width: '100%', aspectRatio: '4 / 4.55', objectFit: 'cover', display: 'block', background: 'var(--nl-bg-warm)', pointerEvents: 'none', WebkitTapHighlightColor: 'transparent' }} />
                      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                        <span style={{ width: 58, height: 58, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--nl-on-dark)', background: 'rgba(37,31,24,0.46)', WebkitBackdropFilter: 'blur(14px)', backdropFilter: 'blur(14px)', boxShadow: '0 18px 42px rgba(var(--nl-shadow-rgb),0.26)' }}>
                          <PlayCircle size={32} strokeWidth={1.65} fill="rgba(255,250,241,0.18)" />
                        </span>
                      </span>
                    </>
                  ) : !primaryMediaLoadFailed ? (
                    <img key={`primary-image-${primaryMedia.media_no}-${primaryMediaRetryKey}-${primaryMediaUrl}`} src={primaryMediaUrl} alt={displayTitle || primaryMedia.original_name || '记录封面'} loading="eager" decoding="async" onError={() => setPrimaryMediaLoadFailed(true)} style={{ width: '100%', aspectRatio: '4 / 4.55', objectFit: 'cover', display: 'block', pointerEvents: primaryMediaOpenable ? 'none' : 'auto', WebkitTapHighlightColor: 'transparent' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '4 / 4.55', display: 'grid', placeItems: 'center', alignContent: 'center', gap: '10px', padding: '24px', color: 'var(--nl-muted)', background: 'var(--nl-surface-soft)', textAlign: 'center', boxSizing: 'border-box' }}>
                      <Image size={34} strokeWidth={1.7} />
                      <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 700 }}>媒体暂时无法加载</strong>
                      <span style={{ maxWidth: '240px', fontSize: '12px', lineHeight: 1.55 }}>记录正文和媒体状态仍然保留。</span>
                      <button type="button" onClick={(event) => { event.stopPropagation(); retryPrimaryMedia(); }} style={{ minHeight: '38px', border: '1px solid var(--nl-border-muted)', borderRadius: '8px', background: 'var(--nl-dialog-bg)', color: 'var(--nl-primary-2)', padding: '0 13px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>重试</button>
                    </div>
                  )}
                  <span aria-hidden="true" style={{ position: 'absolute', inset: '45% 0 0', background: 'linear-gradient(180deg, rgba(20,16,12,0), rgba(20,16,12,0.5))', pointerEvents: 'none' }} />
                  {data.media_list.length > 1 ? (
                    <span style={{ position: 'absolute', right: 18, bottom: 18, color: 'var(--nl-on-dark)', fontSize: 12, fontWeight: 820, textShadow: 'var(--nl-text-shadow-hero)' }}>
                      01 / {String(data.media_list.length).padStart(2, '0')}
                    </span>
                  ) : null}
                </div>
              )
            ) : null}
            <div style={{ padding: primaryMedia && primaryMediaUrl ? '24px 2px 0' : '8px 0 0', display: 'grid', gap: '20px' }}>
              <div style={{ display: 'grid', gap: '9px' }}>
                <span style={{ color: 'var(--nl-muted)', fontSize: 12, lineHeight: 1.25, fontWeight: 720 }}>{detailMetaText}</span>
                <h1 style={{ margin: 0, color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: '31px', lineHeight: 1.08, fontWeight: 780 }}>{displayTitle}</h1>
              </div>
              <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '15px', lineHeight: 1.9, fontWeight: 450, whiteSpace: 'pre-wrap' }}>{data.content_text ?? '暂无正文'}</p>
              <div style={{ display: 'grid', borderTop: '1px solid var(--nl-border-soft)' }}>
                {detailMetadataItems.map((item) => (
                  <div key={item.label} style={{ minHeight: 42, display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--nl-border-soft)', padding: '8px 0' }}>
                    <span style={{ color: 'var(--nl-muted)', fontSize: 11, lineHeight: 1.3, fontWeight: 620 }}>{item.label}</span>
                    <span style={{ color: 'var(--nl-muted-strong)', fontSize: 12, lineHeight: 1.45, fontWeight: 560, textAlign: 'right', overflowWrap: 'anywhere' }}>{item.value}</span>
                  </div>
                ))}
              </div>
              {data.tags.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>{data.tags.map((tag, index) => <span key={`${data.record_no}-${tag}-${index}`} style={{ color: 'var(--nl-primary-2)', fontSize: 11, fontWeight: 620 }}>#{tag}</span>)}</div> : null}
            </div>
          </section>

              {canUseAi ? (
              <section style={{ borderRadius: 0, background: 'transparent', border: 'none', borderTop: '1px solid rgba(var(--nl-shadow-rgb),0.08)', padding: '18px 0 0', display: 'grid', gap: '11px', boxShadow: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', alignItems: 'start', gap: '10px' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: 0, background: 'transparent', color: 'var(--nl-primary-2)', display: 'grid', placeItems: 'center' }}>
                    <Sparkles size={15} strokeWidth={2.2} />
                  </span>
                  <div style={{ minWidth: 0, display: 'grid', gap: '5px' }}>
                    <strong style={{ color: 'var(--nl-ink)', fontSize: '13px', fontWeight: 600 }}>整理建议</strong>
                    <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '13px', lineHeight: 1.62 }}>
                      {data.ai_summary ?? (aiJobProcessing ? `${aiActionLabel}正在处理中，请稍候…` : generatedTitle ? '标题建议已生成。' : '当前还没有整理摘要。')}
                    </p>
                    <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.6 }}>建议内容仅作参考，失败不影响记录。</p>
                    {generatedTitle ? (
                      <p style={{ margin: 0, color: 'var(--nl-ink)', fontSize: '13px', lineHeight: 1.6, fontWeight: 560 }}>
                        建议标题：{generatedTitle}
                      </p>
                    ) : null}
                    {data.ai_status ? <p style={{ ...helperTextStyle, color: 'var(--nl-primary-2)' }}>整理状态：{aiJobStatusLabel(data.ai_status)}</p> : null}
                    {aiJob?.status === 'success' ? <p style={{ ...helperTextStyle, color: 'var(--nl-success)' }}>{aiActionLabel}已生成并同步到记录详情。</p> : null}
                    {aiJob?.status === 'failed' ? <p style={{ ...helperTextStyle, color: 'var(--nl-danger)' }}>整理失败：{normalizeAiErrorMessage(aiJob.error_message)}</p> : null}
                    {aiError ? <p style={{ ...helperTextStyle, color: 'var(--nl-danger)' }}>{aiError}</p> : null}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  <button type="button" style={{ ...compactSecondaryButtonStyle, minHeight: '38px', justifyContent: 'center', minWidth: 0, padding: '8px 10px', fontSize: '12px', cursor: aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing' ? 'not-allowed' : 'pointer', opacity: aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing' ? 0.64 : 1 }} onClick={() => void onGenerateAi('record_title', '标题', '标题建议生成失败')} disabled={aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing'}>
                    {aiLoading && aiActionLabel === '标题' ? '生成中…' : '标题'}
                  </button>
                  <button type="button" style={{ ...compactSecondaryButtonStyle, minHeight: '38px', justifyContent: 'center', minWidth: 0, padding: '8px 10px', fontSize: '12px', cursor: aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing' ? 'not-allowed' : 'pointer', opacity: aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing' ? 0.64 : 1 }} onClick={() => void onGenerateAi('record_summary', '摘要', '摘要建议生成失败')} disabled={aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing'}>
                    {aiLoading && aiActionLabel === '摘要' ? '生成中…' : '摘要'}
                  </button>
                  <button type="button" style={{ ...compactSecondaryButtonStyle, minHeight: '38px', justifyContent: 'center', minWidth: 0, padding: '8px 10px', fontSize: '12px', cursor: aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing' ? 'not-allowed' : 'pointer', opacity: aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing' ? 0.64 : 1 }} onClick={() => void onGenerateAi('record_tags', '标签', '标签建议生成失败')} disabled={aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing'}>
                    {aiLoading && aiActionLabel === '标签' ? '生成中…' : '标签'}
                  </button>
                </div>
              </section>
              ) : null}

          {secondaryMediaList.length > 0 ? (
            <Panel style={{ padding: '15px 0 0', borderRadius: 0, border: 'none', borderTop: '1px solid var(--nl-border-muted)', background: 'transparent', boxShadow: 'none' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
                  <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 700 }}>关联媒体</strong>
                  <span style={{ color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 600 }}>{data.media_list.length} 项</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                  {secondaryMediaList.map((media) => (
                    <MediaPreviewTile key={media.media_no} media={media} compact onOpen={setFullscreenMedia} />
                  ))}
                </div>
              </div>
            </Panel>
          ) : null}

          <div style={{ ...buttonRowStyle, gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px', paddingTop: '4px' }}>
            <button type="button" style={{ ...primaryButtonStyle, width: '100%', minWidth: 0, minHeight: '48px', justifyContent: 'center' }} onClick={() => navigate(`/record/${data.record_no}/edit`)}>
              编辑记录
            </button>
            <button type="button" style={{ width: 'fit-content', minHeight: '42px', justifySelf: 'center', border: 'none', background: 'transparent', color: 'var(--nl-danger)', padding: '8px 14px', fontSize: '12px', fontWeight: 560, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.64 : 0.78 }} onClick={() => {
              setDeleteError(null);
              setDeleteConfirmOpen(true);
            }} disabled={deleting}>
              {deleting ? '删除中…' : '删除记录'}
            </button>
          </div>
        </article>
      ) : null}
      {data && deleteConfirmOpen ? (
        <DeleteRecordConfirmDialog
          recordTitle={displayTitle}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) setDeleteConfirmOpen(false);
          }}
          onConfirm={() => void onDelete()}
        />
      ) : null}
      <MediaFullscreenDialog media={fullscreenMedia} mediaList={data?.media_list} onClose={() => setFullscreenMedia(null)} />
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
      <PageShell title="编辑记录" backTo={params.record_no ? `/record/${params.record_no}` : '/timeline'}>
        <Panel>
          <EmptyState message="加载中…" />
        </Panel>
      </PageShell>
    );
  }

  if (error || !data || !initialValue) {
    return (
      <PageShell title="编辑记录" backTo="/timeline">
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
