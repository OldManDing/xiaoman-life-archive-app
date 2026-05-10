import type { ReactNode } from 'react';

import { badgeStyle, cardStyle, headingStyle, mutedTextStyle } from './uiStyles';

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
