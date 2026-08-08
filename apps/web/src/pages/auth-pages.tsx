import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent, type FocusEvent, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, ChevronLeft } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { BrandBootMotion } from '../components/BrandBootMotion';
import { webApi } from '../shared/api/webApi';
import { uploadChildAvatar } from '../shared/avatarUpload';
import { isSupportedImageFile, withResolvedFileMimeType } from '../shared/mediaFiles';
import { AppDateInput, Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/ui';
import { markWelcomeIntroSeen } from '../shared/welcome';
import { referenceAssets } from './reference-ui';
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

const validatePassword = (password: string, label = '密码', maxLength = 72) => {
  if (password.length < 8 || password.length > maxLength) return `${label}需为 8 到 ${maxLength} 位`;
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
  gap: '18px',
  padding: 'calc(34px + env(safe-area-inset-top)) 2px 28px',
};

const authHeroStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: '10px',
  textAlign: 'center',
};

const authLogoStyle: CSSProperties = {
  width: '68px',
  height: '68px',
  borderRadius: '22%',
  boxSizing: 'border-box',
  objectFit: 'contain',
  boxShadow: '0 20px 42px rgba(var(--nl-shadow-rgb),0.18)',
};

const authTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--nl-ink)',
  fontFamily: 'var(--nl-font-display)',
  fontSize: '32px',
  fontWeight: 800,
  lineHeight: 1.1,
};

const authBackButtonStyle: CSSProperties = {
  minHeight: '42px',
  border: 'none',
  background: 'transparent',
  color: 'var(--nl-muted-strong)',
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '14px',
  fontWeight: 560,
  cursor: 'pointer',
  justifySelf: 'start',
};

const authPanelStyle: CSSProperties = {
  padding: '4px 2px 0',
  borderRadius: 0,
  border: 'none',
  background: 'transparent',
  boxShadow: 'none',
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
  border: checked ? '1px solid var(--nl-primary-border)' : '1px solid var(--nl-border-strong)',
  backgroundColor: checked ? 'var(--nl-primary)' : 'rgba(var(--nl-surface-rgb), 0.92)',
  backgroundImage: checked
    ? 'url("data:image/svg+xml,%3Csvg width=\'14\' height=\'14\' viewBox=\'0 0 14 14\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M3 7.1L5.6 9.7L11 4.3\' stroke=\'white\' stroke-width=\'2.2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")'
    : 'none',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '14px 14px',
  boxShadow: checked
    ? '0 8px 18px rgba(var(--nl-primary-rgb),0.18), inset 0 1px 0 var(--nl-inset-highlight-faint)'
    : 'inset 0 1px 0 var(--nl-inset-highlight)',
  cursor: 'pointer',
});

const authAgreementTextStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
};

const disabledSubmitButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'rgba(var(--nl-surface-strong-rgb),0.44)',
  color: 'var(--nl-muted)',
  boxShadow: 'none',
  cursor: 'not-allowed',
  opacity: 1,
};

export const SplashPage = () => <BrandBootMotion />;

const welcomePosters = [
  {
    src: '/posters/welcome-growth-timeline.png',
    alt: '年轮成长时间线介绍海报',
    label: '成长时间线',
  },
  {
    src: '/posters/welcome-media-archive.png',
    alt: '年轮影像归档介绍海报',
    label: '影像归档',
  },
  {
    src: '/posters/welcome-family-notice.png',
    alt: '年轮家庭协作介绍海报',
    label: '家庭协作',
  },
];

export const WelcomePage = () => {
  const navigate = useNavigate();

  const continueToLogin = () => {
    markWelcomeIntroSeen();
    navigate('/auth/login', { replace: true });
  };

  return (
    <main style={{ minHeight: '100dvh', boxSizing: 'border-box', display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', gap: 16, padding: 'calc(16px + env(safe-area-inset-top)) 0 max(24px, env(safe-area-inset-bottom))', overflow: 'hidden' }}>
      <section style={{ display: 'grid', alignContent: 'center', gap: 14, minHeight: 0 }}>
        <div
          aria-label="年轮介绍海报"
          style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: 'minmax(284px, 82vw)',
            gap: 14,
            overflowX: 'auto',
            overscrollBehaviorX: 'contain',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            padding: '0 20px 2px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {welcomePosters.map((poster, index) => (
            <article
              key={poster.src}
              aria-label={poster.label}
              style={{
                position: 'relative',
                scrollSnapAlign: 'center',
                aspectRatio: '9 / 16',
                minHeight: 0,
                maxHeight: 'min(68dvh, 640px)',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--nl-border-soft)',
                background: 'var(--nl-surface-soft)',
                boxShadow: index === 0 ? '0 30px 70px rgba(var(--nl-shadow-rgb),0.18)' : '0 18px 42px rgba(var(--nl-shadow-rgb),0.12)',
              }}
            >
              <img
                src={poster.src}
                alt={poster.alt}
                decoding={index === 0 ? 'sync' : 'async'}
                loading={index === 0 ? 'eager' : 'lazy'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </article>
          ))}
        </div>

        <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          {welcomePosters.map((poster, index) => (
            <span
              key={poster.src}
              style={{
                width: index === 0 ? 18 : 6,
                height: 6,
                borderRadius: 99,
                background: index === 0 ? 'rgba(var(--nl-primary-rgb),0.58)' : 'rgba(var(--nl-muted-rgb),0.28)',
              }}
            />
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 10, padding: '0 20px' }}>
        <button type="button" onClick={continueToLogin} style={primaryButtonStyle}>开始使用</button>
        <button type="button" onClick={continueToLogin} style={{ ...secondaryButtonStyle, justifyContent: 'center' }}>跳过</button>
      </section>
    </main>
  );
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, needsOnboarding } = useAuth();
  const [initialDraft] = useState(readLoginFormDraft);
  const [mode, setMode] = useState<AuthMode>(initialDraft.mode);
  const [form, setForm] = useState<AuthFormState>({ ...initialDraft.form });
  const [acceptedAgreement, setAcceptedAgreement] = useState(initialDraft.acceptedAgreement);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const credentialInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const passwordConfirmInputRef = useRef<HTMLInputElement>(null);
  const inviteCodeInputRef = useRef<HTMLInputElement>(null);
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

  const goBackFromLogin = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/splash', { replace: true });
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

  const scrollInputIntoView = (input: HTMLInputElement | null) => {
    window.setTimeout(() => {
      input?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 120);
  };

  const onInputFocus = (event: FocusEvent<HTMLInputElement>) => {
    scrollInputIntoView(event.currentTarget);
  };

  const focusNextInputOnEnter = (event: KeyboardEvent<HTMLInputElement>, nextInputRef: RefObject<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    nextInputRef.current?.focus();
    scrollInputIntoView(nextInputRef.current);
  };

  const submitAuth = async () => {
    if (submitting) return;
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

      const passwordError = validatePassword(form.password, '密码', mode === 'login' ? 72 : 12);
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
        const passwordConfirmError = validatePassword(form.password_confirm, '确认密码', 12);
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

  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void submitAuth();
  };

  const onPasswordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (mode === 'login') {
      submitOnEnter(event);
      return;
    }
    focusNextInputOnEnter(event, passwordConfirmInputRef);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitAuth();
  };

  return (
    <PageShell title="登录注册" hideHeader>
      <div style={authPageContentStyle}>
        <button type="button" aria-label="返回" onClick={goBackFromLogin} style={authBackButtonStyle}>
          <ChevronLeft size={18} strokeWidth={2.4} />
          返回
        </button>
        <section style={authHeroStyle} aria-label="年轮品牌">
          <img src="/brand/nianlun-logo-192.png" alt="年轮" width={72} height={72} style={authLogoStyle} />
          <div>
            <h1 style={authTitleStyle}>登录注册</h1>
          </div>
        </section>
        <Panel style={authPanelStyle}>
          <form onSubmit={onSubmit} style={authFormStyle} noValidate>
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
              ref={credentialInputRef}
              style={inputStyle}
              value={form.credential}
              onChange={(event) => updateFormField('credential', event.target.value)}
              onFocus={onInputFocus}
              onKeyDown={(event) => focusNextInputOnEnter(event, passwordInputRef)}
              placeholder="账号"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
            />
          </Field>
          <Field label="密码">
            <input
              ref={passwordInputRef}
              style={inputStyle}
              type="password"
              value={form.password}
              onChange={(event) => updateFormField('password', event.target.value)}
              onFocus={onInputFocus}
              onKeyDown={onPasswordKeyDown}
              placeholder="密码"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint={mode === 'login' ? 'done' : 'next'}
              maxLength={mode === 'login' ? 72 : 12}
            />
          </Field>
          {mode === 'register' ? (
            <>
              <Field label="确认密码">
                <input
                  ref={passwordConfirmInputRef}
                  style={inputStyle}
                  type="password"
                  value={form.password_confirm}
                  onChange={(event) => updateFormField('password_confirm', event.target.value)}
                  onFocus={onInputFocus}
                  onKeyDown={(event) => focusNextInputOnEnter(event, inviteCodeInputRef)}
                  placeholder="确认密码"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  maxLength={12}
                />
              </Field>
              <Field label="邀请码">
                <input
                  ref={inviteCodeInputRef}
                  style={inputStyle}
                  value={form.invite_code}
                  onChange={(event) => updateFormField('invite_code', event.target.value)}
                  onFocus={onInputFocus}
                  onKeyDown={submitOnEnter}
                  placeholder="邀请码"
                  autoComplete="one-time-code"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                />
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
            协议与隐私
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
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

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
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
    setAvatarFile(uploadFile);
    setAvatarPreviewFailed(false);
    setError(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const child = await webApi.createChild(form);
      let completedChild = child;
      if (avatarFile) {
        try {
          const avatarUrl = await uploadChildAvatar(child.child_no, avatarFile, avatarPreviewUrl);
          completedChild = await webApi.updateChild(child.child_no, { avatar_url: avatarUrl });
        } catch (avatarError) {
          console.warn('Child created without avatar because avatar upload failed', avatarError);
        }
      }
      if (needsOnboarding) {
        completeOnboarding(completedChild);
        navigate('/home', { replace: true });
        return;
      }

      await refreshChildren();
      setActiveChild(completedChild);
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
        <div style={{ display: 'grid', justifyItems: 'center', gap: '9px', paddingTop: '2px' }}>
          <label style={{ width: '96px', height: '96px', borderRadius: '8px', border: '1px solid var(--nl-border-muted)', background: 'rgba(var(--nl-surface-strong-rgb),0.3)', display: 'grid', placeItems: 'center', color: 'var(--nl-muted)', position: 'relative', cursor: 'pointer', overflow: 'hidden', boxShadow: '0 14px 30px rgba(var(--nl-shadow-rgb),0.18)' }}>
            {childAvatarPreviewSrc && !avatarPreviewFailed ? <img src={childAvatarPreviewSrc} alt="宝宝头像预览" decoding="async" onError={() => setAvatarPreviewFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={34} strokeWidth={1.9} />}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={onAvatarChange} style={{ display: 'none' }} />
          </label>
        </div>

        <Panel style={{ padding: 0, borderRadius: '8px', overflow: 'hidden', background: 'rgba(var(--nl-surface-rgb),0.12)', border: '1px solid var(--nl-border-muted)', boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)' }}>
          <div style={{ display: 'grid' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--nl-border-muted)' }}>
            <Field label="宝宝小名">
              <input style={{ ...inputStyle, border: 'none', padding: 0, minHeight: '44px' }} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="小名" />
            </Field>
            </div>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--nl-border-muted)' }}>
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
                        borderRadius: '8px',
                        border: selected ? '1px solid var(--nl-primary-line)' : '1px solid var(--nl-border-muted)',
                        background: selected ? 'rgba(var(--nl-primary-rgb),0.12)' : 'rgba(var(--nl-surface-rgb),0.14)',
                        color: selected ? 'var(--nl-ink)' : 'var(--nl-muted-strong)',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            </div>
            <div style={{ padding: '16px' }}>
            <Field label="出生日期">
              <AppDateInput
                aria-label="出生日期"
                value={form.birthday}
                displayValue={form.birthday ? form.birthday.replace(/-/g, '/') : undefined}
                placeholder="年/月/日"
                onChange={(event) => setForm((current) => ({ ...current, birthday: event.target.value }))}
              />
            </Field>
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
