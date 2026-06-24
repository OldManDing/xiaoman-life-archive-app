const STORAGE_KEY_PREFIX = 'nianlun-local-media-preview:';
const LOCAL_MEDIA_REFERENCE_PREFIX = 'local-media:';
const STORED_MEDIA_REFERENCE_PREFIX = 'media:';
const MEDIA_NO_PATTERN = /^(m|media)_[a-z0-9][a-z0-9_-]*$/i;
const MAX_PREVIEW_BYTES = 4_200_000;
const IMAGE_PREVIEW_MAX_SIDE = 1280;
const RAW_BROWSER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const runtimeMediaPreviewUrls = new Map<string, string>();

type PersistableMediaPreviewOptions = {
  maxBytes?: number;
  imageMaxSide?: number;
};

export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
        return;
      }
      reject(new Error('媒体预览读取失败'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('媒体预览读取失败'));
    reader.readAsDataURL(file);
  });

const imageFromObjectUrl = (objectUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('媒体预览生成失败'));
    image.src = objectUrl;
  });

const compressImagePreview = async (file: File, options: PersistableMediaPreviewOptions = {}) => {
  const maxBytes = options.maxBytes ?? MAX_PREVIEW_BYTES;
  const imageMaxSide = options.imageMaxSide ?? IMAGE_PREVIEW_MAX_SIDE;

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return readFileAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await imageFromObjectUrl(objectUrl);
    const scale = Math.min(1, imageMaxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return readFileAsDataUrl(file);

    context.drawImage(image, 0, 0, width, height);
    for (const quality of [0.82, 0.68, 0.54]) {
      const compressed = canvas.toDataURL('image/jpeg', quality);
      if (compressed.length <= maxBytes) return compressed;
    }
  } catch {
    return readFileAsDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return readFileAsDataUrl(file);
};

export const createPersistableMediaPreview = async (file: File) => {
  return createPersistableMediaPreviewWithOptions(file);
};

export const createPersistableMediaPreviewWithOptions = async (file: File, options: PersistableMediaPreviewOptions = {}) => {
  const maxBytes = options.maxBytes ?? MAX_PREVIEW_BYTES;
  const normalizedType = file.type.toLowerCase().split(';', 1)[0];
  const isImage = normalizedType.startsWith('image/');
  if (!isImage && file.size > maxBytes) return null;

  if (normalizedType.startsWith('image/') && !RAW_BROWSER_IMAGE_TYPES.has(normalizedType)) {
    return compressImagePreview(file, options);
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (!isImage) return dataUrl.length <= maxBytes ? dataUrl : null;
  if (dataUrl.length <= maxBytes) return dataUrl;
  return compressImagePreview(file, options);
};

export const createPersistableAvatarPreview = (file: File) =>
  createPersistableMediaPreviewWithOptions(file, {
    imageMaxSide: 420,
    maxBytes: 650_000,
  });

export const saveLocalMediaPreview = (mediaNo: string, dataUrl: string | null | undefined) => {
  if (!mediaNo || !dataUrl || !/^data:(image|video|audio)\//.test(dataUrl)) return false;
  if (dataUrl.length > MAX_PREVIEW_BYTES) return false;

  try {
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${mediaNo}`, dataUrl);
    return true;
  } catch {
    // 本地缓存只是 mock 上传体验增强，写入失败时回退到 API 返回的占位图。
    return false;
  }
};

export const getLocalMediaPreview = (mediaNo?: string | null) => {
  if (!mediaNo) return null;

  try {
    return window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${mediaNo}`);
  } catch {
    return null;
  }
};

export const saveRuntimeMediaPreview = (mediaNo: string, previewUrl: string | null | undefined) => {
  if (!mediaNo || !previewUrl) return false;
  runtimeMediaPreviewUrls.set(mediaNo, previewUrl);
  return true;
};

export const getRuntimeMediaPreview = (mediaNo?: string | null) => {
  if (!mediaNo) return null;
  return runtimeMediaPreviewUrls.get(mediaNo) ?? null;
};

export const removeRuntimeMediaPreview = (mediaNo?: string | null) => {
  if (!mediaNo) return;
  runtimeMediaPreviewUrls.delete(mediaNo);
};

export const resolveMediaPreviewUrl = (mediaNo: string | null | undefined, accessUrl: string | null | undefined) =>
  getLocalMediaPreview(mediaNo) ?? getRuntimeMediaPreview(mediaNo) ?? accessUrl ?? null;

export const toLocalMediaReference = (mediaNo: string) => `${LOCAL_MEDIA_REFERENCE_PREFIX}${mediaNo}`;

export const toStoredMediaReference = (mediaNo: string) => `${STORED_MEDIA_REFERENCE_PREFIX}${mediaNo}`;

export const getStoredMediaReferenceNo = (value: string | null | undefined) => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return null;
  if (normalizedValue.startsWith(LOCAL_MEDIA_REFERENCE_PREFIX)) {
    return normalizedValue.slice(LOCAL_MEDIA_REFERENCE_PREFIX.length) || null;
  }
  if (normalizedValue.startsWith(STORED_MEDIA_REFERENCE_PREFIX)) {
    return normalizedValue.slice(STORED_MEDIA_REFERENCE_PREFIX.length) || null;
  }
  if (!/^(https?:|data:|blob:|\/)/i.test(normalizedValue) && MEDIA_NO_PATTERN.test(normalizedValue)) {
    return normalizedValue;
  }
  return null;
};

export const resolveStoredMediaUrl = (value: string | null | undefined) => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return null;
  if (normalizedValue.startsWith(LOCAL_MEDIA_REFERENCE_PREFIX)) {
    return resolveMediaPreviewUrl(normalizedValue.slice(LOCAL_MEDIA_REFERENCE_PREFIX.length), null);
  }
  if (normalizedValue.startsWith(STORED_MEDIA_REFERENCE_PREFIX)) {
    return resolveMediaPreviewUrl(normalizedValue.slice(STORED_MEDIA_REFERENCE_PREFIX.length), null);
  }
  if (!/^(https?:|data:|blob:|\/)/i.test(normalizedValue) && MEDIA_NO_PATTERN.test(normalizedValue)) {
    return resolveMediaPreviewUrl(normalizedValue, null);
  }
  return normalizedValue;
};
