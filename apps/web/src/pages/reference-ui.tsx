import { type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const referenceAssets = {
  momAvatar: '/reference-ui/avatar-mom.png',
  childAvatar: '/reference-ui/avatar-child.png',
  childPhoto: '/reference-ui/timeline-child.png',
  parkPhoto: '/reference-ui/park-photo.png',
  roomPhoto: '/reference-ui/room-photo.png',
};

export const refPageStyle: CSSProperties = {
  minHeight: '100dvh',
  background: '#f6f7f8',
  color: '#292524',
  overflowX: 'hidden',
  animation: 'app-page-enter 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
};

export const refContentStyle: CSSProperties = {
  padding: '0 20px 28px',
  display: 'grid',
  gap: '18px',
};

export const refCardStyle: CSSProperties = {
  borderRadius: '18px',
  border: '1px solid #eef0f2',
  background: '#ffffff',
  boxShadow: '0 3px 12px rgba(15,23,42,0.045)',
};

export const refSoftCardStyle: CSSProperties = {
  ...refCardStyle,
  borderRadius: '24px',
};

export const refPrimaryButtonStyle: CSSProperties = {
  minHeight: '46px',
  border: 'none',
  borderRadius: '999px',
  background: '#292524',
  color: '#ffffff',
  padding: '12px 18px',
  fontSize: '14px',
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
  boxShadow: '0 6px 14px rgba(41,37,36,0.16)',
};

export const refSecondaryButtonStyle: CSSProperties = {
  ...refPrimaryButtonStyle,
  border: '1px solid #eef0f2',
  background: '#ffffff',
  color: '#57534e',
  boxShadow: '0 2px 8px rgba(15,23,42,0.035)',
};

export const refMutedTextStyle: CSSProperties = {
  margin: 0,
  color: '#9ca3af',
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
        padding: 'calc(6px + env(safe-area-inset-top)) 14px 0',
        borderBottom: '1px solid #eef0f2',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(16px)',
        display: 'grid',
        gridTemplateColumns: '52px minmax(0, 1fr) 52px',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>{backNode}</div>
      <h1 style={{ margin: 0, textAlign: 'center', color: '#292524', fontSize: '17px', fontWeight: 800, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
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
  color: '#292524',
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
}: {
  src?: string;
  label: string;
  size?: number;
  radius?: string;
}) => (
  <img
    src={src}
    alt={label}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: radius,
      objectFit: 'cover',
      border: '1px solid #eee9df',
      boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
      flexShrink: 0,
      background: '#f5f5f4',
    }}
  />
);

export const RefSectionTitle = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <h2 style={{ margin: '0 0 12px 2px', color: '#9ca3af', fontSize: '15px', fontWeight: 800, ...style }}>{children}</h2>
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
      minHeight: '58px',
      border: 'none',
      borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
      background: '#ffffff',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      textAlign: 'left',
      cursor: onClick ? 'pointer' : 'default',
      color: danger ? '#ef4444' : '#334155',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
      {icon ? <span style={{ width: '24px', color: danger ? '#ef4444' : '#94a3b8', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</span> : null}
      <span style={{ fontSize: '15px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
    </span>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: danger ? '#ef4444' : '#9ca3af', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
      {value}
      {onClick ? <ChevronRight size={16} color="#cbd5e1" /> : null}
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
      background: active ? '#292524' : '#ffffff',
      color: active ? '#ffffff' : '#78716c',
      border: active ? '1px solid #292524' : '1px solid #edf0f3',
      boxShadow: active ? '0 5px 12px rgba(41,37,36,0.16)' : 'none',
      fontSize: '13px',
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);
