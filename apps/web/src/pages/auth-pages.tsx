import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import { Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
import { rowStyle } from './shared';

export const SplashPage = () => (
  <PageShell title="启动页" description="当前会在应用启动后自动进行登录态检查。">
    <Panel>
      <p style={helperTextStyle}>如果你能看到这个页面，说明路由已就绪。正常流程会很快跳转到登录或首页。</p>
    </Panel>
  </PageShell>
);

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, needsOnboarding } = useAuth();
  const [form, setForm] = useState({ credential: '', verify_code: '' });
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(needsOnboarding ? '/onboarding/child' : '/home', { replace: true });
    }
  }, [isAuthenticated, navigate, needsOnboarding]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const onSendCode = async () => {
    setSendingCode(true);
    setError(null);
    setInfoMessage(null);
    try {
      const result = await webApi.sendCode(form.credential);
      setCountdown(result.next_send_in);
      setInfoMessage(`验证码已发送，${result.expires_in} 秒内有效。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!acceptedAgreement) {
      setError('请先阅读并同意用户协议和隐私政策');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await login({ login_type: 'mobile', ...form });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="登录 / 注册" description="用手机号验证码进入家庭成长档案馆。">
      <Panel>
        <form onSubmit={onSubmit} style={rowStyle}>
          <Field label="手机号">
            <input
              style={inputStyle}
              value={form.credential}
              onChange={(event) => setForm((current) => ({ ...current, credential: event.target.value }))}
              placeholder="请输入手机号"
            />
          </Field>
          <Field label="验证码">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
              <input
                style={inputStyle}
                value={form.verify_code}
                onChange={(event) => setForm((current) => ({ ...current, verify_code: event.target.value }))}
                placeholder="请输入验证码"
              />
              <button type="button" style={secondaryButtonStyle} onClick={() => void onSendCode()} disabled={sendingCode || countdown > 0}>
                {sendingCode ? '发送中…' : countdown > 0 ? `${countdown}s` : '发送验证码'}
              </button>
            </div>
          </Field>
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
          {infoMessage ? <p style={{ ...helperTextStyle, color: '#0f766e' }}>{infoMessage}</p> : null}
          {error ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{error}</p> : null}
          <button type="submit" style={primaryButtonStyle} disabled={submitting || !acceptedAgreement}>
            {submitting ? '登录中…' : '进入小满人生档案馆'}
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
