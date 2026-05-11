import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookHeart, ChevronRight, FileBox, HelpCircle, Lock, LogOut, RefreshCw, ShieldCheck, UserRound, Users } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { RecordSummary } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { membershipTypeLabel } from '../shared/labels';
import { clearLocalSettings, loadLocalSettings, saveLocalSettings, type LocalSettings } from '../shared/localSettings';
import { Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
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

const settingsRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '14px',
  padding: '14px 0',
  borderBottom: '1px solid #f2efe9',
} as const;

const toggleButtonStyle = (enabled: boolean) =>
  ({
    minWidth: '54px',
    border: 'none',
    borderRadius: '999px',
    padding: '4px',
    background: enabled ? '#292524' : '#d6d3d1',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: enabled ? 'flex-end' : 'flex-start',
  }) as const;

const toggleKnobStyle = {
  width: '22px',
  height: '22px',
  borderRadius: '999px',
  background: '#ffffff',
  boxShadow: '0 1px 4px rgba(15,23,42,0.18)',
} as const;

const toMonthKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

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
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#b09040', padding: '2px 8px', borderRadius: '8px', border: '1px solid #e8e2d2', background: 'linear-gradient(90deg, #f2efe9 0%, #faf8f5 100%)', letterSpacing: 0 }}>
                  {membershipTypeLabel(user?.membership_type)}
                </span>
              </div>
              <span style={{ fontSize: '13px', color: '#78716c', fontWeight: 500 }}>用户编号：{user?.user_no ?? '—'}</span>
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
            <span style={{ fontSize: '12px', fontWeight: 600 }}>草稿会保存在成长记录中</span>
          </div>
        </div>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '24px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: 0 }}>我的孩子</h2>
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
        <h2 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: 0 }}>管理中心</h2>
        <div style={profileCardStyle}>
          <ProfileListItem icon={BookHeart} title="月报与纪念册" description="查看本月记录概览、里程碑和影像回顾。" onClick={() => navigate('/profile/reports')} />
          <ProfileListItem icon={UserRound} title="个人资料" description="查看当前账号和基础资料信息。" onClick={() => navigate('/profile/account')} />
          <ProfileListItem icon={Users} title="家庭管理" description="查看家庭成员、邀请和协作状态。" onClick={() => navigate('/family')} />
          <ProfileListItem icon={HelpCircle} title="帮助与反馈" description="查看常见问题，并提交本机反馈记录。" onClick={() => navigate('/profile/help')} />
        </div>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '28px', paddingBottom: '22px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: 0 }}>设置区</h2>
        <div style={profileCardStyle}>
          <ProfileListItem icon={ShieldCheck} title="隐私设置" description="管理通知、手机号展示和首页刷新偏好。" onClick={() => navigate('/profile/settings')} />
          <ProfileListItem icon={Lock} title="关于与协议" description="查看版本说明、用户协议和隐私保护摘要。" onClick={() => navigate('/profile/legal')} />
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
    <PageShell title="个人资料" description="查看当前账号信息与会员状态，并支持修改昵称。">
      <Panel>
        <div style={rowStyle}>
          <p style={helperTextStyle}>用户编号：{user?.user_no ?? '—'}</p>
          <Field label="昵称">
            <input style={inputStyle} value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={64} />
          </Field>
          <p style={helperTextStyle}>会员类型：{membershipTypeLabel(user?.membership_type)}</p>
          <p style={helperTextStyle}>脱敏手机号：{displayMobile}</p>
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
  const [settings, setSettings] = useState<LocalSettings>(() => loadLocalSettings());
  const [message, setMessage] = useState<string | null>(null);

  const updateSetting = (key: keyof LocalSettings) => {
    setSettings((current) => {
      const next = { ...current, [key]: !current[key] };
      saveLocalSettings(next);
      setMessage('设置已保存');
      return next;
    });
  };

  const resetSettings = () => {
    clearLocalSettings();
    const next = loadLocalSettings();
    setSettings(next);
    setMessage('本机设置已恢复默认');
  };

  return (
    <PageShell title="隐私设置" description="管理当前设备上的通知、资料展示和首页刷新偏好。">
      <Panel>
        <div>
          {[
            { key: 'hideMobileMask' as const, title: '隐藏手机号', description: '个人资料页只显示手机号隐藏状态，减少旁人看到敏感信息的机会。', icon: ShieldCheck },
            { key: 'autoRefreshHome' as const, title: '首页进入时刷新', description: '每次进入首页时自动同步孩子资料和最近记录，也可以在首页手动点击刷新。', icon: RefreshCw },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} style={settingsRowStyle}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '999px', background: '#fafaf9', border: '1px solid #eee9df', display: 'grid', placeItems: 'center', color: '#78716c', flexShrink: 0 }}>
                    <Icon size={17} strokeWidth={2} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: '#44403c', fontSize: '15px' }}>{item.title}</strong>
                    <p style={{ ...helperTextStyle, marginTop: '4px', lineHeight: 1.5 }}>{item.description}</p>
                  </div>
                </div>
                <button type="button" aria-label={item.title} aria-pressed={settings[item.key]} style={toggleButtonStyle(settings[item.key])} onClick={() => updateSetting(item.key)}>
                  <span style={toggleKnobStyle} />
                </button>
              </div>
            );
          })}
          {message ? <p style={{ ...helperTextStyle, color: '#0f766e', marginTop: '14px' }}>{message}</p> : null}
          <div style={{ ...buttonRowStyle, marginTop: '18px' }}>
            <button type="button" style={secondaryButtonStyle} onClick={resetSettings}>
              恢复默认设置
            </button>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
};

export const ReportsPage = () => {
  const navigate = useNavigate();
  const { activeChild } = useAuth();
  const { data: records, loading, error } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 100 });
      return result.list;
    },
    [activeChild?.child_no],
  );
  const monthKey = toMonthKey(new Date());
  const monthlyRecords = (records ?? []).filter((item) => toMonthKey(item.event_time) === monthKey);
  const milestoneCount = monthlyRecords.filter((item) => item.is_milestone).length;
  const imageCount = monthlyRecords.filter((item) => item.cover_url).length;
  const latest = monthlyRecords[0];

  return (
    <PageShell title="月报与纪念册" description={`${activeChild?.name ?? '孩子'}的本月成长记录回顾。`}>
      <Panel>
        {loading ? <EmptyState message="正在整理本月记录…" /> : null}
        {error ? <EmptyState message={`月报加载失败：${error}`} /> : null}
        {!loading && !error ? (
          <div style={rowStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
              {[
                { label: '本月记录', value: monthlyRecords.length },
                { label: '里程碑', value: milestoneCount },
                { label: '影像记录', value: imageCount },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: '16px', border: '1px solid #f2efe9', background: '#fafaf9', padding: '14px', textAlign: 'center' }}>
                  <strong style={{ display: 'block', color: '#292524', fontSize: '22px' }}>{item.value}</strong>
                  <span style={{ color: '#78716c', fontSize: '12px', fontWeight: 600 }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ borderRadius: '18px', background: '#faf8f5', border: '1px solid #f2efe9', padding: '16px' }}>
              <strong style={{ color: '#44403c' }}>本月回顾</strong>
              <p style={{ ...helperTextStyle, marginTop: '8px', lineHeight: 1.7 }}>
                {monthlyRecords.length
                  ? `这个月已经记录 ${monthlyRecords.length} 个成长瞬间，其中 ${milestoneCount} 个里程碑，${imageCount} 条包含影像。`
                  : '这个月还没有记录，可以从首页添加照片或文字，生成第一条月度回顾素材。'}
              </p>
              {latest ? <p style={{ ...helperTextStyle, marginTop: '8px' }}>最近一条：{latest.title ?? '未命名记录'}</p> : null}
            </div>
            {monthlyRecords.length ? (
              <div style={rowStyle}>
                {monthlyRecords.slice(0, 6).map((item) => (
                  <button key={item.record_no} type="button" style={{ ...secondaryButtonStyle, borderRadius: '16px', textAlign: 'left' }} onClick={() => navigate(`/record/${item.record_no}`)}>
                    <span style={{ display: 'block', fontWeight: 700 }}>{item.title ?? '未命名记录'}</span>
                    <span style={{ display: 'block', marginTop: '4px', color: '#78716c', fontSize: '12px' }}>{new Date(item.event_time).toLocaleString('zh-CN', { hour12: false })}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>
    </PageShell>
  );
};

export const HelpFeedbackPage = () => {
  const [category, setCategory] = useState('使用问题');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const submitFeedback = () => {
    const normalized = content.trim();
    if (normalized.length < 6) {
      setMessage('请至少输入 6 个字，方便定位问题。');
      return;
    }

    const item = { category, content: normalized, contact: contact.trim(), created_at: new Date().toISOString() };
    let list: typeof item[] = [];
    try {
      const raw = window.localStorage.getItem('xiaoman-web-feedback-list');
      list = raw ? (JSON.parse(raw) as typeof item[]) : [];
    } catch {
      list = [];
    }
    window.localStorage.setItem('xiaoman-web-feedback-list', JSON.stringify([item, ...list].slice(0, 20)));
    setContent('');
    setContact('');
    setMessage('反馈已保存在本机，感谢补充信息。');
  };

  return (
    <PageShell title="帮助与反馈" description="查看常见问题，并提交当前设备上的反馈记录。">
      <Panel>
        <div style={rowStyle}>
          <strong>常见问题</strong>
          <p style={helperTextStyle}>账号密码用于登录；注册账号时需要填写家庭邀请码；照片上传支持 JPG、PNG、WebP。</p>
          <p style={helperTextStyle}>如果记录没有出现在首页，请先检查是否已选择孩子档案，再返回首页刷新。</p>
        </div>
      </Panel>
      <Panel>
        <div style={rowStyle}>
          <strong>提交反馈</strong>
          <Field label="问题类型">
            <select style={inputStyle} value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="使用问题">使用问题</option>
              <option value="页面显示">页面显示</option>
              <option value="数据异常">数据异常</option>
              <option value="功能建议">功能建议</option>
            </select>
          </Field>
          <Field label="反馈内容">
            <textarea style={textareaStyle} value={content} onChange={(event) => setContent(event.target.value)} placeholder="请描述遇到的问题、页面位置和操作步骤" />
          </Field>
          <Field label="联系方式">
            <input style={inputStyle} value={contact} onChange={(event) => setContact(event.target.value)} placeholder="手机号或微信，可选" />
          </Field>
          {message ? <p style={{ ...helperTextStyle, color: message.includes('已保存') ? '#0f766e' : '#dc2626' }}>{message}</p> : null}
          <div style={buttonRowStyle}>
            <button type="button" style={primaryButtonStyle} onClick={submitFeedback}>
              保存反馈
            </button>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
};

const legalSections = [
  {
    title: '用户协议',
    items: [
      '本服务用于记录孩子成长过程中的文字、图片、家庭协作和成长时间轴。用户应使用真实、合法的信息创建家庭档案。',
      '用户应妥善保管账号、密码、邀请码和设备，不得将账号借给他人使用，也不得上传侵权、违法、骚扰、广告或损害未成年人权益的内容。',
      '家庭创建者可以邀请成员共同维护孩子档案；家庭成员不得擅自公开、转发或商业化使用孩子资料和影像内容。',
      '平台可依据法律要求、用户投诉或运营审核结果限制、下架或删除违规内容，并会尽合理努力保障服务稳定。',
    ],
  },
  {
    title: '隐私政策',
    items: [
      '为提供成长档案服务，平台会处理账号、昵称、孩子档案资料、家庭成员关系、成长记录、媒体文件、登录时间和必要审计日志。',
      '上述信息用于登录校验、身份识别、档案展示、家庭协作、媒体上传与预览、内容审核、异常排查、安全风控和合规留存。',
      '除用户授权、法律要求、保护未成年人权益或完成短信、对象存储、AI 处理等必要服务外，平台不会向无关第三方出售或出租个人信息。',
      '用户可以查看和修改个人资料、孩子档案、家庭成员关系和成长记录；正式上线后应提供注销、导出、删除申请和隐私问题反馈渠道。',
    ],
  },
  {
    title: '儿童信息保护摘要',
    items: [
      '儿童姓名、生日、性别、成长记录、照片、家庭关系和其他可识别儿童身份的信息，均按敏感家庭资料保护。',
      '创建孩子档案、上传儿童影像、邀请家庭成员和管理档案内容，应由儿童监护人或获得监护人授权的家庭成员完成。',
      '儿童信息默认仅对档案所属家庭成员和必要授权运营角色可见；后台访问受角色权限、操作审计和最小权限原则约束。',
      '监护人可以申请更正或删除儿童档案、成长记录和媒体内容；正式上线前应补齐儿童信息保护负责人和投诉渠道。',
    ],
  },
];

export const LegalPage = () => (
  <PageShell title="关于与协议" description="查看当前版本说明、用户协议、隐私政策和儿童信息保护规则。">
    <Panel>
      <div style={rowStyle}>
        <strong>当前版本说明</strong>
        <p style={helperTextStyle}>当前版本用于最小可用版本联调与验收，已覆盖登录、建档、记录、时间轴、家庭成员、媒体上传和后台运营主流程。</p>
      </div>
    </Panel>
    {legalSections.map((section) => (
      <Panel key={section.title}>
        <div style={rowStyle}>
          <strong>{section.title}</strong>
          {section.items.map((item) => (
            <p key={item} style={{ ...helperTextStyle, lineHeight: 1.7 }}>
              {item}
            </p>
          ))}
        </div>
      </Panel>
    ))}
  </PageShell>
);

export const ErrorPage = () => (
  <PageShell title="页面暂时无法打开" description="请返回上一页重试，或重新登录后再查看。">
    <Panel>
      <EmptyState message="页面加载遇到问题，请稍后重试。若问题持续出现，可在帮助与反馈中补充操作步骤。" />
    </Panel>
  </PageShell>
);
