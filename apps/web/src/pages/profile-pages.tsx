import { useEffect, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookHeart, Camera, ChevronRight, Copy, CreditCard, DownloadCloud, FileBox, HelpCircle, Info, Lock, LogOut, RefreshCw, ShieldCheck, Users } from 'lucide-react';

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
  border: '1px solid #ebe6dc',
  borderRadius: '18px',
  boxShadow: '0 1px 2px rgba(41,37,36,0.04)',
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
    return <img src={resolvedSrc} alt={label} style={{ width: '68px', height: '68px', borderRadius: '999px', objectFit: 'cover', border: '1px solid #e7e5e4', boxShadow: '0 2px 10px rgba(15,23,42,0.04)', flexShrink: 0 }} />;
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
        boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
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
    return <img src={resolvedSrc} alt={label} style={{ width: '42px', height: '42px', borderRadius: '999px', objectFit: 'cover', border: '1px solid #eee9df', flexShrink: 0 }} />;
  }

  return (
    <div style={{ width: '42px', height: '42px', borderRadius: '999px', border: '1px solid #eee9df', background: '#f5f5f4', display: 'grid', placeItems: 'center', color: '#57534e', fontWeight: 700, flexShrink: 0 }}>
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
      padding: '14px 16px',
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
  const { user, logout, activeChild } = useAuth();
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100dvh', background: '#faf8f5', color: '#292524', overflowX: 'hidden' }}>
      <section style={{ background: '#ffffff', padding: 'calc(50px + env(safe-area-inset-top)) 20px 24px', borderBottom: '1px solid #ebe6dc', boxShadow: '0 1px 2px rgba(41,37,36,0.03)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <ProfileAvatar src={user?.avatar_url ?? activeChild?.avatar_url} label={user?.nickname ?? '我的头像'} />
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

      <section style={{ ...profileSectionStyle, marginTop: '18px' }}>
        <button
          type="button"
          onClick={() => navigate('/timeline')}
          style={{ ...profileCardStyle, width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '999px', background: '#fafaf9', border: '1px solid #e7e5e4', display: 'grid', placeItems: 'center', color: '#78716c' }}>
              <FileBox size={16} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#57534e' }}>草稿箱</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a8a29e' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>待完善记录</span>
            <ChevronRight size={16} strokeWidth={2.2} />
          </div>
        </button>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '20px' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: 0 }}>我的孩子</h2>
        <div style={{ ...profileCardStyle, padding: '0' }}>
          <button
            type="button"
            onClick={() => navigate('/family/child')}
            style={{
              width: '100%',
              border: 'none',
              borderBottom: '1px solid #f7f4ef',
              background: 'transparent',
              padding: '14px 16px',
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
              margin: '12px 16px 14px',
              width: 'calc(100% - 32px)',
              padding: '11px 16px',
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

      <section style={{ ...profileSectionStyle, marginTop: '22px' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: 0 }}>管理中心</h2>
        <div style={profileCardStyle}>
          <ProfileListItem icon={BookHeart} title="月报与纪念册" onClick={() => navigate('/profile/reports')} />
          <ProfileListItem icon={DownloadCloud} title="导出与备份" onClick={() => navigate('/profile/export')} />
          <ProfileListItem icon={CreditCard} title="会员中心" onClick={() => navigate('/profile/membership')} />
          <ProfileListItem icon={ShieldCheck} title="隐私设置" onClick={() => navigate('/profile/settings')} />
          <ProfileListItem icon={Users} title="家庭管理" onClick={() => navigate('/family')} />
          <ProfileListItem icon={HelpCircle} title="帮助与反馈" onClick={() => navigate('/profile/help')} />
        </div>
      </section>

      <section style={{ ...profileSectionStyle, marginTop: '22px', paddingBottom: '22px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#a8a29e', letterSpacing: 0 }}>设置区</h2>
        <div style={profileCardStyle}>
          <ProfileListItem icon={Lock} title="账号与安全" onClick={() => navigate('/profile/security')} />
          <ProfileListItem icon={Info} title="关于我们" onClick={() => navigate('/profile/about')} />
        </div>
        <button
          type="button"
          style={{
            width: '100%',
            marginTop: '20px',
            padding: '14px 16px',
            borderRadius: '14px',
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
    <PageShell title="隐私设置" description="管理当前设备上的通知、资料展示和首页刷新偏好。" backTo="/profile">
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
  const mediaRecords = monthlyRecords.filter((item) => item.cover_url && item.cover_media_type !== 'audio');
  const imageCount = mediaRecords.length;
  const textCount = monthlyRecords.filter((item) => item.record_type === 'text').length;
  const latest = monthlyRecords[0];
  const heroCover = mediaRecords[0] ? resolveMediaPreviewUrl(mediaRecords[0].cover_media_no, mediaRecords[0].cover_url) : null;

  return (
    <PageShell title="月报与纪念册" description={`${activeChild?.name ?? '孩子'}的本月成长记录回顾。`} backTo="/profile">
      {loading ? <Panel><EmptyState message="正在整理本月记录…" /></Panel> : null}
      {error ? <Panel><EmptyState message={`月报加载失败：${error}`} /></Panel> : null}
      {!loading && !error ? (
        <>
          <section
            style={{
              minHeight: '176px',
              borderRadius: '20px',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #ebe6dc',
              background: heroCover ? '#292524' : 'linear-gradient(135deg, #f2efe9 0%, #ffffff 100%)',
              boxShadow: '0 2px 12px rgba(15,23,42,0.025)',
            }}
          >
            {heroCover && mediaRecords[0]?.cover_media_type === 'video' ? (
              <video src={heroCover} muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : null}
            {heroCover && mediaRecords[0]?.cover_media_type !== 'video' ? <img src={heroCover} alt="月报封面" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
            <div style={{ position: 'absolute', inset: 0, background: heroCover ? 'linear-gradient(180deg, rgba(41,37,36,0.12) 0%, rgba(41,37,36,0.66) 100%)' : 'transparent' }} />
            <div style={{ position: 'relative', zIndex: 1, padding: '20px', display: 'grid', alignContent: 'end', minHeight: '176px', color: heroCover ? '#fff' : '#292524' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, opacity: 0.78 }}>{monthKey} 成长月报</span>
              <strong style={{ marginTop: '8px', fontSize: '23px', lineHeight: 1.25 }}>{activeChild?.name ?? '孩子'}的本月纪念册</strong>
              <p style={{ margin: '10px 0 0', fontSize: '13px', lineHeight: 1.65, color: heroCover ? 'rgba(255,255,255,0.86)' : '#78716c' }}>
                {monthlyRecords.length ? `已整理 ${monthlyRecords.length} 个成长瞬间，适合生成纪念册草稿。` : '本月还没有记录，可以先从首页添加照片、语音或文字。'}
              </p>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
            {[
              { label: '记录', value: monthlyRecords.length },
              { label: '影像', value: imageCount },
              { label: '文字', value: textCount },
              { label: '里程碑', value: milestoneCount },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius: '14px', border: '1px solid #ebe6dc', background: '#ffffff', padding: '12px 6px', textAlign: 'center' }}>
                <strong style={{ display: 'block', color: '#292524', fontSize: '20px', lineHeight: 1 }}>{item.value}</strong>
                <span style={{ display: 'block', marginTop: '7px', color: '#78716c', fontSize: '11px', fontWeight: 700 }}>{item.label}</span>
              </div>
            ))}
          </div>

          <Panel>
            <div style={rowStyle}>
              <strong>本月回顾</strong>
              <p style={{ ...helperTextStyle, lineHeight: 1.75 }}>
                {monthlyRecords.length
                  ? `这个月共记录 ${monthlyRecords.length} 个成长瞬间，其中 ${milestoneCount} 个里程碑、${imageCount} 条影像记录。`
                  : '本月还没有记录内容，月报会在添加记录后自动汇总。'}
              </p>
              {latest ? (
                <button type="button" style={{ ...secondaryButtonStyle, justifyContent: 'space-between', textAlign: 'left' }} onClick={() => navigate(`/record/${latest.record_no}`)}>
                  <span>最近一条：{latest.title ?? '未命名记录'}</span>
                  <ChevronRight size={16} />
                </button>
              ) : null}
            </div>
          </Panel>

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
    `账号：${user?.nickname ?? '未登录用户'}（${user?.user_no ?? '—'}）`,
    `孩子：${activeChild?.name ?? '未选择孩子'}`,
    `记录数量：${recordsList.length}`,
    `里程碑数量：${milestoneCount}`,
    `影像记录数量：${mediaCount}`,
    '',
    ...recordsList.slice(0, 30).map((item, index) => `${index + 1}. ${item.title ?? '未命名记录'}｜${new Date(item.event_time).toLocaleString('zh-CN', { hour12: false })}｜${item.tags.join('、') || '无标签'}`),
  ].join('\n');

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setMessage('档案摘要已复制到剪贴板');
    } catch {
      setMessage('复制失败，请检查浏览器剪贴板权限');
    }
  };

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

  return (
    <PageShell title="导出与备份" description="生成当前孩子档案摘要，便于本机保存或发送给家人。" backTo="/profile">
      <Panel>
        <div style={rowStyle}>
          <strong>档案概览</strong>
          {loading ? <EmptyState message="正在整理档案摘要…" /> : null}
          {error ? <EmptyState message={`摘要整理失败：${error}`} /> : null}
          {!loading && !error ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
              {[
                { label: '记录', value: recordsList.length },
                { label: '影像', value: mediaCount },
                { label: '里程碑', value: milestoneCount },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: '14px', border: '1px solid #ebe6dc', background: '#fffdf9', padding: '12px 8px', textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: '20px', color: '#292524' }}>{item.value}</strong>
                  <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', color: '#78716c', fontWeight: 700 }}>{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}
          <p style={{ ...helperTextStyle, lineHeight: 1.7 }}>当前导出内容包含账号、孩子档案和最近成长记录摘要；媒体原文件仍保存在对象存储或本地预览缓存中。</p>
          {message ? <p style={{ ...helperTextStyle, color: message.includes('失败') ? '#dc2626' : '#0f766e' }}>{message}</p> : null}
          <div style={buttonRowStyle}>
            <button type="button" style={primaryButtonStyle} onClick={downloadSummary} disabled={loading || Boolean(error)}>
              <DownloadCloud size={16} />
              下载摘要
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={() => void copySummary()} disabled={loading || Boolean(error)}>
              <Copy size={16} />
              复制摘要
            </button>
          </div>
        </div>
      </Panel>
      <Panel>
        <div style={rowStyle}>
          <strong>导出预览</strong>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#57534e', fontSize: '12px', lineHeight: 1.7, background: '#fafaf9', border: '1px solid #ebe6dc', borderRadius: '14px', padding: '12px' }}>
            {exportText}
          </pre>
        </div>
      </Panel>
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
    <PageShell title="会员中心" description="查看当前会员状态和家庭档案权益。" backTo="/profile">
      <section style={{ borderRadius: '20px', border: '1px solid #e8e2d2', background: 'linear-gradient(135deg, #fffdf8 0%, #faf8f5 100%)', padding: '18px', display: 'grid', gap: '12px' }}>
        <span style={{ color: '#b09040', fontSize: '12px', fontWeight: 800 }}>当前会员</span>
        <strong style={{ color: '#292524', fontSize: '24px' }}>{membershipTypeLabel(user?.membership_type)}</strong>
        <p style={{ ...helperTextStyle, lineHeight: 1.7 }}>
          到期时间：{user?.membership_expire_at ? new Date(user.membership_expire_at).toLocaleString('zh-CN', { hour12: false }) : '长期有效或未设置到期时间'}
        </p>
        {message ? <p style={{ ...helperTextStyle, color: message.includes('失败') ? '#dc2626' : '#0f766e' }}>{message}</p> : null}
        <button type="button" style={{ ...primaryButtonStyle, justifyContent: 'center' }} onClick={() => void refreshMembership()} disabled={refreshing}>
          <RefreshCw size={16} />
          {refreshing ? '刷新中…' : '刷新会员信息'}
        </button>
      </section>
      <Panel>
        <div style={rowStyle}>
          <strong>已启用权益</strong>
          {['家庭成员协作记录', '图片、视频与语音上传', '时间轴筛选与月报回顾', '账号密码登录与邀请注册'].map((item) => (
            <p key={item} style={{ ...helperTextStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: '#b09040', flexShrink: 0 }} />
              {item}
            </p>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
};

export const SecurityPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <PageShell title="账号与安全" description="查看登录方式、账号资料和隐私安全入口。" backTo="/profile">
      <Panel>
        <div style={rowStyle}>
          <strong>登录方式</strong>
          <p style={helperTextStyle}>当前使用账号密码登录；邀请码只在注册时填写，注册成功后不再用于登录。</p>
          <p style={helperTextStyle}>账号编号：{user?.user_no ?? '—'}</p>
          <p style={helperTextStyle}>绑定手机号：{user?.mobile ?? '当前未提供'}</p>
          <div style={buttonRowStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={() => navigate('/profile/account')}>
              编辑个人资料
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={() => navigate('/profile/settings')}>
              隐私设置
            </button>
          </div>
        </div>
      </Panel>
      <Panel>
        <div style={rowStyle}>
          <strong>安全建议</strong>
          <p style={helperTextStyle}>请不要把账号密码、家庭邀请码或孩子影像资料发送给无关人员。</p>
          <p style={helperTextStyle}>如果家人需要加入家庭，请在家庭页生成新的邀请码，并按只读或可编辑角色授权。</p>
        </div>
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
    <PageShell title="帮助与反馈" description="查看常见问题，并提交当前设备上的反馈记录。" backTo="/profile">
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
      '监护人可以申请更正或删除儿童档案、成长记录和媒体内容；正式上线前应补齐儿童信息保护负责人和投诉渠道。',
    ],
  },
];

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
