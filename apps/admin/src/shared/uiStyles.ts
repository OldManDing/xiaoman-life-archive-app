import type { CSSProperties } from 'react';

export const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
};

export const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: '20px',
  fontWeight: 700,
  color: '#111827',
};

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: '12px',
  border: '1px solid #d1d5db',
  padding: '10px 12px',
  fontSize: '14px',
};

export const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: '12px',
  padding: '10px 14px',
  background: '#111827',
  color: '#ffffff',
  fontWeight: 600,
  cursor: 'pointer',
};

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: '#e5e7eb',
  color: '#111827',
};

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

export const thTdStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 10px',
  borderBottom: '1px solid #e5e7eb',
  fontSize: '14px',
  verticalAlign: 'top',
};
