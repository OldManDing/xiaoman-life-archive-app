import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookHeart, Camera, CheckCircle2, ChevronRight, CreditCard, DownloadCloud, FileBox, FileText, Globe, HelpCircle, Info, KeyRound, Lock, LogOut, Mail, RefreshCw, Shield, ShieldCheck, Smartphone, Users } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { ArchiveExportRequestItem, RecordSummary } from '../shared/api/types';
import { useAsyncData, useStoredMediaUrl } from '../shared/hooks';
import { membershipTypeLabel } from '../shared/labels';
import { createPersistableAvatarPreview, resolveMediaPreviewUrl, saveLocalMediaPreview, saveRuntimeMediaPreview, toStoredMediaReference } from '../shared/localMediaPreview';
import { loadLocalSettings, localSettingsToPreferences, preferencesToLocalSettings, saveLocalSettings, type LocalSettings } from '../shared/localSettings';
import { isSupportedImageFile, resolveFileMimeType, withResolvedFileMimeType } from '../shared/mediaFiles';
import { AppSelect, Field, PageShell, Panel, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, rowStyle } from './shared';
import { RefAvatar, RefListRow, RefSectionTitle, isReferencePlaceholderAvatar, refCardStyle, refPageStyle, refSoftCardStyle, referenceAssets } from './reference-ui';

const profileCardStyle = {
  background: 'var(--nl-surface)',
  border: '1px solid var(--nl-border)',
  borderRadius: '24px',
  boxShadow: 'var(--nl-shadow-sm)',
  overflow: 'hidden',
} as const;

const profileSectionStyle = {
  paddingLeft: '20px',
  paddingRight: '20px',
} as const;


const isPositiveStatusMessage = (message: string) => !/(失败|不能|请先|请至少|请输入|仅支持|无法|错误|暂时)/.test(message);

const uploadAvatarImage = async (childNo: string, file: File, previewUrl?: string | null) => {
  const uploadFile = withResolvedFileMimeType(file);
  const uploadToken = await webApi.createUploadToken({
    child_no: childNo,
    file_name: uploadFile.name,
    mime_type: resolveFileMimeType(uploadFile) || uploadFile.type,
    size_bytes: uploadFile.size,
    media_type: 'image',
  });

  if (previewUrl) saveRuntimeMediaPreview(uploadToken.media_no, previewUrl);

  if (!uploadToken.mock_upload) {
    const uploadResponse = await fetch(uploadToken.upload_url, {
      method: uploadToken.method,
      headers: uploadToken.headers,
      body: uploadFile,
    });
    if (!uploadResponse.ok) {
      throw new Error(`头像上传失败：HTTP ${uploadResponse.status}`);
    }
  }
  await webApi.confirmUpload({ media_no: uploadToken.media_no });
  try {
    const preview = await createPersistableAvatarPreview(uploadFile);
    if (preview) {
      saveLocalMediaPreview(uploadToken.media_no, preview);
      saveRuntimeMediaPreview(uploadToken.media_no, preview);
    }
  } catch {
    // The runtime blob preview still keeps the avatar visible in the current app session.
  }
  return toStoredMediaReference(uploadToken.media_no);
};

const ProfileAvatar = ({ src, label, fallbackSrc = referenceAssets.momAvatar }: { src?: string | null; label: string; fallbackSrc?: string }) => {
  const resolvedSrc = useStoredMediaUrl(src && !isReferencePlaceholderAvatar(src) ? src : null);
  const displaySrc = resolvedSrc && !isReferencePlaceholderAvatar(resolvedSrc) ? resolvedSrc : fallbackSrc;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [displaySrc]);

  if (displaySrc && failedSrc !== displaySrc) {
    return <img src={displaySrc} alt={label} decoding="async" onError={() => setFailedSrc(displaySrc)} style={{ width: '68px', height: '68px', borderRadius: '999px', objectFit: 'cover', border: '1px solid var(--nl-border)', background: 'linear-gradient(135deg, rgba(var(--nl-primary-rgb),0.22), rgba(var(--nl-accent-rgb),0.12)), var(--nl-surface-soft)', boxShadow: '0 14px 32px rgba(var(--nl-shadow-rgb),0.32)', flexShrink: 0 }} />;
  }

  return (
    <div
      style={{
        width: '68px',
        height: '68px',
        borderRadius: '999px',
        background: 'linear-gradient(135deg, rgba(var(--nl-primary-rgb),0.22), rgba(var(--nl-accent-rgb),0.12)), var(--nl-surface-soft)',
        border: '1px solid var(--nl-border)',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        color: 'var(--nl-ink)',
        boxShadow: '0 14px 32px rgba(var(--nl-shadow-rgb),0.28)',
        flexShrink: 0,
      }}
    >
      {label.slice(0, 1) || '我'}
    </div>
  );
};

const SmallChildAvatar = ({ src, label }: { src?: string | null; label: string }) => {
  const resolvedSrc = useStoredMediaUrl(src && !isReferencePlaceholderAvatar(src) ? src : null);
  const displaySrc = resolvedSrc && !isReferencePlaceholderAvatar(resolvedSrc) ? resolvedSrc : referenceAssets.childAvatar;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [displaySrc]);

  if (displaySrc && failedSrc !== displaySrc) {
    return <img src={displaySrc} alt={label} decoding="async" onError={() => setFailedSrc(displaySrc)} style={{ width: '38px', height: '38px', borderRadius: '999px', objectFit: 'cover', border: '1px solid var(--nl-border)', background: 'linear-gradient(135deg, rgba(var(--nl-primary-rgb),0.22), rgba(var(--nl-accent-rgb),0.12)), var(--nl-surface-soft)', flexShrink: 0 }} />;
  }

  return (
    <div style={{ width: '38px', height: '38px', borderRadius: '999px', border: '1px solid var(--nl-border)', background: 'linear-gradient(135deg, rgba(var(--nl-primary-rgb),0.22), rgba(var(--nl-accent-rgb),0.12)), var(--nl-surface-soft)', display: 'grid', placeItems: 'center', color: 'var(--nl-muted-strong)', fontWeight: 700, flexShrink: 0 }}>
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
      borderBottom: '1px solid var(--nl-border)',
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
      <div style={{ width: '36px', height: '36px', borderRadius: '999px', background: 'rgba(var(--nl-accent-rgb),0.14)', border: '1px solid var(--nl-border)', display: 'grid', placeItems: 'center', color: 'var(--nl-accent)', flexShrink: 0 }}>
        <Icon size={19} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--nl-ink)' }}>{title}</span>
          {badge ? <span style={{ fontSize: '11px', color: 'var(--nl-muted)', fontWeight: 700 }}>{badge}</span> : null}
        </div>
        {description ? <p style={{ ...helperTextStyle, marginTop: '3px', lineHeight: 1.5 }}>{description}</p> : null}
      </div>
    </div>
    {!disabled || onClick ? <ChevronRight size={18} color="var(--nl-muted)" strokeWidth={2} /> : null}
  </button>
);

const ProfileQuickAction = ({
  title,
  description,
  icon: Icon,
  tone = 'neutral',
  onClick,
}: {
  title: string;
  description: string;
  icon: typeof BookHeart;
  tone?: 'neutral' | 'warm' | 'green' | 'blue';
  onClick: () => void;
}) => {
  const toneStyles = {
    neutral: { background: 'rgba(var(--nl-surface-rgb),0.72)', color: 'var(--nl-muted-strong)', iconBg: 'rgba(var(--nl-accent-rgb),0.12)', border: 'var(--nl-border)' },
    warm: { background: 'rgba(var(--nl-primary-rgb),0.12)', color: 'var(--nl-primary-2)', iconBg: 'rgba(var(--nl-primary-rgb),0.16)', border: 'rgba(var(--nl-primary-rgb),0.24)' },
    green: { background: 'rgba(var(--nl-success-rgb),0.12)', color: 'var(--nl-success)', iconBg: 'rgba(var(--nl-success-rgb),0.16)', border: 'rgba(var(--nl-success-rgb),0.22)' },
    blue: { background: 'rgba(var(--nl-accent-rgb),0.12)', color: 'var(--nl-accent)', iconBg: 'rgba(var(--nl-accent-rgb),0.16)', border: 'rgba(var(--nl-accent-rgb),0.22)' },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: '104px',
        borderRadius: '20px',
        border: `1px solid ${toneStyles.border}`,
        background: toneStyles.background,
        color: 'var(--nl-ink)',
        padding: '14px',
        display: 'grid',
        alignContent: 'space-between',
        gap: '12px',
        textAlign: 'left',
        boxShadow: 'var(--nl-shadow-sm)',
        cursor: 'pointer',
      }}
    >
      <span style={{ width: '34px', height: '34px', borderRadius: '999px', background: toneStyles.iconBg, color: toneStyles.color, display: 'grid', placeItems: 'center' }}>
        <Icon size={18} strokeWidth={2.1} />
      </span>
      <span style={{ display: 'grid', gap: '4px' }}>
        <strong style={{ fontSize: '14px', fontWeight: 800, color: 'var(--nl-ink)', lineHeight: 1.2 }}>{title}</strong>
        <span style={{ fontSize: '12px', lineHeight: 1.45, color: 'var(--nl-muted-strong)', fontWeight: 600 }}>{description}</span>
      </span>
    </button>
  );
};

const settingsRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '14px',
  padding: '14px 0',
  borderBottom: '1px solid var(--nl-border)',
} as const;

const toggleButtonStyle = (enabled: boolean) =>
  ({
    minWidth: '58px',
    minHeight: '44px',
    border: '1px solid var(--nl-border)',
    borderRadius: '999px',
    padding: '4px',
    background: enabled ? 'linear-gradient(135deg, var(--nl-primary), var(--nl-primary-2))' : 'rgba(var(--nl-surface-rgb),0.74)',
    boxShadow: enabled ? '0 10px 24px rgba(var(--nl-primary-rgb),0.28)' : 'inset 0 1px 0 rgba(216,220,255,0.06)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: enabled ? 'flex-end' : 'flex-start',
  }) as const;

const toggleKnobStyle = {
  width: '22px',
  height: '22px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, rgba(248,249,255,0.96), rgba(216,220,255,0.86))',
  boxShadow: '0 1px 4px rgba(var(--nl-shadow-rgb),0.28)',
} as const;

const toMonthKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const archiveExportPurposeText = (value: ArchiveExportRequestItem['purpose']) =>
  value === 'adult_handoff' ? '成年移交' : '档案打包';

const archiveExportTypeText = (value: ArchiveExportRequestItem['export_type']) => {
  if (value === 'media') return '仅媒体';
  if (value === 'text') return '仅文字';
  return '全部数据';
};

const archiveExportStatusText = (value: ArchiveExportRequestItem['status']) => {
  if (value === 'processing') return '处理中';
  if (value === 'completed') return '已完成';
  if (value === 'rejected') return '已驳回';
  return '待处理';
};

const archiveExportStatusColor = (value: ArchiveExportRequestItem['status']) => {
  if (value === 'completed') return 'var(--nl-success)';
  if (value === 'rejected') return 'var(--nl-danger)';
  if (value === 'processing') return 'var(--nl-primary-2)';
  return 'var(--nl-muted)';
};

const formatProfileDateTime = (value: string | null) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—');

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
    <div style={refPageStyle}>
      <section style={{ background: 'linear-gradient(135deg, rgba(var(--nl-surface-strong-rgb),0.96), rgba(var(--nl-primary-rgb),0.16) 62%, rgba(var(--nl-surface-strong-rgb),0.92))', padding: 'calc(30px + env(safe-area-inset-top)) 20px 18px', borderBottom: '1px solid var(--nl-border)', borderRadius: '0 0 24px 24px', boxShadow: 'var(--nl-shadow-sm)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'center' }}>
          <RefAvatar src={user?.avatar_url && !isReferencePlaceholderAvatar(user.avatar_url) ? user.avatar_url : referenceAssets.momAvatar} label={user?.nickname ?? '我的头像'} size={54} />
          <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: 20, lineHeight: 1.1, fontWeight: 950 }}>{user?.nickname ?? '未登录用户'}</strong>
              <span style={{ color: 'var(--nl-accent)', background: 'rgba(var(--nl-accent-rgb),0.14)', border: '1px solid var(--nl-border)', borderRadius: '999px', padding: '3px 9px', fontSize: 11, fontWeight: 900 }}>{membershipTypeLabel(user?.membership_type)}</span>
            </div>
            <span style={{ color: 'var(--nl-muted)', fontSize: 12, fontWeight: 700 }}>当前档案：{activeChild?.name ?? '未选择孩子'}</span>
          </div>
          <button type="button" onClick={() => navigate('/profile/account')} style={{ ...secondaryButtonStyle, minHeight: 36, padding: '7px 12px', fontSize: 12 }}>编辑主页</button>
        </div>
      </section>

      <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, padding: '10px 20px calc(168px + env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={() => navigate(latestDraft ? `/record/${latestDraft.record_no}/edit` : '/record/create')} style={{ ...refSoftCardStyle, width: '100%', minHeight: 54, padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <FileBox size={20} color="var(--nl-primary)" />
            <span style={{ color: 'var(--nl-ink)', fontSize: 15, fontWeight: 900 }}>草稿箱</span>
          </span>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: 'var(--nl-muted)', fontSize: 13, fontWeight: 750 }}>
            {latestDraft ? `${draftRecords?.length ?? 1} 条待完善记录` : '暂无草稿'}
            <ChevronRight size={17} color="var(--nl-muted)" />
          </span>
        </button>

        <section>
          <RefSectionTitle>我的孩子</RefSectionTitle>
          <div style={{ ...refSoftCardStyle, padding: 0, overflow: 'hidden' }}>
            <button type="button" onClick={() => navigate('/family/child')} style={{ width: '100%', minHeight: 60, border: 'none', borderBottom: '1px solid var(--nl-border)', background: 'rgba(var(--nl-surface-rgb),0.72)', padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ display: 'flex', gap: 13, alignItems: 'center', minWidth: 0 }}>
                <RefAvatar
                  src={activeChild?.avatar_url && !isReferencePlaceholderAvatar(activeChild.avatar_url) ? activeChild.avatar_url : referenceAssets.childAvatar}
                  label={activeChild?.name ?? '孩子'}
                  size={36}
                  fallbackSrc={referenceAssets.childAvatar}
                />
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', color: 'var(--nl-ink)', fontSize: 15, fontWeight: 900 }}>{activeChild?.name ?? '孩子资料'}</strong>
                  <span style={{ display: 'block', marginTop: 3, color: 'var(--nl-muted)', fontSize: 12, fontWeight: 700 }}>{activeChild?.current_age_display ?? '查看和维护孩子的基础资料'}</span>
                </span>
              </span>
              <ChevronRight size={18} color="var(--nl-muted)" />
            </button>
            <button type="button" onClick={() => navigate('/onboarding/child?mode=add')} style={{ margin: '8px 13px 12px', width: 'calc(100% - 26px)', minHeight: 42, borderRadius: 15, border: '1px dashed rgba(var(--nl-accent-rgb),0.28)', background: 'rgba(var(--nl-primary-rgb),0.12)', color: 'var(--nl-accent)', fontSize: 13, fontWeight: 850, cursor: 'pointer' }}>+ 添加宝宝</button>
          </div>
        </section>

        <section>
          <RefSectionTitle>管理中心</RefSectionTitle>
          <div style={{ ...refCardStyle, borderRadius: 22, overflow: 'hidden' }}>
            <RefListRow icon={<BookHeart size={22} />} title="月报与纪念册" onClick={() => navigate('/profile/reports')} />
            <RefListRow icon={<DownloadCloud size={22} />} title="导出与备份" onClick={() => navigate('/profile/export')} />
            <RefListRow icon={<CreditCard size={22} />} title="会员中心" onClick={() => navigate('/profile/membership')} />
            <RefListRow icon={<ShieldCheck size={22} />} title="隐私设置" onClick={() => navigate('/profile/settings')} isLast />
          </div>
        </section>

        <section style={{ paddingTop: 20 }}>
          <RefSectionTitle>设置区</RefSectionTitle>
          <div style={{ ...refCardStyle, borderRadius: 22, overflow: 'hidden' }}>
            <RefListRow icon={<Lock size={22} />} title="账号与安全" onClick={() => navigate('/profile/security')} />
            <RefListRow icon={<Users size={22} />} title="家庭管理" onClick={() => navigate('/family/members')} />
            <RefListRow icon={<HelpCircle size={22} />} title="帮助与反馈" onClick={() => navigate('/profile/help')} />
            <RefListRow icon={<Info size={22} />} title="关于我们" onClick={() => navigate('/profile/about')} isLast />
          </div>
          <button
            type="button"
            style={{ ...refSoftCardStyle, width: '100%', marginTop: 16, minHeight: 52, border: '1px solid rgba(255,107,139,0.24)', color: 'var(--nl-danger)', fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
            onClick={async () => {
              await logout();
              navigate('/auth/login', { replace: true });
            }}
          >
            <LogOut size={18} strokeWidth={2.4} />
            退出登录
          </button>
        </section>
      </main>
    </div>
  );
};

export const AccountPage = () => {
  const { user, activeChild, setUserProfile } = useAuth();
  const settings = loadLocalSettings();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const displayMobile = settings.hideMobileMask ? '已隐藏' : user?.mobile ?? '当前未提供';

  useEffect(() => {
    setNickname(user?.nickname ?? '');
  }, [user?.nickname]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

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
    if (!isSupportedImageFile(file)) {
      setMessage('头像仅支持 JPG、PNG、WebP、HEIC 图片');
      return;
    }

    const uploadFile = withResolvedFileMimeType(file);
    const previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(uploadFile) : null;
    setAvatarPreviewUrl(previewUrl);
    setAvatarUploading(true);
    setMessage('头像本地预览已显示，正在保存到账号…');
    try {
      const avatarUrl = await uploadAvatarImage(activeChild.child_no, uploadFile, previewUrl);
      const nextProfile = await webApi.updateMe({ avatar_url: avatarUrl });
      setUserProfile({ ...nextProfile, avatar_url: avatarUrl });
      setAvatarPreviewUrl(null);
      setMessage('头像已更新');
    } catch (err) {
      setAvatarPreviewUrl(null);
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
            <ProfileAvatar src={avatarPreviewUrl ?? user?.avatar_url} label={user?.nickname ?? '我的头像'} />
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
          {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
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
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    void webApi
      .preferences()
      .then((preferences) => {
        if (!active) return;
        const next = preferencesToLocalSettings(preferences);
        setSettings(next);
        saveLocalSettings(next);
      })
      .catch(() => {
        if (active) setMessage('当前使用本机隐私设置，联网后可同步到账号。');
      });

    return () => {
      active = false;
    };
  }, []);

  const updateSetting = async (key: keyof LocalSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveLocalSettings(next);
    setSyncing(true);
    setMessage('设置已保存在本机，正在同步账号。');

    try {
      const synced = await webApi.updatePreferences(localSettingsToPreferences(next));
      const syncedSettings = preferencesToLocalSettings(synced);
      setSettings(syncedSettings);
      saveLocalSettings(syncedSettings);
      setMessage('设置已同步到账号。');
    } catch {
      setMessage('设置已保存在本机，服务器同步稍后可重试。');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <PageShell title="隐私设置" backTo="/profile">
      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setMessage('当前默认仅家庭成员可见。')}
          style={{ ...settingsRowStyle, width: '100%', border: 'none', borderBottom: '1px solid var(--nl-border)', background: 'rgba(var(--nl-surface-rgb),0.72)', padding: '17px 18px', textAlign: 'left', cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <ShieldCheck size={18} color="var(--nl-accent)" />
            <span style={{ color: 'var(--nl-muted-strong)', fontSize: '14px', fontWeight: 700 }}>默认谁可以看到您的记录</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 700 }}>
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
                <Icon size={18} color="var(--nl-accent)" />
                <strong style={{ display: 'block', color: 'var(--nl-muted-strong)', fontSize: '14px' }}>{item.title}</strong>
              </div>
              <button type="button" aria-label={item.title} aria-pressed={enabled} style={toggleButtonStyle(enabled)} onClick={() => void updateSetting(item.key)} disabled={syncing}>
                <span style={toggleKnobStyle} />
              </button>
            </div>
          );
        })}
      </Panel>
      <p style={{ ...helperTextStyle, lineHeight: 1.7 }}>我们尊重每个家庭对孩子影像和成长记录的保护习惯。新的访问规则会优先同步到账号，本机也会保留一份偏好用于离线和旧版本接口降级。</p>
      {message ? <p style={{ ...helperTextStyle, color: '#0f766e' }}>{message}</p> : null}
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
  const hasMonthlyRecords = monthlyRecords.length > 0;
  const latest = monthlyRecords[0];
  const monthlySummary = monthlyRecords.length
    ? `该月已经留下 ${monthlyRecords.length} 个成长瞬间。${milestoneCount ? `${milestoneCount} 个里程碑把关键变化标了出来，` : ''}${imageCount ? `${imageCount} 条影像让回忆有画面，` : ''}${textCount ? `${textCount} 条文字记录保留了当时的语气。` : '每一条记录都会进入孩子的长期档案。'}`
    : '该月还没有可生成月报的真实记录。添加记录后，这里会按实际内容整理故事摘要、里程碑和影像回顾。';

  const pastMonths = [2, 3, 4, 5].map((offset) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });

  return (
    <PageShell title="月报与纪念册" backTo="/profile">
      {loading ? <Panel><EmptyState message="正在整理月度记录…" /></Panel> : null}
      {error ? <Panel><EmptyState message={`月报加载失败：${error}`} /></Panel> : null}
      {!loading && !error ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
            <div>
              <p style={{ margin: 0, color: 'var(--nl-muted-strong)', fontSize: '14px', fontWeight: 700 }}>
                为 {activeChild?.name ?? '孩子'} 整理的
              </p>
              <p style={{ margin: '5px 0 0', color: 'var(--nl-muted)', fontSize: '13px', fontWeight: 600 }}>专属时光记忆和可导出的家庭资产</p>
            </div>
            <SmallChildAvatar src={activeChild?.avatar_url} label={activeChild?.name ?? '孩子'} />
          </div>
          <section
            style={{
              borderRadius: '28px',
              padding: '22px',
              position: 'relative',
              border: '1px solid var(--nl-border)',
              background: 'linear-gradient(135deg, rgba(var(--nl-surface-strong-rgb),0.96), rgba(var(--nl-surface-strong-rgb),0.9))',
              boxShadow: 'var(--nl-shadow-sm)',
              display: 'grid',
              gap: '16px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 42px', gap: '14px', alignItems: 'start' }}>
              <div>
                <span style={{ display: 'inline-flex', color: 'var(--nl-accent)', fontSize: '12px', fontWeight: 800, marginBottom: '8px' }}>最新月报</span>
                <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: '25px', fontWeight: 850, lineHeight: 1.16 }}>
                  {reportYear}年{reportMonth}月
                  <br />
                  成长月报
                </h2>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--nl-border)', background: 'rgba(var(--nl-accent-rgb),0.14)', color: 'var(--nl-accent)', display: 'grid', placeItems: 'center' }}>
                <BookHeart size={19} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {[
                { label: '记录数量', value: monthlyRecords.length },
                { label: '影像记录', value: imageCount },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: '16px', background: 'rgba(var(--nl-surface-rgb),0.72)', border: '1px solid var(--nl-border)', padding: '12px', textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: '19px', color: 'var(--nl-ink)', lineHeight: 1 }}>{item.value}</strong>
                  <span style={{ display: 'block', marginTop: '6px', color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 800 }}>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ borderRadius: '18px', background: 'rgba(var(--nl-primary-rgb),0.08)', border: '1px solid var(--nl-border)', padding: '14px', display: 'grid', gap: '8px' }}>
              <strong style={{ color: 'var(--nl-accent)', fontSize: '13px' }}>月度故事摘要</strong>
              <p style={{ ...helperTextStyle, lineHeight: 1.8 }}>{monthlySummary}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 48px', gap: '10px', alignItems: 'center' }}>
              <button type="button" style={{ ...primaryButtonStyle, width: '100%', minHeight: '44px' }} onClick={() => latest ? navigate(`/record/${latest.record_no}`) : navigate('/record/create')}>
                {hasMonthlyRecords ? '查看月报' : '添加记录'}
              </button>
              <button type="button" aria-label="导出月报摘要" title="导出月报摘要" style={{ ...secondaryButtonStyle, width: '48px', minWidth: '48px', minHeight: '48px', padding: 0, borderRadius: '999px', justifyContent: 'center' }} onClick={() => navigate('/profile/export')}>
                <DownloadCloud size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--nl-border)', paddingTop: '12px', display: 'grid', gap: '8px' }}>
              <strong style={{ color: 'var(--nl-accent)', fontSize: '13px' }}>AI 月报摘要</strong>
              <p style={{ ...helperTextStyle, lineHeight: 1.75 }}>
                {monthlyRecords.length
                  ? `该月共记录 ${monthlyRecords.length} 个成长瞬间，其中 ${milestoneCount} 个里程碑、${imageCount} 条影像记录、${textCount} 条文字记录。`
                  : '该月还没有真实记录，添加记录后会自动汇总为成长月报。'}
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
            <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 800, color: 'var(--nl-ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookHeart size={18} color="var(--nl-accent)" />
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
                    border: '1px solid var(--nl-border)',
                    background: index === pastMonths.length - 1 ? 'rgba(var(--nl-accent-rgb),0.12)' : 'rgba(var(--nl-surface-rgb),0.72)',
                    color: 'var(--nl-ink)',
                    padding: '14px',
                    display: 'grid',
                    alignContent: 'space-between',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate('/profile/export')}
                >
                  <strong style={{ fontSize: '15px', lineHeight: 1.25 }}>{item.year}年<br />{item.month}月纪念册</strong>
                  <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 700 }}>查看 / 导出</span>
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
                      <button key={item.record_no} type="button" onClick={() => navigate(`/record/${item.record_no}`)} style={{ border: 'none', padding: 0, background: 'var(--nl-surface-soft)', borderRadius: '14px', overflow: 'hidden', aspectRatio: '1 / 1', cursor: 'pointer' }}>
                        {cover && item.cover_media_type === 'video' ? <video src={cover} muted playsInline preload="none" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                        {cover && item.cover_media_type !== 'video' ? <img src={cover} alt={item.title ?? '纪念册影像'} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
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
                      <span style={{ color: 'var(--nl-muted)', fontSize: '12px' }}>{new Date(item.event_time).toLocaleString('zh-CN', { hour12: false })}</span>
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
  const [submittingArchiveRequest, setSubmittingArchiveRequest] = useState<'backup' | 'adult_handoff' | null>(null);
  const [downloadingSummary, setDownloadingSummary] = useState(false);
  const { data: records, loading, error } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 100 });
      return result.list;
    },
    [activeChild?.child_no],
  );
  const {
    data: archiveRequests,
    loading: archiveRequestsLoading,
    error: archiveRequestsError,
    setData: setArchiveRequests,
  } = useAsyncData<ArchiveExportRequestItem[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listArchiveExportRequests({ child_no: activeChild.child_no });
      return result.list;
    },
    [activeChild?.child_no],
  );
  const recordsList = records ?? [];
  const archiveRequestsList = archiveRequests ?? [];
  const canExportArchive = Boolean(activeChild && user && activeChild.owner_user_no === user.user_no);
  const milestoneCount = recordsList.filter((item) => item.is_milestone).length;
  const mediaCount = recordsList.filter((item) => item.cover_url).length;

  const downloadSummary = async () => {
    if (!activeChild) {
      setMessage('请先选择孩子档案后再下载摘要');
      return;
    }

    setDownloadingSummary(true);
    setMessage(null);
    try {
      const result = await webApi.archiveExportSummary({ child_no: activeChild.child_no });
      const blob = new Blob([result.content], { type: result.mime_type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.file_name;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage(`档案摘要已生成：${result.summary.record_count} 条记录、${result.summary.media_count} 个媒体，并已写入审计日志。`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '档案摘要生成失败，请稍后再试');
    } finally {
      setDownloadingSummary(false);
    }
  };

  const submitArchiveRequest = async (purpose: 'backup' | 'adult_handoff') => {
    if (!activeChild) {
      setMessage('请先选择孩子档案后再提交导出申请');
      return;
    }

    setSubmittingArchiveRequest(purpose);
    setMessage(null);
    try {
      const result = await webApi.requestArchiveExport({
        child_no: activeChild.child_no,
        export_type: purpose === 'adult_handoff' ? 'all' : exportMode,
        purpose,
        note:
          purpose === 'adult_handoff'
            ? '用户从导出与备份页发起成年移交准备'
            : '用户从导出与备份页发起云端档案打包',
      });
      const nextRequest: ArchiveExportRequestItem = {
        request_no: result.request_no,
        child_no: result.summary.child_no,
        child_name: result.summary.child_name,
        export_type: result.summary.export_type,
        purpose: result.summary.purpose,
        status: result.status,
        record_count: result.summary.record_count,
        milestone_count: result.summary.milestone_count,
        media_count: result.summary.media_count,
        first_record_time: result.summary.first_record_time,
        latest_record_time: result.summary.latest_record_time,
        processed_at: null,
        process_note: null,
        created_at: result.created_at,
        updated_at: result.created_at,
      };
      setArchiveRequests((current) => [nextRequest, ...(current ?? []).filter((item) => item.request_no !== nextRequest.request_no)].slice(0, 10));
      setMessage(`${result.message} 当前快照：${result.summary.record_count} 条记录、${result.summary.media_count} 个媒体、${result.summary.milestone_count} 个里程碑。`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '导出申请提交失败，请稍后再试');
    } finally {
      setSubmittingArchiveRequest(null);
    }
  };

  const exportOptions = [
    { value: 'all' as const, title: '全部数据（推荐）', description: '包含所有文字记录、高清图片和视频文件' },
    { value: 'media' as const, title: '仅图片和视频', description: '只导出媒体文件，适合节省空间' },
    { value: 'text' as const, title: '仅文字记录', description: '导出为 TXT/PDF 格式的纯文字日记' },
  ];
  const archiveRequestDisabled = !canExportArchive || Boolean(submittingArchiveRequest);

  return (
    <PageShell title="导出与备份" backTo="/profile">
      <Panel style={{ textAlign: 'center', padding: '26px 20px', borderRadius: '18px', boxShadow: 'var(--nl-shadow-sm)' }}>
        <div style={{ width: '54px', height: '54px', borderRadius: '999px', background: 'rgba(var(--nl-accent-rgb),0.14)', color: 'var(--nl-accent)', display: 'grid', placeItems: 'center', margin: '0 auto 15px' }}>
          <DownloadCloud size={23} strokeWidth={2.2} />
        </div>
        <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: '17px', fontWeight: 800 }}>一键备份数字资产</h2>
        <p style={{ ...helperTextStyle, margin: '9px auto 0', maxWidth: '280px', lineHeight: 1.65 }}>将您在应用中记录的所有照片、视频和文字日志打包下载，永久保存在您的私人设备中。</p>
      </Panel>

      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 800, color: 'var(--nl-ink)' }}>选择导出内容</h2>
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
                  border: selected ? '1.5px solid var(--nl-primary)' : '1px solid var(--nl-border)',
                  background: selected ? 'rgba(var(--nl-accent-rgb),0.14)' : 'rgba(var(--nl-surface-rgb),0.72)',
                  minHeight: '68px',
                  padding: '13px 15px',
                  display: 'grid',
                  gridTemplateColumns: '36px minmax(0, 1fr) 22px',
                  gap: '12px',
                  alignItems: 'center',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: selected ? '0 14px 30px rgba(var(--nl-primary-rgb),0.24)' : 'var(--nl-shadow-sm)',
                }}
              >
                <span style={{ width: '36px', height: '36px', borderRadius: '999px', background: selected ? 'linear-gradient(135deg, var(--nl-primary), var(--nl-primary-2))' : 'rgba(var(--nl-accent-rgb),0.12)', color: selected ? '#ffffff' : 'var(--nl-muted)', display: 'grid', placeItems: 'center' }}>
                  <FileBox size={17} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 800 }}>{item.title}</strong>
                  <span style={{ display: 'block', marginTop: '4px', color: 'var(--nl-muted)', fontSize: '12px', lineHeight: 1.45 }}>{item.description}</span>
                </span>
                {selected ? <CheckCircle2 size={20} color="var(--nl-accent)" strokeWidth={2.4} /> : <span style={{ width: '18px', height: '18px', borderRadius: '999px', border: '1px solid var(--nl-border)', background: 'rgba(255,255,255,0.04)' }} />}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? <EmptyState message="正在整理档案摘要…" /> : null}
      {error ? <EmptyState message={`摘要整理失败：${error}`} /> : null}

      <Panel style={{ display: 'grid', gap: '12px', borderRadius: '18px', boxShadow: 'var(--nl-shadow-sm)' }}>
        <div style={{ display: 'grid', gap: '6px' }}>
          <strong style={{ color: 'var(--nl-ink)', fontSize: '15px' }}>长期交付留痕</strong>
          <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.65 }}>
            需要云端完整打包或为孩子成年后的档案移交做准备时，先提交申请并写入后台审计，运营可按身份核验和档案完整性流程继续处理。
          </p>
          <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.65, color: canExportArchive ? 'var(--nl-success)' : 'var(--nl-primary-2)' }}>
            {canExportArchive ? '当前账号为家庭管理员，可发起正式导出与交付申请。' : '为保护家庭档案，首版仅家庭管理员可导出或发起交付申请。'}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: '10px' }}>
          <button
            type="button"
            style={{ ...secondaryButtonStyle, minHeight: '46px', borderRadius: '999px', justifyContent: 'center' }}
            onClick={() => void submitArchiveRequest('backup')}
            disabled={archiveRequestDisabled}
          >
            {submittingArchiveRequest === 'backup' ? '提交中…' : '提交打包申请'}
          </button>
          <button
            type="button"
            style={{ ...secondaryButtonStyle, minHeight: '46px', borderRadius: '999px', justifyContent: 'center' }}
            onClick={() => void submitArchiveRequest('adult_handoff')}
            disabled={archiveRequestDisabled}
          >
            {submittingArchiveRequest === 'adult_handoff' ? '提交中…' : '成年移交准备'}
          </button>
        </div>
        <div style={{ display: 'grid', gap: '10px', paddingTop: '2px' }}>
          <strong style={{ color: 'var(--nl-ink)', fontSize: '14px' }}>最近申请</strong>
          {archiveRequestsLoading ? <p style={{ ...helperTextStyle, margin: 0 }}>正在读取最近交付申请…</p> : null}
      {archiveRequestsError ? <p style={{ ...helperTextStyle, margin: 0, color: 'var(--nl-danger)' }}>最近申请读取失败：{archiveRequestsError}</p> : null}
          {!archiveRequestsLoading && !archiveRequestsError && archiveRequestsList.length === 0 ? (
            <p style={{ ...helperTextStyle, margin: 0 }}>暂无交付申请。提交后可在这里查看处理状态。</p>
          ) : null}
          {archiveRequestsList.map((item) => (
            <div
              key={item.request_no}
              style={{
                border: '1px solid var(--nl-border)',
                borderRadius: '16px',
                padding: '12px',
                display: 'grid',
                gap: '8px',
                background: 'rgba(var(--nl-surface-rgb),0.72)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', lineHeight: 1.35 }}>
                  {archiveExportPurposeText(item.purpose)} · {archiveExportTypeText(item.export_type)}
                </strong>
                <span style={{ color: archiveExportStatusColor(item.status), fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {archiveExportStatusText(item.status)}
                </span>
              </div>
              <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.6 }}>
                {item.record_count} 条记录、{item.media_count} 个媒体、{item.milestone_count} 个里程碑 · {formatProfileDateTime(item.created_at)}
              </p>
              {item.process_note ? <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.6 }}>处理备注：{item.process_note}</p> : null}
            </div>
          ))}
        </div>
      </Panel>

        {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
      <button type="button" style={{ ...primaryButtonStyle, width: '100%', minHeight: '50px', borderRadius: '999px' }} onClick={() => void downloadSummary()} disabled={loading || downloadingSummary || Boolean(error) || !canExportArchive}>
        {downloadingSummary ? '正在生成摘要…' : '下载审计留痕摘要'}
      </button>
    </PageShell>
  );
};

export const MembershipPage = () => {
  const navigate = useNavigate();
  const { user, setUserProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [requestingBook, setRequestingBook] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showBookHelpFallback, setShowBookHelpFallback] = useState(false);
  const membershipType = user?.membership_type ?? 'free';
  const hasBookBenefit = ['premium', 'family', 'family_member', 'ai_plus'].includes(membershipType);
  const membershipBadge = hasBookBenefit ? (membershipType === 'ai_plus' ? 'AI PLUS' : membershipType === 'premium' ? 'VIP PRO' : 'FAMILY') : 'BASIC';
  const membershipBookText = hasBookBenefit
    ? '作为高级会员，您每年可申领一本由专业排版生成的成长纪念册，将数字记忆变成可保存的家庭资产。'
    : '当前账号为基础会员，成长纪念册申领需要先确认会员权益。您可以提交咨询，客服核对后会联系您。';
  const membershipMessageIsError = message ? /失败|无法|暂时|错误/.test(message) : false;

  const refreshMembership = async () => {
    setRefreshing(true);
    setMessage(null);
    setShowBookHelpFallback(false);
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

  const requestMembershipBook = async () => {
    setRequestingBook(true);
    setMessage(null);
    setShowBookHelpFallback(false);
    try {
      const result = await webApi.requestMembershipBook({
        year: new Date().getFullYear(),
        contact: user?.mobile ?? undefined,
      });
      setMessage(result.message);
    } catch {
      setMessage('申领暂时无法同步服务器，请通过帮助与反馈提交申请。');
      setShowBookHelpFallback(true);
    } finally {
      setRequestingBook(false);
    }
  };

  return (
    <PageShell title="会员中心" backTo="/profile">
      <section style={{ borderRadius: '24px', border: '1px solid var(--nl-border)', background: 'linear-gradient(135deg, rgba(var(--nl-surface-strong-rgb),0.96), rgba(var(--nl-surface-strong-rgb),0.9))', padding: '18px', minHeight: '142px', color: 'var(--nl-ink)', display: 'grid', gap: '14px', boxShadow: 'var(--nl-shadow-sm)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', right: '0', top: '-34px', width: '104px', height: '104px', borderRadius: '999px', border: '22px solid rgba(var(--nl-accent-rgb),0.08)', boxSizing: 'border-box' }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
            <ProfileAvatar src={user?.avatar_url} label={user?.nickname ?? '会员'} />
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '17px', fontWeight: 800 }}>{user?.nickname ?? '年轮会员'}</strong>
              <span style={{ display: 'block', marginTop: '5px', color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 700 }}>{membershipTypeLabel(user?.membership_type)}</span>
            </div>
          </div>
          <span style={{ borderRadius: '999px', background: hasBookBenefit ? 'rgba(var(--nl-primary-rgb),0.18)' : 'rgba(var(--nl-surface-rgb),0.74)', color: hasBookBenefit ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)', border: hasBookBenefit ? '1px solid rgba(var(--nl-primary-rgb),0.3)' : '1px solid var(--nl-border)', padding: '6px 10px', fontSize: '10px', fontWeight: 900 }}>{membershipBadge}</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '12px' }}>
          <p style={{ margin: 0, color: 'var(--nl-muted)', fontSize: '12px', lineHeight: 1.6 }}>
            到期时间：{user?.membership_expire_at ? new Date(user.membership_expire_at).toLocaleDateString('zh-CN') : '长期有效'}
          </p>
          <button type="button" style={{ ...secondaryButtonStyle, minHeight: '44px', padding: '8px 12px', background: 'rgba(var(--nl-surface-rgb),0.74)', color: 'var(--nl-ink)', boxShadow: 'none', fontSize: '12px' }} onClick={() => void refreshMembership()} disabled={refreshing}>
            {refreshing ? '刷新中' : '刷新会员信息'}
          </button>
        </div>
      </section>

      <section>
        <h2 style={{ margin: '0 0 12px 2px', fontSize: '14px', fontWeight: 800, color: 'var(--nl-ink)' }}>您的专属特权</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
          {[
            { icon: DownloadCloud, title: '高清画质下载', desc: '大容量媒体备份' },
            { icon: BookHeart, title: '精美时光月报', desc: '每月自动生成' },
            { icon: ShieldCheck, title: '云端安全加密', desc: '保存敏感资产' },
            { icon: CreditCard, title: '家庭人数无限', desc: '邀请亲友一起记录' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} style={{ borderRadius: '16px', border: '1px solid var(--nl-border)', background: 'rgba(var(--nl-surface-rgb),0.72)', padding: '14px', display: 'grid', gap: '10px', boxShadow: 'var(--nl-shadow-sm)' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '999px', background: 'rgba(var(--nl-accent-rgb),0.14)', color: 'var(--nl-accent)', display: 'grid', placeItems: 'center' }}>
                  <Icon size={15} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: 'var(--nl-ink)' }}>{item.title}</strong>
                  <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--nl-muted)', lineHeight: 1.4 }}>{item.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Panel style={{ borderRadius: '18px', boxShadow: 'var(--nl-shadow-sm)' }}>
        <div style={rowStyle}>
          <strong>成长纪念册</strong>
          <p style={{ ...helperTextStyle, lineHeight: 1.75 }}>{membershipBookText}</p>
          {message ? <p style={{ ...helperTextStyle, color: membershipMessageIsError ? 'var(--nl-danger)' : 'var(--nl-success)' }}>{message}</p> : null}
          <button
            type="button"
            style={{ ...primaryButtonStyle, width: '100%', borderRadius: '18px' }}
            onClick={() => hasBookBenefit ? void requestMembershipBook() : navigate('/profile/help?topic=membership')}
            disabled={refreshing || requestingBook}
          >
            {requestingBook ? '提交中…' : hasBookBenefit ? '免费申领本年度纪念册' : '咨询会员权益'}
          </button>
          {showBookHelpFallback ? (
            <button
              type="button"
              style={{ ...secondaryButtonStyle, width: '100%', borderRadius: '18px', justifyContent: 'center' }}
              onClick={() => navigate('/profile/help?topic=membership')}
            >
              打开帮助与反馈
            </button>
          ) : null}
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
    { title: '第三方账号绑定', value: '暂未接入', icon: ShieldCheck, onClick: () => navigate('/profile/account') },
  ];

  return (
    <PageShell title="账号与安全" backTo="/profile">
      <Panel style={{ padding: 0, overflow: 'hidden', borderRadius: '18px', boxShadow: 'var(--nl-shadow-sm)' }}>
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
              borderBottom: index === rows.length - 1 ? 'none' : '1px solid var(--nl-border)',
              background: 'rgba(var(--nl-surface-rgb),0.72)',
              padding: '0 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--nl-muted-strong)', fontSize: '14px', fontWeight: 700 }}>
              <Icon size={17} color="var(--nl-accent)" strokeWidth={2} />
              {item.title}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--nl-muted)', fontSize: '13px', fontWeight: 700 }}>
              {item.value}
              <ChevronRight size={16} color="var(--nl-muted)" />
            </span>
          </button>
          );
        })}
      </Panel>
      <button type="button" onClick={() => navigate('/profile/account-delete')} style={{ ...secondaryButtonStyle, width: '100%', color: '#ef4444', justifyContent: 'center', minHeight: '48px', marginTop: '10px', borderRadius: '18px' }}>
        注销账号
      </button>
    </PageShell>
  );
};

export const AccountDeletionPage = () => {
  const navigate = useNavigate();
  const { clearSession } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [check, setCheck] = useState<{
    can_delete: boolean;
    requires_password: boolean;
    confirm_text: string;
    blockers: string[];
    summary: {
      owned_family_count: number;
      joined_family_count: number;
      active_child_count: number;
      active_record_count: number;
    };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const result = await webApi.deletionCheck();
        if (!cancelled) {
          setCheck(result);
          setMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : '暂时无法读取注销条件，请稍后再试');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!check) return;
    const normalizedPassword = password.trim();
    const normalizedConfirmText = confirmText.trim();
    if (!check.can_delete) {
      setMessage(check.blockers[0] ?? '当前账号暂时不能直接注销');
      return;
    }
    if (check.requires_password && !normalizedPassword) {
      setMessage('请输入当前登录密码');
      return;
    }
    if (check.requires_password && normalizedPassword.length < 8) {
      setMessage('登录密码至少 8 位');
      return;
    }
    if (normalizedConfirmText !== check.confirm_text) {
      setMessage(`请输入“${check.confirm_text}”后再继续`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await webApi.deleteMe({
        password: normalizedPassword,
        confirm_text: normalizedConfirmText,
      });
      setMessage(result.message);
      clearSession();
      navigate('/auth/login', { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '账号注销失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="注销账号" description="该操作会立即使当前账号失效，并按规则清理你名下的数据关系" backTo="/profile/security">
      <Panel>
        <div style={rowStyle}>
          <strong>注销前检查</strong>
          <p style={helperTextStyle}>为了保护家庭成员和儿童信息，系统会先检查你是否仍持有需要处理的家庭所有权。</p>
          {loading ? <p style={helperTextStyle}>正在检查当前账号状态…</p> : null}
          {!loading && check ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                <Panel style={{ padding: '14px 16px', borderRadius: '18px', boxShadow: 'none', background: 'rgba(var(--nl-surface-rgb),0.74)' }}>
                  <strong style={{ fontSize: '20px', color: 'var(--nl-ink)' }}>{check.summary.owned_family_count}</strong>
                  <p style={helperTextStyle}>你拥有的家庭</p>
                </Panel>
                <Panel style={{ padding: '14px 16px', borderRadius: '18px', boxShadow: 'none', background: 'rgba(var(--nl-surface-rgb),0.74)' }}>
                  <strong style={{ fontSize: '20px', color: 'var(--nl-ink)' }}>{check.summary.joined_family_count}</strong>
                  <p style={helperTextStyle}>你加入的家庭</p>
                </Panel>
                <Panel style={{ padding: '14px 16px', borderRadius: '18px', boxShadow: 'none', background: 'rgba(var(--nl-surface-rgb),0.74)' }}>
                  <strong style={{ fontSize: '20px', color: 'var(--nl-ink)' }}>{check.summary.active_child_count}</strong>
                  <p style={helperTextStyle}>你名下孩子档案</p>
                </Panel>
                <Panel style={{ padding: '14px 16px', borderRadius: '18px', boxShadow: 'none', background: 'rgba(var(--nl-surface-rgb),0.74)' }}>
                  <strong style={{ fontSize: '20px', color: 'var(--nl-ink)' }}>{check.summary.active_record_count}</strong>
                  <p style={helperTextStyle}>你创建的有效记录</p>
                </Panel>
              </div>
              {check.blockers.length ? (
                <div style={{ borderRadius: '18px', background: 'rgba(var(--nl-primary-rgb),0.12)', border: '1px solid rgba(var(--nl-primary-rgb),0.24)', padding: '14px 16px', color: 'var(--nl-primary-2)', display: 'grid', gap: '8px' }}>
                  <strong>当前还不能直接注销</strong>
                  {check.blockers.map((item) => (
                    <p key={item} style={{ margin: 0, fontSize: '13px', lineHeight: 1.6 }}>{item}</p>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginTop: '4px' }}>
                    <button type="button" style={{ ...secondaryButtonStyle, minHeight: '42px', borderRadius: '999px', boxShadow: 'none', color: 'var(--nl-primary-2)' }} onClick={() => navigate('/family/members')}>
                      去处理成员
                    </button>
                    <button type="button" style={{ ...secondaryButtonStyle, minHeight: '42px', borderRadius: '999px', boxShadow: 'none', color: 'var(--nl-primary-2)' }} onClick={() => navigate('/profile/help?topic=account-delete')}>
                      提交协助
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ borderRadius: '18px', background: 'rgba(var(--nl-success-rgb),0.12)', border: '1px solid rgba(var(--nl-success-rgb),0.24)', padding: '14px 16px', color: 'var(--nl-success)', display: 'grid', gap: '6px' }}>
                  <strong>当前账号可以注销</strong>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6 }}>注销后将立即退出登录，密码和账号凭据会失效，不能恢复。</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Panel>
      <Panel>
        <form style={rowStyle} onSubmit={(event) => void submit(event)}>
          <strong>确认信息</strong>
          <Field label="登录密码">
            <input style={inputStyle} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入当前登录密码" />
          </Field>
          <Field label={`确认文案（输入“${check?.confirm_text ?? '确认注销'}”）`}>
            <input style={inputStyle} value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={check?.confirm_text ?? '确认注销'} />
          </Field>
          {message ? <p style={{ ...helperTextStyle, color: message.includes('已') ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
          <div style={buttonRowStyle}>
            <button
              type="submit"
              style={{
                ...primaryButtonStyle,
                background: check?.can_delete ? 'linear-gradient(135deg, var(--nl-danger), #ff9aae)' : 'rgba(var(--nl-surface-rgb),0.58)',
                boxShadow: 'none',
              }}
              disabled={submitting || loading || !check?.can_delete}
            >
              {submitting ? '正在注销…' : '确认注销账号'}
            </button>
          </div>
        </form>
      </Panel>
    </PageShell>
  );
};

type HelpFeedbackTopic = 'account-delete' | 'membership' | 'family-remove';

const helpFeedbackTopicConfig: Record<HelpFeedbackTopic, { category: string; content: string; description: string }> = {
  'account-delete': {
    category: '数据异常',
    content: '申请注销账号，请联系我完成身份确认和儿童信息处理。',
    description: '账号注销需要人工确认，请提交申请后等待联系。',
  },
  membership: {
    category: '功能建议',
    content: '咨询会员权益与成长纪念册申领，请联系我确认升级方式。',
    description: '会员权益咨询会自动带入反馈内容，提交后等待联系。',
  },
  'family-remove': {
    category: '数据异常',
    content: '申请移出家庭成员，请联系我完成管理员确认和成员关系处理。',
    description: '成员移出需要管理员二次确认，请提交申请后等待联系。',
  },
};

const isHelpFeedbackTopic = (value: string | null): value is HelpFeedbackTopic =>
  value === 'account-delete' || value === 'membership' || value === 'family-remove';

const getHelpFeedbackContent = (topic: HelpFeedbackTopic | null, memberNo: string | null) => {
  if (!topic) return '';
  if (topic === 'family-remove' && memberNo) {
    return `申请移出家庭成员（用户编号：${memberNo}），请联系我完成管理员确认和成员关系处理。`;
  }
  return helpFeedbackTopicConfig[topic].content;
};

export const HelpFeedbackPage = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const topicParam = searchParams.get('topic');
  const memberNo = searchParams.get('member');
  const topic = isHelpFeedbackTopic(topicParam) ? topicParam : null;
  const topicConfig = topic ? helpFeedbackTopicConfig[topic] : null;
  const initialCategory = topicConfig?.category ?? '使用问题';
  const initialContent = getHelpFeedbackContent(topic, memberNo);
  const [category, setCategory] = useState(initialCategory);
  const [content, setContent] = useState(initialContent);
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCategory(initialCategory);
    setContent(initialContent);
    setMessage(null);
  }, [initialCategory, initialContent]);

  const submitFeedback = async () => {
    const normalized = content.trim();
    if (normalized.length < 6) {
      setMessage('请至少输入 6 个字，方便定位问题。');
      return;
    }

    setSubmitting(true);
    try {
      const result = await webApi.submitFeedback({
        category,
        content: normalized,
        contact: contact.trim() || undefined,
        topic: topic ?? undefined,
      });
      setContent('');
      setContact('');
      setMessage(result.message);
      return;
    } catch {
      const item = { category, content: normalized, contact: contact.trim(), topic: topic ?? undefined, created_at: new Date().toISOString(), sync_status: 'pending' };
      let list: typeof item[] = [];
      try {
        const raw = window.localStorage.getItem('xiaoman-web-feedback-list');
        list = raw ? (JSON.parse(raw) as typeof item[]) : [];
      } catch {
        list = [];
      }
      try {
        window.localStorage.setItem('xiaoman-web-feedback-list', JSON.stringify([item, ...list].slice(0, 20)));
        setContent('');
        setContact('');
        setMessage('暂时无法同步服务器，已先保存在本机，请稍后再提交。');
      } catch {
        setMessage('暂时无法同步服务器，本机也无法保存，请稍后重试或复制内容后联系支持。');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="帮助与反馈" description={topicConfig?.description ?? '查看常见问题，并提交当前设备上的反馈记录。'} backTo="/profile">
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
          {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
          <div style={buttonRowStyle}>
            <button type="button" style={primaryButtonStyle} onClick={() => void submitFeedback()} disabled={submitting}>
              {submitting ? '提交中…' : '提交反馈'}
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
      '用户可以查看和修改个人资料、孩子档案、家庭成员关系和成长记录；平台提供注销、导出、删除申请和隐私问题反馈渠道。',
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
      borderBottom: isLast ? 'none' : '1px solid var(--nl-border)',
      background: 'rgba(var(--nl-surface-rgb),0.72)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      textAlign: 'left',
      cursor: 'pointer',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, color: 'var(--nl-muted-strong)', fontSize: '15px', fontWeight: 700 }}>
      <Icon size={18} color="var(--nl-accent)" strokeWidth={2} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </span>
    {value ? (
      <span style={{ color: 'var(--nl-muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>{value}</span>
    ) : (
      <ChevronRight size={16} color="var(--nl-muted)" strokeWidth={2.2} />
    )}
  </button>
);

export const AboutPage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <PageShell title="关于我们" backTo="/profile">
      <section style={{ display: 'grid', justifyItems: 'center', padding: '18px 0 10px' }}>
        <img
          src="/brand/nianlun-logo-192.png"
          alt="年轮"
          width={96}
          height={96}
          style={{ borderRadius: '26px', boxShadow: '0 16px 34px rgba(var(--nl-primary-rgb),0.24)', marginBottom: '16px' }}
        />
        <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontSize: '20px', fontWeight: 800 }}>nianlun</h2>
        <p style={{ margin: '6px 0 0', color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 600 }}>版本 1.0.0（构建 20260514）</p>
      </section>

      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <AboutMenuLink icon={Info} label="功能介绍" onClick={() => setMessage('年轮支持成长记录、家庭协作、时间轴、月报纪念册、档案交付和审计留痕导出。')} />
        <AboutMenuLink icon={FileText} label="用户服务协议" onClick={() => navigate('/profile/legal')} />
        <AboutMenuLink icon={Shield} label="隐私政策" onClick={() => navigate('/profile/legal')} />
        <AboutMenuLink icon={Globe} label="服务说明" isLast onClick={() => setMessage('当前版本已覆盖成长记录、家庭协作、时间轴回看、档案导出和运营后台管理。')} />
      </Panel>

      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <AboutMenuLink icon={Mail} label="联系我们" value="帮助与反馈" onClick={() => navigate('/profile/help')} />
        <AboutMenuLink icon={HelpCircle} label="应用反馈" isLast onClick={() => navigate('/profile/help')} />
      </Panel>

      {message ? <p style={{ ...helperTextStyle, color: 'var(--nl-muted-strong)', textAlign: 'center' }}>{message}</p> : null}
      <div style={{ textAlign: 'center', color: 'var(--nl-muted)', fontSize: '10px', lineHeight: 1.7, paddingTop: '8px' }}>
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
        <p style={helperTextStyle}>当前版本已覆盖登录、建档、记录、时间轴、家庭成员、媒体上传和后台运营主流程。</p>
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
