import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Clock, Home, Sparkles, User, Users } from 'lucide-react';
import type { CSSProperties } from 'react';

export const AppLayout = () => {
  const location = useLocation();
  const bottomNavHeight = 'calc(88px + env(safe-area-inset-bottom))';
  const bottomNavClearance = 'calc(88px + env(safe-area-inset-bottom))';
  const tabScrollPadding = '56px';
  const navItems = [
    { to: '/home', label: '首页', icon: Home },
    { to: '/timeline', label: '时间轴', icon: Clock },
    { to: '/record/create', label: '记录', icon: Sparkles, featured: true },
    { to: '/family', label: '家庭', icon: Users },
    { to: '/profile', label: '我的', icon: User },
  ];
  const tabPaths = new Set(['/home', '/timeline', '/family', '/profile']);
  const showBottomNav = tabPaths.has(location.pathname);

  return (
    <div
      className="app-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        maxWidth: '430px',
        margin: '0 auto',
        background: 'var(--nl-page-bg)',
        color: 'var(--nl-ink)',
        position: 'relative',
        overflowX: 'clip',
      }}
    >
      <main
        style={{
          flex: 1,
          overflow: showBottomNav ? 'auto' : 'visible',
          minHeight: 0,
          height: showBottomNav ? `calc(100dvh - ${bottomNavClearance})` : undefined,
          maxHeight: showBottomNav ? `calc(100dvh - ${bottomNavClearance})` : undefined,
          paddingBottom: 0,
          scrollPaddingTop: '24px',
          scrollPaddingBottom: showBottomNav ? tabScrollPadding : '24px',
          overscrollBehavior: showBottomNav ? 'contain' : undefined,
          boxSizing: 'border-box',
          '--nl-page-min-height': showBottomNav ? `calc(100dvh - ${bottomNavClearance})` : '100dvh',
        } as CSSProperties}
      >
        <Outlet />
      </main>
      {showBottomNav ? (
        <span
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: bottomNavHeight,
            zIndex: 9,
            width: '100%',
            maxWidth: '430px',
            height: '38px',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(17,18,16,0), rgba(17,18,16,0.62) 70%, rgba(17,18,16,0.9))',
          }}
        />
      ) : null}
      {showBottomNav ? <nav
        aria-label="主导航"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '430px',
          minHeight: bottomNavHeight,
          border: '1px solid var(--nl-glass-border)',
          borderRadius: '28px 28px 0 0',
          background: 'var(--nl-glass-strong)',
          WebkitBackdropFilter: 'blur(26px) saturate(1.18)',
          backdropFilter: 'blur(26px) saturate(1.18)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 10,
          marginTop: 'auto',
          padding: '9px 18px calc(9px + env(safe-area-inset-bottom))',
          boxShadow: '0 -18px 46px rgba(var(--nl-shadow-rgb),0.42), 0 -1px 0 rgba(245,205,140,0.12), inset 0 1px 0 rgba(255,255,255,0.1)',
          boxSizing: 'border-box',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `app-bottom-nav-link${isActive ? ' is-active' : ''}${item.featured ? ' is-featured' : ''}`}
              style={({ isActive }) => ({
                width: '20%',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'none',
                color: item.featured ? 'var(--nl-primary-2)' : isActive ? '#ffffff' : 'var(--nl-muted)',
                fontSize: '11px',
                fontWeight: isActive ? 850 : 700,
                position: 'relative',
                minHeight: '44px',
                justifyContent: 'center',
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && !item.featured ? (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: '-5px',
                        left: '50%',
                        width: '44px',
                        height: '36px',
                        borderRadius: '999px',
                        background: 'var(--nl-glass-soft)',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                      }}
                    />
                  ) : null}
                  <span
                    className="app-bottom-nav-icon"
                    style={{
                      width: item.featured ? '62px' : '34px',
                      height: item.featured ? '62px' : '34px',
                      marginTop: item.featured ? '-24px' : 0,
                      borderRadius: '999px',
                      display: 'grid',
                      placeItems: 'center',
                        background: item.featured ? 'var(--nl-glass-accent)' : isActive ? 'var(--nl-glass-soft)' : 'rgba(var(--nl-surface-rgb),0.18)',
                        color: item.featured ? '#ffffff' : isActive ? '#ffffff' : 'var(--nl-muted)',
                      boxShadow: item.featured ? '0 12px 28px rgba(var(--nl-shadow-rgb),0.3), inset 0 1px 0 rgba(255,255,255,0.2)' : isActive ? '0 8px 18px rgba(var(--nl-shadow-rgb),0.18), inset 0 1px 0 rgba(255,255,255,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        border: item.featured ? '1px solid rgba(245,205,140,0.58)' : '1px solid rgba(245,205,140,0.12)',
                      WebkitBackdropFilter: 'blur(14px) saturate(1.12)',
                      backdropFilter: 'blur(14px) saturate(1.12)',
                      transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.18s ease, color 0.18s ease',
                    }}
                  >
                    <Icon size={item.featured ? 27 : 21} strokeWidth={isActive || item.featured ? 2.5 : 2} />
                  </span>
                  <span className="app-bottom-nav-label" style={{ lineHeight: 1, marginTop: item.featured ? '1px' : 0 }}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav> : null}
    </div>
  );
};
