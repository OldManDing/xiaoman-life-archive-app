import type { CSSProperties } from 'react';

export const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(35, 31, 27, 0.1)',
  borderRadius: '8px',
  padding: '16px',
  boxShadow: '0 16px 38px rgba(30, 24, 18, 0.045)',
};

export const headingStyle: CSSProperties = {
  margin: 0,
  fontWeight: 700,
  color: '#1f1d1a',
  letterSpacing: 0,
};

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '42px',
  borderRadius: '8px',
  border: '1px solid rgba(35, 31, 27, 0.12)',
  padding: '10px 12px',
  fontSize: '13px',
  background: '#ffffff',
  color: '#221b12',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.72)',
  transition: 'border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease',
};

export const primaryButtonStyle: CSSProperties = {
  border: '1px solid rgba(75, 59, 35, 0.82)',
  borderRadius: '8px',
  padding: '9px 14px',
  background: '#4a3a22',
  color: '#fffaf1',
  fontWeight: 800,
  cursor: 'pointer',
  minHeight: '42px',
  boxShadow: '0 10px 22px rgba(70, 48, 24, 0.08)',
};

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid rgba(139, 116, 79, 0.22)',
  background: '#ffffff',
  color: '#5d4d35',
  boxShadow: 'none',
};

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  borderRadius: '10px',
  background: '#ffffff',
};

export const thTdStyle: CSSProperties = {
  textAlign: 'left',
  padding: '11px 12px',
  borderBottom: '1px solid #eceae6',
  fontSize: '13px',
  verticalAlign: 'top',
  color: '#2d2a26',
  minWidth: 0,
};

export const tableHeaderStyle: CSSProperties = {
  color: '#68635c',
  fontSize: '12px',
  background: '#f7f7f5',
};

export const mutedTextStyle: CSSProperties = {
  margin: 0,
  color: '#7d7162',
  fontSize: '13px',
  lineHeight: 1.6,
};

export const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '24px',
  borderRadius: '999px',
  padding: '3px 9px',
  border: '1px solid rgba(139, 116, 79, 0.18)',
  background: '#f7efe1',
  color: '#4d412f',
  fontSize: '12px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};
