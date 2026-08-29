import { Link } from 'react-router-dom';
import { Archive } from 'lucide-react';

import { helperTextStyle } from '../shared/ui';

export const rowStyle = {
  display: 'grid',
  gap: '14px',
} as const;

export const buttonRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
  gap: '12px',
  width: '100%',
  alignItems: 'stretch',
};

export const formSubmitSpacingStyle = {
  paddingBottom: '72px',
};

export const formatDateTimeLocal = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const appTimeZone = 'Asia/Shanghai';

const parseDisplayDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatAppDate = (value: string | Date | null | undefined, fallback = '时间待确认') => {
  const date = parseDisplayDate(value);
  return date ? date.toLocaleDateString('zh-CN', { timeZone: appTimeZone }) : fallback;
};

export const formatAppDateTime = (value: string | Date | null | undefined, fallback = '时间待确认') => {
  const date = parseDisplayDate(value);
  return date ? date.toLocaleString('zh-CN', { timeZone: appTimeZone, hour12: false }) : fallback;
};

const invalidQuestionMarkTextPattern = /^[?\uFF1F\uFFFD\s]+$/u;

export const normalizeDisplayName = (value: string | null | undefined, fallback: string) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || invalidQuestionMarkTextPattern.test(trimmed)) return fallback;
  return trimmed;
};

export const EmptyState = ({ message }: { message: string }) => (
  <div
    role="status"
    style={{
      minHeight: '92px',
      padding: '18px 8px',
      display: 'grid',
      placeItems: 'center',
      alignContent: 'center',
      gap: '9px',
      textAlign: 'center',
    }}
  >
    <span
      aria-hidden="true"
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        border: '1px solid var(--nl-border-muted)',
        color: 'var(--nl-muted)',
        background: 'var(--nl-control-bg)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Archive size={17} strokeWidth={1.8} />
    </span>
    <p style={{ ...helperTextStyle, margin: 0, maxWidth: '260px' }}>{message}</p>
  </div>
);

export const sectionTitleStyle = {
  margin: 0,
  fontSize: '17px',
  fontWeight: 700,
  fontFamily: 'var(--nl-font-sans)',
  color: 'var(--nl-ink)',
} as const;

export const mutedChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '8px',
  background: 'transparent',
  border: '1px solid var(--nl-border-muted)',
  color: 'var(--nl-muted-strong)',
  fontSize: '12px',
  fontWeight: 540,
} as const;

export const listCardStyle = {
  textAlign: 'left' as const,
  border: '1px solid var(--nl-border-muted)',
  borderRadius: '8px',
  padding: '16px',
  background: 'var(--nl-control-bg)',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
} as const;

export const HubLink = ({ to, title, description }: { to: string; title: string; description: string }) => (
  <Link
    to={to}
    style={{
      display: 'grid',
      gap: '6px',
      padding: '18px 2px',
      borderRadius: '8px',
      border: 'none',
      borderBottom: '1px solid var(--nl-border-muted)',
      color: 'var(--nl-ink)',
      textDecoration: 'none',
      background: 'transparent',
    }}
  >
    <strong>{title}</strong>
    <span style={helperTextStyle}>{description}</span>
  </Link>
);
