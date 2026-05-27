import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Camera } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import { createPersistableMediaPreview } from '../shared/localMediaPreview';
import { Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/ui';
import { rowStyle } from './shared';

type AuthMode = 'login' | 'register';
type AuthFormState = {
  credential: string;
  password: string;
  password_confirm: string;
  invite_code: string;
};

type LoginFormDraft = {
  mode: AuthMode;
  form: AuthFormState;
  acceptedAgreement: boolean;
};

type PersistedLoginFormDraft = {
  mode: AuthMode;
  form: Pick<AuthFormState, 'credential' | 'invite_code'>;
  acceptedAgreement: boolean;
};

const emptyAuthForm: AuthFormState = {
  credential: '',
  password: '',
  password_confirm: '',
  invite_code: '',
};

const loginFormDraftStorageKey = 'nianlun.auth.loginFormDraft.v1';

const createEmptyLoginFormDraft = (): LoginFormDraft => ({
  mode: 'login',
  form: { ...emptyAuthForm },
  acceptedAgreement: false,
});

const normalizePersistedLoginFormDraft = (value: unknown): LoginFormDraft | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<PersistedLoginFormDraft>;
  if (candidate.mode !== 'login' && candidate.mode !== 'register') return null;
  if (!candidate.form || typeof candidate.form !== 'object') return null;

  const form = candidate.form as Partial<Record<keyof AuthFormState, unknown>>;
  return {
    mode: candidate.mode,
    form: {
      credential: typeof form.credential === 'string' ? form.credential : '',
      password: '',
      password_confirm: '',
      invite_code: typeof form.invite_code === 'string' ? form.invite_code : '',
    },
    acceptedAgreement: candidate.acceptedAgreement === true,
  };
};

let loginFormDraft: LoginFormDraft = createEmptyLoginFormDraft();
let hasVolatileLoginFormDraft = false;

const savePersistedLoginFormDraft = (draft: LoginFormDraft) => {
  if (typeof window === 'undefined') return;

  const persistedDraft: PersistedLoginFormDraft = {
    mode: draft.mode,
    form: {
      credential: draft.form.credential,
      invite_code: draft.form.invite_code,
    },
    acceptedAgreement: draft.acceptedAgreement,
  };

  try {
    window.sessionStorage.setItem(loginFormDraftStorageKey, JSON.stringify(persistedDraft));
  } catch {
    // sessionStorage can be unavailable in restricted WebViews; in-memory draft still works.
  }
};

const readLoginFormDraft = () => {
  if (hasVolatileLoginFormDraft) return loginFormDraft;
  if (typeof window === 'undefined') return loginFormDraft;

  try {
    const stored = window.sessionStorage.getItem(loginFormDraftStorageKey);
    if (!stored) return loginFormDraft;

    const draft = normalizePersistedLoginFormDraft(JSON.parse(stored));
    if (!draft) return loginFormDraft;

    loginFormDraft = draft;
    savePersistedLoginFormDraft(draft);
    return loginFormDraft;
  } catch {
    return loginFormDraft;
  }
};

const saveLoginFormDraft = (draft: LoginFormDraft) => {
  loginFormDraft = draft;
  hasVolatileLoginFormDraft = true;
  savePersistedLoginFormDraft(draft);
};

export const clearLoginFormDraft = () => {
  loginFormDraft = createEmptyLoginFormDraft();
  hasVolatileLoginFormDraft = false;
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(loginFormDraftStorageKey);
  } catch {
    // Ignore storage errors during cleanup.
  }
};

const validateCredential = (credential: string) => {
  const normalized = credential.trim();
  if (normalized.length < 3) return '账号至少需要 3 位';
  if (normalized.length > 64) return '账号不能超过 64 位';
  if (/\s/.test(normalized)) return '账号不能包含空格';
  return null;
};

const validatePassword = (password: string, label = '密码') => {
  if (password.length < 8 || password.length > 72) return `${label}需为 8 到 72 位`;
  return null;
};

const validateInviteCode = (inviteCode: string) => {
  const normalized = inviteCode.trim();
  if (normalized.length < 6 || normalized.length > 128) return '邀请码需为 6 到 128 位';
  return null;
};

const normalizeAuthErrorMessage = (mode: AuthMode, message: string) => {
  if (mode === 'login' && message === '状态不允许') return '账号或密码错误';
  if (mode === 'register' && message === '参数校验失败') return '请检查账号、密码、确认密码和邀请码是否完整';
  return message;
};

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
  const [initialDraft] = useState(readLoginFormDraft);
  const [mode, setMode] = useState<AuthMode>(initialDraft.mode);
  const [form, setForm] = useState<AuthFormState>({ ...initialDraft.form });
  const [acceptedAgreement, setAcceptedAgreement] = useState(initialDraft.acceptedAgreement);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit =
    acceptedAgreement &&
    form.credential.trim().length > 0 &&
    form.password.length > 0 &&
    (mode === 'login' || (form.password_confirm.length > 0 && form.invite_code.trim().length > 0));

  const persistDraft = (nextMode: AuthMode, nextForm: AuthFormState, nextAcceptedAgreement: boolean) => {
    saveLoginFormDraft({
      mode: nextMode,
      form: { ...nextForm },
      acceptedAgreement: nextAcceptedAgreement,
    });
  };

  const updateMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    persistDraft(nextMode, form, acceptedAgreement);
    setError(null);
  };

  const updateFormField = (field: keyof AuthFormState, value: string) => {
    setForm((current) => {
      const nextForm = { ...current, [field]: value };
      persistDraft(mode, nextForm, acceptedAgreement);
      return nextForm;
    });
  };

  const updateAcceptedAgreement = (checked: boolean) => {
    setAcceptedAgreement(checked);
    persistDraft(mode, form, checked);
  };

  const openLegalPage = () => {
    persistDraft(mode, form, acceptedAgreement);
    navigate('/legal');
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate(needsOnboarding ? '/onboarding/child' : '/home', { replace: true });
    }
  }, [isAuthenticated, navigate, needsOnboarding]);

  useEffect(() => {
    saveLoginFormDraft({
      mode,
      form: { ...form },
      acceptedAgreement,
    });
  }, [acceptedAgreement, form, mode]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!acceptedAgreement) {
      setError('请先阅读并同意用户协议和隐私政策');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const credentialError = validateCredential(form.credential);
      if (credentialError) {
        setError(credentialError);
        return;
      }

      const passwordError = validatePassword(form.password);
      if (passwordError) {
        setError(passwordError);
        return;
      }

      if (mode === 'login') {
        await login({
          login_type: 'password',
          credential: form.credential.trim(),
          password: form.password,
        });
        clearLoginFormDraft();
      } else {
        const passwordConfirmError = validatePassword(form.password_confirm, '确认密码');
        if (passwordConfirmError) {
          setError(passwordConfirmError);
          return;
        }

        if (form.password !== form.password_confirm) {
          setError('两次输入的密码不一致');
          return;
        }

        const inviteCodeError = validateInviteCode(form.invite_code);
        if (inviteCodeError) {
          setError(inviteCodeError);
          return;
        }

        await register({
          credential: form.credential.trim(),
          password: form.password,
          password_confirm: form.password_confirm,
          invite_code: form.invite_code.trim(),
        });
        clearLoginFormDraft();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : mode === 'login' ? '登录失败，请稍后重试' : '注册失败，请稍后重试';
      setError(normalizeAuthErrorMessage(mode, message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="登录注册" description={mode === 'login' ? '使用账号密码进入年轮。' : '使用邀请码创建账号并加入家庭。'}>
      <section style={{ display: 'grid', justifyItems: 'center', gap: '10px', paddingTop: '4px' }} aria-label="年轮品牌">
        <img
          src="/brand/nianlun-logo-192.png"
          alt="年轮"
          width={84}
          height={84}
          style={{ borderRadius: '24px', boxShadow: '0 14px 30px rgba(115, 74, 41, 0.16)' }}
        />
        <p style={{ ...helperTextStyle, color: '#57534e', fontWeight: 700 }}>一家人的成长年轮，慢慢沉淀成档案。</p>
      </section>
      <Panel>
        <form onSubmit={onSubmit} style={rowStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              style={mode === 'login' ? primaryButtonStyle : secondaryButtonStyle}
              onClick={() => updateMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              style={mode === 'register' ? primaryButtonStyle : secondaryButtonStyle}
              onClick={() => updateMode('register')}
            >
              注册
            </button>
          </div>
          <Field label="账号">
            <input
              style={inputStyle}
              value={form.credential}
              onChange={(event) => updateFormField('credential', event.target.value)}
              placeholder="请输入账号"
              autoComplete="username"
            />
          </Field>
          <Field label="密码">
            <input
              style={inputStyle}
              type="password"
              value={form.password}
              onChange={(event) => updateFormField('password', event.target.value)}
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
                  onChange={(event) => updateFormField('password_confirm', event.target.value)}
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="邀请码">
                <input
                  style={inputStyle}
                  value={form.invite_code}
                  onChange={(event) => updateFormField('invite_code', event.target.value)}
                  placeholder="请输入邀请码"
                  autoComplete="one-time-code"
                />
              </Field>
            </>
          ) : null}
          <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: '#78716c', fontSize: '13px', lineHeight: 1.6 }}>
            <input
              type="checkbox"
              checked={acceptedAgreement}
              onChange={(event) => updateAcceptedAgreement(event.target.checked)}
              style={{ marginTop: '4px' }}
            />
            <span>
              我已阅读并同意《用户协议》和《隐私政策》
            </span>
          </label>
          {error ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{error}</p> : null}
          <button type="button" style={{ ...secondaryButtonStyle, justifyContent: 'center' }} onClick={openLegalPage}>
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
  const [searchParams] = useSearchParams();
  const { completeOnboarding, needsOnboarding, refreshChildren, setActiveChild } = useAuth();
  const isAddingChild = searchParams.get('mode') === 'add';
  const [form, setForm] = useState({
    name: '',
    avatar_url: '',
    birthday: '',
    gender: 'male',
    birth_place: '',
    remark: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!needsOnboarding && !isAddingChild) {
      navigate('/home', { replace: true });
    }
  }, [isAddingChild, navigate, needsOnboarding]);

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('头像仅支持 JPG、PNG、WebP 或 HEIC 图片');
      return;
    }

    try {
      const avatarUrl = await createPersistableMediaPreview(file);
      setForm((current) => ({ ...current, avatar_url: avatarUrl }));
      setError(null);
    } catch {
      setError('头像读取失败，请重新选择图片');
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const child = await webApi.createChild(form);
      if (needsOnboarding) {
        completeOnboarding(child);
        navigate('/home', { replace: true });
        return;
      }

      await refreshChildren();
      setActiveChild(child);
      navigate('/family/child', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '建档失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title={isAddingChild ? '添加宝宝档案' : '完善宝宝信息'} backTo={isAddingChild ? '/profile' : undefined}>
      <form onSubmit={onSubmit} style={{ ...rowStyle, gap: '22px' }}>
        <div style={{ display: 'grid', justifyItems: 'center', gap: '10px', paddingTop: '6px' }}>
          <label style={{ width: '96px', height: '96px', borderRadius: '999px', border: '4px solid #ffffff', background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#cbd5e1', position: 'relative', cursor: 'pointer', overflow: 'hidden', boxShadow: '0 8px 18px rgba(15,23,42,0.07)' }}>
            {form.avatar_url ? <img src={form.avatar_url} alt="宝宝头像预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={34} strokeWidth={1.9} />}
            <span style={{ position: 'absolute', right: '0', bottom: '0', width: '30px', height: '30px', borderRadius: '999px', background: '#292524', color: '#ffffff', display: 'grid', placeItems: 'center', fontSize: '19px', fontWeight: 700, border: '2px solid #ffffff', lineHeight: 1 }}>+</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => void onAvatarChange(event)} style={{ display: 'none' }} />
          </label>
          <span style={{ color: '#a1a1aa', fontSize: '12px', fontWeight: 700 }}>设置头像</span>
        </div>

        <Panel style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', boxShadow: '0 8px 22px rgba(41,37,36,0.04)' }}>
          <div style={{ display: 'grid' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
            <Field label="宝宝小名">
              <input style={{ ...inputStyle, border: 'none', padding: 0, minHeight: '44px' }} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="请输入宝宝小名" />
            </Field>
            </div>
            <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
            <Field label="性别">
              <div role="radiogroup" aria-label="性别" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                {[
                  { value: 'male', label: '男孩' },
                  { value: 'female', label: '女孩' },
                ].map((item) => {
                  const selected = form.gender === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setForm((current) => ({ ...current, gender: item.value }))}
                      style={{
                        minHeight: '44px',
                        borderRadius: '14px',
                        border: selected ? (item.value === 'male' ? '1px solid #bfdbfe' : '1px solid #fbcfe8') : '1px solid #eef1f4',
                        background: selected ? (item.value === 'male' ? '#eff6ff' : '#fdf2f8') : '#f8fafc',
                        color: selected ? '#2563eb' : '#78716c',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label} {item.value === 'male' ? '👦' : '👧'}
                    </button>
                  );
                })}
              </div>
            </Field>
            </div>
            <div style={{ padding: '16px', position: 'relative' }}>
            <Field label="出生日期">
              <span style={{ position: 'relative', minHeight: '44px', paddingRight: '28px', display: 'flex', alignItems: 'center', color: form.birthday ? '#292524' : '#a1a1aa', fontSize: '14px', fontWeight: 600 }}>
                <input
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  type="date"
                  aria-label="出生日期"
                  value={form.birthday}
                  onChange={(event) => setForm((current) => ({ ...current, birthday: event.target.value }))}
                />
                <span style={{ pointerEvents: 'none' }}>{form.birthday ? form.birthday.replace(/-/g, '/') : '年/月/日'}</span>
              </span>
            </Field>
              <Calendar size={18} color="#cbd5e1" style={{ position: 'absolute', right: '16px', bottom: '20px', pointerEvents: 'none' }} />
            </div>
          </div>
        </Panel>

        {error ? <p style={{ ...helperTextStyle, color: '#dc2626' }}>{error}</p> : null}
        <button type="submit" style={{ ...primaryButtonStyle, width: '100%', minHeight: '48px', boxShadow: '0 8px 20px rgba(41,37,36,0.16)' }} disabled={submitting}>
          {submitting ? '提交中…' : '完成创建'}
        </button>
      </form>
    </PageShell>
  );
};
