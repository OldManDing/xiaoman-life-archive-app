import type { CSSProperties, ReactNode } from 'react';

const pageShellStyle: CSSProperties = {
  display: 'grid',
  gap: '18px',
  padding: '0 20px',
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '20px',
  padding: '20px',
  border: '1px solid #f2efe9',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.02)',
};

const headingStyle: CSSProperties = {
  margin: 0,
  color: '#292524',
  fontSize: '22px',
  fontWeight: 600,
  lineHeight: 1.3,
};

export const PageShell = ({
  title,
  description,
  hideHeader,
  children,
}: {
  title: string;
  description?: string;
  hideHeader?: boolean;
  children: ReactNode;
}) => (
  <section style={pageShellStyle}>
    {!hideHeader ? (
      <header style={{ padding: '28px 0 0' }}>
        <h1 style={{ ...headingStyle, fontSize: '24px', fontWeight: 700 }}>{title}</h1>
        {description ? <p style={{ margin: '8px 0 0', color: '#78716c', lineHeight: 1.6, fontSize: '14px' }}>{description}</p> : null}
      </header>
    ) : null}
    {children}
  </section>
);

export const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ ...cardStyle, ...style }}>{children}</div>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label style={{ display: 'grid', gap: '8px', fontSize: '14px', color: '#57534e', fontWeight: 600 }}>
    <span>{label}</span>
    {children}
  </label>
);

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: '14px',
  border: '1px solid #e7e5e4',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#292524',
  background: '#ffffff',
};

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '120px',
  resize: 'vertical',
};

export const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: '999px',
  padding: '12px 16px',
  background: '#292524',
  color: '#ffffff',
  fontWeight: 600,
  cursor: 'pointer',
};

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid #e7e5e4',
  background: '#ffffff',
  color: '#57534e',
};

export const helperTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: '#78716c',
};
