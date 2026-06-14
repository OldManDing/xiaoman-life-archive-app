import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useStoredMediaUrl } from '../shared/hooks';

export const referenceAssets = {
  momAvatar: '/reference-ui/avatar-mom.png',
  childAvatar: '/reference-ui/avatar-child.png',
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
  minHeight: '100dvh',
  background: 'linear-gradient(180deg, #050918 0%, #0b1130 52%, #050918 100%)',
  color: 'var(--nl-ink)',
  overflowX: 'hidden',
  animation: 'app-page-enter 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
};

export const refContentStyle: CSSProperties = {
  padding: '0 20px 28px',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: '18px',
};

export const refCardStyle: CSSProperties = {
  borderRadius: '20px',
  border: '1px solid var(--nl-border)',
  background: 'var(--nl-surface)',
  boxShadow: '0 16px 36px rgba(var(--nl-shadow-rgb),0.28), inset 0 1px 0 rgba(255,255,255,0.08)',
  backdropFilter: 'blur(18px)',
};

export const refSoftCardStyle: CSSProperties = {
  ...refCardStyle,
  borderRadius: '26px',
};

export const refPrimaryButtonStyle: CSSProperties = {
  minHeight: '46px',
  border: 'none',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, var(--nl-primary), var(--nl-primary-2))',
  color: '#ffffff',
  padding: '12px 18px',
  fontSize: '14px',
  fontWeight: 850,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
  boxShadow: '0 12px 28px rgba(var(--nl-primary-rgb),0.22), inset 0 1px 0 rgba(255,255,255,0.28)',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease',
};

export const refSecondaryButtonStyle: CSSProperties = {
  ...refPrimaryButtonStyle,
  border: '1px solid var(--nl-border)',
  background: 'rgba(var(--nl-surface-rgb),0.74)',
  color: 'var(--nl-muted-strong)',
  boxShadow: '0 12px 28px rgba(var(--nl-shadow-rgb),0.24)',
};

export const refMutedTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--nl-muted)',
  fontSize: '12px',
  lineHeight: 1.55,
  fontWeight: 600,
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
        height: '52px',
        padding: 'calc(30px + env(safe-area-inset-top)) 14px 0',
        borderBottom: '1px solid var(--nl-border)',
        background: 'rgba(5,9,24,0.86)',
        backdropFilter: 'blur(22px)',
        display: 'grid',
        gridTemplateColumns: '52px minmax(0, 1fr) 52px',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>{backNode}</div>
      <h1 style={{ margin: 0, textAlign: 'center', color: 'var(--nl-ink)', fontSize: '17px', fontWeight: 850, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{action ?? <span />}</div>
    </header>
  );
};

const topBackButtonStyle: CSSProperties = {
  width: '44px',
  minWidth: '44px',
  height: '44px',
  border: 'none',
  background: 'transparent',
  color: 'var(--nl-ink)',
  display: 'grid',
  placeItems: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
};

export const RefAvatar = ({
  src = referenceAssets.momAvatar,
  label,
  size = 44,
  radius = '999px',
  fallbackSrc = referenceAssets.momAvatar,
}: {
  src?: string;
  label: string;
  size?: number;
  radius?: string;
  fallbackSrc?: string;
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedSrc = useStoredMediaUrl(src);
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
        border: '2px solid rgba(231,234,255,0.9)',
        boxShadow: '0 16px 34px rgba(var(--nl-shadow-rgb),0.36), 0 0 0 5px rgba(160,151,255,0.14)',
        flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(var(--nl-primary-rgb),0.22), rgba(var(--nl-accent-rgb),0.12)), var(--nl-surface-soft)',
      }}
    />
  );
};

export const RefSectionTitle = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <h2 style={{ margin: '0 0 12px 2px', color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 900, ...style }}>{children}</h2>
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
      minHeight: '54px',
      border: 'none',
      borderBottom: isLast ? 'none' : '1px solid var(--nl-border)',
      background: 'rgba(var(--nl-surface-rgb),0.72)',
      padding: '11px 15px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      textAlign: 'left',
      cursor: onClick ? 'pointer' : 'default',
      color: danger ? 'var(--nl-danger)' : 'var(--nl-ink)',
      transition: 'background-color 0.18s ease, transform 0.18s ease',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 auto' }}>
      {icon ? <span style={{ width: '30px', height: '30px', borderRadius: '11px', background: danger ? 'rgba(229,95,105,0.12)' : 'rgba(var(--nl-primary-rgb),0.12)', color: danger ? 'var(--nl-danger)' : 'var(--nl-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</span> : null}
      <span style={{ fontSize: '14px', fontWeight: 760, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{title}</span>
    </span>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: danger ? 'var(--nl-danger)' : 'var(--nl-muted)', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
      {value}
      {onClick ? <ChevronRight size={16} color="rgba(216,220,255,0.62)" /> : null}
    </span>
  </button>
);

export const RefChip = ({ children, active }: { children: ReactNode; active?: boolean }) => (
  <span
    style={{
      minHeight: '44px',
      borderRadius: '999px',
      padding: '10px 15px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? 'linear-gradient(135deg, var(--nl-primary), var(--nl-primary-2))' : 'rgba(var(--nl-surface-rgb),0.74)',
      color: active ? '#ffffff' : 'var(--nl-muted)',
      border: active ? '1px solid var(--nl-primary)' : '1px solid var(--nl-border)',
      boxShadow: active ? '0 12px 26px rgba(var(--nl-primary-rgb),0.34)' : '0 8px 18px rgba(var(--nl-shadow-rgb),0.22)',
      fontSize: '13px',
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);
