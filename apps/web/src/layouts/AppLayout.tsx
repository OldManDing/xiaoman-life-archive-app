import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Clock, Home, Sparkles, User, Users } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';

import { webApi } from '../shared/api/webApi';
import type { AppUpdateCheckResponse } from '../shared/api/types';

const appVersion = import.meta.env.VITE_APP_VERSION ?? '2.0.4';
const appBuildNumberRaw = import.meta.env.VITE_APP_BUILD_NUMBER ?? 'dev';
const appBuildNumber = Number.isFinite(Number(appBuildNumberRaw)) ? Number(appBuildNumberRaw) : 0;

const updateActionStyle = {
  minHeight: '38px',
  borderRadius: '8px',
  border: '1px solid var(--nl-border-strong)',
  padding: '0 13px',
  fontSize: '13px',
  fontWeight: 720,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
} as const;

const AppUpdateNotice = ({ bottomOffset }: { bottomOffset: string }) => {
  const [update, setUpdate] = useState<AppUpdateCheckResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    void webApi
      .checkAppUpdate({
        platform: 'android',
        version: appVersion,
        build_number: appBuildNumber,
      })
      .then((result) => {
        if (mounted) setUpdate(result);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  if (!update?.update_available || dismissed || !update.apk_url) return null;

  const downloadAction = (
    <a
      href={update.apk_url}
      target="_blank"
      rel="noreferrer"
      style={{
        ...updateActionStyle,
        background: 'var(--nl-primary-gradient)',
        borderColor: 'var(--nl-primary-border)',
        color: 'var(--nl-on-primary)',
        boxShadow: '0 10px 20px rgba(var(--nl-primary-rgb),0.09), inset 0 1px 0 var(--nl-inset-highlight-faint)',
      }}
    >
      下载更新
    </a>
  );

  if (update.force_update) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="版本更新"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'var(--nl-overlay-scrim)',
          display: 'grid',
          placeItems: 'center',
          padding: '20px',
        }}
      >
        <section style={{ width: '100%', maxWidth: '390px', borderRadius: '8px', border: '1px solid var(--nl-border-strong)', background: 'var(--nl-dialog-bg)', padding: '18px', display: 'grid', gap: '12px', boxShadow: 'var(--nl-dialog-shadow)' }}>
          <div style={{ display: 'grid', gap: '5px' }}>
            <strong style={{ color: 'var(--nl-ink)', fontSize: '17px', fontWeight: 780 }}>需要更新</strong>
            <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 600 }}>最新版本 {update.latest_version}（构建 {update.latest_build_number}）</span>
          </div>
          <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '13px', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{update.release_notes}</p>
          {downloadAction}
        </section>
      </div>
    );
  }

  return (
    <section
      role="status"
      aria-label="发现新版本"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: bottomOffset,
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '406px',
        zIndex: 30,
        borderRadius: '8px',
        border: '1px solid var(--nl-border-strong)',
        background: 'var(--nl-dialog-bg)',
        padding: '14px',
        boxShadow: 'var(--nl-dialog-shadow)',
        display: 'grid',
        gap: '10px',
      }}
    >
      <div style={{ display: 'grid', gap: '4px' }}>
        <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 760 }}>发现新版本</strong>
        <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 600 }}>最新版本 {update.latest_version}（构建 {update.latest_build_number}）</span>
      </div>
      <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '12px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{update.release_notes}</p>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button type="button" onClick={() => setDismissed(true)} style={{ ...updateActionStyle, background: 'transparent', color: 'var(--nl-muted-strong)' }}>
          稍后
        </button>
        {downloadAction}
      </div>
    </section>
  );
};

export const AppLayout = () => {
  const location = useLocation();
  const bottomNavHeight = 'calc(74px + env(safe-area-inset-bottom))';
  const bottomNavClearance = 'calc(74px + env(safe-area-inset-bottom))';
  const tabScrollPadding = '32px';
  const navItems = [
    { to: '/home', label: '首页', icon: Home, featured: false },
    { to: '/timeline', label: '时间轴', icon: Clock, featured: false },
    { to: '/record/create', label: '记录', icon: Sparkles, featured: false },
    { to: '/family', label: '家庭', icon: Users, featured: false },
    { to: '/profile', label: '我的', icon: User, featured: false },
  ];
  const tabPaths = new Set(['/home', '/timeline', '/family', '/profile']);
  const showBottomNav = tabPaths.has(location.pathname);
  const updateNoticeBottom = showBottomNav ? 'calc(86px + env(safe-area-inset-bottom))' : '16px';

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
        className="app-main-scroll"
        style={{
          flex: 1,
          overflow: showBottomNav ? 'auto' : 'visible',
          minHeight: 0,
          height: showBottomNav ? `calc(100dvh - ${bottomNavClearance})` : undefined,
          maxHeight: showBottomNav ? `calc(100dvh - ${bottomNavClearance})` : undefined,
          paddingBottom: 0,
          scrollPaddingTop: '22px',
          scrollPaddingBottom: showBottomNav ? tabScrollPadding : '24px',
          overscrollBehavior: showBottomNav ? 'contain' : undefined,
          WebkitOverflowScrolling: 'touch',
          contain: showBottomNav ? 'layout paint style' : undefined,
          boxSizing: 'border-box',
          '--nl-page-min-height': showBottomNav ? `calc(100dvh - ${bottomNavClearance})` : '100dvh',
        } as CSSProperties}
      >
        <Outlet />
      </main>
      {showBottomNav ? <nav
        className="app-bottom-nav"
        aria-label="主导航"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '430px',
          minHeight: bottomNavHeight,
          borderTop: '1px solid var(--nl-border-soft)',
          borderRight: 'none',
          borderBottom: 'none',
          borderLeft: 'none',
          borderRadius: 0,
        background: 'rgba(var(--nl-surface-rgb), 0.94)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.02)',
          backdropFilter: 'blur(18px) saturate(1.02)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 10,
          marginTop: 'auto',
          padding: '5px 14px calc(10px + env(safe-area-inset-bottom))',
          boxShadow: '0 -12px 30px rgba(var(--nl-shadow-rgb),0.08)',
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
                gap: '3px',
                textDecoration: 'none',
                color: isActive || item.featured ? 'var(--nl-primary-2)' : 'var(--nl-muted)',
                fontSize: '10px',
                fontWeight: isActive ? 650 : 500,
                position: 'relative',
                minHeight: '44px',
                justifyContent: 'center',
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    className="app-bottom-nav-icon"
                    style={{
                    width: '28px',
                    height: '28px',
                    marginTop: 0,
                    borderRadius: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'transparent',
                    color: item.featured || isActive ? 'var(--nl-primary-2)' : 'var(--nl-muted)',
                    boxShadow: 'none',
                    border: 'none',
                      transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.18s ease, color 0.18s ease',
                    }}
                  >
                    <Icon size={isActive || item.featured ? 20 : 19} strokeWidth={isActive || item.featured ? 2.15 : 1.8} />
                  </span>
                  <span className="app-bottom-nav-label" style={{ lineHeight: 1, marginTop: 0 }}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav> : null}
      <AppUpdateNotice bottomOffset={updateNoticeBottom} />
    </div>
  );
};
