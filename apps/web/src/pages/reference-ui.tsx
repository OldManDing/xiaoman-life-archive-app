import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useStoredMediaUrl } from '../shared/hooks';

export const referenceAssets = {
  momAvatar: '/reference-ui/avatar-mom.png',
  childAvatar: '/reference-ui/avatar-child-hq.png',
  childPhoto: '/reference-ui/timeline-child.png',
  parkPhoto: '/reference-ui/park-photo.png',
  roomPhoto: '/reference-ui/room-photo.png',
};

export const isReferencePlaceholderAvatar = (src?: string | null) => {
  const normalized = src?.trim();
  if (!normalized) return false;
  return (
    normalized.startsWith('data:image/svg+xml') ||
    /(placeholder|default-avatar|avatar-placeholder|m_mpteyz2rbf1f|f_demo_001)/i.test(normalized)
  );
};

export const refPageStyle: CSSProperties = {
  minHeight: 'var(--nl-page-min-height, 100dvh)',
  background: 'var(--nl-page-bg)',
  color: 'var(--nl-ink)',
  overflowX: 'hidden',
  animation: 'app-page-enter 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
};

export const refContentStyle: CSSProperties = {
  padding: '0 var(--nl-content-inline) 34px',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: '20px',
};

export const refCardStyle: CSSProperties = {
  borderRadius: '8px',
  border: '1px solid var(--nl-border-soft)',
  background: 'var(--nl-card-bg)',
  boxShadow: 'var(--nl-shadow-sm)',
  WebkitBackdropFilter: 'none',
  backdropFilter: 'none',
};

export const refSoftCardStyle: CSSProperties = {
  ...refCardStyle,
  borderRadius: '8px',
};

export const refPrimaryButtonStyle: CSSProperties = {
  minHeight: '48px',
  border: '1px solid var(--nl-primary-border)',
  borderRadius: '8px',
  background: 'var(--nl-primary-2)',
  color: 'var(--nl-on-primary)',
  padding: '12px 18px',
  fontSize: '15px',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
  boxShadow: '0 10px 22px rgba(var(--nl-shadow-rgb),0.11)',
  transition: 'transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease',
};

export const refSecondaryButtonStyle: CSSProperties = {
  ...refPrimaryButtonStyle,
  border: '1px solid var(--nl-border-soft)',
  background: 'var(--nl-control-bg)',
  color: 'var(--nl-muted-strong)',
  boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
};

export const refMutedTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--nl-muted)',
  fontSize: '13px',
  lineHeight: 1.58,
  fontWeight: 520,
};

export const RefTopBar = ({
  title,
  backTo,
  backLabel = '返回',
  onBack,
  action,
}: {
  title: string;
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
  action?: ReactNode;
}) => {
  const backNode = onBack ? (
    <button type="button" aria-label={backLabel} onClick={onBack} style={topBackButtonStyle}>
      <ChevronLeft size={19} strokeWidth={2.4} />
    </button>
  ) : backTo ? (
    <Link to={backTo} aria-label={backLabel} style={topBackButtonStyle}>
      <ChevronLeft size={19} strokeWidth={2.4} />
    </Link>
  ) : (
    <span />
  );

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 4,
        minHeight: '52px',
        padding: 'calc(16px + env(safe-area-inset-top)) 16px 8px',
      borderBottom: '1px solid transparent',
      background: 'var(--nl-topbar-bg)',
      WebkitBackdropFilter: 'blur(16px) saturate(1.01)',
      backdropFilter: 'blur(16px) saturate(1.01)',
      boxShadow: 'none',
        display: 'grid',
        gridTemplateColumns: '52px minmax(0, 1fr) 52px',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>{backNode}</div>
      <h1 style={{ margin: 0, textAlign: 'center', color: 'var(--nl-ink)', fontSize: '16px', fontWeight: 680, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{action ?? <span />}</div>
    </header>
  );
};

const topBackButtonStyle: CSSProperties = {
  width: '40px',
  minWidth: '40px',
  height: '40px',
  border: 'none',
  borderRadius: 0,
  background: 'transparent',
  color: 'var(--nl-muted-strong)',
  display: 'grid',
  placeItems: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: 'none',
};

export const RefAvatar = ({
  src = referenceAssets.momAvatar,
  mediaNo,
  label,
  size = 44,
  radius = '999px',
  fallbackSrc = referenceAssets.momAvatar,
}: {
  src?: string | null;
  mediaNo?: string | null;
  label: string;
  size?: number;
  radius?: string;
  fallbackSrc?: string;
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedSrc = useStoredMediaUrl(src, mediaNo);
  const effectiveSrc = resolvedSrc && !isReferencePlaceholderAvatar(resolvedSrc) ? resolvedSrc : fallbackSrc;
  const displaySrc = failedSrc === effectiveSrc ? fallbackSrc : effectiveSrc;

  useEffect(() => {
    setFailedSrc(null);
  }, [effectiveSrc]);

  return (
    <img
      src={displaySrc}
      alt={label}
      decoding="async"
      onError={() => {
        if (displaySrc !== fallbackSrc) setFailedSrc(effectiveSrc);
      }}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius,
        objectFit: 'cover',
        border: '2px solid var(--nl-border-image)',
        outline: '1px solid rgba(var(--nl-accent-rgb),0.1)',
        boxShadow: '0 12px 26px rgba(var(--nl-shadow-rgb),0.15)',
        flexShrink: 0,
        background: 'var(--nl-surface-soft)',
      }}
    />
  );
};

export const RefSectionTitle = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <h2 style={{ margin: '0 0 10px', color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-sans)', fontSize: 'var(--nl-title-section-size)', lineHeight: 1.25, fontWeight: 680, letterSpacing: 0, display: 'flex', alignItems: 'center', gap: 9, ...style }}>
    <span aria-hidden="true" style={{ width: 18, height: 1, borderRadius: 1, background: 'var(--nl-accent)', flexShrink: 0 }} />
    <span>{children}</span>
  </h2>
);

export const RefListRow = ({
  icon,
  title,
  value,
  danger,
  onClick,
  isLast,
}: {
  icon?: ReactNode;
  title: string;
  value?: ReactNode;
  danger?: boolean;
  onClick?: () => void;
  isLast?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: '100%',
      minHeight: '64px',
      border: 'none',
      borderBottom: isLast ? 'none' : '1px solid rgba(var(--nl-shadow-rgb),0.07)',
      background: 'transparent',
      padding: '14px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '14px',
      textAlign: 'left',
      cursor: onClick ? 'pointer' : 'default',
      color: danger ? 'var(--nl-danger)' : 'var(--nl-ink)',
      transition: 'background-color 0.18s ease, transform 0.18s ease',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: '1 1 auto' }}>
      {icon ? <span style={{ width: '28px', height: '34px', borderRadius: 0, background: 'transparent', border: 'none', color: danger ? 'var(--nl-danger)' : 'var(--nl-primary-2)', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: 'none' }}>{icon}</span> : null}
      <span style={{ fontSize: '15px', fontWeight: 680, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{title}</span>
    </span>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: danger ? 'var(--nl-danger)' : 'var(--nl-muted)', fontSize: '12px', fontWeight: 500, flexShrink: 0 }}>
      {value}
      {onClick ? <ChevronRight size={16} color="var(--nl-muted)" /> : null}
    </span>
  </button>
);

export const RefChip = ({ children, active }: { children: ReactNode; active?: boolean }) => (
  <span
    style={{
      minHeight: '38px',
      borderRadius: '8px',
      padding: '8px 12px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? 'var(--nl-primary-soft)' : 'transparent',
      color: active ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)',
      border: active ? '1px solid var(--nl-primary-line)' : '1px solid var(--nl-border-muted)',
      boxShadow: 'none',
      fontSize: '12px',
      fontWeight: active ? 620 : 540,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);
