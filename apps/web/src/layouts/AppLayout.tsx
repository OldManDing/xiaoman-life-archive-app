import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Clock, Edit3, Home, User, Users } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';

import { webApi } from '../shared/api/webApi';
import type { AppUpdateCheckResponse } from '../shared/api/types';
import { formatUpdateBytes, updateDownloadStateLabel, useAppUpdateDownload } from '../shared/appUpdateUi';
import { hasVerifiedAppUpdateMetadata } from '../shared/appUpdater';

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
  const download = useAppUpdateDownload(update);

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

  if (!update?.update_available || dismissed) return null;

  const hasDownload = hasVerifiedAppUpdateMetadata(update) && update.download_available !== false && update.can_download_update !== false;
  const downloadAction = hasDownload ? (
    <div style={{ display: 'grid', gap: '8px' }}>
      {download.state === 'downloading' || download.state === 'verifying' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 650 }}>
            <span>{updateDownloadStateLabel(download.state)}</span>
            <span>{Math.round(download.progress)}%</span>
          </div>
          <div aria-label={`更新下载进度 ${Math.round(download.progress)}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(download.progress)} style={{ height: '6px', borderRadius: '999px', overflow: 'hidden', background: 'var(--nl-border-muted)' }}>
            <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, download.progress))}%`, background: 'var(--nl-primary-gradient)', transition: 'width 0.2s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--nl-muted)', fontSize: '11px' }}>{formatUpdateBytes(download.downloadedBytes)}{download.totalBytes ? ` / ${formatUpdateBytes(download.totalBytes)}` : ''}</span>
            <button type="button" onClick={() => void download.cancelDownload()} style={{ ...updateActionStyle, minHeight: '32px', padding: '0 10px', background: 'transparent', color: 'var(--nl-muted-strong)' }}>取消</button>
          </div>
        </>
      ) : download.state === 'ready' || download.state === 'permission' ? (
        <button type="button" onClick={() => void download.install()} style={{ ...updateActionStyle, background: 'var(--nl-primary-gradient)', borderColor: 'var(--nl-primary-border)', color: 'var(--nl-on-primary)', boxShadow: '0 10px 20px rgba(var(--nl-primary-rgb),0.09), inset 0 1px 0 var(--nl-inset-highlight-faint)' }}>
          {download.state === 'permission' ? '再次安装' : '安装更新'}
        </button>
      ) : download.state === 'installing' ? (
        <button type="button" disabled style={{ ...updateActionStyle, background: 'var(--nl-primary-gradient)', borderColor: 'var(--nl-primary-border)', color: 'var(--nl-on-primary)', opacity: 0.65 }}>
          正在打开系统安装器
        </button>
      ) : (
        <button type="button" onClick={() => void download.startDownload()} style={{ ...updateActionStyle, background: 'var(--nl-primary-gradient)', borderColor: 'var(--nl-primary-border)', color: 'var(--nl-on-primary)', boxShadow: '0 10px 20px rgba(var(--nl-primary-rgb),0.09), inset 0 1px 0 var(--nl-inset-highlight-faint)' }}>
          {download.state === 'error' ? '重试下载' : '下载并安装'}
        </button>
      )}
      {download.error ? <p style={{ margin: 0, color: 'var(--nl-danger)', fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{download.error}</p> : null}
      {download.state === 'installing' ? <span style={{ color: 'var(--nl-muted)', fontSize: '11px' }}>{updateDownloadStateLabel(download.state)}</span> : null}
    </div>
  ) : (
    <p style={{ margin: 0, color: 'var(--nl-danger)', fontSize: '12px', lineHeight: 1.55 }}>更新包暂不可下载，请联系管理员或稍后再试。</p>
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
  const bottomNavClearance = 'calc(70px + env(safe-area-inset-bottom))';
  const tabScrollPadding = '32px';
  const navItems = [
    { to: '/home', label: '首页', icon: Home },
    { to: '/timeline', label: '时间轴', icon: Clock },
    { to: '/record/create', label: '记录', icon: Edit3 },
    { to: '/family', label: '家庭', icon: Users },
    { to: '/profile', label: '我的', icon: User },
  ];
  const tabPaths = new Set(['/home', '/timeline', '/family', '/profile']);
  const showBottomNav = tabPaths.has(location.pathname);
  const isHome = location.pathname === '/home';
  const updateNoticeBottom = showBottomNav ? 'calc(68px + env(safe-area-inset-bottom))' : '16px';

  return (
    <div
      className={`app-layout${isHome ? ' is-home' : ''}`}
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
          minHeight: 'calc(70px + env(safe-area-inset-bottom))',
          height: 'calc(70px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--nl-border-soft)',
          borderRight: 'none',
          borderBottom: 'none',
          borderLeft: 'none',
          borderRadius: 0,
          background: 'var(--nl-surface)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 10,
          marginTop: 'auto',
          padding: '3px 14px max(9px, env(safe-area-inset-bottom))',
          boxShadow: 'none',
          boxSizing: 'border-box',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `app-bottom-nav-link${isActive ? ' is-active' : ''}`}
              style={({ isActive }) => ({
                width: '20%',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                textDecoration: 'none',
                color: isActive ? 'var(--nl-nav-active)' : 'var(--nl-nav-muted)',
                fontSize: '10px',
                fontWeight: isActive ? 650 : 500,
                position: 'relative',
                minHeight: '48px',
                justifyContent: 'center',
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    className="app-bottom-nav-icon"
                    style={{
                    width: isActive ? '30px' : '28px',
                    height: isActive ? '28px' : '26px',
                    marginTop: 0,
                    borderRadius: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'transparent',
                    color: isActive ? 'var(--nl-nav-active)' : 'var(--nl-nav-muted)',
                    boxShadow: 'none',
                    border: 'none',
                    transform: 'none',
                    transition: 'transform 0.18s ease, color 0.18s ease',
                  }}
                  >
                    <Icon size={isActive ? 20 : 19} strokeWidth={isActive ? 2.15 : 1.8} />
                  </span>
                  <span className="app-bottom-nav-label" style={{ lineHeight: 1, marginTop: 0, fontWeight: isActive ? 650 : undefined }}>{item.label}</span>
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
