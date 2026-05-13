import type { CSSProperties } from 'react';

export const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #dbe3df',
  borderRadius: '10px',
  padding: '20px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
};

export const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: '24px',
  fontWeight: 700,
  color: '#16211f',
  letterSpacing: 0,
};

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '42px',
  borderRadius: '10px',
  border: '1px solid #cbd5d1',
  padding: '10px 12px',
  fontSize: '14px',
  background: '#ffffff',
  color: '#1f2933',
  outline: 'none',
};

export const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  padding: '10px 14px',
  background: '#123c37',
  color: '#ffffff',
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: '40px',
};

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid #cbd5d1',
  background: '#ffffff',
  color: '#123c37',
};

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#ffffff',
};

export const thTdStyle: CSSProperties = {
  textAlign: 'left',
  padding: '13px 12px',
  borderBottom: '1px solid #e1e8e4',
  fontSize: '14px',
  verticalAlign: 'top',
  color: '#263532',
  minWidth: '104px',
  whiteSpace: 'nowrap',
};

export const mutedTextStyle: CSSProperties = {
  margin: 0,
  color: '#66736f',
  fontSize: '14px',
  lineHeight: 1.7,
};

export const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '26px',
  borderRadius: '999px',
  padding: '3px 10px',
  border: '1px solid #cbd5d1',
  background: '#f6f8f7',
  color: '#263532',
  fontSize: '12px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};
