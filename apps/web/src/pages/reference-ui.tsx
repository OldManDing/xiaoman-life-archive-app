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
  background: 'transparent',
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
  borderRadius: 'var(--nl-radius-card, 24px)',
  border: '1px solid var(--nl-glass-border)',
  background: 'var(--nl-card-bg)',
  boxShadow: '0 10px 24px rgba(146, 96, 52, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.66)',
  WebkitBackdropFilter: 'blur(12px) saturate(1.02)',
  backdropFilter: 'blur(12px) saturate(1.02)',
};

export const refSoftCardStyle: CSSProperties = {
  ...refCardStyle,
  borderRadius: 'var(--nl-radius-card, 24px)',
};

export const refPrimaryButtonStyle: CSSProperties = {
  minHeight: '52px',
  border: '1px solid transparent',
  borderRadius: 'var(--nl-radius-control, 16px)',
  background: 'var(--nl-primary-gradient)',
  color: 'var(--nl-on-primary)',
  padding: '14px 20px',
  fontSize: '16px',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
  boxShadow: '0 12px 26px rgba(169, 88, 27, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
  transition: 'transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease',
};

export const refSecondaryButtonStyle: CSSProperties = {
  ...refPrimaryButtonStyle,
  border: '1px solid var(--nl-glass-border)',
  background: 'rgba(255, 250, 244, 0.66)',
  color: 'var(--nl-ink)',
  boxShadow: '0 6px 16px rgba(146, 96, 52, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.66)',
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
        top: 'calc(8px + env(safe-area-inset-top))',
        zIndex: 4,
        margin: '0 16px',
        minHeight: '52px',
        padding: '6px 10px',
      border: '1px solid rgba(255, 255, 255, 0.72)',
      borderRadius: '26px',
      background: 'rgba(255, 250, 244, 0.78)',
      WebkitBackdropFilter: 'blur(18px) saturate(1.05)',
      backdropFilter: 'blur(18px) saturate(1.05)',
      boxShadow: '0 12px 30px rgba(146, 96, 52, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
        display: 'grid',
        gridTemplateColumns: '52px minmax(0, 1fr) 52px',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>{backNode}</div>
      <h1 style={{ margin: 0, textAlign: 'center', color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: '20px', fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{action ?? <span />}</div>
    </header>
  );
};

const topBackButtonStyle: CSSProperties = {
  width: '44px',
  minWidth: '44px',
  height: '44px',
  border: '1px solid rgba(255, 255, 255, 0.72)',
  borderRadius: '999px',
  background: 'rgba(255, 255, 255, 0.58)',
  color: 'var(--nl-ink)',
  display: 'grid',
  placeItems: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: '0 6px 16px rgba(146, 96, 52, 0.12)',
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
      borderBottom: isLast ? 'none' : '1px solid rgba(58, 42, 28, 0.08)',
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
      {icon ? <span style={{ width: '28px', height: '34px', borderRadius: 0, background: 'transparent', border: 'none', color: danger ? 'var(--nl-danger)' : 'var(--nl-accent)', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: 'none' }}>{icon}</span> : null}
      <span style={{ fontSize: '15px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{title}</span>
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
      minHeight: '30px',
      borderRadius: '999px',
      padding: '7px 14px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? 'rgba(233, 160, 90, 0.26)' : 'rgba(255, 255, 255, 0.4)',
      color: active ? 'var(--nl-ink)' : 'var(--nl-muted)',
      border: active ? '1px solid rgba(169, 88, 27, 0.32)' : '1px solid rgba(58, 42, 28, 0.08)',
      boxShadow: 'none',
      fontSize: '12px',
      fontWeight: active ? 600 : 500,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);
