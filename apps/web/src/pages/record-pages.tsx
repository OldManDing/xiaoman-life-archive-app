import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import { BookOpen, Check, ChevronRight, Clock, Eye, FileAudio, Image, ImagePlus, MapPin, Mic, PlayCircle, Sparkles, Star, Tag, Video, X } from 'lucide-react';
import { Camera, CameraResultType, CameraSource, type GalleryPhoto, type Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { AiJobDetail, LocationSuggestion, RecordDetail } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { aiJobStatusLabel, mediaTypeLabel, recordStatusLabel, recordTypeLabel, visibilityScopeLabel } from '../shared/labels';
import { createPersistableMediaPreview, resolveMediaPreviewUrl, resolveStoredMediaUrl, saveLocalMediaPreview } from '../shared/localMediaPreview';
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
};

type MediaType = MediaPreview['media_type'];
type NativeImageAsset = Pick<Photo | GalleryPhoto, 'webPath' | 'format'>;

const tagOptions = ['生日纪念', '户外日常', '语言发育', '大动作发展', '睡前时光', '亲子陪伴', '第一次', '家庭日常'];

const locationOptions = ['家里', '小区', '公园', '学校', '医院', '游乐场', '爷爷奶奶家', '外婆家'];

const metadataPanelStyle = {
  background: 'rgba(255,255,255,0.88)',
  padding: '0',
  display: 'grid',
  gap: '12px',
} as const;

const metadataSelectStyle = {
  minHeight: '44px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(126,145,170,0.24)',
  boxShadow: '0 8px 18px rgba(25,35,55,0.06)',
} as const;

const metadataIconSelectStyle = {
  ...metadataSelectStyle,
  paddingLeft: '36px',
} as const;

const metadataPillStyle = {
  minHeight: '44px',
  borderRadius: '999px',
  border: '1px solid rgba(126,145,170,0.24)',
  background: 'rgba(255,255,255,0.82)',
  boxShadow: '0 6px 14px rgba(25,35,55,0.05)',
} as const;

const compactPillButtonStyle = {
  ...secondaryButtonStyle,
  minHeight: '44px',
  padding: '8px 13px',
  borderRadius: '999px',
  fontSize: '12px',
  boxShadow: '0 8px 18px rgba(25,35,55,0.07)',
} as const;

const selectedChipButtonStyle = {
  minHeight: '44px',
  border: '1px solid rgba(126,145,170,0.24)',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.92)',
  color: '#334155',
  padding: '7px 11px',
  fontSize: '12px',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  cursor: 'pointer',
  boxShadow: '0 8px 18px rgba(25,35,55,0.06)',
} as const;

const mediaActionCardStyle: CSSProperties = {
  borderRadius: '24px',
  border: '1px solid rgba(126,145,170,0.22)',
  background: 'rgba(255,255,255,0.96)',
  padding: '15px',
  display: 'grid',
  gap: '12px',
  boxShadow: '0 16px 34px rgba(25,35,55,0.09)',
};
const mediaActionButtonStyle: CSSProperties = {
  minHeight: '62px',
  width: '100%',
  borderRadius: '20px',
  border: '1px solid rgba(126,145,170,0.22)',
  background: 'rgba(255,255,255,0.9)',
  color: '#172033',
  padding: '11px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  textAlign: 'left',
  cursor: 'pointer',
  boxShadow: '0 10px 22px rgba(25,35,55,0.07)',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease',
};

const mediaActionIconStyle: CSSProperties = {
  width: '34px',
  height: '34px',
  borderRadius: '14px',
  background: '#edf7f5',
  color: '#17342f',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
};

const mediaActionLabelStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
  letterSpacing: 0,
};

const mediaActionDescriptionStyle: CSSProperties = {
  color: '#687386',
  fontSize: '12px',
  lineHeight: 1.5,
};

const sectionEyebrowStyle: CSSProperties = {
  color: '#687386',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

const MediaActionButton = ({
  icon,
  label,
  description,
  onClick,
  disabled,
  style,
}: {
  icon: ReactNode;
  label: string;
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
  >
    <span style={mediaActionIconStyle}>{icon}</span>
    <span style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
      <span style={mediaActionLabelStyle}>{label}</span>
      <span style={mediaActionDescriptionStyle}>{description}</span>
    </span>
  </button>
);

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

const RecordForm = ({
  mode,
  initialValue,
  initialFocus,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initialFocus?: 'media' | 'content' | null;
  initialValue: {
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
  const [form, setForm] = useState(initialValue);
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
  const [mediaNos, setMediaNos] = useState<string[]>(initialValue.media_nos);
  const [mediaPreviews, setMediaPreviews] = useState<MediaPreview[]>(initialValue.media_items);
  const mediaPreviewsRef = useRef<MediaPreview[]>(initialValue.media_items);
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
  const currentChildAvatar = currentChild?.avatar_url && !isGeneratedSvgAvatar(currentChild.avatar_url) ? resolveStoredMediaUrl(currentChild.avatar_url) : null;
  const selectedTags = splitTags(form.tags);

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
    setForm(initialValue);
    setMediaNos(initialValue.media_nos);
    setMediaPreviews(initialValue.media_items);
  }, [initialValue]);

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
            setPoiSuggestions(result.list);
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
          URL.revokeObjectURL(item.preview_url);
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
    const previewUrl = URL.createObjectURL(uploadFile);
    let previewSource = previewUrl;
    let shouldRevokePreview = true;
    try {
      const uploadToken = await webApi.createUploadToken({
        child_no: childNo,
        file_name: uploadFile.name,
        mime_type: resolveFileMimeType(uploadFile) || uploadFile.type,
        size_bytes: uploadFile.size,
        media_type: mediaType,
      });

      if (uploadToken.mock_upload) {
        try {
          previewSource = await createPersistableMediaPreview(uploadFile);
          shouldRevokePreview = false;
          saveLocalMediaPreview(uploadToken.media_no, previewSource);
          URL.revokeObjectURL(previewUrl);
        } catch {
          previewSource = previewUrl;
        }
      }

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
      setMediaPreviews((current) => [
        ...current,
        {
          media_no: uploadToken.media_no,
          preview_url: previewSource,
          media_type: mediaType,
          original_name: uploadFile.name,
          is_local: shouldRevokePreview,
        },
      ]);
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      setError(err instanceof Error ? err.message : '上传失败');
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
    setMediaNos((current) => current.filter((item) => item !== mediaNo));
    setMediaPreviews((current) => {
      const removed = current.find((item) => item.media_no === mediaNo);
      if (removed?.is_local) {
        URL.revokeObjectURL(removed.preview_url);
      }
      return current.filter((item) => item.media_no !== mediaNo);
    });
  };

  const submitRecord = async (nextStatus = form.status) => {
    const childNo = form.child_no || currentChild?.child_no || (await waitForSelectedChildNo());
    if (nextStatus === 'published') {
      const title = form.title.trim();
      const contentText = form.content_text.trim();
      if (!childNo) {
        setError('发布前请选择孩子档案');
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
      if (form.record_type === 'mixed' && mediaNos.length === 0) {
        setError('图文记录发布前请至少上传一张照片或视频');
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
      const nextMediaNos = form.record_type === 'text' ? [] : mediaNos;
      const locationText = normalizeLocationText(form.location_text);
      await onSubmit({
        child_no: childNo,
        record_type: form.record_type,
        title: form.title.trim() || undefined,
        content_text: form.content_text.trim() || undefined,
        media_nos: nextMediaNos,
        tags: splitTags(form.tags),
        location_text: locationText || undefined,
        visibility_scope: form.visibility_scope,
        event_time: form.event_time ? new Date(form.event_time).toISOString() : undefined,
        is_milestone: form.record_type === 'milestone',
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
    ...poiSuggestions.filter((suggestion) => !filteredLocationOptions.includes(suggestion.name)),
  ].slice(0, 5);
  const manualLocationText = normalizeLocationText(form.location_text);
  const hasManualLocationSuggestion =
    manualLocationText.length >= 2 &&
    !mergedLocationSuggestions.some((location) => {
      const locationText = formatLocationText(location);
      return locationText === manualLocationText || location.name.trim() === manualLocationText;
    });
  const requiredItems = [
    { label: '标题', done: Boolean(form.title.trim()) },
    { label: '正文', done: Boolean(form.content_text.trim()) },
    { label: '时间', done: Boolean(form.event_time) },
  ];
  const completionCount = requiredItems.filter((item) => item.done).length;
  const completionPercent = Math.round((completionCount / requiredItems.length) * 100);
  const showMediaSection = form.record_type !== 'text';
  const showPhotoVideoAction = showMediaSection && form.record_type !== 'audio';
  const showAudioAction = showMediaSection && form.record_type !== 'video';
  const photoVideoAccept =
    form.record_type === 'video'
      ? 'video/*,video/mp4,video/webm,video/quicktime,video/3gpp'
      : 'image/*,video/*,image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/3gpp';
  const mediaHint =
    form.record_type === 'video'
      ? '支持 MP4、WebM、MOV 视频'
      : form.record_type === 'audio'
        ? '支持 M4A、MP3、WAV、WebM、OGG 语音'
      : '支持 JPG、PNG、WebP、HEIC、MP4、WebM、M4A、MP3、WAV';

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
      if (nearby?.list.length) {
        setPoiSuggestions(nearby.list.slice(0, 5));
      }
      const nearestLocation = nearby?.list.find((item) => item.name.trim() || item.address?.trim());
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
        background: '#f4f8fc',
        color: '#172033',
        padding: '0 20px calc(40px + env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
      }}
    >
        <AppTopBar
          title={mode === 'create' ? '记录时光' : '编辑记录'}
          backLabel={mode === 'create' ? '取消' : '返回'}
          backVariant={mode === 'create' ? 'text' : 'icon'}
          onBack={() => {
            if (mode === 'create') {
              navigate('/home');
              return;
            }
            navigate(-1);
          }}
          background="rgba(248, 251, 255, 0.84)"
          style={{ position: 'relative', top: 'auto', margin: '0 -20px 20px', padding: 'calc(28px + env(safe-area-inset-top)) 20px 18px' }}
          action={
            <button
              type="submit"
              form="record-form"
              style={{
                ...primaryButtonStyle,
                minHeight: '44px',
                borderRadius: '16px',
                background: '#17342f',
                padding: '10px 14px',
                fontSize: '12px',
                letterSpacing: '0.02em',
                cursor: submitting || uploading ? 'not-allowed' : 'pointer',
                boxShadow: '0 14px 28px rgba(23,52,47,0.24)',
                opacity: submitting || uploading ? 0.72 : 1,
              }}
              disabled={submitting || uploading}
            >
              {pendingAction === 'publish' ? (mode === 'create' ? '发布中…' : '保存中…') : mode === 'create' ? '发布' : '保存'}
            </button>
          }
        />
        <form id="record-form" onSubmit={handleSubmit} style={{ ...rowStyle, gap: '24px' }}>
          <section
            style={{
              display: 'grid',
              gap: '14px',
            }}
          >
            <div
              style={{
                borderRadius: '28px',
                padding: '17px',
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid rgba(126,145,170,0.2)',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 20px 42px rgba(25,35,55,0.11)',
              }}
            >
              <div style={{ display: 'grid', gap: '7px' }}>
                <span style={sectionEyebrowStyle}>发布对象</span>
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
                    gap: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '999px',
                      background: currentChildAvatar ? '#ffffff' : '#eef6ff',
                      border: '2px solid rgba(255,255,255,0.94)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#17342f',
                      fontWeight: 700,
                      boxShadow: '0 10px 20px rgba(25,35,55,0.13)',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {currentChildAvatar ? <img src={currentChildAvatar} alt={currentChildName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (currentChild?.name?.slice(0, 1) ?? '宝')}
                  </div>
                  <div style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
                    <strong style={{ fontSize: '18px', color: '#172033', fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentChildName}</strong>
                    <span style={{ fontSize: '12px', color: '#5f6d7f', lineHeight: 1.5, fontWeight: 700 }}>今天的片段会归进家庭时间轴。</span>
                  </div>
                </button>
              </div>
              <button
                type="button"
                aria-label="切换或查看孩子资料"
                onClick={switchChild}
                style={{ border: '1px solid rgba(126,145,170,0.24)', background: 'rgba(255,255,255,0.86)', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', padding: '0 14px', minHeight: '44px', borderRadius: '999px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 10px 20px rgba(25,35,55,0.08)' }}
              >
                切换孩子
                <ChevronRight size={16} strokeWidth={2.3} />
              </button>
            </div>

            <section
              aria-label="发布前必填项"
              style={{
                borderRadius: '22px',
                background: 'rgba(255,255,255,0.86)',
                border: '1px solid rgba(217,119,6,0.18)',
                padding: '12px',
                display: 'grid',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <strong style={{ color: '#172033', fontSize: '13px' }}>发布前只需要补齐这 3 项</strong>
                <span style={{ color: '#a16207', fontSize: '11px', fontWeight: 850 }}>{completionCount}/3 已完成</span>
              </div>
              <div style={{ height: 7, borderRadius: '999px', background: 'rgba(126,145,170,0.14)', overflow: 'hidden' }}>
                <span
                  className="record-progress-fill"
                  style={{
                    display: 'block',
                    height: '100%',
                    width: `${completionPercent}%`,
                    borderRadius: '999px',
                    background: '#17342f',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${requiredItems.length}, minmax(0, 1fr))`, gap: '8px' }}>
              {requiredItems.map((item) => (
                <span
                  key={item.label}
                  style={{
                    minHeight: '36px',
                    borderRadius: '999px',
                    border: item.done ? '1px solid #bfe7d0' : '1px solid rgba(126,145,170,0.22)',
                    background: item.done ? '#ecfdf5' : 'rgba(255,255,255,0.78)',
                    color: item.done ? '#166534' : '#78716c',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  {item.done ? <Check size={13} strokeWidth={2.5} /> : null}
                  {item.label}
                </span>
              ))}
              </div>
            </section>
          </section>

          {showMediaSection ? (
            <section style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <span style={{ color: '#172033', fontSize: '19px', fontWeight: 950, letterSpacing: 0 }}>影像与声音</span>
                <span style={{ color: '#687386', fontSize: '12px', lineHeight: 1.65, fontWeight: 650 }}>把今天最有质感的一帧、一句话、一段声音留下来。</span>
              </div>

              {mediaPreviews.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                  {mediaPreviews.map((media) => (
                    <div
                      key={media.media_no}
                      style={{
                        position: 'relative',
                        minHeight: '156px',
                        borderRadius: '18px',
                        overflow: 'hidden',
                        border: '1px solid #e7e5e4',
                        background: '#ffffff',
                        boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
                      }}
                    >
                      {media.media_type === 'image' ? <img src={media.preview_url} alt={media.original_name ?? '已上传照片'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                      {media.media_type === 'video' ? <video src={media.preview_url} controls muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#292524' }} /> : null}
                      {media.media_type === 'audio' ? (
                        <div style={{ width: '100%', height: '100%', display: 'grid', alignContent: 'center', gap: '12px', padding: '16px', background: '#faf8f5' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#57534e', fontSize: '13px', fontWeight: 700 }}>
                            <PlayCircle size={19} strokeWidth={2.2} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.original_name ?? '语音记录'}</span>
                          </div>
                          <audio src={media.preview_url} controls style={{ width: '100%', height: '32px' }} />
                        </div>
                      ) : null}
                      <button
                        type="button"
                        aria-label="移除媒体"
                        onClick={() => removeMedia(media.media_no)}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          width: '44px',
                          height: '44px',
                          borderRadius: '999px',
                          border: '1px solid rgba(255,255,255,0.72)',
                          background: 'rgba(41,37,36,0.72)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <X size={15} strokeWidth={2.4} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ display: 'grid', gap: '12px' }}>
                {showPhotoVideoAction ? (
                  <section style={mediaActionCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'grid', gap: '5px' }}>
                        <strong style={{ color: '#292524', fontSize: '15px', fontWeight: 800 }}>{form.record_type === 'video' ? '视频采集' : '图片 / 视频'}</strong>
                        <span style={{ color: '#78716c', fontSize: '12px', lineHeight: 1.6 }}>
                          {form.record_type === 'video' ? '直接打开系统相机录制视频，也可以从手机相册导入。' : '原生相机拍照和系统相册导入分开处理，避免局部预览异常。'}
                        </span>
                      </div>
                      <span style={{ width: '42px', height: '42px', borderRadius: '16px', background: '#f7f4ee', border: '1px solid #ece3d5', display: 'grid', placeItems: 'center', color: '#5b5348', flexShrink: 0 }}>
                        {form.record_type === 'video' ? <Video size={18} strokeWidth={2.1} /> : <ImagePlus size={18} strokeWidth={2.1} />}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                      {form.record_type === 'video' ? (
                        <>
                          <MediaActionButton icon={<Video size={18} strokeWidth={2.2} />} label="拍摄视频" description="打开系统相机录制" onClick={() => triggerMediaInput(videoCaptureInputRef.current, '请在系统相机中完成拍摄，保存后会自动加入记录。')} disabled={uploading} />
                          <MediaActionButton icon={<ImagePlus size={18} strokeWidth={2.2} />} label="从相册选择" description="导入已有视频素材" onClick={() => triggerMediaInput(galleryInputRef.current, '请从相册选择视频素材。')} disabled={uploading} />
                        </>
                      ) : (
                        <>
                          <MediaActionButton icon={<ImagePlus size={18} strokeWidth={2.2} />} label="拍照记录" description="打开原生相机拍照" onClick={() => void openNativePhotoCapture()} disabled={uploading} />
                          <MediaActionButton icon={<Video size={18} strokeWidth={2.2} />} label="拍摄视频" description="打开系统相机录像" onClick={() => triggerMediaInput(videoCaptureInputRef.current, '请在系统相机中完成拍摄，保存后会自动加入记录。')} disabled={uploading} />
                          <MediaActionButton icon={<Image size={18} strokeWidth={2.2} />} label="从相册添加" description="原生相册多选照片" onClick={() => void openNativeGalleryImages()} disabled={uploading} style={{ gridColumn: '1 / -1' }} />
                        </>
                      )}
                    </div>
                  </section>
                ) : null}

                {showAudioAction ? (
                  <section style={mediaActionCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'grid', gap: '5px' }}>
                        <strong style={{ color: '#292524', fontSize: '15px', fontWeight: 800 }}>语音采集</strong>
                        <span style={{ color: '#78716c', fontSize: '12px', lineHeight: 1.6 }}>录一段和上传已有音频分开，优先交给系统录音或文件选择器处理。</span>
                      </div>
                      <span style={{ width: '42px', height: '42px', borderRadius: '16px', background: '#f7f4ee', border: '1px solid #ece3d5', display: 'grid', placeItems: 'center', color: '#5b5348', flexShrink: 0 }}>
                        <Mic size={18} strokeWidth={2.1} />
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                      <MediaActionButton icon={<Mic size={18} strokeWidth={2.2} />} label="录制语音" description="打开系统录音入口" onClick={() => triggerMediaInput(audioCaptureInputRef.current, '请使用系统录音入口录制，保存后会自动加入记录。')} disabled={uploading} />
                      <MediaActionButton icon={<FileAudio size={18} strokeWidth={2.2} />} label="上传语音" description="选择已有录音或音频" onClick={() => triggerMediaInput(audioLibraryInputRef.current, '请选择已有录音或音频文件。')} disabled={uploading} />
                    </div>
                  </section>
                ) : null}

                <input ref={photoCaptureInputRef} aria-label="拍照记录" type="file" accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={(event) => void onFileChange(event)} disabled={uploading} style={{ display: 'none' }} />
                <input ref={videoCaptureInputRef} aria-label="拍摄视频" type="file" accept="video/*,video/mp4,video/webm,video/quicktime,video/3gpp" capture="environment" onChange={(event) => void onFileChange(event)} disabled={uploading} style={{ display: 'none' }} />
                <input ref={galleryInputRef} aria-label={form.record_type === 'video' ? '从相册选择视频' : '从相册添加'} type="file" accept={photoVideoAccept} multiple onChange={(event) => void onFileChange(event)} disabled={uploading} style={{ display: 'none' }} />
                <input ref={audioCaptureInputRef} aria-label="录制语音" type="file" accept="audio/*,audio/mpeg,audio/mp4,audio/m4a,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/3gpp,audio/amr" capture onChange={(event) => void onFileChange(event)} disabled={uploading} style={{ display: 'none' }} />
                <input ref={audioLibraryInputRef} aria-label="上传语音" type="file" accept="audio/*,audio/mpeg,audio/mp4,audio/m4a,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/3gpp,audio/amr" onChange={(event) => void onFileChange(event)} disabled={uploading} style={{ display: 'none' }} />
              </div>

              <span style={{ color: '#a8a29e', fontSize: '11px', lineHeight: 1.45, fontWeight: 600 }}>{uploading ? '正在上传媒体…' : mediaHint}</span>
            </section>
          ) : null}

          <div style={{ display: 'grid', gap: '18px', borderRadius: '28px', border: '1px solid #efe4d4', background: '#fffdfa', padding: '20px 18px', boxShadow: '0 16px 36px rgba(41,37,36,0.05)' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <span style={{ color: '#292524', fontSize: '18px', fontWeight: 800, letterSpacing: 0 }}>写下这一刻</span>
              <span style={{ color: '#78716c', fontSize: '12px', lineHeight: 1.55 }}>标题让以后容易找到，正文保留当时的细节和情绪。</span>
            </div>
            <input
              ref={titleInputRef}
              className="record-title-input"
              style={{
                width: '100%',
                border: 'none',
                borderBottom: '1px solid #ece3d6',
                padding: '0 0 14px',
                fontSize: '18px',
                fontWeight: 700,
                color: '#292524',
                outline: 'none',
                background: 'transparent',
                boxSizing: 'border-box',
              }}
              placeholder="给这一刻起个名字"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
            <textarea
              ref={contentInputRef}
              className="record-body-input"
              style={{
                width: '100%',
                minHeight: '184px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                background: 'transparent',
                padding: 0,
                fontSize: '15px',
                lineHeight: 1.9,
                color: '#44403c',
                boxSizing: 'border-box',
              }}
              placeholder="在想什么呢？记录一下这一刻发生的故事…"
              value={form.content_text}
              onChange={(event) => setForm((current) => ({ ...current, content_text: event.target.value }))}
            />
            <div style={{ borderRadius: '18px', background: '#f8f7ff', border: '1px solid #e9e6ff', padding: '12px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '999px', background: '#ffffff', color: '#6366f1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Sparkles size={15} strokeWidth={2.2} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', color: '#312e81', fontSize: '13px', marginBottom: '3px' }}>不知道怎么整理？</strong>
                  <span style={{ color: '#6b7280', fontSize: '12px', lineHeight: 1.6 }}>先写几句话，AI 可以帮你生成标题、摘要和标签。</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="AI 智能建议"
                onClick={() => void generateAiPreview()}
                disabled={aiPreviewLoading}
                style={{
                  minHeight: '40px',
                  border: '1px solid #e8dece',
                  borderRadius: '14px',
                  background: '#fffaf2',
                  color: '#6f4b2f',
                  padding: '10px 13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: aiPreviewLoading ? 'not-allowed' : 'pointer',
                  opacity: aiPreviewLoading ? 0.72 : 1,
                  boxShadow: '0 8px 20px rgba(41,37,36,0.06)',
                }}
              >
                <Sparkles size={14} strokeWidth={2.2} />
                {aiPreviewLoading ? 'AI 生成中…' : '生成标题/摘要/标签'}
              </button>
            </div>
            {aiPreviewSummary || aiPreviewTags.length ? (
              <section
                style={{
                  borderRadius: '18px',
                  background: '#f8f9fa',
                  border: '1px solid #eef2ff',
                  padding: '14px 14px 13px',
                  display: 'grid',
                  gap: '10px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#818cf8' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '2px' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '999px', background: '#eef2ff', color: '#6366f1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Sparkles size={15} strokeWidth={2.2} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', marginBottom: '4px', color: '#312e81', fontSize: '12px', fontWeight: 800 }}>AI 智能建议</strong>
                    {aiPreviewSummary ? <p style={{ margin: 0, color: '#4a4a4a', fontSize: '13px', lineHeight: 1.7 }}>{aiPreviewSummary}</p> : null}
                  </div>
                </div>
                {aiPreviewTags.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', paddingLeft: '38px' }}>
                    {aiPreviewTags.map((tag, index) => (
                      <span key={`${tag}-${index}`} style={{ borderRadius: '999px', background: '#ffffff', border: '1px solid #e0e7ff', color: '#4f46e5', padding: '5px 9px', fontSize: '11px', fontWeight: 700 }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <span style={{ color: '#292524', fontSize: '15px', fontWeight: 800 }}>补充信息</span>
              <span style={{ color: '#78716c', fontSize: '12px', lineHeight: 1.55 }}>可见范围、地点、标签和里程碑用于后续检索与家庭协作。</span>
            </div>
            <button
              type="button"
              aria-expanded={visibilityOpen}
              onClick={() => {
                setVisibilityOpen((current) => !current);
                setSelectorMessage(null);
              }}
              style={{
                borderRadius: '18px',
                border: '1px solid #efede9',
                background: visibilityOpen ? '#fffdf9' : '#ffffff',
                padding: '15px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: visibilityOpen ? '0 8px 20px rgba(41,37,36,0.045)' : '0 2px 10px rgba(41,37,36,0.025)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#57534e', fontSize: '15px', fontWeight: 600 }}>
                <Eye size={18} strokeWidth={2.2} />
                可见范围
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#57534e', fontSize: '14px', fontWeight: 600 }}>
                家庭成员可见
                <ChevronRight size={16} strokeWidth={2.2} style={{ transform: visibilityOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.16s ease' }} />
              </span>
            </button>
            {visibilityOpen ? (
              <div
                style={{
                  borderRadius: '18px',
                  border: '1px solid #eee9df',
                  background: '#faf8f5',
                  padding: '12px',
                  display: 'grid',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  aria-pressed="true"
                  style={{
                    width: '100%',
                    border: '1px solid #ded8cf',
                    borderRadius: '14px',
                    background: '#ffffff',
                    color: '#292524',
                    padding: '12px 13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(41,37,36,0.04)',
                  }}
                  onClick={() => {
                    setForm((current) => ({ ...current, visibility_scope: 'family' }));
                    setSelectorMessage('已设为家庭成员可见。');
                  }}
                >
                  <span style={{ display: 'grid', gap: '3px' }}>
                    <span>家庭成员可见</span>
                    <span style={{ color: '#78716c', fontSize: '12px', fontWeight: 600 }}>与后台权限保持一致，家庭成员可查看这条记录。</span>
                  </span>
                  <Check size={18} strokeWidth={2.5} color="#a16207" />
                </button>
                <p style={{ ...helperTextStyle, lineHeight: 1.65 }}>当前记录默认仅对家庭成员可见，和家庭成员角色权限保持一致。</p>
              </div>
            ) : null}

            <section style={metadataPanelStyle}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ ...metadataPillStyle, position: 'relative', overflow: 'hidden', flex: '0 1 154px' }}>
                  <input
                    ref={timeInputRef}
                    className="app-date-time-input"
                    aria-label="发生时间 *"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    type="datetime-local"
                    value={form.event_time}
                    onChange={(event) => setForm((current) => ({ ...current, event_time: event.target.value }))}
                  />
                  <div style={{ minHeight: '40px', padding: '8px 13px', display: 'flex', alignItems: 'center', gap: '7px', pointerEvents: 'none' }}>
                    <Clock size={14} strokeWidth={2.2} color="#a8a29e" />
                    <span style={{ flex: 1, minWidth: 0, color: form.event_time ? '#57534e' : '#78716c', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {form.event_time ? formatDateTimeDisplay(form.event_time) : '选择时间'}
                    </span>
                  </div>
                </div>
                <div style={{ position: 'relative', flex: '0 1 156px', minWidth: '142px' }}>
                  <MapPin size={14} strokeWidth={2.2} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a8a29e', pointerEvents: 'none' }} />
                  <input
                    aria-label="搜索地点"
                    style={{ ...inputStyle, ...metadataPillStyle, width: '100%', minHeight: '44px', borderRadius: '999px', background: '#fafaf9', padding: '8px 12px 8px 34px', fontSize: '13px', fontWeight: 700 }}
                    value={form.location_text}
                    onChange={(event) => setForm((current) => ({ ...current, location_text: event.target.value }))}
                    placeholder="添加地点"
                  />
                </div>
                <div style={{ position: 'relative', flex: '1 1 138px', minWidth: '138px' }}>
                  <Tag size={14} strokeWidth={2.2} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a8a29e', pointerEvents: 'none', zIndex: 1 }} />
                  <AppSelect
                    aria-label="选择标签"
                    value={tagSelectValue}
                    onChange={(event) => {
                      setTagSelectValue(event.target.value);
                      addSelectedTag(event.target.value);
                    }}
                    selectStyle={{ ...metadataIconSelectStyle, ...metadataPillStyle, borderRadius: '999px', minHeight: '44px', paddingTop: '8px', paddingBottom: '8px', fontSize: '13px', fontWeight: 700 }}
                  >
                    <option value="">添加标签</option>
                    {tagOptions.map((tag) => (
                      <option key={tag} value={tag} disabled={selectedTags.includes(tag)}>
                        {tag}
                      </option>
                    ))}
                  </AppSelect>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={{ ...compactPillButtonStyle, opacity: locationLoading ? 0.72 : 1 }}
                  onClick={() => void useCurrentLocation()}
                  disabled={locationLoading}
                >
                  <MapPin size={13} strokeWidth={2.2} />
                  {locationLoading ? '定位中…' : '手机定位'}
                </button>
                {form.location_text.trim() || poiLoading ? (
                  <>
                  {hasManualLocationSuggestion ? (
                    <button
                      type="button"
                      style={compactPillButtonStyle}
                      onClick={() => {
                        setForm((current) => ({ ...current, location_text: manualLocationText }));
                        setSelectorMessage(
                          poiSearchFailed
                            ? `已使用手动填写的地点「${manualLocationText}」，地图恢复后可再搜索更精确地址。`
                            : `已使用手动填写的地点「${manualLocationText}」。`,
                        );
                      }}
                    >
                      使用手动地点：{manualLocationText}
                    </button>
                  ) : null}
                  {mergedLocationSuggestions.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      style={compactPillButtonStyle}
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
                  </>
                ) : null}
              </div>
              {selectedTags.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedTags.map((tag, index) => (
                    <button key={`${tag}-${index}`} type="button" onClick={() => removeSelectedTag(tag)} style={selectedChipButtonStyle}>
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
              width: '100%',
              minHeight: '66px',
              border: form.record_type === 'milestone' ? '1px solid #e7c66a' : '1px solid #efe7da',
              borderRadius: '22px',
              background: form.record_type === 'milestone' ? '#fff7d9' : '#ffffff',
              padding: '11px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'left',
              cursor: 'pointer',
              boxShadow: form.record_type === 'milestone' ? '0 12px 24px rgba(161,98,7,0.10)' : '0 4px 14px rgba(41,37,36,0.035)',
            }}
            onClick={() => setForm((current) => ({ ...current, record_type: current.record_type === 'milestone' ? 'mixed' : 'milestone' }))}
          >
            <span
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '16px',
                background: form.record_type === 'milestone' ? '#f9d56f' : '#f7f2ea',
                display: 'grid',
                placeItems: 'center',
                color: form.record_type === 'milestone' ? '#78350f' : '#8a8177',
                flexShrink: 0,
                boxShadow: form.record_type === 'milestone' ? 'inset 0 -1px 0 rgba(120,53,15,0.14)' : 'none',
              }}
            >
              <Star size={18} strokeWidth={2.3} fill={form.record_type === 'milestone' ? 'currentColor' : 'none'} />
            </span>
            <span style={{ display: 'grid', gap: '3px', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '14px', fontWeight: 850, color: '#292524' }}>里程碑</span>
              <span style={{ fontSize: '12px', lineHeight: 1.45, color: '#78716c' }}>第一次、生日、入园等关键节点会被单独归档。</span>
            </span>
            <span
              aria-hidden="true"
              style={{
                minWidth: '58px',
                minHeight: '32px',
                borderRadius: '999px',
                background: form.record_type === 'milestone' ? '#78350f' : '#f4f0ea',
                color: form.record_type === 'milestone' ? '#ffffff' : '#8a8177',
                border: form.record_type === 'milestone' ? '1px solid #78350f' : '1px solid #e8dfd3',
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

          {selectorMessage ? <p style={{ ...helperTextStyle, color: '#0f766e' }}>{selectorMessage}</p> : null}
          {mediaNos.length ? <p style={helperTextStyle}>已选择 {mediaNos.length} 个媒体，将随记录一起保存。</p> : null}
          {uploading ? <p style={helperTextStyle}>正在上传媒体…</p> : null}
          {error ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{error}</p> : null}

        </form>
        <div
          className="record-floating-actions"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            padding: '16px 0 0',
            boxSizing: 'border-box',
            background: 'transparent',
          }}
        >
          <div
            style={{
              borderRadius: '26px',
              border: '1px solid rgba(126,145,170,0.22)',
              background: 'rgba(255,255,255,0.92)',
              boxShadow: '0 -12px 36px rgba(25,35,55,0.14)',
              padding: '12px',
              display: 'grid',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ color: '#687386', fontSize: '12px', fontWeight: 800 }}>发布准备度</span>
              <strong style={{ color: completionPercent === 100 ? '#166534' : '#a16207', fontSize: '12px', fontWeight: 900 }}>{completionPercent}%</strong>
            </div>
            <div style={{ height: 6, borderRadius: '999px', background: 'rgba(126,145,170,0.14)', overflow: 'hidden' }}>
              <span
                className="record-progress-fill"
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${completionPercent}%`,
                  borderRadius: '999px',
                  background: completionPercent === 100 ? '#166534' : '#17342f',
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mode === 'create' ? '0.82fr 1.18fr' : '1fr', gap: '10px' }}>
              {mode === 'create' ? (
                <button
                  type="button"
                  className="nl-pressable"
                  style={{
                    ...secondaryButtonStyle,
                    minHeight: '48px',
                    borderRadius: '18px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    cursor: submitting || uploading ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => {
                    setForm((current) => ({ ...current, status: 'draft' }));
                    void submitRecord('draft');
                  }}
                  disabled={submitting || uploading}
                >
                  <BookOpen size={15} strokeWidth={2.1} />
                  {pendingAction === 'draft' ? '保存中…' : '存草稿'}
                </button>
              ) : null}
              <button
                type="submit"
                form="record-form"
                className="nl-pressable"
                style={{
                  ...primaryButtonStyle,
                  minHeight: '50px',
                  borderRadius: '18px',
                  background: completionPercent === 100 ? '#17342f' : primaryButtonStyle.background,
                  padding: '12px 14px',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: submitting || uploading ? 'not-allowed' : 'pointer',
                  opacity: submitting || uploading ? 0.72 : 1,
                }}
                disabled={submitting || uploading}
              >
                {pendingAction === 'publish' ? (mode === 'create' ? '发布中…' : '保存中…') : mode === 'create' ? '完成发布' : '更新记录'}
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
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
  const initialRecordType = ['mixed', 'text', 'video', 'audio', 'milestone'].includes(requestedType ?? '') ? requestedType! : 'mixed';
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
          <section style={{ borderRadius: '16px', border: '1px solid #ebe6dc', background: '#ffffff', overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,0.025)' }}>
            {primaryMedia && primaryMediaUrl && primaryMedia.media_type !== 'audio' ? (
              <div style={{ position: 'relative', background: '#fafaf9' }}>
                {primaryMedia.media_type === 'video' ? (
                  <video src={primaryMediaUrl} controls playsInline style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block', background: '#292524' }} />
                ) : (
                  <img src={primaryMediaUrl} alt={data.title ?? primaryMedia.original_name ?? '记录封面'} style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
                )}
                <span style={{ position: 'absolute', left: '14px', bottom: '14px', borderRadius: '999px', background: 'rgba(41,37,36,0.72)', color: '#fff', padding: '6px 10px', fontSize: '12px', fontWeight: 700 }}>
                  {mediaTypeLabel(primaryMedia.media_type)}
                </span>
              </div>
            ) : null}
            <div style={{ padding: '18px', display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', background: data.is_milestone ? '#fef3c7' : '#fafaf9', color: data.is_milestone ? '#a16207' : '#57534e', border: '1px solid #ebe6dc', padding: '6px 10px', fontSize: '12px', fontWeight: 700 }}>
                  {data.is_milestone ? <Star size={13} fill="currentColor" /> : null}
                  {recordTypeLabel(data.record_type, data.is_milestone)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', background: '#fafaf9', color: '#78716c', border: '1px solid #ebe6dc', padding: '6px 10px', fontSize: '12px', fontWeight: 700 }}>
                  {recordStatusLabel(data.status)}
                </span>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <h2 style={{ margin: 0, color: '#292524', fontSize: '23px', lineHeight: 1.28, fontWeight: 700 }}>{data.title ?? '未命名记录'}</h2>
                <p style={{ margin: 0, color: '#57534e', fontSize: '15px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{data.content_text ?? '暂无正文'}</p>
              </div>
              <section style={{ borderRadius: '18px', background: '#f8f9fa', border: '1px solid #eef2ff', padding: '14px 14px 13px', display: 'grid', gap: '12px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#818cf8' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '2px' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '999px', background: '#eef2ff', color: '#6366f1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Sparkles size={15} strokeWidth={2.2} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', marginBottom: '4px', color: '#312e81', fontSize: '12px', fontWeight: 800 }}>AI 智能提取</strong>
                    <p style={{ margin: 0, color: '#4a4a4a', fontSize: '13px', lineHeight: 1.7 }}>
                      {data.ai_summary ?? (aiJob?.status === 'pending' || aiJob?.status === 'processing' ? `${aiActionLabel}正在处理中，请稍候…` : '当前还没有 AI 摘要，可以点击下方按钮生成标题、摘要或标签。')}
                    </p>
                    {data.ai_status ? <p style={{ ...helperTextStyle, marginTop: '6px', color: '#6366f1' }}>AI 状态：{aiJobStatusLabel(data.ai_status)}</p> : null}
                    {aiJob?.status === 'success' ? <p style={{ ...helperTextStyle, marginTop: '6px', color: '#0f766e' }}>{aiActionLabel}已生成并同步到记录详情。</p> : null}
                    {aiJob?.status === 'failed' ? <p style={{ ...helperTextStyle, marginTop: '6px', color: '#dc2626' }}>AI 处理失败：{aiJob.error_message ?? '未知错误'}</p> : null}
                    {aiError ? <p style={{ ...helperTextStyle, marginTop: '6px', color: '#dc2626' }}>{aiError}</p> : null}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  <button style={{ ...secondaryButtonStyle, minHeight: '36px', justifyContent: 'center', borderRadius: '999px', minWidth: 0, paddingInline: '6px', fontSize: '12px', background: '#ffffff' }} onClick={() => void onGenerateAi('record_title', 'AI 标题', 'AI 标题生成失败')} disabled={aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing'}>
                    {aiLoading && aiActionLabel === 'AI 标题' ? '生成中…' : '标题'}
                  </button>
                  <button style={{ ...secondaryButtonStyle, minHeight: '36px', justifyContent: 'center', borderRadius: '999px', minWidth: 0, paddingInline: '6px', fontSize: '12px', background: '#ffffff' }} onClick={() => void onGenerateAi('record_summary', 'AI 摘要', 'AI 摘要生成失败')} disabled={aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing'}>
                    {aiLoading && aiActionLabel === 'AI 摘要' ? '生成中…' : '摘要'}
                  </button>
                  <button style={{ ...secondaryButtonStyle, minHeight: '36px', justifyContent: 'center', borderRadius: '999px', minWidth: 0, paddingInline: '6px', fontSize: '12px', background: '#ffffff' }} onClick={() => void onGenerateAi('record_tags', 'AI 标签', 'AI 标签生成失败')} disabled={aiLoading || aiJob?.status === 'pending' || aiJob?.status === 'processing'}>
                    {aiLoading && aiActionLabel === 'AI 标签' ? '生成中…' : '标签'}
                  </button>
                </div>
              </section>
              <div style={{ display: 'grid', gap: '8px' }}>
                <p style={helperTextStyle}>媒体数量：{data.media_list.length}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', background: '#fafaf9', border: '1px solid #ebe6dc', padding: '7px 10px', color: '#57534e', fontSize: '12px', fontWeight: 700 }}>
                    <Clock size={13} />
                    {new Date(data.event_time).toLocaleString('zh-CN', { hour12: false })}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', background: '#fafaf9', border: '1px solid #ebe6dc', padding: '7px 10px', color: '#57534e', fontSize: '12px', fontWeight: 700 }}>
                    <Eye size={13} />
                    {visibilityScopeLabel(data.visibility_scope)}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', background: '#fafaf9', border: '1px solid #ebe6dc', padding: '7px 10px', color: '#57534e', fontSize: '12px', fontWeight: 700 }}>
                    <MapPin size={13} />
                    {normalizeLocationText(data.location_text) || '未填写地点'}
                  </span>
                </div>
                {data.tags.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {data.tags.map((tag, index) => (
                      <span key={`${data.record_no}-${tag}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '8px', background: '#fffdf9', border: '1px solid #ebe6dc', padding: '5px 8px', color: '#78716c', fontSize: '11px', fontWeight: 700 }}>
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
                <strong style={{ color: '#292524' }}>媒体</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                  {data.media_list.map((media) => {
                    const mediaUrl = resolveMediaPreviewUrl(media.media_no, media.access_url) ?? media.access_url;
                    return (
                      <div key={media.media_no} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e7e5e4', background: '#fafaf9', minHeight: '132px' }}>
                        {media.media_type === 'image' ? <img src={mediaUrl} alt={media.original_name ?? data.title ?? '记录照片'} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} /> : null}
                        {media.media_type === 'video' ? <video src={mediaUrl} controls playsInline style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block', background: '#292524' }} /> : null}
                        {media.media_type === 'audio' ? (
                          <div style={{ minHeight: '132px', display: 'grid', alignContent: 'center', gap: '10px', padding: '14px', color: '#57534e' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                              <FileAudio size={22} strokeWidth={2.1} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.original_name ?? '语音记录'}</span>
                            </div>
                            <audio src={mediaUrl} controls style={{ width: '100%' }} />
                            {media.duration_seconds ? <span style={{ fontSize: '12px', color: '#a8a29e' }}>{media.duration_seconds} 秒</span> : null}
                          </div>
                        ) : null}
                        {!['image', 'video', 'audio'].includes(media.media_type) ? (
                          <div style={{ minHeight: '132px', display: 'grid', placeItems: 'center', color: '#78716c' }}>
                            <div style={{ display: 'grid', justifyItems: 'center', gap: '8px' }}>
                              <Image size={28} strokeWidth={1.8} />
                              <span>{mediaTypeLabel(media.media_type)}</span>
                            </div>
                          </div>
                        ) : null}
                      </div>
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
            <button style={{ ...secondaryButtonStyle, color: '#dc2626' }} onClick={() => void onDelete()} disabled={deleting}>
              {deleting ? '删除中…' : '删除记录'}
            </button>
          </div>
        </article>
      ) : null}
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
