import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent, type FocusEvent, type FormEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Camera, ChevronLeft, ChevronRight, ShieldCheck, Smartphone } from 'lucide-react';

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

const inlineLegalLinkStyle: CSSProperties = {
  display: 'inline',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--nl-accent)',
  font: 'inherit',
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  cursor: 'pointer',
};

const disabledSubmitButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'rgba(var(--nl-surface-strong-rgb),0.44)',
  color: 'var(--nl-muted)',
  boxShadow: 'none',
  cursor: 'not-allowed',
  opacity: 1,
};

export const SplashPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => navigate('/home', { replace: true }), 900);
    return () => window.clearTimeout(timer);
  }, [navigate]);
  return <BrandBootMotion />;
};

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
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);

  const continueToLogin = () => {
    markWelcomeIntroSeen();
    navigate('/auth/login', { replace: true });
  };

  const startNow = () => {
    if (!acceptedAgreement) return;
    markWelcomeIntroSeen();
    navigate('/auth/login', { replace: true });
  };

  return (
    <main className="wl-page">
      <button type="button" className="wl-skip" onClick={continueToLogin}>跳过</button>

      <div className="wl-hero">
        <img src="/photos/welcome-hero.jpg" alt="孩子在水边张开手臂" />
        <div className="wl-hero-scrim" aria-hidden="true" />
      </div>

      <div className="wl-body">
        <h1 className="wl-title">把每一个第一次，<br />都留下来</h1>
        <p className="wl-subtitle">照片、语音、一句话，家人都能一起记录</p>

        <div className="wl-features">
          <div className="wl-feature">
            <span className="wl-feature-icon"><Camera size={20} strokeWidth={1.8} /></span>
            <span>记录成长</span>
          </div>
          <div className="wl-feature">
            <span className="wl-feature-icon"><CalendarDays size={20} strokeWidth={1.8} /></span>
            <span>家人共写</span>
          </div>
          <div className="wl-feature">
            <span className="wl-feature-icon"><ChevronRight size={20} strokeWidth={1.8} /></span>
            <span>一键成书</span>
          </div>
        </div>

        <label className="lg-agreement wl-agreement">
          <input
            type="checkbox"
            checked={acceptedAgreement}
            onChange={(event) => setAcceptedAgreement(event.target.checked)}
            aria-label="同意用户协议、隐私政策和儿童个人信息保护规则"
          />
          <span>
            已阅读并同意 <Link to="/legal?doc=terms" className="lg-link">《用户协议》</Link> 和{' '}
            <Link to="/legal?doc=privacy" className="lg-link">《隐私政策》</Link>
          </span>
        </label>

        <button type="button" className="wl-start" onClick={startNow} disabled={!acceptedAgreement}>
          开始记录
        </button>
        <button type="button" className="wl-login" onClick={continueToLogin}>已有账号？登录</button>
      </div>
    </main>
  );
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, needsOnboarding } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdownEnd, setCountdownEnd] = useState<number>(() => {
    try {
      const raw = window.sessionStorage.getItem('nianlun.sms-countdown-end');
      const parsed = raw ? Number(raw) : 0;
      return Number.isFinite(parsed) && parsed > Date.now() ? parsed : 0;
    } catch {
      return 0;
    }
  });
  const [clock, setClock] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const inviteCode = (searchParams.get('invite') ?? '').trim();

  const normalizedPhone = phone.trim();
  const canSubmit = acceptedAgreement && /^1\d{10}$/.test(normalizedPhone) && code.trim().length >= 4;
  const countdown = countdownEnd ? Math.max(0, Math.ceil((countdownEnd - clock) / 1000)) : 0;

  useEffect(() => {
    if (isAuthenticated) {
      navigate(needsOnboarding ? '/onboarding/child' : '/home', { replace: true });
    }
  }, [isAuthenticated, navigate, needsOnboarding]);

  useEffect(() => {
    if (!countdownEnd) return undefined;
    if (countdownEnd <= Date.now()) {
      setCountdownEnd(0);
      try {
        window.sessionStorage.removeItem('nianlun.sms-countdown-end');
      } catch {
        /* ignore */
      }
      return undefined;
    }
    const timer = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [countdownEnd]);

  const sendCode = async () => {
    if (countdown > 0 || sending) return;
    if (!/^1\d{10}$/.test(normalizedPhone)) {
      setError('请输入 11 位手机号');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await webApi.sendCode(normalizedPhone);
      setClock(Date.now());
      const deadline = Date.now() + 60_000;
      setCountdownEnd(deadline);
      try {
        window.sessionStorage.setItem('nianlun.sms-countdown-end', String(deadline));
      } catch {
        /* storage may be unavailable */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  const submit = async () => {
    if (submitting) return;
    if (!acceptedAgreement) {
      setError('请先阅读并同意用户协议和隐私政策');
      return;
    }
    if (!/^1\d{10}$/.test(normalizedPhone)) {
      setError('请输入正确的 11 位手机号');
      return;
    }
    if (code.trim().length < 4) {
      setError('请输入短信验证码');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login({ login_type: 'sms', credential: normalizedPhone, code: code.trim(), invite_code: inviteCode || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lg-page">
      <div className="lg-hero" aria-hidden="true">
        <img src="/photos/login-hero.jpg" alt="" />
        <div className="lg-hero-scrim" />
        <div className="lg-brand">
          <span className="lg-brand-mark" aria-hidden="true" />
          <h1 className="lg-brand-name">年轮</h1>
          <span className="lg-brand-rule" aria-hidden="true" />
          <p className="lg-brand-slogan">把每一天，都留给以后</p>
        </div>
      </div>

      <div className="lg-body">
        <div className="lg-field-card">
          <label className="lg-row">
            <Smartphone size={22} strokeWidth={1.7} color="var(--nl-ink)" />
            <input
              aria-label="手机号"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/[^\d]/g, '').slice(0, 11))}
              placeholder="手机号"
            />
          </label>
          <div className="lg-row">
            <ShieldCheck size={22} strokeWidth={1.7} color="var(--nl-ink)" />
            <input
              aria-label="验证码"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="验证码"
            />
            <button type="button" className="lg-code-button" onClick={() => void sendCode()} disabled={countdown > 0 || sending}>
              {countdown > 0 ? `${countdown}s` : sending ? '发送中' : '获取验证码'}
            </button>
          </div>
        </div>

        {error ? <p className="lg-error" role="alert">{error}</p> : null}

        <button type="button" className="lg-submit" onClick={() => void submit()} disabled={!canSubmit || submitting}>
          {submitting ? '登录中…' : '登录 / 注册'}
        </button>

        <label className="lg-agreement">
          <input
            type="checkbox"
            checked={acceptedAgreement}
            onChange={(event) => setAcceptedAgreement(event.target.checked)}
          />
          <span>
            已阅读并同意 <Link to="/legal?doc=terms" className="lg-link">《用户协议》</Link> 和{' '}
            <Link to="/legal?doc=privacy" className="lg-link">《隐私政策》</Link>
          </span>
        </label>

        <p className="lg-footnote">未注册的手机号将自动创建账号</p>
      </div>
    </div>
  );
};


export const OnboardingChildPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeOnboarding, needsOnboarding, refreshChildren, setActiveChild, skipOnboarding } = useAuth();
  const isAddingChild = searchParams.get('mode') === 'add';
  const [form, setForm] = useState({
    name: '',
    avatar_url: '',
    birthday: '',
    gender: 'female',
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
    if (submitting) return;
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
    <div className="onb-page">
      <div className="onb-top">
        {isAddingChild ? (
          <button type="button" className="onb-back" aria-label="返回" onClick={() => navigate('/profile')}>
            <ChevronLeft size={22} strokeWidth={1.9} />
          </button>
        ) : <span />}
        <span className="onb-dots" aria-hidden="true">
          <span className="onb-dot is-active" />
          <span className="onb-dot" />
          <span className="onb-dot" />
        </span>
        {isAddingChild ? (
          <button type="button" className="onb-skip" onClick={() => navigate('/profile')}>跳过</button>
        ) : (
          <button
            type="button"
            className="onb-skip"
            onClick={() => {
              skipOnboarding();
              navigate('/home', { replace: true });
            }}
          >
            跳过
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} style={{ display: 'contents' }}>
        <div className="onb-avatar-wrap">
          <label className="onb-avatar">
            {childAvatarPreviewSrc && !avatarPreviewFailed ? (
              <img src={childAvatarPreviewSrc} alt="宝宝头像预览" decoding="async" onError={() => setAvatarPreviewFailed(true)} />
            ) : (
              <Camera size={54} strokeWidth={1.4} />
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={onAvatarChange} style={{ display: 'none' }} />
          </label>
        </div>

        <h1 className="onb-title">先认识一下{form.name.trim() || '宝宝'}</h1>
        <p className="onb-sub">这些信息只会给家人看到</p>

        <div className="onb-card">
          <div className="onb-row">
            <span className="onb-label">宝贝的名字</span>
            <input
              className="onb-input"
              aria-label="宝贝的名字"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="小名"
              autoComplete="off"
            />
          </div>

          <div className="onb-row">
            <CalendarDays size={22} strokeWidth={1.7} color="var(--nl-ink)" />
            <label className="onb-date">
              <span className="onb-date-value">
                {form.birthday
                  ? (() => {
                    const [year, month, day] = form.birthday.split('-');
                    return year && month && day ? `${Number(year)}年${Number(month)}月${Number(day)}日` : form.birthday;
                  })()
                  : '年/月/日'}
              </span>
              <span className="onb-date-hint">出生时间可选</span>
              <input
                type="date"
                className="onb-date-input"
                aria-label="出生日期"
                value={form.birthday}
                onChange={(event) => setForm((current) => ({ ...current, birthday: event.target.value }))}
              />
            </label>
            <ChevronRight size={20} strokeWidth={1.8} color="rgba(58,42,28,0.45)" />
          </div>

          <div className="onb-row">
            <span className="onb-label">性别</span>
            <div role="radiogroup" aria-label="性别" className="onb-gender">
              {[
                { value: 'female', label: '女孩' },
                { value: 'male', label: '男孩' },
              ].map((item) => {
                const selected = form.gender === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setForm((current) => ({ ...current, gender: item.value }))}
                    className={`onb-gender-opt${selected ? ' is-selected' : ''}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error ? <p className="onb-error">{error}</p> : null}

        <button type="submit" className="onb-submit" disabled={submitting}>
          {submitting ? '提交中…' : '继续'}
        </button>
        <p className="onb-foot">随时可以在「家庭」里修改</p>
      </form>
    </div>
  );
};
