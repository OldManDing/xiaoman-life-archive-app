import type { CSSProperties } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Bot, Database, FileText, Image, KeyRound, LogOut, ShieldCheck, UsersRound, type LucideIcon } from 'lucide-react';

import { useAdminAuth } from '../shared/useAdminAuth';
import { adminRoleLabel } from '../shared/labels';
import { secondaryButtonStyle } from '../shared/uiStyles';

const navItems: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/dashboard', label: '总览', icon: BarChart3 },
  { to: '/users', label: '账号管理', icon: UsersRound },
  { to: '/invites', label: '邀请码', icon: KeyRound },
  { to: '/children', label: '孩子档案', icon: Database },
  { to: '/records', label: '成长记录', icon: FileText },
  { to: '/media', label: '媒体库', icon: Image },
  { to: '/ai-jobs', label: 'AI 任务', icon: Bot },
];

const sidebarStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  minHeight: '100vh',
  background: '#102f2b',
  color: '#eff7f5',
  padding: '22px 16px',
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
  gap: '22px',
};

const navLinkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '9px',
  minHeight: '42px',
  padding: '10px 12px',
  borderRadius: '8px',
  color: isActive ? '#123c37' : '#d7e5e1',
  background: isActive ? '#ffffff' : 'transparent',
  border: isActive ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.08)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
});

const SidebarSignal = ({ label, value }: { label: string; value: string }) => (
  <div className="admin-sidebar-signal">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

export const AdminLayout = () => {
  const { admin, logout } = useAdminAuth();
  const displayName = admin?.display_name === 'System Admin' ? '系统管理员' : admin?.display_name;

  return (
    <div
      className="admin-layout"
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '248px minmax(0, 1fr)',
        background: '#f3f6f4',
      }}
    >
      <aside className="admin-sidebar" style={sidebarStyle}>
        <div className="admin-sidebar-brand">
          <img src="/brand/nianlun-logo-64.png" alt="年轮" className="admin-brand-logo" width={44} height={44} />
          <div>
            <div style={{ fontSize: '13px', color: '#a7c3bd', fontWeight: 700, marginBottom: '6px' }}>年轮</div>
            <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: 0 }}>管理后台</div>
          </div>
        </div>
        <div className="admin-sidebar-user" style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '12px', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>{displayName ?? '未登录'}</div>
          <div style={{ marginTop: '4px', fontSize: '12px', color: '#bdd3ce' }}>{adminRoleLabel(admin?.role)}</div>
        </div>
        <nav aria-label="后台导航" style={{ display: 'grid', gap: '8px', alignContent: 'start' }}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} style={navLinkStyle} aria-label={item.label}>
              <item.icon size={17} strokeWidth={2.2} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {admin?.role === 'super_admin' ? (
            <NavLink to="/audit-logs" style={navLinkStyle} aria-label="审计日志">
              <ShieldCheck size={17} strokeWidth={2.2} />
              <span>审计日志</span>
            </NavLink>
          ) : null}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-signals" aria-label="后台值班摘要">
            <SidebarSignal label="当前任务" value="先判风险" />
            <SidebarSignal label="页面语言" value="中文" />
          </div>
          <button type="button" style={{ ...secondaryButtonStyle, width: '100%' }} onClick={logout}>
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      </aside>
      <main className="admin-main" style={{ padding: '28px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#66736f', fontWeight: 700 }}>当前工作台</div>
            <div style={{ marginTop: '4px', color: '#16211f', fontSize: '16px', fontWeight: 700 }}>运营、内容与 AI 任务管理</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ borderRadius: '999px', padding: '6px 10px', background: '#ffffff', border: '1px solid #dbe3df', color: '#4b5a56', fontSize: '12px', fontWeight: 700 }}>风险优先</span>
            <span style={{ borderRadius: '999px', padding: '6px 10px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '12px', fontWeight: 700 }}>中文界面</span>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
};
