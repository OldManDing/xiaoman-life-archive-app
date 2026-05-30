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
    <section className="admin-login-shell">
      <div className="admin-login-hero">
        <img src="/brand/nianlun-logo-192.png" alt="年轮" className="admin-login-logo" width={92} height={92} />
        <span className="admin-login-kicker">年轮运营中枢</span>
        <h1>把家庭档案、内容审核和 AI 任务收进同一个工作台。</h1>
        <p>面向运营团队的管理后台，覆盖用户、孩子档案、成长记录、媒体素材、AI 任务与审计日志。</p>
        <div className="admin-login-metrics" aria-label="后台能力">
          <span>全中文操作</span>
          <span>审计留痕</span>
          <span>移动端可用</span>
        </div>
      </div>

      <form className="admin-login-card" onSubmit={onSubmit}>
        <div>
          <img src="/brand/nianlun-logo-64.png" alt="" className="admin-login-card-logo" width={46} height={46} aria-hidden="true" />
          <span className="admin-login-card-label">管理入口</span>
          <h2>管理员登录</h2>
          <p>请使用当前环境中已启用的管理员账号进入后台。</p>
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
        <p className="admin-login-footnote">手机端适合查询、审核和应急处理；批量运营仍建议使用桌面端。</p>
      </form>
    </section>
  );
};
