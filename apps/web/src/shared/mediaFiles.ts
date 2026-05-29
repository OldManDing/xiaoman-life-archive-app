export type SupportedMediaType = 'image' | 'video' | 'audio';

const GENERIC_MIME_TYPES = new Set(['application/octet-stream', 'binary/octet-stream']);

const MIME_TYPE_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'audio/m4a': 'audio/x-m4a',
};

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  '3gp': 'video/3gpp',
  '3gpp': 'video/3gpp',
  m4a: 'audio/x-m4a',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  amr: 'audio/amr',
};

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp']);
const AUDIO_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/3gpp', 'audio/amr']);

export const normalizeMimeType = (mimeType?: string | null) => {
  const normalized = mimeType?.toLowerCase().split(';', 1)[0].trim() ?? '';
  return MIME_TYPE_ALIASES[normalized] ?? normalized;
};

export const inferMimeTypeFromFileName = (fileName?: string | null) => {
  const normalized = fileName?.trim().toLowerCase().split(/[?#]/, 1)[0] ?? '';
  const match = /\.([a-z0-9]+)$/.exec(normalized);
  if (!match) return '';
  return MIME_TYPE_BY_EXTENSION[match[1]] ?? '';
};

export const resolveFileMimeType = (file: Pick<File, 'name' | 'type'>) => {
  const normalized = normalizeMimeType(file.type);
  if (normalized && !GENERIC_MIME_TYPES.has(normalized)) return normalized;
  return inferMimeTypeFromFileName(file.name) || normalized;
};

export const deriveMediaType = (file: Pick<File, 'name' | 'type'>): SupportedMediaType | null => {
  const mimeType = resolveFileMimeType(file);
  if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
  if (VIDEO_MIME_TYPES.has(mimeType)) return 'video';
  if (AUDIO_MIME_TYPES.has(mimeType)) return 'audio';
  return null;
};

export const isSupportedImageFile = (file: Pick<File, 'name' | 'type'>) => deriveMediaType(file) === 'image';

export const withResolvedFileMimeType = (file: File) => {
  const resolvedType = resolveFileMimeType(file);
  if (!resolvedType || resolvedType === normalizeMimeType(file.type)) return file;
  return new File([file], file.name, { type: resolvedType, lastModified: file.lastModified });
};
