import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Clock, Home, Plus, User, Users } from 'lucide-react';

export const AppLayout = () => {
  const location = useLocation();
  const navItems = [
    { to: '/home', label: '首页', icon: Home },
    { to: '/timeline', label: '时间轴', icon: Clock },
    { to: '/record/create', label: '记录', icon: Plus, featured: true },
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
        background: 'linear-gradient(180deg, #f4f8fc 0%, #fffaf1 54%, #f6f9fd 100%)',
        color: '#172033',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      <main style={{ flex: 1, overflow: 'visible', paddingBottom: showBottomNav ? 'calc(86px + env(safe-area-inset-bottom))' : 0 }}>
        <Outlet />
      </main>
      {showBottomNav ? <nav
        aria-label="主导航"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: 'calc(100% - 18px)',
          maxWidth: '412px',
          minHeight: '74px',
          border: '1px solid rgba(126,145,170,0.2)',
          borderRadius: '30px 30px 22px 22px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(249,252,255,0.86) 100%)',
          backdropFilter: 'blur(24px)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'flex-start',
          zIndex: 10,
          marginTop: 'auto',
          padding: '8px 8px calc(10px + env(safe-area-inset-bottom))',
          boxShadow: '0 -18px 44px rgba(25,35,55,0.14), inset 0 1px 0 rgba(255,255,255,0.8)',
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
                color: item.featured ? '#17342f' : isActive ? '#17342f' : '#7b8494',
                fontSize: '10px',
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
                        top: '-2px',
                        left: '50%',
                        width: '38px',
                        height: '26px',
                        borderRadius: '999px',
                        background: 'rgba(34,88,79,0.10)',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                      }}
                    />
                  ) : null}
                  <span
                    className="app-bottom-nav-icon"
                    style={{
                      width: item.featured ? '54px' : '30px',
                      height: item.featured ? '54px' : '30px',
                      marginTop: item.featured ? '-26px' : 0,
                      borderRadius: item.featured ? '20px' : '999px',
                      display: 'grid',
                      placeItems: 'center',
                      background: item.featured ? 'linear-gradient(135deg, #17342f 0%, #22584f 58%, #d97706 140%)' : 'transparent',
                      color: item.featured ? '#ffffff' : isActive ? '#17342f' : '#7b8494',
                      boxShadow: item.featured ? '0 18px 34px rgba(23,52,47,0.3), inset 0 1px 0 rgba(255,255,255,0.22)' : 'none',
                      border: item.featured ? '2px solid rgba(255,255,255,0.86)' : 'none',
                      transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.18s ease, color 0.18s ease',
                    }}
                  >
                    <Icon size={item.featured ? 24 : 21} strokeWidth={isActive || item.featured ? 2.5 : 2} />
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
