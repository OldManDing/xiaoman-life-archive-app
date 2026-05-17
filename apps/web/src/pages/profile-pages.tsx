import { useEffect, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookHeart, Camera, CheckCircle2, ChevronRight, CreditCard, DownloadCloud, FileBox, FileText, Globe, HelpCircle, Info, KeyRound, Lock, LogOut, Mail, RefreshCw, Shield, ShieldCheck, Smartphone, Star, Users } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { RecordSummary } from '../shared/api/types';
import { useAsyncData } from '../shared/hooks';
import { membershipTypeLabel } from '../shared/labels';
import { createPersistableMediaPreview, resolveMediaPreviewUrl, resolveStoredMediaUrl, saveLocalMediaPreview, toLocalMediaReference } from '../shared/localMediaPreview';
import { clearLocalSettings, loadLocalSettings, saveLocalSettings, type LocalSettings } from '../shared/localSettings';
import { AppSelect, Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, rowStyle } from './shared';

const profileCardStyle = {
  background: '#ffffff',
  border: '1px solid #eef0f2',
  borderRadius: '24px',
  boxShadow: '0 3px 12px rgba(15,23,42,0.035)',
  overflow: 'hidden',
} as const;

const profileSectionStyle = {
  paddingLeft: '20px',
  paddingRight: '20px',
} as const;

const uploadAvatarImage = async (childNo: string, file: File) => {
  const uploadToken = await webApi.createUploadToken({
    child_no: childNo,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    media_type: 'image',
  });

  if (uploadToken.mock_upload) {
    const preview = await createPersistableMediaPreview(file);
    saveLocalMediaPreview(uploadToken.media_no, preview);
    await webApi.confirmUpload({ media_no: uploadToken.media_no });
    return toLocalMediaReference(uploadToken.media_no);
  }

  await fetch(uploadToken.upload_url, {
    method: uploadToken.method,
    headers: uploadToken.headers,
    body: file,
  });
  await webApi.confirmUpload({ media_no: uploadToken.media_no });
  const access = await webApi.mediaAccessUrl(uploadToken.media_no);
  return access.access_url;
};

const ProfileAvatar = ({ src, label }: { src?: string | null; label: string }) => {
  const resolvedSrc = resolveStoredMediaUrl(src);
  if (resolvedSrc) {
    return <img src={resolvedSrc} alt={label} style={{ width: '68px', height: '68px', borderRadius: '999px', objectFit: 'cover', border: '1px solid #e7e5e4', boxShadow: '0 5px 16px rgba(15,23,42,0.12)', flexShrink: 0 }} />;
  }

  return (
    <div
      style={{
        width: '68px',
        height: '68px',
        borderRadius: '999px',
        background: '#f5f5f4',
        border: '1px solid #e7e5e4',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        color: '#44403c',
        boxShadow: '0 5px 16px rgba(15,23,42,0.12)',
        flexShrink: 0,
      }}
    >
      {label.slice(0, 1) || '我'}
    </div>
  );
};

const SmallChildAvatar = ({ src, label }: { src?: string | null; label: string }) => {
  const resolvedSrc = resolveStoredMediaUrl(src);
  if (resolvedSrc) {
    return <img src={resolvedSrc} alt={label} style={{ width: '38px', height: '38px', borderRadius: '999px', objectFit: 'cover', border: '1px solid #eee9df', flexShrink: 0 }} />;
  }

  return (
    <div style={{ width: '38px', height: '38px', borderRadius: '999px', border: '1px solid #eee9df', background: '#f5f5f4', display: 'grid', placeItems: 'center', color: '#57534e', fontWeight: 700, flexShrink: 0 }}>
      {label.slice(0, 1) || '宝'}
    </div>
  );
};

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
      minHeight: '70px',
      padding: '15px 16px',
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
      <div style={{ width: '36px', height: '36px', borderRadius: '999px', background: '#ffffff', border: '1px solid #eee9df', display: 'grid', placeItems: 'center', color: '#94a3b8', flexShrink: 0 }}>
        <Icon size={19} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '16px', fontWeight: 500, color: '#44403c' }}>{title}</span>
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
    minWidth: '58px',
    minHeight: '44px',
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
  const { user, logout, activeChild } = useAuth();
  const navigate = useNavigate();
  const { data: draftRecords } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 3, status: 'draft' });
      return result.list;
    },
    [activeChild?.child_no],
  );
  const latestDraft = draftRecords?.[0] ?? null;
  return (
    <div style={{ minHeight: '100dvh', background: '#f8f9fa', color: '#292524', overflowX: 'hidden' }}>
      <section style={{ background: '#ffffff', padding: 'calc(54px + env(safe-area-inset-top)) 20px 30px', borderBottom: '1px solid #eef0f2', borderRadius: '0 0 30px 30px', boxShadow: '0 5px 16px rgba(15,23,42,0.06)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '13px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <ProfileAvatar src={user?.avatar_url ?? activeChild?.avatar_url} label={user?.nickname ?? '我的头像'} />
            <div style={{ display: 'grid', gap: '5px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '24px', color: '#292524', lineHeight: 1.1 }}>{user?.nickname ?? '未登录用户'}</strong>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#d97706', padding: '3px 10px', borderRadius: '999px', border: '1px solid #f1d99b', background: '#fff7dc', letterSpacing: 0 }}>
                  {membershipTypeLabel(user?.membership_type)}
                </span>
              </div>
              <span style={{ fontSize: '15px', color: '#78716c', fontWeight: 500 }}>
                {activeChild ? `正在记录 ${activeChild.name} 的成长` : '管理你的家庭档案'}
              </span>
            </div>
          </div>
          <button
            type="button"
            style={{
              borderRadius: '999px',
              border: '1px solid #edf0f3',
              background: '#ffffff',
              color: '#57534e',
              fontSize: '15px',
              fontWeight: 600,
              padding: '10px 18px',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/profile/account')}
          >
            编辑主页
          </button>
        </div>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '16px' }}>
        <button
          type="button"
          onClick={() => navigate(latestDraft ? `/record/${latestDraft.record_no}/edit` : '/record/create')}
          style={{ ...profileCardStyle, width: '100%', minHeight: '66px', padding: '15px 16px', borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '999px', background: '#fafaf9', border: '1px solid #e7e5e4', display: 'grid', placeItems: 'center', color: '#78716c' }}>
              <FileBox size={16} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#57534e' }}>草稿箱</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a8a29e' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{latestDraft ? `${draftRecords?.length ?? 1} 条待完善` : '暂无草稿'}</span>
            <ChevronRight size={16} strokeWidth={2.2} />
          </div>
        </button>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '22px' }}>
        <h2 style={{ margin: '0 0 10px 4px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: 0 }}>我的孩子</h2>
        <div style={{ ...profileCardStyle, padding: '0', borderRadius: '22px' }}>
          <button
            type="button"
            onClick={() => navigate('/family/child')}
            style={{
              width: '100%',
              border: 'none',
              borderBottom: '1px solid #f7f4ef',
              background: 'transparent',
              minHeight: '68px',
              padding: '15px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <SmallChildAvatar src={activeChild?.avatar_url} label={activeChild?.name ?? '孩子'} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: '15px', color: '#292524' }}>{activeChild?.name ?? '孩子资料'}</strong>
                <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#78716c', fontWeight: 600 }}>{activeChild?.current_age_display ?? '查看和维护孩子的基础资料'}</span>
              </div>
            </div>
            <ChevronRight size={18} color="#d6d3d1" strokeWidth={2} />
          </button>
          <button
            type="button"
            style={{
              margin: '12px 16px 16px',
              width: 'calc(100% - 32px)',
              padding: '12px 16px',
              borderRadius: '14px',
              border: '1px dashed #d6d3d1',
              background: '#fafaf9',
              color: '#78716c',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/onboarding/child?mode=add')}
          >
            + 添加宝宝
          </button>
        </div>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '24px' }}>
        <h2 style={{ margin: '0 0 10px 4px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: 0 }}>管理中心</h2>
        <div style={{ ...profileCardStyle, borderRadius: '22px' }}>
          <ProfileListItem icon={BookHeart} title="月报与纪念册" onClick={() => navigate('/profile/reports')} />
          <ProfileListItem icon={DownloadCloud} title="导出与备份" onClick={() => navigate('/profile/export')} />
          <ProfileListItem icon={CreditCard} title="会员中心" onClick={() => navigate('/profile/membership')} />
          <ProfileListItem icon={ShieldCheck} title="隐私设置" onClick={() => navigate('/profile/settings')} />
          <ProfileListItem icon={Users} title="家庭管理" onClick={() => navigate('/family')} />
          <ProfileListItem icon={HelpCircle} title="帮助与反馈" onClick={() => navigate('/profile/help')} />
        </div>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '24px', paddingBottom: '22px' }}>
        <h2 style={{ margin: '0 0 10px 4px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: 0 }}>设置区</h2>
        <div style={{ ...profileCardStyle, borderRadius: '22px' }}>
          <ProfileListItem icon={Lock} title="账号与安全" onClick={() => navigate('/profile/security')} />
          <ProfileListItem icon={Info} title="关于我们" onClick={() => navigate('/profile/about')} />
        </div>
        <button
          type="button"
          style={{
            width: '100%',
            marginTop: '22px',
            minHeight: '58px',
            padding: '14px 16px',
            borderRadius: '22px',
            border: '1px solid #eef0f2',
            background: '#ffffff',
            color: '#ef4444',
            fontSize: '15px',
            fontWeight: 700,
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
  const { user, activeChild, setUserProfile } = useAuth();
  const settings = loadLocalSettings();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
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

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!activeChild?.child_no) {
      setMessage('请先选择孩子档案后再上传头像');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setMessage('头像仅支持 JPG、PNG、WebP、HEIC 图片');
      return;
    }

    setAvatarUploading(true);
    setMessage(null);
    try {
      const avatarUrl = await uploadAvatarImage(activeChild.child_no, file);
      const nextProfile = await webApi.updateMe({ avatar_url: avatarUrl });
      setUserProfile(nextProfile);
      setMessage('头像已更新');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '头像上传失败');
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <PageShell title="个人资料" description="查看当前账号信息与会员状态，并支持修改昵称。" backTo="/profile">
      <Panel>
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <ProfileAvatar src={user?.avatar_url} label={user?.nickname ?? '我的头像'} />
            <label
              style={{
                ...secondaryButtonStyle,
                minHeight: '40px',
                borderRadius: '999px',
                cursor: avatarUploading ? 'not-allowed' : 'pointer',
                opacity: avatarUploading ? 0.68 : 1,
              }}
            >
              <Camera size={15} strokeWidth={2.2} />
              {avatarUploading ? '上传中…' : '上传头像'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={avatarUploading} onChange={(event) => void onAvatarChange(event)} style={{ display: 'none' }} />
            </label>
          </div>
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
    <PageShell title="隐私设置" backTo="/profile">
      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setMessage('当前默认仅家庭成员可见。')}
          style={{ ...settingsRowStyle, width: '100%', border: 'none', borderBottom: '1px solid #f2efe9', background: '#ffffff', padding: '17px 18px', textAlign: 'left', cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <ShieldCheck size={18} color="#94a3b8" />
            <span style={{ color: '#57534e', fontSize: '14px', fontWeight: 700 }}>默认谁可以看到您的记录</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#a8a29e', fontSize: '12px', fontWeight: 700 }}>
            仅家庭成员
            <ChevronRight size={15} />
          </span>
        </button>
        {[
          { key: 'hideMobileMask' as const, title: '允许通过手机号搜索到我', icon: Users, inverted: true },
          { key: 'autoRefreshHome' as const, title: '向新成员展示历史时间轴', icon: RefreshCw },
        ].map((item) => {
          const Icon = item.icon;
          const enabled = item.inverted ? !settings[item.key] : settings[item.key];
          return (
            <div key={item.key} style={{ ...settingsRowStyle, padding: '17px 18px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                <Icon size={18} color="#94a3b8" />
                <strong style={{ display: 'block', color: '#57534e', fontSize: '14px' }}>{item.title}</strong>
              </div>
              <button type="button" aria-label={item.title} aria-pressed={enabled} style={toggleButtonStyle(enabled)} onClick={() => updateSetting(item.key)}>
                <span style={toggleKnobStyle} />
              </button>
            </div>
          );
        })}
      </Panel>
      <p style={{ ...helperTextStyle, lineHeight: 1.7 }}>我们尊重每个家庭对孩子影像和成长记录的保护习惯。新的访问规则将即时生效，并同步到本机浏览偏好。</p>
      {message ? <p style={{ ...helperTextStyle, color: '#0f766e' }}>{message}</p> : null}
      <button type="button" style={{ ...secondaryButtonStyle, width: '100%', justifyContent: 'center' }} onClick={resetSettings}>
        恢复默认设置
      </button>
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
  const currentDate = new Date();
  const reportDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const reportYear = reportDate.getFullYear();
  const reportMonth = reportDate.getMonth() + 1;
  const monthKey = toMonthKey(reportDate);
  const monthlyRecords = (records ?? []).filter((item) => toMonthKey(item.event_time) === monthKey);
  const milestoneCount = monthlyRecords.filter((item) => item.is_milestone).length;
  const mediaRecords = monthlyRecords.filter((item) => item.cover_url && item.cover_media_type !== 'audio');
  const imageCount = mediaRecords.length;
  const textCount = monthlyRecords.filter((item) => item.record_type === 'text').length;
  const latest = monthlyRecords[0];
  const monthlySummary = monthlyRecords.length
    ? `这个月已经留下 ${monthlyRecords.length} 个成长瞬间。${milestoneCount ? `${milestoneCount} 个里程碑把关键变化标了出来，` : ''}${imageCount ? `${imageCount} 条影像让回忆有画面，` : ''}${textCount ? `${textCount} 条文字记录保留了当时的语气。` : '每一条记录都会进入孩子的长期档案。'}`
    : '这个月还没有生成月报内容。先发布一条记录，年轮会自动把它放进本月成长回顾。';

  const pastMonths = [1, 2, 3, 4].map((offset) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });

  return (
    <PageShell title="月报与纪念册" backTo="/profile">
      {loading ? <Panel><EmptyState message="正在整理本月记录…" /></Panel> : null}
      {error ? <Panel><EmptyState message={`月报加载失败：${error}`} /></Panel> : null}
      {!loading && !error ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
            <div>
              <p style={{ margin: 0, color: '#57534e', fontSize: '14px', fontWeight: 700 }}>
                为 {activeChild?.name ?? '孩子'} 整理的
              </p>
              <p style={{ margin: '5px 0 0', color: '#a8a29e', fontSize: '13px', fontWeight: 600 }}>专属时光记忆和可导出的家庭资产</p>
            </div>
            <SmallChildAvatar src={activeChild?.avatar_url} label={activeChild?.name ?? '孩子'} />
          </div>
          <section
            style={{
              borderRadius: '28px',
              padding: '22px',
              position: 'relative',
              border: '1px solid #eef0f2',
              background: '#ffffff',
              boxShadow: '0 5px 18px rgba(15,23,42,0.045)',
              display: 'grid',
              gap: '16px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 42px', gap: '14px', alignItems: 'start' }}>
              <div>
                <span style={{ display: 'inline-flex', color: '#d97706', fontSize: '12px', fontWeight: 800, marginBottom: '8px' }}>最新月报</span>
                <h2 style={{ margin: 0, color: '#292524', fontSize: '25px', fontWeight: 800, lineHeight: 1.16 }}>
                  {reportYear}年{reportMonth}月
                  <br />
                  成长月报
                </h2>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #eef1f4', background: '#f8fafc', color: '#94a3b8', display: 'grid', placeItems: 'center' }}>
                <BookHeart size={19} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {[
                { label: '记录数量', value: monthlyRecords.length },
                { label: '影像记录', value: imageCount },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: '16px', background: '#fcfaf5', border: '1px solid #f5f1e6', padding: '12px', textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: '19px', color: '#292524', lineHeight: 1 }}>{item.value}</strong>
                  <span style={{ display: 'block', marginTop: '6px', color: '#a8a29e', fontSize: '11px', fontWeight: 800 }}>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ borderRadius: '18px', background: '#fcfaf5', border: '1px solid #f5f1e6', padding: '14px', display: 'grid', gap: '8px' }}>
              <strong style={{ color: '#a16207', fontSize: '13px' }}>本月故事摘要</strong>
              <p style={{ ...helperTextStyle, lineHeight: 1.8 }}>{monthlySummary}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              <button type="button" style={{ ...primaryButtonStyle, width: '100%', minHeight: '44px', boxShadow: '0 8px 18px rgba(41,37,36,0.16)' }} onClick={() => latest ? navigate(`/record/${latest.record_no}`) : navigate('/record/create')}>
                {latest ? '查看最近记录' : '去记录第一条'}
              </button>
              <button type="button" style={{ ...secondaryButtonStyle, width: '100%', minHeight: '44px', justifyContent: 'center' }} onClick={() => navigate('/profile/export')}>
                导出月报摘要
              </button>
            </div>

            <div style={{ borderTop: '1px solid #f3f0ea', paddingTop: '12px', display: 'grid', gap: '8px' }}>
              <strong style={{ color: '#d97706', fontSize: '13px' }}>AI 月报摘要</strong>
              <p style={{ ...helperTextStyle, lineHeight: 1.75 }}>
                {monthlyRecords.length
                  ? `本月共记录 ${monthlyRecords.length} 个成长瞬间，其中 ${milestoneCount} 个里程碑、${imageCount} 条影像记录、${textCount} 条文字记录。`
                  : '本月还没有记录内容，添加记录后会自动汇总为成长月报。'}
              </p>
              {latest ? (
                <button type="button" style={{ ...secondaryButtonStyle, justifyContent: 'space-between', textAlign: 'left' }} onClick={() => navigate(`/record/${latest.record_no}`)}>
                  <span>最近一条：{latest.title ?? '未命名记录'}</span>
                  <ChevronRight size={16} />
                </button>
              ) : null}
            </div>
          </section>

          <section>
            <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 800, color: '#44403c', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookHeart size={18} color="#94a3b8" />
              往期纪念册
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              {pastMonths.map((item, index) => (
                <button
                  key={`${item.year}-${item.month}`}
                  type="button"
                  style={{
                    minHeight: '138px',
                    borderRadius: '22px',
                    border: '1px solid #eef0f2',
                    background: index === pastMonths.length - 1 ? '#fbfaf7' : '#ffffff',
                    color: '#292524',
                    padding: '14px',
                    display: 'grid',
                    alignContent: 'space-between',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate('/profile/export')}
                >
                  <strong style={{ fontSize: '15px', lineHeight: 1.25 }}>{item.year}年<br />{item.month}月纪念册</strong>
                  <span style={{ color: '#a8a29e', fontSize: '12px', fontWeight: 700 }}>查看 / 导出</span>
                </button>
              ))}
            </div>
          </section>

          {mediaRecords.length ? (
            <Panel>
              <div style={rowStyle}>
                <strong>影像墙</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  {mediaRecords.slice(0, 6).map((item) => {
                    const cover = resolveMediaPreviewUrl(item.cover_media_no, item.cover_url);
                    return (
                      <button key={item.record_no} type="button" onClick={() => navigate(`/record/${item.record_no}`)} style={{ border: 'none', padding: 0, background: '#fafaf9', borderRadius: '14px', overflow: 'hidden', aspectRatio: '1 / 1', cursor: 'pointer' }}>
                        {cover && item.cover_media_type === 'video' ? <video src={cover} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                        {cover && item.cover_media_type !== 'video' ? <img src={cover} alt={item.title ?? '纪念册影像'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Panel>
          ) : null}

          {monthlyRecords.length ? (
            <Panel>
              <div style={rowStyle}>
                <strong>记录清单</strong>
                {monthlyRecords.slice(0, 6).map((item) => (
                  <button key={item.record_no} type="button" style={{ ...secondaryButtonStyle, borderRadius: '14px', textAlign: 'left', justifyContent: 'space-between' }} onClick={() => navigate(`/record/${item.record_no}`)}>
                    <span style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontWeight: 700 }}>{item.title ?? '未命名记录'}</span>
                      <span style={{ color: '#78716c', fontSize: '12px' }}>{new Date(item.event_time).toLocaleString('zh-CN', { hour12: false })}</span>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
};

export const ExportBackupPage = () => {
  const { user, activeChild } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<'all' | 'media' | 'text'>('all');
  const { data: records, loading, error } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 100 });
      return result.list;
    },
    [activeChild?.child_no],
  );
  const recordsList = records ?? [];
  const milestoneCount = recordsList.filter((item) => item.is_milestone).length;
  const mediaCount = recordsList.filter((item) => item.cover_url).length;
  const exportText = [
    '年轮成长档案摘要',
    `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    `账号：${user?.nickname ?? '未登录用户'}`,
    `孩子：${activeChild?.name ?? '未选择孩子'}`,
    `记录数量：${recordsList.length}`,
    `里程碑数量：${milestoneCount}`,
    `影像记录数量：${mediaCount}`,
    '',
    ...recordsList.slice(0, 30).map((item, index) => `${index + 1}. ${item.title ?? '未命名记录'}｜${new Date(item.event_time).toLocaleString('zh-CN', { hour12: false })}｜${item.tags.join('、') || '无标签'}`),
  ].join('\n');

  const downloadSummary = () => {
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `年轮-${activeChild?.name ?? '孩子'}-档案摘要.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('档案摘要已生成下载文件');
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setMessage('档案摘要已复制，可粘贴到家庭群或备忘录');
    } catch {
      setMessage('复制失败，请使用下载文件保存摘要');
    }
  };

  const exportOptions = [
    { value: 'all' as const, title: '全部数据（推荐）', description: '包含所有文字记录、高清图片和视频文件' },
    { value: 'media' as const, title: '仅图片和视频', description: '只导出媒体文件，适合节省空间' },
    { value: 'text' as const, title: '仅文字记录', description: '导出为 TXT/PDF 格式的纯文字日记' },
  ];

  return (
    <PageShell title="导出与备份" backTo="/profile">
      <Panel style={{ textAlign: 'center', padding: '26px 20px', borderRadius: '18px', boxShadow: '0 2px 8px rgba(41,37,36,0.03)' }}>
        <div style={{ width: '54px', height: '54px', borderRadius: '999px', background: '#fff4d6', color: '#d97706', display: 'grid', placeItems: 'center', margin: '0 auto 15px' }}>
          <DownloadCloud size={23} strokeWidth={2.2} />
        </div>
        <h2 style={{ margin: 0, color: '#292524', fontSize: '17px', fontWeight: 800 }}>一键备份数字资产</h2>
        <p style={{ ...helperTextStyle, margin: '9px auto 0', maxWidth: '280px', lineHeight: 1.65 }}>将您在应用中记录的所有照片、视频和文字日志打包下载，永久保存在您的私人设备中。</p>
      </Panel>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
        {[
          { label: '记录', value: recordsList.length },
          { label: '里程碑', value: milestoneCount },
          { label: '影像', value: mediaCount },
        ].map((item) => (
          <div key={item.label} style={{ borderRadius: '16px', border: '1px solid #eef0f2', background: '#ffffff', padding: '13px 10px', textAlign: 'center' }}>
            <strong style={{ display: 'block', color: '#292524', fontSize: '18px', lineHeight: 1 }}>{item.value}</strong>
            <span style={{ display: 'block', marginTop: '6px', color: '#a8a29e', fontSize: '11px', fontWeight: 800 }}>{item.label}</span>
          </div>
        ))}
      </section>

      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 800, color: '#292524' }}>选择导出内容</h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          {exportOptions.map((item) => {
            const selected = exportMode === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setExportMode(item.value)}
                style={{
                  borderRadius: '16px',
                  border: selected ? '1.5px solid #292524' : '1px solid #eef1f4',
                  background: '#ffffff',
                  minHeight: '68px',
                  padding: '13px 15px',
                  display: 'grid',
                  gridTemplateColumns: '36px minmax(0, 1fr) 22px',
                  gap: '12px',
                  alignItems: 'center',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: selected ? '0 5px 14px rgba(41,37,36,0.07)' : '0 1px 4px rgba(41,37,36,0.02)',
                }}
              >
                <span style={{ width: '36px', height: '36px', borderRadius: '999px', background: selected ? '#292524' : '#f8fafc', color: selected ? '#ffffff' : '#cbd5e1', display: 'grid', placeItems: 'center' }}>
                  <FileBox size={17} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', color: '#292524', fontSize: '14px', fontWeight: 800 }}>{item.title}</strong>
                  <span style={{ display: 'block', marginTop: '4px', color: '#a8a29e', fontSize: '12px', lineHeight: 1.45 }}>{item.description}</span>
                </span>
                {selected ? <CheckCircle2 size={20} color="#292524" strokeWidth={2.4} /> : <span style={{ width: '18px', height: '18px', borderRadius: '999px', border: '1px solid #d6d3d1', background: '#ffffff' }} />}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? <EmptyState message="正在整理档案摘要…" /> : null}
      {error ? <EmptyState message={`摘要整理失败：${error}`} /> : null}

      {message ? <p style={{ ...helperTextStyle, color: message.includes('失败') ? '#dc2626' : '#0f766e' }}>{message}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
        <button type="button" style={{ ...primaryButtonStyle, width: '100%', minHeight: '46px', borderRadius: '18px' }} onClick={downloadSummary} disabled={loading || Boolean(error)}>
          下载摘要
        </button>
        <button type="button" style={{ ...secondaryButtonStyle, width: '100%', minHeight: '46px', borderRadius: '18px', justifyContent: 'center' }} onClick={() => void copySummary()} disabled={loading || Boolean(error)}>
          复制摘要
        </button>
      </div>
    </PageShell>
  );
};

export const MembershipPage = () => {
  const { user, setUserProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshMembership = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const profile = await webApi.me();
      setUserProfile(profile);
      setMessage('会员信息已刷新');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '会员信息刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <PageShell title="会员中心" backTo="/profile">
      <section style={{ borderRadius: '20px', border: '1px solid #292524', background: 'linear-gradient(135deg, #1f1f1f 0%, #0f0f0f 100%)', padding: '18px', minHeight: '142px', color: '#ffffff', display: 'grid', gap: '14px', boxShadow: '0 10px 22px rgba(15,15,15,0.18)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', right: '-28px', top: '-28px', width: '120px', height: '120px', borderRadius: '999px', border: '24px solid rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
            <ProfileAvatar src={user?.avatar_url} label={user?.nickname ?? '会员'} />
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '17px', fontWeight: 800 }}>{user?.nickname ?? '年轮会员'}</strong>
              <span style={{ display: 'block', marginTop: '5px', color: 'rgba(255,255,255,0.68)', fontSize: '12px', fontWeight: 700 }}>{membershipTypeLabel(user?.membership_type)}</span>
            </div>
          </div>
          <span style={{ borderRadius: '999px', background: '#d97706', color: '#ffffff', padding: '6px 10px', fontSize: '10px', fontWeight: 900 }}>VIP PRO</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '12px' }}>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.74)', fontSize: '12px', lineHeight: 1.6 }}>
            到期时间：{user?.membership_expire_at ? new Date(user.membership_expire_at).toLocaleDateString('zh-CN') : '长期有效'}
          </p>
          <button type="button" style={{ ...primaryButtonStyle, minHeight: '44px', padding: '8px 12px', background: '#ffffff', color: '#292524', boxShadow: 'none', fontSize: '12px' }} onClick={() => void refreshMembership()} disabled={refreshing}>
            {refreshing ? '刷新中' : '刷新会员信息'}
          </button>
        </div>
      </section>

      <section>
        <h2 style={{ margin: '0 0 12px 2px', fontSize: '14px', fontWeight: 800, color: '#292524' }}>您的专属特权</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
          {[
            { icon: DownloadCloud, title: '高清画质下载', desc: '大容量媒体备份' },
            { icon: BookHeart, title: '精美时光月报', desc: '每月自动生成' },
            { icon: ShieldCheck, title: '云端安全加密', desc: '保存敏感资产' },
            { icon: CreditCard, title: '家庭人数无限', desc: '邀请亲友一起记录' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} style={{ borderRadius: '14px', border: '1px solid #eef1f4', background: '#ffffff', padding: '14px', display: 'grid', gap: '10px', boxShadow: '0 1px 4px rgba(41,37,36,0.02)' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '999px', background: '#fff4d6', color: '#d97706', display: 'grid', placeItems: 'center' }}>
                  <Icon size={15} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#292524' }}>{item.title}</strong>
                  <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#a8a29e', lineHeight: 1.4 }}>{item.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Panel style={{ borderRadius: '18px', boxShadow: '0 2px 8px rgba(41,37,36,0.03)' }}>
        <div style={rowStyle}>
          <strong>成长纪念册</strong>
          <p style={{ ...helperTextStyle, lineHeight: 1.75 }}>作为高级会员，您每年可申领一本由专业排版生成的成长纪念册，将数字记忆变成可保存的家庭资产。</p>
          {message ? <p style={{ ...helperTextStyle, color: message.includes('失败') ? '#dc2626' : '#0f766e' }}>{message}</p> : null}
          <button
            type="button"
            style={{ ...primaryButtonStyle, width: '100%', borderRadius: '18px', background: '#d97706', boxShadow: '0 6px 14px rgba(217,119,6,0.18)' }}
            onClick={() => setMessage('纪念册申领入口暂未接入，请通过帮助与反馈提交申请。')}
            disabled={refreshing}
          >
            查看纪念册说明
          </button>
        </div>
      </Panel>
    </PageShell>
  );
};

export const SecurityPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const rows = [
    { title: '手机号码', value: user?.mobile ?? '当前未提供', icon: Smartphone, onClick: () => navigate('/profile/account') },
    { title: '登录密码', value: '已设置', icon: KeyRound, onClick: () => navigate('/profile/account') },
    { title: '第三方账号绑定', value: '已绑定微信', icon: ShieldCheck, onClick: () => navigate('/profile/settings') },
  ];

  return (
    <PageShell title="账号与安全" backTo="/profile">
      <Panel style={{ padding: 0, overflow: 'hidden', borderRadius: '18px', boxShadow: '0 2px 8px rgba(41,37,36,0.03)' }}>
        {rows.map((item, index) => {
          const Icon = item.icon;
          return (
          <button
            key={item.title}
            type="button"
            onClick={item.onClick}
            style={{
              width: '100%',
              minHeight: '62px',
              border: 'none',
              borderBottom: index === rows.length - 1 ? 'none' : '1px solid #f3f0ea',
              background: '#ffffff',
              padding: '0 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#57534e', fontSize: '14px', fontWeight: 700 }}>
              <Icon size={17} color="#94a3b8" strokeWidth={2} />
              {item.title}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#a8a29e', fontSize: '13px', fontWeight: 700 }}>
              {item.value}
              <ChevronRight size={16} color="#d6d3d1" />
            </span>
          </button>
          );
        })}
      </Panel>
      <button type="button" onClick={() => navigate('/profile/help?topic=account-delete')} style={{ ...secondaryButtonStyle, width: '100%', color: '#ef4444', justifyContent: 'center', minHeight: '48px', marginTop: '10px', borderRadius: '18px' }}>
        注销账号
      </button>
    </PageShell>
  );
};

export const HelpFeedbackPage = () => {
  const location = useLocation();
  const accountDeleteTopic = new URLSearchParams(location.search).get('topic') === 'account-delete';
  const [category, setCategory] = useState(accountDeleteTopic ? '数据异常' : '使用问题');
  const [content, setContent] = useState(accountDeleteTopic ? '申请注销账号，请联系我完成身份确认和儿童信息处理。' : '');
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
    <PageShell title="帮助与反馈" description={accountDeleteTopic ? '账号注销需要人工确认，请提交申请后等待联系。' : '查看常见问题，并提交当前设备上的反馈记录。'} backTo="/profile">
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
            <AppSelect aria-label="问题类型" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="使用问题">使用问题</option>
              <option value="页面显示">页面显示</option>
              <option value="数据异常">数据异常</option>
              <option value="功能建议">功能建议</option>
            </AppSelect>
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
      '监护人可以申请更正或删除儿童档案、成长记录和媒体内容；如需处理儿童信息保护问题，可通过帮助与反馈提交申请。',
    ],
  },
];

const AboutMenuLink = ({
  icon: Icon,
  label,
  value,
  onClick,
  isLast,
}: {
  icon: typeof Info;
  label: string;
  value?: string;
  onClick?: () => void;
  isLast?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: '100%',
      minHeight: '54px',
      border: 'none',
      borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
      background: '#ffffff',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      textAlign: 'left',
      cursor: 'pointer',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, color: '#4a4a4a', fontSize: '15px', fontWeight: 700 }}>
      <Icon size={18} color="#94a3b8" strokeWidth={2} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </span>
    {value ? (
      <span style={{ color: '#a1a1aa', fontSize: '13px', whiteSpace: 'nowrap' }}>{value}</span>
    ) : (
      <ChevronRight size={16} color="#cbd5e1" strokeWidth={2.2} />
    )}
  </button>
);

export const AboutPage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <PageShell title="关于我们" backTo="/profile">
      <section style={{ display: 'grid', justifyItems: 'center', padding: '18px 0 10px' }}>
        <div style={{ width: '96px', height: '96px', borderRadius: '26px', background: 'linear-gradient(135deg, #2c2c2c 0%, #171717 100%)', color: '#fbbf24', display: 'grid', placeItems: 'center', boxShadow: '0 10px 22px rgba(15,15,15,0.16)', marginBottom: '16px' }}>
          <Star size={40} fill="currentColor" strokeWidth={1.8} />
        </div>
        <h2 style={{ margin: 0, color: '#2c2c2c', fontSize: '20px', fontWeight: 800 }}>孩子的人生档案馆</h2>
        <p style={{ margin: '6px 0 0', color: '#a1a1aa', fontSize: '12px', fontWeight: 600 }}>Version 1.0.0 (Build 20260514)</p>
      </section>

      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <AboutMenuLink icon={Info} label="功能介绍" onClick={() => setMessage('年轮支持成长记录、家庭协作、时间轴、月报纪念册和本机导出。')} />
        <AboutMenuLink icon={FileText} label="用户服务协议" onClick={() => navigate('/profile/legal')} />
        <AboutMenuLink icon={Shield} label="隐私政策" onClick={() => navigate('/profile/legal')} />
        <AboutMenuLink icon={Globe} label="官方网站（待开放）" isLast onClick={() => setMessage('官方网站将在正式上线后开放。')} />
      </Panel>

      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <AboutMenuLink icon={Mail} label="联系我们" value="support@familyarchive.com" onClick={() => setMessage('可通过 support@familyarchive.com 联系我们。')} />
        <AboutMenuLink icon={Star} label="应用商店评分（待开放）" isLast onClick={() => setMessage('App 版本上线后将开放应用商店评分入口。')} />
      </Panel>

      {message ? <p style={{ ...helperTextStyle, color: '#57534e', textAlign: 'center' }}>{message}</p> : null}
      <div style={{ textAlign: 'center', color: '#a1a1aa', fontSize: '10px', lineHeight: 1.7, paddingTop: '8px' }}>
        <p style={{ margin: 0 }}>年轮 © 2026</p>
        <p style={{ margin: 0 }}>守护每个家庭的成长记录。</p>
      </div>
    </PageShell>
  );
};

export const LegalPage = () => {
  const location = useLocation();
  const backTo = location.pathname.startsWith('/profile') ? '/profile' : '/auth/login';
  const isAboutPage = location.pathname.endsWith('/about');

  return (
  <PageShell title={isAboutPage ? '关于我们' : '关于与协议'} description="查看当前版本说明、用户协议、隐私政策和儿童信息保护规则。" backTo={backTo}>
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
};

export const ErrorPage = () => (
  <PageShell title="页面暂时无法打开" description="请返回上一页重试，或重新登录后再查看。">
    <Panel>
      <EmptyState message="页面加载遇到问题，请稍后重试。若问题持续出现，可在帮助与反馈中补充操作步骤。" />
    </Panel>
  </PageShell>
);
