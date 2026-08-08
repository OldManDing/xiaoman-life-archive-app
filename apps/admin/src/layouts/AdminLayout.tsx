import type { CSSProperties } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Archive, BarChart3, BellRing, Bot, Database, FileText, House, KeyRound, LogOut, MessageSquareText, ServerCog, Settings2, ShieldCheck, SlidersHorizontal, UsersRound, X, type LucideIcon } from 'lucide-react';

import { useAdminAuth } from '../shared/useAdminAuth';
import { adminRoleLabel } from '../shared/labels';
import { secondaryButtonStyle } from '../shared/uiStyles';

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavSection = { label: string; items: NavItem[]; secondary?: boolean };

const navSections: NavSection[] = [
  {
    label: '工作台',
    items: [{ to: '/dashboard', label: '总览', icon: BarChart3 }],
  },
  {
    label: '内容与家庭',
    items: [
      { to: '/records', label: '成长记录', icon: FileText },
      { to: '/families', label: '家庭管理', icon: House },
      { to: '/children', label: '孩子档案', icon: Database },
    ],
  },
  {
    label: '运营',
    secondary: true,
    items: [
      { to: '/users', label: '账号管理', icon: UsersRound },
      { to: '/invites', label: '邀请码', icon: KeyRound },
      { to: '/notifications', label: '通知管理', icon: BellRing },
    ],
  },
  {
    label: '智能服务',
    secondary: true,
    items: [
      { to: '/ai-settings', label: 'AI 设置', icon: SlidersHorizontal },
      { to: '/ai-jobs', label: 'AI 任务', icon: Bot },
    ],
  },
  {
    label: '协作',
    secondary: true,
    items: [
      { to: '/support-tickets', label: '客服反馈', icon: MessageSquareText },
      { to: '/archive-export-requests', label: '档案交付', icon: Archive },
    ],
  },
  {
    label: '系统',
    secondary: true,
    items: [
      { to: '/ops-readiness', label: '系统运维', icon: ServerCog },
      { to: '/system-config', label: '系统配置', icon: Settings2 },
    ],
  },
];

const sidebarStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  alignSelf: 'start',
  height: '100dvh',
  maxHeight: '100dvh',
  minHeight: 0,
  background: '#2b2419',
  color: '#fff8ed',
  padding: '22px 16px',
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
  gap: '22px',
  overflow: 'hidden',
};

const navLinkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '9px',
  minHeight: '42px',
  padding: '10px 12px',
  borderRadius: '8px',
  color: isActive ? '#2b2419' : '#e9dcc8',
  background: isActive ? '#fff4df' : 'rgba(255, 248, 237, 0.03)',
  border: isActive ? '1px solid rgba(255, 244, 223, 0.92)' : '1px solid rgba(255, 248, 237, 0.09)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
});

export const AdminLayout = () => {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const displayName = admin?.display_name === 'System Admin' ? '系统管理员' : admin?.display_name;
  const primarySections = navSections.filter((section) => !section.secondary);
  const secondarySections = navSections.filter((section) => section.secondary);
  const isSecondaryRoute = secondarySections.some((section) => section.items.some((item) => location.pathname === item.to)) || location.pathname === '/audit-logs';
  const isMobileViewport = () => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches;
  const [moreOpen, setMoreOpen] = useState(isSecondaryRoute && !isMobileViewport());
  const visibleMoreOpen = moreOpen;
  const closeMore = () => setMoreOpen(false);
  useEffect(() => {
    if (!visibleMoreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [visibleMoreOpen]);
  const handleSecondaryNavClick = () => {
    closeMore();
  };

  return (
      <div
      className="admin-layout"
      style={{
        minHeight: '100dvh',
        height: '100dvh',
        maxHeight: '100dvh',
        display: 'grid',
         gridTemplateColumns: '224px minmax(0, 1fr)',
        background: '#f7f5f0',
        overflow: 'hidden',
      }}
    >
      <aside className={`admin-sidebar${visibleMoreOpen ? ' admin-sidebar-more-open' : ''}`} style={sidebarStyle}>
        <div className="admin-sidebar-brand">
          <img src="/brand/nianlun-logo-64.png" alt="年轮" className="admin-brand-logo" width={44} height={44} />
          <div>
            <div style={{ fontSize: '13px', color: '#d8c6aa', fontWeight: 700, marginBottom: '6px' }}>年轮</div>
            <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: 0 }}>管理后台</div>
          </div>
        </div>
          <div className="admin-sidebar-user" style={{ border: 'none', borderRadius: 0, padding: '10px 4px', background: 'transparent', borderTop: '1px solid rgba(255,248,237,0.12)', borderBottom: '1px solid rgba(255,248,237,0.12)' }}>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>{displayName ?? '未登录'}</div>
          <div style={{ marginTop: '4px', fontSize: '12px', color: '#d8c6aa' }}>{adminRoleLabel(admin?.role)}</div>
        </div>
        <nav className="admin-nav-sections" aria-label="后台导航">
          {primarySections.map((section) => (
            <section key={section.label} className={`admin-nav-section${section.secondary ? ' admin-nav-section-secondary' : ''}`}>
              <div className="admin-nav-section-label">{section.label}</div>
              <div className="admin-nav-section-items">
                {section.items.map((item) => (
                  <NavLink key={item.to} to={item.to} style={navLinkStyle} aria-label={item.label} onClick={closeMore}>
                    <item.icon size={17} strokeWidth={2.2} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
          <div className="admin-nav-more">
            <button type="button" className="admin-nav-more-trigger" aria-expanded={visibleMoreOpen} onClick={() => setMoreOpen((current) => !current)}>
              更多管理
            </button>
            {visibleMoreOpen ? <>
              <button type="button" className="admin-nav-more-backdrop" aria-label="关闭面板" onClick={closeMore} />
              <div className="admin-nav-more-content">
                <div className="admin-nav-more-heading">
                  <strong>更多管理</strong>
                  <button type="button" aria-label="关闭面板" onClick={closeMore}><X size={17} /></button>
                </div>
              {secondarySections.map((section) => (
                <section key={section.label} className="admin-nav-section admin-nav-section-secondary">
                  <div className="admin-nav-section-label">{section.label}</div>
                  <div className="admin-nav-section-items">
                    {section.items.map((item) => (
                      <NavLink key={item.to} to={item.to} style={navLinkStyle} aria-label={item.label} onClick={handleSecondaryNavClick}>
                        <item.icon size={17} strokeWidth={2.2} />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </section>
              ))}
              {admin?.role === 'super_admin' ? (
                <section className="admin-nav-section admin-nav-section-secondary">
                  <div className="admin-nav-section-label">审计</div>
                  <div className="admin-nav-section-items">
                    <NavLink to="/audit-logs" style={navLinkStyle} aria-label="审计日志" onClick={handleSecondaryNavClick}>
                      <ShieldCheck size={17} strokeWidth={2.2} />
                      <span>审计日志</span>
                    </NavLink>
                  </div>
                </section>
              ) : null}
              </div>
            </> : null}
          </div>
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" style={{ ...secondaryButtonStyle, width: '100%' }} onClick={logout}>
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      </aside>
      <main className="admin-main" style={{ padding: '32px 36px 48px', minWidth: 0, height: '100dvh', maxHeight: '100dvh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <Outlet />
      </main>
    </div>
  );
};
