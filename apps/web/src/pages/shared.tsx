import { Link } from 'react-router-dom';

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
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

export const EmptyState = ({ message }: { message: string }) => <p style={helperTextStyle}>{message}</p>;

export const sectionTitleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 720,
  fontFamily: 'var(--nl-font-display)',
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
