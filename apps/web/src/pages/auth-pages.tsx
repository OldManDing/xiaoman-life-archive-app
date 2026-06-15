import { useEffect, useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Camera, CheckCircle2 } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import { createPersistableAvatarPreview } from '../shared/localMediaPreview';
import { isSupportedImageFile, withResolvedFileMimeType } from '../shared/mediaFiles';
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
  if (mode === 'register' && message === '参数校验失败') return '请检查账号、密码和确认密码是否完整';
  return message;
};

const authPageContentStyle: CSSProperties = {
  width: '100%',
  maxWidth: '430px',
  margin: '0 auto',
  display: 'grid',
  alignContent: 'start',
  gap: '14px',
  padding: 'calc(42px + env(safe-area-inset-top)) 0 24px',
};

const authHeroStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: '8px',
  textAlign: 'center',
};

const authLogoStyle: CSSProperties = {
  width: '72px',
  height: '72px',
  borderRadius: '20px',
  boxShadow: '0 14px 30px rgba(var(--nl-shadow-rgb),0.28), 0 0 0 5px rgba(var(--nl-primary-rgb),0.1)',
};

const authTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--nl-ink)',
  fontSize: '26px',
  fontWeight: 950,
  lineHeight: 1.18,
};

const authSubtitleStyle: CSSProperties = {
  margin: '7px auto 0',
  maxWidth: '300px',
  color: 'var(--nl-muted-strong)',
  fontSize: '13px',
  lineHeight: 1.58,
  fontWeight: 750,
};

const authTrustGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px',
};

const authTrustItemStyle: CSSProperties = {
  minHeight: '58px',
  borderRadius: '18px',
  border: '1px solid var(--nl-glass-border)',
  background: 'var(--nl-glass-soft)',
  color: 'var(--nl-muted-strong)',
  display: 'grid',
  placeItems: 'center',
  gap: '4px',
  padding: '8px 4px',
  textAlign: 'center',
  fontSize: '11px',
  lineHeight: 1.25,
  fontWeight: 850,
  WebkitBackdropFilter: 'blur(14px) saturate(1.12)',
  backdropFilter: 'blur(14px) saturate(1.12)',
};

const authPanelStyle: CSSProperties = {
  padding: '16px',
  borderRadius: '20px',
};

const authFormStyle: CSSProperties = {
  ...rowStyle,
  gap: '11px',
};

const authAgreementStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  alignItems: 'flex-start',
  minHeight: '44px',
  position: 'relative',
  color: 'var(--nl-muted-strong)',
  fontSize: '13px',
  lineHeight: 1.55,
  cursor: 'pointer',
};

const authCheckboxStyle = (checked: boolean): CSSProperties => ({
  appearance: 'none',
  WebkitAppearance: 'none',
  width: '20px',
  height: '20px',
  margin: '2px 0 0',
  flex: '0 0 auto',
  borderRadius: '7px',
  border: checked ? '1px solid rgba(245, 205, 140, 0.68)' : '1px solid var(--nl-border)',
  backgroundColor: checked ? 'var(--nl-primary)' : 'rgba(var(--nl-surface-rgb), 0.92)',
  backgroundImage: checked
    ? 'url("data:image/svg+xml,%3Csvg width=\'14\' height=\'14\' viewBox=\'0 0 14 14\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M3 7.1L5.6 9.7L11 4.3\' stroke=\'white\' stroke-width=\'2.2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")'
    : 'none',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '14px 14px',
  boxShadow: checked ? '0 8px 18px rgba(var(--nl-primary-rgb), 0.2)' : 'inset 0 0 0 1px rgba(255, 255, 255, 0.04)',
  cursor: 'pointer',
});

const authAgreementTextStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
};

const onboardingStepStyle = (active: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr)',
  gap: '10px',
  alignItems: 'start',
  color: active ? 'var(--nl-ink)' : 'var(--nl-muted-strong)',
  fontSize: '13px',
  lineHeight: 1.45,
  fontWeight: 750,
});

const onboardingStepDotStyle = (active: boolean): CSSProperties => ({
  width: '24px',
  height: '24px',
  borderRadius: '999px',
  display: 'grid',
  placeItems: 'center',
  background: active ? 'rgba(var(--nl-success-rgb),0.16)' : 'rgba(var(--nl-surface-rgb),0.74)',
  color: active ? 'var(--nl-success)' : 'var(--nl-muted)',
  border: '1px solid var(--nl-border)',
  fontSize: '11px',
  fontWeight: 900,
});

const disabledSubmitButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'rgba(var(--nl-surface-rgb),0.62)',
  color: 'var(--nl-muted)',
  boxShadow: 'none',
  cursor: 'not-allowed',
  opacity: 1,
};

export const SplashPage = () => (
  <PageShell title="正在进入年轮" description="系统正在检查登录状态，并会自动前往合适的页面。">
    <Panel style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 14, padding: '28px 20px' }}>
      <img src="/brand/nianlun-logo-192.png" alt="年轮" width={64} height={64} style={{ ...authLogoStyle, width: 64, height: 64, borderRadius: 18 }} />
      <div style={{ display: 'grid', gap: 6 }}>
        <strong style={{ color: 'var(--nl-ink)', fontSize: 18, fontWeight: 950 }}>正在同步家庭档案</strong>
        <p style={{ ...helperTextStyle, margin: 0 }}>正在检查登录状态、孩子档案和最近记录。</p>
      </div>
      <span aria-hidden="true" style={{ width: '100%', height: 8, borderRadius: '999px', background: 'linear-gradient(90deg, rgba(var(--nl-surface-rgb),0.52), rgba(var(--nl-primary-rgb),0.32), rgba(var(--nl-surface-rgb),0.52))' }} />
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
    (mode === 'login' || form.password_confirm.length > 0);

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

        const inviteCode = form.invite_code.trim();
        if (inviteCode) {
          const inviteCodeError = validateInviteCode(inviteCode);
          if (inviteCodeError) {
            setError(inviteCodeError);
            return;
          }
        }

        await register({
          credential: form.credential.trim(),
          password: form.password,
          password_confirm: form.password_confirm,
          ...(inviteCode ? { invite_code: inviteCode } : {}),
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
    <PageShell title="登录注册" hideHeader>
      <div style={authPageContentStyle}>
        <section style={authHeroStyle} aria-label="年轮品牌">
          <img src="/brand/nianlun-logo-192.png" alt="年轮" width={72} height={72} style={authLogoStyle} />
          <div>
            <h1 style={authTitleStyle}>登录注册</h1>
            <p style={authSubtitleStyle}>为孩子长期保存照片、文字、语音和家人的共同记忆。</p>
          </div>
        </section>
        <section aria-label="年轮价值" style={authTrustGridStyle}>
          {['成长时间线', '家庭协作', '长期可导出'].map((item) => (
            <span key={item} style={authTrustItemStyle}>
              <CheckCircle2 size={15} color="var(--nl-accent)" />
              {item}
            </span>
          ))}
        </section>
        <Panel style={authPanelStyle}>
          <form onSubmit={onSubmit} style={authFormStyle}>
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
              <Field label="邀请码（选填）">
                <input
                  style={inputStyle}
                  value={form.invite_code}
                  onChange={(event) => updateFormField('invite_code', event.target.value)}
                  placeholder="已有家庭邀请码可填写，没有也能注册"
                  autoComplete="one-time-code"
                />
                <p style={{ ...helperTextStyle, margin: '6px 0 0' }}>没有邀请码会先创建自己的家庭档案，之后可邀请家人加入。</p>
              </Field>
            </>
          ) : null}
          <label style={authAgreementStyle}>
            <input
              type="checkbox"
              checked={acceptedAgreement}
              onChange={(event) => updateAcceptedAgreement(event.target.checked)}
              style={authCheckboxStyle(acceptedAgreement)}
            />
            <span style={authAgreementTextStyle}>
              我已阅读并同意《用户协议》和《隐私政策》
            </span>
          </label>
        {error ? <p style={{ ...helperTextStyle, color: 'var(--nl-danger)' }}>{error}</p> : null}
          <button type="button" style={{ ...secondaryButtonStyle, justifyContent: 'center' }} onClick={openLegalPage}>
            查看完整协议与隐私政策
          </button>
          <button type="submit" style={submitting || !canSubmit ? disabledSubmitButtonStyle : primaryButtonStyle} disabled={submitting || !canSubmit}>
            {submitting ? (mode === 'login' ? '登录中…' : '注册中…') : mode === 'login' ? '进入年轮' : '注册并进入'}
          </button>
          </form>
        </Panel>
      </div>
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
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarPreviewFailed, setAvatarPreviewFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const childAvatarPreviewSrc = avatarPreviewUrl ?? form.avatar_url;

  useEffect(() => {
    if (!needsOnboarding && !isAddingChild) {
      navigate('/home', { replace: true });
    }
  }, [isAddingChild, navigate, needsOnboarding]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isSupportedImageFile(file)) {
      setError('头像仅支持 JPG、PNG、WebP 或 HEIC 图片');
      return;
    }

    const uploadFile = withResolvedFileMimeType(file);
    const previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(uploadFile) : null;
    setAvatarPreviewUrl(previewUrl);
    setAvatarPreviewFailed(false);
    try {
      const avatarUrl = await createPersistableAvatarPreview(uploadFile);
      if (avatarUrl) setForm((current) => ({ ...current, avatar_url: avatarUrl }));
      setError(null);
    } catch {
      setAvatarPreviewUrl(null);
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
        <Panel style={{ padding: '16px 16px 14px', borderRadius: '20px' }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div>
              <strong style={{ display: 'block', color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 900 }}>开始使用的三步</strong>
              <p style={{ ...helperTextStyle, marginTop: '4px' }}>先建档，再留下第一条记录，最后邀请家人一起维护同一份成长档案。</p>
            </div>
            <div style={{ display: 'grid', gap: '9px' }}>
              {[
                { title: '完善宝宝信息', done: true },
                { title: '记录第一条成长瞬间', done: false },
                { title: '邀请家人加入协作', done: false },
              ].map((item, index) => (
                <div key={item.title} style={onboardingStepStyle(item.done)}>
                  <span style={onboardingStepDotStyle(item.done)}>{item.done ? <CheckCircle2 size={14} strokeWidth={2.5} /> : index + 1}</span>
                  <span>
                    <strong style={{ display: 'block', fontSize: '13px', fontWeight: 850, color: 'inherit' }}>{item.title}</strong>
                    <span style={{ display: 'block', marginTop: '2px', color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 650 }}>
                      {index === 0 ? '填写头像、生日和基础资料，后面内容会更完整。' : index === 1 ? '从相册或拍照开始，先留下真实的一刻。' : '家人权限可控，协作边界会保持清楚。'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <div style={{ display: 'grid', justifyItems: 'center', gap: '10px', paddingTop: '6px' }}>
          <label style={{ width: '96px', height: '96px', borderRadius: '999px', border: '1px solid var(--nl-border)', background: 'var(--nl-surface-soft)', display: 'grid', placeItems: 'center', color: 'var(--nl-muted)', position: 'relative', cursor: 'pointer', overflow: 'hidden', boxShadow: '0 16px 34px rgba(var(--nl-shadow-rgb),0.32), 0 0 0 5px rgba(var(--nl-primary-rgb),0.14)' }}>
            {childAvatarPreviewSrc && !avatarPreviewFailed ? <img src={childAvatarPreviewSrc} alt="宝宝头像预览" decoding="async" onError={() => setAvatarPreviewFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={34} strokeWidth={1.9} />}
            <span style={{ position: 'absolute', right: '0', bottom: '0', width: '30px', height: '30px', borderRadius: '999px', background: 'var(--nl-primary)', color: '#ffffff', display: 'grid', placeItems: 'center', fontSize: '19px', fontWeight: 700, border: '1px solid rgba(245,205,140,0.52)', lineHeight: 1 }}>+</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => void onAvatarChange(event)} style={{ display: 'none' }} />
          </label>
          <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 700 }}>设置头像</span>
        </div>

        <Panel style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', boxShadow: 'var(--nl-shadow-sm)' }}>
          <div style={{ display: 'grid' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--nl-border)' }}>
            <Field label="宝宝小名">
              <input style={{ ...inputStyle, border: 'none', padding: 0, minHeight: '44px' }} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="请输入宝宝小名" />
            </Field>
            </div>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--nl-border)' }}>
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
                        border: selected ? '1px solid rgba(245,205,140,0.58)' : '1px solid var(--nl-border)',
                        background: selected ? 'rgba(var(--nl-primary-rgb),0.24)' : 'rgba(var(--nl-surface-rgb),0.72)',
                        color: selected ? 'var(--nl-ink)' : 'var(--nl-muted-strong)',
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
              <span style={{ position: 'relative', minHeight: '44px', paddingRight: '28px', display: 'flex', alignItems: 'center', color: form.birthday ? 'var(--nl-ink)' : 'var(--nl-muted)', fontSize: '14px', fontWeight: 600 }}>
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
              <Calendar size={18} color="var(--nl-muted)" style={{ position: 'absolute', right: '16px', bottom: '20px', pointerEvents: 'none' }} />
            </div>
          </div>
        </Panel>

        {error ? <p style={{ ...helperTextStyle, color: 'var(--nl-danger)' }}>{error}</p> : null}
        <button type="submit" style={{ ...primaryButtonStyle, width: '100%', minHeight: '48px' }} disabled={submitting}>
          {submitting ? '提交中…' : '完成创建'}
        </button>
      </form>
    </PageShell>
  );
};
