const MEDIA_REFERENCE_PREFIX = 'media:';

export function parseMediaReference(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized?.startsWith(MEDIA_REFERENCE_PREFIX)) return null;
  const mediaNo = normalized.slice(MEDIA_REFERENCE_PREFIX.length).trim();
  return mediaNo || null;
}
