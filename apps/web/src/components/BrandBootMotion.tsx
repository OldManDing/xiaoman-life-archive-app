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
  gap: '24px',
  overflow: 'hidden',
};

const motionBlockStyle: CSSProperties = {
  width: 'min(100%, 360px)',
  display: 'grid',
  justifyItems: 'center',
  gap: '18px',
  textAlign: 'center',
};

const logoStageStyle: CSSProperties = {
  position: 'relative',
  width: '174px',
  height: '174px',
  display: 'grid',
  placeItems: 'center',
};

const logoStyle: CSSProperties = {
  position: 'relative',
  zIndex: 3,
  width: '82px',
  height: '82px',
  borderRadius: '8px',
  boxShadow: '0 18px 48px rgba(var(--nl-shadow-rgb),0.28)',
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
          background:
            conic-gradient(from 24deg,
              transparent 0deg,
              rgba(var(--nl-primary-rgb),0.46) 42deg,
              transparent 104deg,
              rgba(var(--nl-accent-rgb),0.54) 176deg,
              transparent 236deg,
              var(--nl-boot-ring-light) 292deg,
              transparent 360deg);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), var(--nl-mask-fill) calc(100% - 1px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), var(--nl-mask-fill) calc(100% - 1px));
          animation: nlBootRingTurn 5.6s linear infinite;
        }

        .nl-boot-ring:nth-of-type(2) {
          inset: 22px;
          opacity: 0.72;
          animation-duration: 4.2s;
          animation-direction: reverse;
        }

        .nl-boot-ring:nth-of-type(3) {
          inset: 44px;
          opacity: 0.58;
          animation: nlBootRingBreathe 2.4s ease-in-out infinite;
        }

        .nl-boot-logo {
          animation: nlBootLogoSettle 2.4s ease-in-out infinite;
        }

        .nl-boot-line {
          height: 2px;
          border-radius: 999px;
          background: rgba(var(--nl-primary-rgb),0.44);
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
        <img className="nl-boot-logo" src="/brand/nianlun-logo-192.png" alt="" width={82} height={82} style={logoStyle} />
      </div>

      <div style={{ display: 'grid', gap: '7px', justifyItems: 'center', minWidth: 0 }}>
        <strong style={{ color: 'var(--nl-ink)', fontSize: '24px', lineHeight: 1.1, fontWeight: 760 }}>年轮</strong>
        <span style={{ color: 'var(--nl-muted)', fontSize: '13px', fontWeight: 620 }}>正在进入家庭时间线</span>
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
            style={{ ...recoveryButtonStyle, background: 'var(--nl-primary-gradient)', color: 'var(--nl-on-primary)', fontWeight: 760, borderColor: 'var(--nl-primary-border)', boxShadow: '0 10px 20px rgba(var(--nl-primary-rgb),0.09), inset 0 1px 0 var(--nl-inset-highlight-faint)' }}
          >
            回到登录
          </button>
        </div>
      </section>
    ) : null}
  </main>
);
