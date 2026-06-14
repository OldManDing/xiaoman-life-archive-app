import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Clock, Home, Sparkles, User, Users } from 'lucide-react';

export const AppLayout = () => {
  const location = useLocation();
  const bottomNavHeight = 'calc(90px + env(safe-area-inset-bottom))';
  const tabScrollPadding = 'calc(150px + env(safe-area-inset-bottom))';
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
        background: 'linear-gradient(180deg, #050918 0%, #0b1130 52%, #050918 100%)',
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
          maxHeight: showBottomNav ? `calc(100dvh - ${bottomNavHeight})` : undefined,
          paddingBottom: showBottomNav ? tabScrollPadding : 0,
          scrollPaddingTop: '24px',
          scrollPaddingBottom: showBottomNav ? tabScrollPadding : '24px',
        }}
      >
        <Outlet />
      </main>
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
          border: '1px solid rgba(127,139,220,0.34)',
          borderRadius: '34px 34px 0 0',
          background: 'rgba(6,10,28,0.92)',
          backdropFilter: 'blur(24px)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 10,
          marginTop: 'auto',
          padding: '9px 18px calc(10px + env(safe-area-inset-bottom))',
          boxShadow: '0 -18px 56px rgba(var(--nl-shadow-rgb),0.48), inset 0 1px 0 rgba(255,255,255,0.08)',
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
                        background: 'rgba(var(--nl-primary-rgb),0.22)',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                        boxShadow: '0 0 24px rgba(var(--nl-primary-rgb),0.32)',
                      }}
                    />
                  ) : null}
                  <span
                    className="app-bottom-nav-icon"
                    style={{
                      width: item.featured ? '70px' : '34px',
                      height: item.featured ? '70px' : '34px',
                      marginTop: item.featured ? '-30px' : 0,
                      borderRadius: '999px',
                      display: 'grid',
                      placeItems: 'center',
                        background: item.featured ? 'radial-gradient(circle at 30% 24%, rgba(216,220,255,0.52), transparent 18%), linear-gradient(145deg, var(--nl-primary-2), var(--nl-primary))' : isActive ? 'rgba(var(--nl-primary-rgb),0.18)' : 'transparent',
                        color: item.featured ? 'var(--nl-ink)' : isActive ? '#ffffff' : 'var(--nl-muted)',
                      boxShadow: item.featured ? '0 18px 44px rgba(var(--nl-primary-rgb),0.34), inset 0 1px 0 rgba(255,255,255,0.34)' : 'none',
                        border: item.featured ? '2px solid rgba(190,178,255,0.78)' : 'none',
                      transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.18s ease, color 0.18s ease',
                    }}
                  >
                    <Icon size={item.featured ? 30 : 21} strokeWidth={isActive || item.featured ? 2.5 : 2} />
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
