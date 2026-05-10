import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAdminAuth } from '../shared/useAdminAuth';
import { PageShell, Panel } from '../shared/ui';
import { inputStyle, primaryButtonStyle } from '../shared/uiStyles';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAdminAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="管理员登录" description="请使用当前环境中已配置的管理员账号登录。">
      <Panel>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: '12px' }}>
          <input style={inputStyle} value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="用户名" />
          <input style={inputStyle} type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="密码" />
          {error ? <p style={{ margin: 0, color: '#dc2626' }}>{error}</p> : null}
          <button type="submit" style={primaryButtonStyle} disabled={loading}>
            {loading ? '登录中…' : '进入管理后台'}
          </button>
        </form>
      </Panel>
    </PageShell>
  );
};
