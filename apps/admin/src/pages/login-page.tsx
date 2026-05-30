import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAdminAuth } from '../shared/useAdminAuth';
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
    <section className="admin-login-shell" aria-label="管理员登录">
      <form className="admin-login-card" onSubmit={onSubmit}>
        <div className="admin-login-card-head">
          <img src="/brand/nianlun-logo-64.png" alt="" className="admin-login-card-logo" width={46} height={46} aria-hidden="true" />
          <h2>管理员登录</h2>
        </div>
        <label className="admin-login-field">
          <span>用户名</span>
          <input
            style={inputStyle}
            value={form.username}
            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            placeholder="请输入用户名"
            autoComplete="username"
          />
        </label>
        <label className="admin-login-field">
          <span>密码</span>
          <input
            style={inputStyle}
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="请输入密码"
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="admin-login-error">{error}</p> : null}
        <button type="submit" style={primaryButtonStyle} disabled={loading}>
          {loading ? '登录中...' : '进入管理后台'}
        </button>
      </form>
    </section>
  );
};
