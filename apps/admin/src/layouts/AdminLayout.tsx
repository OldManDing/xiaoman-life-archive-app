import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Archive, BarChart3, BellRing, Bot, Database, FileText, House, KeyRound, LogOut, Menu, MessageSquareText, ServerCog, Settings2, ShieldCheck, SlidersHorizontal, UsersRound, X, type LucideIcon } from 'lucide-react';

import { adminApi } from '../shared/request';
import { getTokenExpiresAt } from '../shared/authMemory';
import { formatDateTime } from '../shared/format';
import { inputStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/uiStyles';
import { useAdminAuth } from '../shared/useAdminAuth';
import { adminRoleLabel } from '../shared/labels';
import { AdminModal } from '../shared/modal';


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

const navLinkClassName = ({ isActive }: { isActive: boolean }) => `admin-nav-link${isActive ? ' is-active' : ''}`;

const MOBILE_QUERY = '(max-width: 760px)';

const useIsMobileViewport = () => {
  const [isMobile, setIsMobile] = useState(() => (typeof window.matchMedia === 'function' ? window.matchMedia(MOBILE_QUERY).matches : false));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};

const ChangePasswordModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ current: '', next: '', confirm: '' });
      setError(null);
      setMessage(null);
    }
  }, [open]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.next.length < 8 || form.next.length > 12) {
      setError('新密码长度必须为 8 到 12 位');
      return;
    }
    if (!/[A-Za-z]/.test(form.next) || !/\d/.test(form.next)) {
      setError('新密码必须同时包含字母和数字');
      return;
    }
    if (form.next !== form.confirm) {
      setError('两次输入的新密码不一致');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await adminApi.changePassword({ current_password: form.current, new_password: form.next, new_password_confirm: form.confirm });
      setMessage('登录密码已修改，下次登录请使用新密码。');
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改密码失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal open={open} title="修改登录密码" eyebrow="账号安全" onClose={onClose}>
      <form onSubmit={onSubmit}>
        <label className="admin-modal-field">
          当前密码
          <input type="password" style={inputStyle} value={form.current} onChange={(event) => setForm((current) => ({ ...current, current: event.target.value }))} autoComplete="current-password" autoFocus />
        </label>
        <label className="admin-modal-field">
          新密码
          <input type="password" style={inputStyle} value={form.next} onChange={(event) => setForm((current) => ({ ...current, next: event.target.value }))} placeholder="8 到 12 位，需包含字母和数字" autoComplete="new-password" />
        </label>
        <label className="admin-modal-field">
          确认新密码
          <input type="password" style={inputStyle} value={form.confirm} onChange={(event) => setForm((current) => ({ ...current, confirm: event.target.value }))} placeholder="再次输入新密码" autoComplete="new-password" />
        </label>
        {error ? <p className="admin-modal-error">{error}</p> : null}
        {message ? <p style={{ margin: '0 0 10px', color: '#2d6d38', fontSize: '13px', fontWeight: 700 }}>{message}</p> : null}
        <div className="admin-modal-actions">
          <button type="button" style={secondaryButtonStyle} onClick={onClose}>
            关闭
          </button>
          <button type="submit" style={primaryButtonStyle} disabled={saving}>
            {saving ? '提交中…' : '确认修改'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
};

export const AdminLayout = () => {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const isMobileViewport = useIsMobileViewport();
  const [moreOpen, setMoreOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const closeMore = () => setMoreOpen(false);

  const displayName = admin?.display_name === 'System Admin' ? '系统管理员' : admin?.display_name;
  const primarySections = navSections.filter((section) => !section.secondary);
  const secondarySections = navSections.filter((section) => section.secondary);
  const isSecondaryRoute = secondarySections.some((section) => section.items.some((item) => location.pathname === item.to)) || location.pathname === '/audit-logs';
  // 二级路由下桌面端默认展开"更多管理"，移动端保持收起。
  useEffect(() => {
    if (isSecondaryRoute && !isMobileViewport) setMoreOpen(true);
  }, [isSecondaryRoute, isMobileViewport]);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [moreOpen]);

  const expiresAt = getTokenExpiresAt();

  return (
      <div className="admin-layout">
      <aside className={`admin-sidebar${moreOpen ? ' admin-sidebar-more-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <img src="/brand/nianlun-logo-64.png" alt="年轮" className="admin-brand-logo" width={44} height={44} />
          <div className="admin-sidebar-brand-text">
            <div className="admin-sidebar-brand-app">年轮</div>
            <div className="admin-sidebar-brand-title">管理后台</div>
          </div>
        </div>
          <div className="admin-sidebar-user">
          <div className="admin-sidebar-user-name">{displayName ?? '未登录'}</div>
          <div className="admin-sidebar-user-role">{adminRoleLabel(admin?.role)}</div>
          {expiresAt ? (
            <div className="admin-sidebar-expiry">登录有效期至 {formatDateTime(new Date(expiresAt).toISOString())}</div>
          ) : null}
          <button type="button" className="admin-sidebar-password-btn" onClick={() => setPasswordModalOpen(true)}>
            <KeyRound size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
            修改密码
          </button>
        </div>
        <nav className="admin-nav-sections" aria-label="后台导航">
          {primarySections.map((section) => (
            <section key={section.label} className={`admin-nav-section${section.secondary ? ' admin-nav-section-secondary' : ''}`}>
              <div className="admin-nav-section-label">{section.label}</div>
              <div className="admin-nav-section-items">
                {section.items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={navLinkClassName} aria-label={item.label} onClick={closeMore}>
                    <item.icon size={17} strokeWidth={2.2} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
          <div className="admin-nav-more">
            <button
              type="button"
              className={`admin-nav-more-trigger${isSecondaryRoute ? ' admin-nav-more-trigger-active' : ''}`}
              aria-label="更多管理"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((current) => !current)}
            >
              <Menu className="admin-nav-more-icon" size={17} strokeWidth={2.2} />
              <span className="admin-nav-more-label-desktop">更多管理</span>
              <span className="admin-nav-more-label-mobile">更多</span>
            </button>
            {moreOpen ? <>
              <button type="button" className="admin-nav-more-backdrop" aria-label="关闭面板" onClick={closeMore} />
              <div className="admin-nav-more-content">
                <div className="admin-nav-more-heading">
                  <strong>更多管理</strong>
                  <button type="button" aria-label="关闭面板" title="关闭面板" onClick={closeMore}><X size={17} /></button>
                </div>
              {secondarySections.map((section) => (
                <section key={section.label} className="admin-nav-section admin-nav-section-secondary">
                  <div className="admin-nav-section-label">{section.label}</div>
                  <div className="admin-nav-section-items">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={navLinkClassName}
                        aria-label={item.label}
                        onClick={() => {
                          if (isMobileViewport) setMoreOpen(false);
                        }}
                      >
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
                    <NavLink
                      to="/audit-logs"
                      className={navLinkClassName}
                      aria-label="审计日志"
                      onClick={() => {
                        if (isMobileViewport) setMoreOpen(false);
                      }}
                    >
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
          <button type="button" className="admin-sidebar-logout" aria-label="退出登录" title="退出登录" onClick={logout}>
            <LogOut size={16} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  );
};
