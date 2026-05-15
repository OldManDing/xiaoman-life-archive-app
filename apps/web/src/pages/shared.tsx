import { Link } from 'react-router-dom';

import { helperTextStyle } from '../shared/ui';

export const rowStyle = {
  display: 'grid',
  gap: '12px',
} as const;

export const buttonRowStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap' as const,
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
  fontSize: '16px',
  fontWeight: 700,
  color: '#1f2937',
} as const;

export const mutedChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '999px',
  background: '#f5f5f4',
  border: '1px solid #e7e5e4',
  color: '#57534e',
  fontSize: '12px',
  fontWeight: 600,
} as const;

export const listCardStyle = {
  textAlign: 'left' as const,
  border: '1px solid #ece7df',
  borderRadius: '8px',
  padding: '16px',
  background: '#ffffff',
  cursor: 'pointer',
  boxShadow: '0 6px 20px rgba(15, 23, 42, 0.04)',
} as const;

export const HubLink = ({ to, title, description }: { to: string; title: string; description: string }) => (
  <Link
    to={to}
    style={{
      display: 'grid',
      gap: '6px',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      color: '#111827',
      textDecoration: 'none',
      background: '#ffffff',
    }}
  >
    <strong>{title}</strong>
    <span style={helperTextStyle}>{description}</span>
  </Link>
);
