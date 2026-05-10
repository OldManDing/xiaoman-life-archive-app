import { Outlet, Link } from 'react-router-dom';

import { useAdminAuth } from '../shared/useAdminAuth';
import { secondaryButtonStyle } from '../shared/uiStyles';

export const AdminLayout = () => {
  const { admin, logout } = useAdminAuth();

  return (
    <div
      className="admin-layout"
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        background: '#f6f8fb',
      }}
    >
      <aside
        style={{
          borderRight: '1px solid #e5e7eb',
          background: '#111827',
          color: '#f9fafb',
          padding: '20px 16px',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>管理后台</div>
        <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '20px' }}>
          <div>{admin?.display_name ?? '未登录'}</div>
          <div>{admin?.role ?? 'viewer'}</div>
        </div>
        <nav style={{ display: 'grid', gap: '12px' }}>
          <Link to="/users" style={{ color: 'inherit', textDecoration: 'none' }}>用户</Link>
          <Link to="/children" style={{ color: 'inherit', textDecoration: 'none' }}>孩子</Link>
          <Link to="/records" style={{ color: 'inherit', textDecoration: 'none' }}>记录</Link>
          <Link to="/media" style={{ color: 'inherit', textDecoration: 'none' }}>媒体</Link>
          <Link to="/ai-jobs" style={{ color: 'inherit', textDecoration: 'none' }}>AI 任务</Link>
          {admin?.role === 'super_admin' ? <Link to="/audit-logs" style={{ color: 'inherit', textDecoration: 'none' }}>审计日志</Link> : null}
        </nav>
        <button type="button" style={{ ...secondaryButtonStyle, marginTop: '20px', width: '100%' }} onClick={logout}>
          退出登录
        </button>
      </aside>
      <main style={{ padding: '24px' }}>
        <Outlet />
      </main>
    </div>
  );
};
