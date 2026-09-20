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

/**
 * 本地时区的「今天」，格式 YYYY-MM-DD。
 * 不能直接用 `new Date().toISOString().slice(0,10)`：那是 UTC 日期，
 * 在东八区凌晨会返回「昨天」，导致日期选择器允许选到已经过去的一天。
 */
export const todayLocalDate = (now: Date = new Date()) => {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
