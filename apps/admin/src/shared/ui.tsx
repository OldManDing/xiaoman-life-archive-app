import type { CSSProperties, ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

import { badgeStyle, cardStyle, headingStyle, inputStyle, mutedTextStyle } from './uiStyles';

export const PageShell = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
  <section style={{ display: 'grid', gap: '16px', width: '100%', minWidth: 0 }}>
    <header style={{ display: 'grid', gap: '8px' }}>
      <h1 style={headingStyle}>{title}</h1>
      {description ? <p style={mutedTextStyle}>{description}</p> : null}
    </header>
    {children}
  </section>
);

export const Panel = ({ children }: { children: ReactNode }) => <div style={{ ...cardStyle, minWidth: 0, overflow: 'hidden' }}>{children}</div>;

export const EmptyState = ({ message }: { message: string }) => <p style={mutedTextStyle}>{message}</p>;

const adminSelectStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '42px',
  padding: '10px 36px 10px 12px',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  background: '#ffffff',
};

export const AdminSelect = ({
  children,
  containerStyle,
  selectStyle,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  containerStyle?: CSSProperties;
  selectStyle?: CSSProperties;
}) => (
  <span style={{ position: 'relative', display: 'block', width: '100%', ...containerStyle }}>
    <select
      {...props}
      style={{
        ...adminSelectStyle,
        opacity: props.disabled ? 0.62 : 1,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        ...selectStyle,
      }}
    >
      {children}
    </select>
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: '12px',
        top: '50%',
        transform: 'translateY(-54%)',
        color: '#66736f',
        width: '18px',
        height: '18px',
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <ChevronDown size={16} strokeWidth={2.3} />
    </span>
  </span>
);

export const Badge = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) => {
  const toneStyle = {
    neutral: { background: '#f6f8f7', borderColor: '#cbd5d1', color: '#263532' },
    success: { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' },
    warning: { background: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412' },
    danger: { background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' },
    info: { background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' },
  }[tone];

  return <span style={{ ...badgeStyle, ...toneStyle }}>{children}</span>;
};
