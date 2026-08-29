export const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : '操作失败，请稍后重试');

export const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—');

export const formatDateOnly = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString('zh-CN') : '—');

export const formatBytes = (value: number | null | undefined) => {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

export const toIsoDateTime = (value: string) => (value ? new Date(value).toISOString() : undefined);

export const optionalFilter = (value: string | undefined) => value?.trim() || undefined;
