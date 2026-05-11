import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import { Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
import { rowStyle } from './shared';

export const SplashPage = () => (
  <PageShell title="正在进入年轮" description="系统正在检查登录状态，并会自动前往合适的页面。">
    <Panel>
      <p style={helperTextStyle}>请稍候，年轮会根据你的账号状态进入登录、建档或首页。</p>
    </Panel>
  </PageShell>
);

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, needsOnboarding } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ credential: '', password: '', password_confirm: '', invite_code: '' });
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit =
    acceptedAgreement &&
    form.credential.trim().length > 0 &&
    form.password.length > 0 &&
    (mode === 'login' || (form.password_confirm.length > 0 && form.invite_code.trim().length > 0));

  useEffect(() => {
    if (isAuthenticated) {
      navigate(needsOnboarding ? '/onboarding/child' : '/home', { replace: true });
    }
  }, [isAuthenticated, navigate, needsOnboarding]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!acceptedAgreement) {
      setError('请先阅读并同意用户协议和隐私政策');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login({
          login_type: 'password',
          credential: form.credential.trim(),
          password: form.password,
        });
      } else {
        if (form.password !== form.password_confirm) {
          setError('两次输入的密码不一致');
          return;
        }

        await register({
          credential: form.credential.trim(),
          password: form.password,
          password_confirm: form.password_confirm,
          invite_code: form.invite_code.trim(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'login' ? '登录失败，请稍后重试' : '注册失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="登录注册" description={mode === 'login' ? '使用账号密码进入年轮。' : '使用邀请码创建账号并加入家庭。'}>
      <Panel>
        <form onSubmit={onSubmit} style={rowStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              style={mode === 'login' ? primaryButtonStyle : secondaryButtonStyle}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
            >
              登录
            </button>
            <button
              type="button"
              style={mode === 'register' ? primaryButtonStyle : secondaryButtonStyle}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
            >
              注册
            </button>
          </div>
          <Field label="账号">
            <input
              style={inputStyle}
              value={form.credential}
              onChange={(event) => setForm((current) => ({ ...current, credential: event.target.value }))}
              placeholder="请输入账号"
              autoComplete="username"
            />
          </Field>
          <Field label="密码">
            <input
              style={inputStyle}
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="请输入密码"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          {mode === 'register' ? (
            <>
              <Field label="确认密码">
                <input
                  style={inputStyle}
                  type="password"
                  value={form.password_confirm}
                  onChange={(event) => setForm((current) => ({ ...current, password_confirm: event.target.value }))}
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="邀请码">
                <input
                  style={inputStyle}
                  value={form.invite_code}
                  onChange={(event) => setForm((current) => ({ ...current, invite_code: event.target.value }))}
                  placeholder="请输入家庭邀请码"
                  autoComplete="one-time-code"
                />
              </Field>
            </>
          ) : null}
          <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: '#78716c', fontSize: '13px', lineHeight: 1.6 }}>
            <input
              type="checkbox"
              checked={acceptedAgreement}
              onChange={(event) => setAcceptedAgreement(event.target.checked)}
              style={{ marginTop: '4px' }}
            />
            <span>
              我已阅读并同意《用户协议》和《隐私政策》
            </span>
          </label>
          {error ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{error}</p> : null}
          <button type="button" style={{ ...secondaryButtonStyle, justifyContent: 'center' }} onClick={() => navigate('/legal')}>
            查看完整协议与隐私政策
          </button>
          <button type="submit" style={primaryButtonStyle} disabled={submitting || !canSubmit}>
            {submitting ? (mode === 'login' ? '登录中…' : '注册中…') : mode === 'login' ? '进入年轮' : '注册并进入'}
          </button>
        </form>
      </Panel>
    </PageShell>
  );
};

export const OnboardingChildPage = () => {
  const navigate = useNavigate();
  const { completeOnboarding, needsOnboarding } = useAuth();
  const [form, setForm] = useState({
    name: '',
    birthday: '',
    gender: 'female',
    birth_place: '',
    remark: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!needsOnboarding) {
      navigate('/home', { replace: true });
    }
  }, [navigate, needsOnboarding]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const child = await webApi.createChild(form);
      completeOnboarding(child);
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '建档失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="完善宝宝信息" description="首次登录后请先完成孩子档案创建。">
      <Panel>
        <form onSubmit={onSubmit} style={rowStyle}>
          <Field label="孩子姓名">
            <input style={inputStyle} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <Field label="生日">
            <input style={inputStyle} type="date" value={form.birthday} onChange={(event) => setForm((current) => ({ ...current, birthday: event.target.value }))} />
          </Field>
          <Field label="性别">
            <select style={inputStyle} value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}>
              <option value="female">女</option>
              <option value="male">男</option>
              <option value="unknown">未知</option>
            </select>
          </Field>
          <Field label="出生地">
            <input style={inputStyle} value={form.birth_place} onChange={(event) => setForm((current) => ({ ...current, birth_place: event.target.value }))} />
          </Field>
          <Field label="备注">
            <textarea style={textareaStyle} value={form.remark} onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))} />
          </Field>
          {error ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{error}</p> : null}
          <button type="submit" style={primaryButtonStyle} disabled={submitting}>
            {submitting ? '提交中…' : '完成建档'}
          </button>
        </form>
      </Panel>
    </PageShell>
  );
};
