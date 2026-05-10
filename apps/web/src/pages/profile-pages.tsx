import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookHeart, ChevronRight, FileBox, HelpCircle, Lock, LogOut, ShieldCheck, UserRound, Users } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import { loadLocalSettings } from '../shared/localSettings';
import { Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, rowStyle } from './shared';

const profileCardStyle = {
  background: '#ffffff',
  border: '1px solid #f2efe9',
  borderRadius: '20px',
  boxShadow: '0 2px 10px rgba(15,23,42,0.025)',
  overflow: 'hidden',
} as const;

const profileSectionStyle = {
  paddingLeft: '20px',
  paddingRight: '20px',
} as const;

const ProfileListItem = ({
  title,
  description,
  icon: Icon,
  badge,
  disabled,
  onClick,
}: {
  title: string;
  description?: string;
  icon: typeof BookHeart;
  badge?: string;
  disabled?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    disabled={disabled && !onClick}
    onClick={onClick}
    style={{
      width: '100%',
      border: 'none',
      borderBottom: '1px solid #f7f4ef',
      background: 'transparent',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '14px',
      textAlign: 'left',
      cursor: disabled && !onClick ? 'default' : 'pointer',
      opacity: disabled ? 0.82 : 1,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '999px', background: '#fafaf9', border: '1px solid #eee9df', display: 'grid', placeItems: 'center', color: '#78716c', flexShrink: 0 }}>
        <Icon size={17} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#44403c' }}>{title}</span>
          {badge ? <span style={{ fontSize: '11px', color: '#a8a29e', fontWeight: 700 }}>{badge}</span> : null}
        </div>
        {description ? <p style={{ ...helperTextStyle, marginTop: '3px', lineHeight: 1.5 }}>{description}</p> : null}
      </div>
    </div>
    {!disabled || onClick ? <ChevronRight size={18} color="#d6d3d1" strokeWidth={2} /> : null}
  </button>
);

const DisabledHubItem = ({ title, description, badge = '规划中' }: { title: string; description: string; badge?: string }) => (
  <div
    aria-disabled="true"
    style={{
      display: 'grid',
      gap: '6px',
      padding: '16px',
      borderRadius: '16px',
      border: '1px dashed #d6d3d1',
      color: '#78716c',
      background: '#fafaf9',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
      <strong>{title}</strong>
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e' }}>{badge}</span>
    </div>
    <span style={helperTextStyle}>{description}</span>
  </div>
);

export const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100dvh', background: '#faf8f5', color: '#292524', overflowX: 'hidden' }}>
      <section style={{ background: '#ffffff', padding: 'calc(56px + env(safe-area-inset-top)) 20px 28px', borderBottom: '1px solid #f2efe9', boxShadow: '0 2px 12px rgba(15,23,42,0.01)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '24px',
                background: '#f5f5f4',
                border: '1px solid #e7e5e4',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                color: '#44403c',
                boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
                flexShrink: 0,
              }}
            >
              {user?.nickname?.slice(0, 1) ?? '我'}
            </div>
            <div style={{ display: 'grid', gap: '6px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '20px', color: '#292524' }}>{user?.nickname ?? '未登录用户'}</strong>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#b09040', padding: '2px 8px', borderRadius: '8px', border: '1px solid #e8e2d2', background: 'linear-gradient(90deg, #f2efe9 0%, #faf8f5 100%)', letterSpacing: '0.08em' }}>
                  {user?.membership_type === 'free' ? '基础会员' : '高级会员'}
                </span>
              </div>
              <span style={{ fontSize: '13px', color: '#78716c', fontWeight: 500 }}>ID: {user?.user_no ?? '—'}</span>
            </div>
          </div>
          <button
            type="button"
            style={{
              borderRadius: '999px',
              border: '1px solid #e7e5e4',
              background: '#fafaf9',
              color: '#57534e',
              fontSize: '12px',
              fontWeight: 600,
              padding: '8px 14px',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/profile/account')}
          >
            编辑主页
          </button>
        </div>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '22px' }}>
        <div style={{ ...profileCardStyle, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '999px', background: '#fafaf9', border: '1px solid #e7e5e4', display: 'grid', placeItems: 'center', color: '#78716c' }}>
              <FileBox size={16} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#57534e' }}>草稿箱</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a8a29e' }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>本期不提供独立列表</span>
          </div>
        </div>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '24px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: '0.08em', textTransform: 'uppercase' }}>我的孩子</h2>
        <div style={{ ...profileCardStyle, padding: '0' }}>
          <ProfileListItem icon={UserRound} title="孩子资料" description="查看和维护孩子的基础资料。" onClick={() => navigate('/family/child')} />
          <button
            type="button"
            style={{
              margin: '16px',
              width: 'calc(100% - 32px)',
              padding: '14px 16px',
              borderRadius: '18px',
              border: '1px dashed #d6d3d1',
              background: '#fafaf9',
              color: '#78716c',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/onboarding/child')}
          >
            + 添加宝宝
          </button>
        </div>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '28px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: '0.08em', textTransform: 'uppercase' }}>管理中心</h2>
        <div style={profileCardStyle}>
          <ProfileListItem icon={BookHeart} title="月报与纪念册" description="月报生成不作为本期已完成入口。" badge="规划中" disabled />
          <ProfileListItem icon={UserRound} title="个人资料" description="查看当前账号和基础资料信息。" onClick={() => navigate('/profile/account')} />
          <ProfileListItem icon={Users} title="家庭管理" description="查看家庭成员、邀请和协作状态。" onClick={() => navigate('/family')} />
          <ProfileListItem icon={HelpCircle} title="帮助与反馈" description="反馈通道待接入客服与运营配置。" badge="待接入" disabled />
        </div>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '28px', paddingBottom: '22px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: '0.08em', textTransform: 'uppercase' }}>设置区</h2>
        <div style={profileCardStyle}>
          <ProfileListItem icon={ShieldCheck} title="隐私设置" description="隐私偏好和跨端设置同步尚未进入本期验收。" badge="未开放" disabled />
          <ProfileListItem icon={Lock} title="关于 / 协议" description="正式协议、隐私政策和儿童信息保护说明待合规确认后接入。" badge="待接入" disabled />
        </div>
        <button
          type="button"
          style={{
            width: '100%',
            marginTop: '20px',
            padding: '14px 16px',
            borderRadius: '20px',
            border: '1px solid #e7e5e4',
            background: '#ffffff',
            color: '#dc2626',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onClick={async () => {
            await logout();
            navigate('/auth/login', { replace: true });
          }}
        >
          <LogOut size={16} strokeWidth={2.4} />
          退出登录
        </button>
      </section>
    </div>
  );
};

export const AccountPage = () => {
  const { user, setUserProfile } = useAuth();
  const settings = loadLocalSettings();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const displayMobile = settings.hideMobileMask ? '已隐藏' : user?.mobile ?? '当前未提供';

  useEffect(() => {
    setNickname(user?.nickname ?? '');
  }, [user?.nickname]);

  const onSave = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setMessage('昵称不能为空');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const nextProfile = await webApi.updateMe({ nickname: trimmed });
      setUserProfile(nextProfile);
      setMessage('昵称保存成功');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '昵称保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title="个人资料" description="展示当前账号信息与会员状态，并支持最小昵称编辑。">
      <Panel>
        <div style={rowStyle}>
          <p style={helperTextStyle}>用户编号：{user?.user_no ?? '—'}</p>
          <Field label="昵称">
            <input style={inputStyle} value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={64} />
          </Field>
          <p style={helperTextStyle}>会员类型：{user?.membership_type ?? '—'}</p>
          <p style={helperTextStyle}>手机号（掩码后）：{displayMobile}</p>
          {message ? <p style={{ ...helperTextStyle, color: message.includes('成功') ? '#0f766e' : '#dc2626' }}>{message}</p> : null}
          <div style={buttonRowStyle}>
            <button type="button" style={primaryButtonStyle} onClick={() => void onSave()} disabled={saving}>
              {saving ? '保存中…' : '保存昵称'}
            </button>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
};

export const SettingsPage = () => {
  return (
    <PageShell title="设置" description="设置能力待正式接入，当前版本不作为可操作验收入口。">
      <Panel>
        <div style={rowStyle}>
          <strong>暂未开放</strong>
          <p style={helperTextStyle}>通知、隐私偏好、缓存和跨端同步设置需要真实设备能力与合规策略配套，本期先不提供可保存的本地假设置。</p>
        </div>
      </Panel>
    </PageShell>
  );
};

export const LegalPage = () => (
  <PageShell title="关于 / 协议" description="正式协议文本待合规确认后接入。">
    <Panel>
      <div style={rowStyle}>
        <strong>当前版本说明</strong>
        <p style={helperTextStyle}>当前版本用于 MVP 联调与验收，已覆盖登录、建档、记录、时间轴、家庭成员和媒体上传主流程。</p>
        <strong>待接入内容</strong>
        <p style={helperTextStyle}>正式生产前需要补齐可发布的用户协议、隐私政策和儿童信息保护说明，并在登录协议勾选处链接到最终文本。</p>
      </div>
    </Panel>
  </PageShell>
);

export const ErrorPage = () => (
  <PageShell title="错误页" description="系统错误与重试入口。">
    <Panel>
      <EmptyState message="当前阶段遇到异常时会统一回到登录页或停留在当前页。" />
    </Panel>
  </PageShell>
);
