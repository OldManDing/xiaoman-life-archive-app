import type { CSSProperties } from 'react';

type BrandBootMotionProps = {
  showRecovery?: boolean;
  onRetry?: () => void;
  onExit?: () => void;
};

const shellStyle: CSSProperties = {
  minHeight: '100dvh',
  boxSizing: 'border-box',
  padding: 'max(34px, env(safe-area-inset-top)) 22px max(28px, env(safe-area-inset-bottom))',
  background: 'var(--nl-page-bg)',
  color: 'var(--nl-muted-strong)',
  display: 'grid',
  alignContent: 'center',
  justifyItems: 'center',
  gap: '20px',
  overflow: 'hidden',
};

const motionBlockStyle: CSSProperties = {
  width: 'min(100%, 360px)',
  display: 'grid',
  justifyItems: 'center',
  gap: '20px',
  textAlign: 'center',
};

const logoStageStyle: CSSProperties = {
  position: 'relative',
  width: '164px',
  height: '164px',
  display: 'grid',
  placeItems: 'center',
};

const logoStyle: CSSProperties = {
  position: 'relative',
  zIndex: 3,
  width: '96px',
  height: '96px',
  borderRadius: '22%',
  objectFit: 'contain',
  boxShadow: '0 24px 58px rgba(var(--nl-shadow-rgb),0.22)',
};

const timelineTrackStyle: CSSProperties = {
  width: '168px',
  height: '2px',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '9px',
  alignItems: 'center',
};

const recoveryStyle: CSSProperties = {
  width: 'min(100%, 360px)',
  borderRadius: '8px',
  border: '1px solid var(--nl-border-strong)',
  background: 'var(--nl-card-bg-strong)',
  padding: '16px',
  display: 'grid',
  gap: '12px',
  boxShadow: 'var(--nl-shadow-sm)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.08)',
  backdropFilter: 'blur(16px) saturate(1.08)',
};

const recoveryButtonStyle: CSSProperties = {
  minHeight: '42px',
  borderRadius: '8px',
  border: '1px solid var(--nl-border-strong)',
  background: 'var(--nl-card-bg-strong)',
  color: 'var(--nl-muted-strong)',
  fontSize: '13px',
  fontWeight: 700,
  boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
  cursor: 'pointer',
};

export const BrandBootMotion = ({ showRecovery = false, onRetry, onExit }: BrandBootMotionProps) => (
  <main aria-busy="true" aria-label="正在进入年轮" style={shellStyle}>
    <style>
      {`
        @keyframes nlBootRingTurn {
          from { transform: rotate(0deg) scale(1); }
          to { transform: rotate(360deg) scale(1); }
        }

        @keyframes nlBootRingBreathe {
          0%, 100% { opacity: 0.48; transform: scale(0.94); }
          50% { opacity: 0.9; transform: scale(1.02); }
        }

        @keyframes nlBootLogoSettle {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-2px) scale(1.015); }
        }

        @keyframes nlBootLineReveal {
          0%, 100% { opacity: 0.28; transform: scaleX(0.36); }
          45%, 65% { opacity: 1; transform: scaleX(1); }
        }

        .nl-boot-ring {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          border: 1px solid rgba(var(--nl-primary-rgb),0.18);
          animation: nlBootRingTurn 5.6s linear infinite;
        }

        .nl-boot-ring:first-of-type::after {
          content: "";
          position: absolute;
          top: 7px;
          left: 50%;
          width: 6px;
          height: 6px;
          margin-left: -3px;
          border-radius: 999px;
          background: var(--nl-accent);
          box-shadow: 0 0 0 4px rgba(var(--nl-accent-rgb),0.09);
        }

        .nl-boot-ring:nth-of-type(2) {
          inset: 22px;
          opacity: 0.74;
          border-color: rgba(var(--nl-accent-rgb),0.2);
          animation-duration: 4.2s;
          animation-direction: reverse;
        }

        .nl-boot-ring:nth-of-type(3) {
          inset: 44px;
          opacity: 0.68;
          border-color: rgba(var(--nl-primary-rgb),0.26);
          animation: nlBootRingBreathe 2.4s ease-in-out infinite;
        }

        .nl-boot-logo {
          animation: nlBootLogoSettle 2.4s ease-in-out infinite;
        }

        .nl-boot-line {
          height: 1px;
          border-radius: 999px;
          background: rgba(var(--nl-accent-rgb),0.56);
          transform-origin: left center;
          animation: nlBootLineReveal 1.9s ease-in-out infinite;
        }

        .nl-boot-line:nth-child(2) { animation-delay: 0.16s; opacity: 0.66; }
        .nl-boot-line:nth-child(3) { animation-delay: 0.32s; opacity: 0.56; }
        .nl-boot-line:nth-child(4) { animation-delay: 0.48s; opacity: 0.46; }

        @media (prefers-reduced-motion: reduce) {
          .nl-boot-ring,
          .nl-boot-logo,
          .nl-boot-line {
            animation: none !important;
          }
        }
      `}
    </style>

    <section style={motionBlockStyle}>
      <div aria-hidden="true" style={logoStageStyle}>
        <span className="nl-boot-ring" />
        <span className="nl-boot-ring" />
        <span className="nl-boot-ring" />
        <img className="nl-boot-logo" src="/brand/nianlun-logo-192.png" alt="" width={96} height={96} style={logoStyle} />
      </div>

      <div style={{ display: 'grid', gap: '7px', justifyItems: 'center', minWidth: 0 }}>
        <strong style={{ color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: '26px', lineHeight: 1.1, fontWeight: 780 }}>年轮</strong>
        <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 520 }}>家庭影像档案</span>
      </div>

      <div aria-hidden="true" style={timelineTrackStyle}>
        {[0, 1, 2, 3].map((item) => (
          <span key={item} className="nl-boot-line" />
        ))}
      </div>
    </section>

    {showRecovery ? (
      <section role="status" aria-label="启动恢复" style={recoveryStyle}>
        <div style={{ display: 'grid', gap: '5px' }}>
          <strong style={{ color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 760 }}>启动时间较长</strong>
          <span style={{ color: 'var(--nl-muted-strong)', fontSize: '13px', lineHeight: 1.55 }}>
            网络或登录状态可能暂时不可用，可以重新检查，或先回到登录页。
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button type="button" onClick={onRetry} style={recoveryButtonStyle}>
            重新检查
          </button>
          <button
            type="button"
            onClick={onExit}
            style={{ ...recoveryButtonStyle, background: 'var(--nl-primary)', color: 'var(--nl-on-primary)', fontWeight: 760, borderColor: 'var(--nl-primary-border)', boxShadow: '0 10px 20px rgba(var(--nl-primary-rgb),0.09), inset 0 1px 0 var(--nl-inset-highlight-faint)' }}
          >
            回到登录
          </button>
        </div>
      </section>
    ) : null}
  </main>
);
