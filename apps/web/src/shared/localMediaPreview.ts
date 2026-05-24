const STORAGE_KEY_PREFIX = 'nianlun-local-media-preview:';
const MAX_PREVIEW_BYTES = 4_200_000;
const IMAGE_PREVIEW_MAX_SIDE = 1280;

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

const compressImagePreview = async (file: File) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return readFileAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await imageFromObjectUrl(objectUrl);
    const scale = Math.min(1, IMAGE_PREVIEW_MAX_SIDE / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
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
      if (compressed.length <= MAX_PREVIEW_BYTES) return compressed;
    }
  } catch {
    return readFileAsDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return readFileAsDataUrl(file);
};

export const createPersistableMediaPreview = async (file: File) => {
  const dataUrl = await readFileAsDataUrl(file);
  if (dataUrl.length <= MAX_PREVIEW_BYTES || !file.type.startsWith('image/')) return dataUrl;
  return compressImagePreview(file);
};

export const saveLocalMediaPreview = (mediaNo: string, dataUrl: string) => {
  if (!mediaNo || !/^data:(image|video|audio)\//.test(dataUrl)) return false;
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

export const resolveMediaPreviewUrl = (mediaNo: string | null | undefined, accessUrl: string | null | undefined) =>
  getLocalMediaPreview(mediaNo) ?? accessUrl ?? null;

export const toLocalMediaReference = (mediaNo: string) => `local-media:${mediaNo}`;

export const resolveStoredMediaUrl = (value: string | null | undefined) => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return null;
  if (!normalizedValue.startsWith('local-media:')) return normalizedValue;
  return getLocalMediaPreview(normalizedValue.slice('local-media:'.length)) ?? null;
};
