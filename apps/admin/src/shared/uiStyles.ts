import type { CSSProperties } from 'react';

export const cardStyle: CSSProperties = {
  background: '#fbfcfb',
  border: '1px solid #d7e0db',
  borderRadius: '8px',
  padding: '16px',
  boxShadow: '0 8px 22px rgba(15, 23, 42, 0.04)',
};

export const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: '24px',
  fontWeight: 800,
  color: '#16211f',
  letterSpacing: 0,
};

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '40px',
  borderRadius: '8px',
  border: '1px solid #cbd5d1',
  padding: '9px 11px',
  fontSize: '13px',
  background: '#ffffff',
  color: '#1f2933',
  outline: 'none',
};

export const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: '8px',
  padding: '9px 13px',
  background: '#123c37',
  color: '#ffffff',
  fontWeight: 800,
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
  padding: '10px 10px',
  borderBottom: '1px solid #e1e8e4',
  fontSize: '13px',
  verticalAlign: 'top',
  color: '#263532',
  minWidth: '104px',
  whiteSpace: 'nowrap',
};

export const mutedTextStyle: CSSProperties = {
  margin: 0,
  color: '#66736f',
  fontSize: '13px',
  lineHeight: 1.6,
};

export const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '24px',
  borderRadius: '999px',
  padding: '3px 9px',
  border: '1px solid #cbd5d1',
  background: '#f6f8f7',
  color: '#263532',
  fontSize: '12px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};
