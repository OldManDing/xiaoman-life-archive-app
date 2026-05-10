import type { ReactNode } from 'react';

import { cardStyle, headingStyle } from './uiStyles';

export const PageShell = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
  <section style={{ display: 'grid', gap: '16px' }}>
    <header style={cardStyle}>
      <h1 style={headingStyle}>{title}</h1>
      {description ? <p style={{ margin: '8px 0 0', color: '#6b7280', lineHeight: 1.6 }}>{description}</p> : null}
    </header>
    {children}
  </section>
);

export const Panel = ({ children }: { children: ReactNode }) => <div style={cardStyle}>{children}</div>;

export const EmptyState = ({ message }: { message: string }) => <p style={{ margin: 0, color: '#6b7280' }}>{message}</p>;
