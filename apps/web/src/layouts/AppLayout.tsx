import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Clock, Home, Plus, User, Users } from 'lucide-react';

export const AppLayout = () => {
  const location = useLocation();
  const hideBottomNav = location.pathname.startsWith('/record/');
  const navItems = [
    { to: '/home', label: '首页', icon: Home },
    { to: '/timeline', label: '时间轴', icon: Clock },
    { to: '/record/create', label: '记录', icon: Plus, featured: true },
    { to: '/family', label: '家庭', icon: Users },
    { to: '/profile', label: '我的', icon: User },
  ];

  return (
    <div
      className="app-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        maxWidth: '430px',
        margin: '0 auto',
        background: '#ffffff',
        color: '#292524',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      <main style={{ flex: 1, overflow: 'auto', paddingBottom: hideBottomNav ? 0 : 'calc(92px + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>
      {hideBottomNav ? null : <nav
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '430px',
          height: '78px',
          borderTop: '1px solid #f3f0ea',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(18px)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'flex-start',
          zIndex: 10,
          marginTop: 'auto',
          padding: '9px 8px calc(14px + env(safe-area-inset-bottom))',
          boxShadow: '0 -3px 14px rgba(15,23,42,0.025)',
          boxSizing: 'border-box',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                width: '20%',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '5px',
                textDecoration: 'none',
                color: item.featured ? '#292524' : isActive ? '#292524' : '#a8a29e',
                fontSize: '10px',
                fontWeight: 600,
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    style={{
                      width: item.featured ? '46px' : '30px',
                      height: item.featured ? '46px' : '30px',
                      marginTop: item.featured ? '-24px' : 0,
                      borderRadius: '999px',
                      display: 'grid',
                      placeItems: 'center',
                      background: item.featured ? '#292524' : 'transparent',
                      color: item.featured ? '#ffffff' : isActive ? '#292524' : '#a8a29e',
                      boxShadow: item.featured ? '0 7px 18px rgba(41,37,36,0.2)' : 'none',
                    }}
                  >
                    <Icon size={item.featured ? 25 : 22} strokeWidth={isActive || item.featured ? 2.5 : 2} />
                  </span>
                  <span style={{ lineHeight: 1 }}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>}
    </div>
  );
};
