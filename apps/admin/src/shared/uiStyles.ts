import type { CSSProperties } from 'react';

/**
 * 内联样式版的设计值。
 *
 * 注意：这里曾与 index.css 那套并行存在、且取值不一致（圆角 8px vs 10px、
 * 主按钮 #4a3a22 vs #3f3322、按钮 42px vs 40px），是"同一件事两套标准"的根源。
 * 2026-09-24 起与 CSS 令牌对齐：颜色/圆角一律引用 var(--…)，尺寸取与 CSS 相同的值。
 * 可证明同值的（如 #ffffff → var(--surface)）直接替换；不一致的按 CSS 那套为准修正。
 */
export const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid rgba(35, 31, 27, 0.1)',
  borderRadius: 'var(--radius-lg)',
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
  minHeight: '40px',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--line)',
  padding: '10px 12px',
  fontSize: '13px',
  background: 'var(--surface)',
  color: 'var(--ink)',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.72)',
  transition: 'border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease',
};

export const primaryButtonStyle: CSSProperties = {
  border: '1px solid #3f3322',
  borderRadius: 'var(--radius-lg)',
  padding: '9px 14px',
  background: '#3f3322',
  color: 'var(--paper)',
  fontWeight: 800,
  cursor: 'pointer',
  minHeight: '40px',
  boxShadow: '0 10px 22px rgba(70, 48, 24, 0.08)',
};

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid rgba(139, 116, 79, 0.22)',
  background: 'var(--surface)',
  color: '#5d4d35',
  boxShadow: 'none',
};

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface)',
};

export const thTdStyle: CSSProperties = {
  textAlign: 'left',
  // 11px 的上下内边距让每行接近 70px，20 行就吃掉一屏；收到 9px 后仍保留分组感，
  // 但一屏能多看 2~3 行（列表密度是运营最常抱怨的点）。
  padding: '9px 12px',
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
