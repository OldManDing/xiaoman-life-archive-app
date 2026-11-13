import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, BookHeart, AlertCircle, Unlink, Camera, CheckCircle2, ChevronRight, Copy, DownloadCloud, FileBox, FileText, HelpCircle, Home, Info, KeyRound, Lock, LogOut, Mail, Moon, Pencil, RefreshCw, Settings, Shield, ShieldCheck, Smartphone, Trash2, Type, UserPlus, UserRound, Users } from 'lucide-react';

import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import type { AppUpdateCheckResponse, ArchiveExportRequestItem, ArchiveExportSummaryResponse, FeedbackTicketItem, MembershipBookRequestItem, NotificationUnreadCountResponse, RecordSummary, UserNotificationItem, UserNotificationsResponse } from '../shared/api/types';
import { formatUpdateBytes, updateDownloadStateLabel, useAppUpdateDownload } from '../shared/appUpdateUi';
import { hasVerifiedAppUpdateMetadata } from '../shared/appUpdater';
import { useAsyncData, useStoredMediaUrl } from '../shared/hooks';
import { membershipTypeLabel } from '../shared/labels';
import { createPersistableAvatarPreview, saveLocalMediaPreview, saveRuntimeMediaPreview, toStoredMediaReference } from '../shared/localMediaPreview';
import { loadLocalSettings, localSettingsToPreferences, preferencesToLocalSettings, saveLocalSettings, type LocalSettings } from '../shared/localSettings';
import { isSupportedImageFile, resolveFileMimeType, withResolvedFileMimeType } from '../shared/mediaFiles';
import { normalizeUploadErrorMessage, readUploadMetadata } from '../shared/mediaMetadata';
import { getHmsPushConnectionStatus, setHmsRemotePushEnabled, type HmsPushConnectionStatus } from '../shared/hmsPush';
import { saveTextFileToDownloads } from '../shared/nativeExport';
import { getNativeNotificationPermissionStatus, requestNativeNotificationPermission, type NativeNotificationPermissionStatus } from '../shared/nativeNotifications';
import { useCachedMediaUrl } from '../shared/useCachedMediaUrl';
import { AppSegmentedControl, AppSelect, Field, PageShell, Panel, compactSecondaryButtonStyle, helperTextStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle, textareaStyle } from '../shared/ui';
import { EmptyState, buttonRowStyle, formatAppDateTime, normalizeDisplayName, rowStyle } from './shared';
import { RefAvatar, RefListRow, RefSectionTitle, isReferencePlaceholderAvatar, refPageStyle, referenceAssets } from './reference-ui';


const isPositiveStatusMessage = (message: string) => !/(失败|不能|请先|请至少|请输入|仅支持|无法|错误|暂时)/.test(message);
const mobilePattern = /^1\d{10}$/;

const normalizeNotificationCopy = (value: string) =>
  value
    .replace(/《\?{3,}[^》]*》/g, '《一条记录》')
    .replace(/\?{3,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const notificationPermissionLabel = (status: NativeNotificationPermissionStatus | 'checking') => {
  if (status === 'checking') return '正在检查';
  if (status === 'granted') return '系统通知已开启';
  if (status === 'denied') return '系统通知未开启';
  if (status === 'prompt' || status === 'prompt-with-rationale') return '尚未开启';
  if (status === 'web') return '网页预览';
  return '以系统设置为准';
};

const NotificationSwitchRow = ({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={title}
    disabled={disabled}
    onClick={onChange}
    style={{
      width: '100%',
      minHeight: 64,
      border: 'none',
      borderBottom: '1px solid rgba(var(--nl-shadow-rgb),0.07)',
      background: 'transparent',
      padding: '14px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      textAlign: 'left',
      opacity: disabled ? 0.42 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      WebkitTapHighlightColor: 'transparent',
    }}
  >
    <span style={{ minWidth: 0, display: 'grid', gap: 4 }}>
      <strong style={{ color: 'var(--nl-ink)', fontSize: 15, lineHeight: 1.2, fontWeight: 680, letterSpacing: 0 }}>{title}</strong>
      {description ? <span style={{ color: 'var(--nl-muted)', fontSize: 12, lineHeight: 1.45, fontWeight: 460 }}>{description}</span> : null}
    </span>
    <span
      aria-hidden="true"
      style={{ ...toggleTrackStyle(checked), flexShrink: 0 }}
    >
      <span style={toggleKnobStyle(checked)} />
    </span>
  </button>
);

const uploadAvatarImage = async (childNo: string, file: File, previewUrl?: string | null) => {
  const uploadFile = withResolvedFileMimeType(file);
  const metadata = await readUploadMetadata('image', previewUrl);
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
  await webApi.confirmUpload({ media_no: uploadToken.media_no, ...metadata });
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

const ProfileAvatar = ({ src, mediaNo, label, fallbackSrc = null }: { src?: string | null; mediaNo?: string | null; label: string; fallbackSrc?: string | null }) => {
  const resolvedSrc = useStoredMediaUrl(src && !isReferencePlaceholderAvatar(src) ? src : null, mediaNo);
  const displaySrc = resolvedSrc && !isReferencePlaceholderAvatar(resolvedSrc) ? resolvedSrc : fallbackSrc;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [displaySrc]);

  if (displaySrc && failedSrc !== displaySrc) {
    return <img src={displaySrc} alt={label} decoding="async" onError={() => setFailedSrc(displaySrc)} style={{ width: '72px', height: '72px', borderRadius: '999px', objectFit: 'cover', border: '2px solid var(--nl-border-image)', outline: '1px solid rgba(var(--nl-accent-rgb),0.1)', background: 'var(--nl-surface-soft)', boxShadow: '0 12px 26px rgba(var(--nl-shadow-rgb),0.15)', flexShrink: 0 }} />;
  }

  return (
    <div
      style={{
        width: '72px',
        height: '72px',
        borderRadius: '999px',
        background: 'rgba(var(--nl-surface-strong-rgb),0.46)',
        border: '2px solid var(--nl-border-image)',
        outline: '1px solid rgba(var(--nl-accent-rgb),0.1)',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        color: 'var(--nl-ink)',
        boxShadow: '0 12px 26px rgba(var(--nl-shadow-rgb),0.15)',
        flexShrink: 0,
      }}
    >
      <UserRound size={28} strokeWidth={1.7} aria-hidden="true" />
    </div>
  );
};

const getRecordMediaKind = (record: RecordSummary | null | undefined) =>
  record?.cover_media_type ?? (record?.record_type === 'audio' || record?.record_type === 'video' ? record.record_type : null);

const ReportMediaWallItem = ({ item, onClick }: { item: RecordSummary; onClick: () => void }) => {
  const mediaKind = getRecordMediaKind(item);
  const cover = useCachedMediaUrl(item.cover_media_no, item.cover_url, mediaKind ?? 'image', {
    cacheRemote: mediaKind !== 'audio',
  });

  return (
    <button type="button" onClick={onClick} style={{ border: 'none', padding: 0, background: 'var(--nl-surface-soft)', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1 / 1', cursor: 'pointer' }}>
      {cover && item.cover_media_type === 'video' ? <video src={cover} muted playsInline preload="none" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
      {cover && item.cover_media_type !== 'video' ? <img src={cover} alt={item.title ?? '纪念册影像'} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
    </button>
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
      border: '1px solid var(--nl-border-muted)',
      borderRadius: '8px',
      background: 'rgba(var(--nl-surface-rgb),0.14)',
      minHeight: '66px',
      padding: '14px 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '14px',
      textAlign: 'left',
      cursor: disabled && !onClick ? 'default' : 'pointer',
      opacity: disabled ? 0.82 : 1,
      boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(var(--nl-surface-rgb),0.18)', border: '1px solid var(--nl-border-muted)', display: 'grid', placeItems: 'center', color: 'var(--nl-muted)', flexShrink: 0, boxShadow: 'inset 0 1px 0 var(--nl-inset-highlight)' }}>
        <Icon size={19} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--nl-ink)' }}>{title}</span>
          {badge ? <span style={{ fontSize: '11px', color: 'var(--nl-muted)', fontWeight: 520 }}>{badge}</span> : null}
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
    neutral: { background: 'rgba(var(--nl-surface-strong-rgb),0.3)', color: 'var(--nl-muted-strong)', iconBg: 'rgba(var(--nl-primary-rgb),0.1)', border: 'var(--nl-border-muted)' },
    warm: { background: 'rgba(var(--nl-primary-rgb),0.08)', color: 'var(--nl-primary-2)', iconBg: 'rgba(var(--nl-primary-rgb),0.12)', border: 'rgba(var(--nl-primary-rgb),0.2)' },
    green: { background: 'rgba(var(--nl-success-rgb),0.1)', color: 'var(--nl-success)', iconBg: 'rgba(var(--nl-success-rgb),0.17)', border: 'rgba(var(--nl-success-rgb),0.24)' },
    blue: { background: 'rgba(var(--nl-primary-rgb),0.07)', color: 'var(--nl-primary-2)', iconBg: 'rgba(var(--nl-primary-rgb),0.1)', border: 'rgba(var(--nl-primary-rgb),0.18)' },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: '104px',
        borderRadius: '8px',
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
      <span style={{ width: '34px', height: '34px', borderRadius: '8px', background: toneStyles.iconBg, color: toneStyles.color, display: 'grid', placeItems: 'center', border: '1px solid var(--nl-inset-highlight)' }}>
        <Icon size={18} strokeWidth={2.1} />
      </span>
      <span style={{ display: 'grid', gap: '4px' }}>
        <strong style={{ fontSize: '14px', fontWeight: 760, color: 'var(--nl-ink)', lineHeight: 1.2 }}>{title}</strong>
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
  borderBottom: '1px solid var(--nl-border-muted)',
} as const;

const toggleButtonStyle = (enabled: boolean) =>
  ({
    minWidth: '54px',
    minHeight: '44px',
    border: 'none',
    borderRadius: '999px',
    padding: 0,
    background: 'transparent',
    boxShadow: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 1,
  }) as const;

const toggleTrackStyle = (enabled: boolean) =>
  ({
    width: '44px',
    height: '26px',
    borderRadius: '999px',
    border: enabled ? 'none' : '1px solid #8b7160',
    background: enabled ? '#c0742f' : '#c7b09c',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: enabled ? 'flex-end' : 'flex-start',
    boxSizing: 'border-box',
  }) as const;

const toggleKnobStyle = (enabled: boolean) => ({
  width: '20px',
  height: '20px',
  borderRadius: '999px',
  background: '#FFFFFF',
  border: 'none',
  boxShadow: '0 1px 3px rgba(var(--nl-shadow-rgb),0.18)',
}) as const;

const toMonthKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const listRecordsForReport = async (childNo: string) => {
  const pageSize = 100;
  const maxRecords = 1000;
  const first = await webApi.listRecords({ child_no: childNo, page: 1, page_size: pageSize });
  const items = [...first.list];
  const target = Math.min(first.total ?? items.length, maxRecords);
  let page = 1;
  while (items.length < target && first.has_more !== false) {
    page += 1;
    const next = await webApi.listRecords({ child_no: childNo, page, page_size: pageSize });
    if (!next.list.length) break;
    items.push(...next.list);
    if (!next.has_more) break;
  }
  return items.slice(0, maxRecords);
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

const membershipBookStatusText = (value: MembershipBookRequestItem['status']) => {
  if (value === 'processing') return '整理中';
  if (value === 'completed') return '已完成';
  if (value === 'rejected') return '未通过';
  return '已提交';
};

const membershipBookStatusColor = (value: MembershipBookRequestItem['status']) => {
  if (value === 'completed') return 'var(--nl-success)';
  if (value === 'rejected') return 'var(--nl-danger)';
  if (value === 'processing') return 'var(--nl-primary-2)';
  return 'var(--nl-muted)';
};

const formatProfileDateTime = (value: string | null) => formatAppDateTime(value, '—');
const isTechnicalProfileName = (value: string) => /^(?:codex(?:ui)?\d[a-z0-9]*|native_[a-z0-9_]+|1\d{10})$/i.test(value.trim());

export const ProfilePage = () => {
  const { user, logout, activeChild } = useAuth();
  const navigate = useNavigate();
  const { data: notificationCount } = useAsyncData<NotificationUnreadCountResponse>(
    async () => webApi.notificationUnreadCount(),
    [],
  );
  const { data: publishedRecords } = useAsyncData<{ list: RecordSummary[]; total: number }>(
    async () => {
      if (!activeChild) return { list: [], total: 0 };
      const result = await webApi.listRecords({ child_no: activeChild.child_no, page: 1, page_size: 200, status: 'published' });
      return { list: result.list, total: result.total };
    },
    [activeChild?.child_no],
  );
  const { data: familyMembers } = useAsyncData(
    async () => (activeChild?.family_no ? webApi.listFamilyMembers(activeChild.family_no) : null),
    [activeChild?.family_no],
  );
  const unreadCount = notificationCount?.unread_count ?? 0;
  const rawProfileName = normalizeDisplayName(user?.nickname, '未登录用户');
  const technicalProfileName = isTechnicalProfileName(rawProfileName);
  const profileName = technicalProfileName ? '我的年轮' : rawProfileName;
  const recordsList = publishedRecords?.list ?? [];
  const recordCount = publishedRecords?.total ?? recordsList.length;
  const milestoneCount = recordsList.filter((item) => item.is_milestone || item.record_type === 'milestone').length;
  const memberCount = familyMembers?.list.filter((member) => member.status === 1).length ?? 0;
  const daysTogether = (() => {
    if (!recordsList.length) return 0;
    const earliest = recordsList.reduce((min, item) => {
      const time = new Date(item.event_time).getTime();
      return Number.isFinite(time) && time < min ? time : min;
    }, Date.now());
    return Math.max(1, Math.floor((Date.now() - earliest) / 86400000));
  })();
  const companionText = activeChild ? `陪伴${activeChild.name} ${daysTogether} 天` : '还没有建立孩子档案';
  const menuItems = [
    { key: 'messages', icon: Mail, label: '消息中心', onClick: () => navigate('/profile/messages') },
    { key: 'settings', icon: Settings, label: '设置', onClick: () => navigate('/profile/settings') },
    { key: 'security', icon: ShieldCheck, label: '账号与安全', onClick: () => navigate('/profile/security') },
    { key: 'font', icon: Type, label: '字体大小', value: '标准', onClick: () => navigate('/profile/settings') },
    { key: 'notifications', icon: Bell, label: '通知管理', onClick: () => navigate('/profile/notifications') },
    { key: 'help', icon: HelpCircle, label: '帮助与反馈', onClick: () => navigate('/profile/help') },
  ];

  return (
    <div className="pf-page">
      <main className="pf-main">
        <section className="pf-hero">
          <RefAvatar
            src={user?.avatar_url && !isTechnicalProfileName(rawProfileName) ? user.avatar_url : null}
            mediaNo={user?.avatar_media_no}
            label={user?.nickname ?? '我的头像'}
            size={64}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="pf-hero-name">{profileName}</h1>
            <p className="pf-hero-meta">{companionText}</p>
          </div>
          <button type="button" className="pf-bell" aria-label={`消息中心${unreadCount ? `，${unreadCount} 条未读` : ''}`} onClick={() => navigate('/profile/messages')}>
            <Bell size={24} strokeWidth={1.9} />
            {unreadCount ? <span className="pf-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
          </button>
        </section>

        <section className="pf-stats" aria-label="成长统计">
          <div className="pf-stat">
            <span className="pf-stat-num">{recordCount}</span>
            <span className="pf-stat-label">条记录</span>
          </div>
          <div className="pf-stat">
            <span className="pf-stat-num">{milestoneCount}</span>
            <span className="pf-stat-label">个里程碑</span>
          </div>
          <div className="pf-stat">
            <span className="pf-stat-num">{memberCount}</span>
            <span className="pf-stat-label">位家人</span>
          </div>
        </section>

        <nav className="pf-menu" aria-label="账户菜单">
          {menuItems.map(({ key, icon: Icon, label, value, onClick }) => (
            <button key={key} type="button" className="pf-menu-row" onClick={onClick}>
              <span className="pf-menu-icon">
                {key === 'font' ? <span className="pf-menu-glyph" aria-hidden="true">Aa</span> : <Icon size={22} strokeWidth={1.8} />}
              </span>
              <span className="pf-menu-label">{label}</span>
              {key === 'messages' ? (
                unreadCount ? <span className="pf-menu-muted">未读</span> : null
              ) : value ? (
                <span className="pf-menu-value">{value}</span>
              ) : null}
              <ChevronRight size={18} strokeWidth={1.9} className="pf-chevron" />
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="pf-logout"
          onClick={async () => {
            if (typeof window !== 'undefined' && !window.confirm('确定退出当前账号吗？')) return;
            await logout();
            navigate('/auth/login', { replace: true });
          }}
        >
          <span className="pf-logout-icon"><LogOut size={22} strokeWidth={2.1} /></span>
          <span style={{ flex: 1 }}>
            <strong>退出登录</strong>
            <small>需要再次确认</small>
          </span>
          <ChevronRight size={18} strokeWidth={1.9} className="pf-chevron" />
        </button>

        <div className="pf-footer">
          <span>年轮 v{appVersion} · 已陪伴 {daysTogether} 天</span>
        </div>
      </main>
    </div>
  );

};

const NotificationListItem = ({
  item,
  onClick,
  isLast,
}: {
  item: UserNotificationItem;
  onClick: () => void;
  isLast?: boolean;
}) => {
  const title = normalizeNotificationCopy(item.title) || '消息';
  const body = normalizeNotificationCopy(item.body) || '有新的家庭动态';

  return (
    <button
      type="button"
      aria-label={`${title}${item.read_at ? '' : '，未读'}${item.target_type === 'record' && item.target_no ? '，查看记录' : ''}`}
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: '76px',
        border: 'none',
        borderBottom: isLast ? 'none' : '1px solid var(--nl-border-muted)',
        background: 'transparent',
        padding: '14px 2px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: '12px',
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: 'none',
      }}
    >
      <span style={{ minWidth: 0, display: 'grid', gap: '6px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {!item.read_at ? <span aria-label="未读" style={{ width: '7px', height: '7px', borderRadius: '999px', background: 'var(--nl-primary)', flexShrink: 0 }} /> : null}
          <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: item.read_at ? 620 : 760, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</strong>
        </span>
        <span style={{ color: 'var(--nl-muted-strong)', fontSize: '13px', lineHeight: 1.55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{body}</span>
        <span style={{ color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 520 }}>{formatProfileDateTime(item.created_at)}</span>
      </span>
      {item.target_type === 'record' && item.target_no ? <ChevronRight size={16} color="var(--nl-muted)" strokeWidth={2.2} /> : null}
    </button>
  );
};

const MESSAGE_AVATARS: Array<[RegExp, string]> = [
  [/妈妈|母亲/, '/photos/people/mom.jpg'],
  [/爸爸|父亲/, '/photos/people/dad.jpg'],
  [/外婆|奶奶|姥姥/, '/photos/people/grandma-real.jpg'],
];

const messageAvatarFor = (item: UserNotificationItem) => {
  const name = `${item.actor_nickname ?? ''} ${item.title ?? ''}`;
  const hit = MESSAGE_AVATARS.find(([pattern]) => pattern.test(name));
  return hit ? hit[1] : null;
};

const formatMessageTime = (value: string) => {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const diff = Date.now() - time;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 172_800_000) return '昨天';
  return `${Math.floor(diff / 86_400_000)} 天前`;
};

const MessageCard = ({ item, onClick }: { item: UserNotificationItem; onClick: () => void }) => {
  const title = normalizeNotificationCopy(item.title) || '消息';
  const body = normalizeNotificationCopy(item.body);
  const avatar = messageAvatarFor(item);
  const isSystem = item.notification_type === 'system';
  const hasReply = item.notification_type !== 'system' && item.target_type === 'record' && Boolean(item.target_no);
  return (
    <button type="button" className="msg-card" onClick={onClick}>
      {!item.read_at ? <span className="msg-dot" aria-label="未读" /> : null}
      {isSystem ? (
        <span className="msg-avatar is-system" aria-hidden="true">
          <DownloadCloud size={24} strokeWidth={1.7} />
        </span>
      ) : avatar ? (
        <img className="msg-avatar" src={avatar} alt="" />
      ) : (
        <span className="msg-avatar" aria-hidden="true">{title.slice(0, 1)}</span>
      )}
      <span className="msg-body">
        <strong className="msg-title">{title}</strong>
        {body ? <span className="msg-text">{body}</span> : null}
      </span>
      <span className="msg-side">
        <span className="msg-time">{formatMessageTime(item.created_at)}</span>
        {hasReply ? <span className="msg-reply">回应</span> : null}
      </span>
    </button>
  );
};

export const MessagesPage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const {
    data: notifications,
    loading,
    setData: setNotifications,
  } = useAsyncData<UserNotificationsResponse>(async () => {
    const pageSize = 50;
    const first = await webApi.listNotifications({ page: 1, page_size: pageSize });
    const items = [...first.list];
    const target = Math.min(first.total ?? items.length, 200);
    let page = 1;
    while (items.length < target && first.has_more !== false) {
      page += 1;
      const next = await webApi.listNotifications({ page, page_size: pageSize });
      if (!next.list.length) break;
      items.push(...next.list);
      if (!next.has_more) break;
    }
    return { ...first, list: items };
  }, []);
  const { data: unreadCount, setData: setUnreadCount } = useAsyncData<NotificationUnreadCountResponse>(
    async () => webApi.notificationUnreadCount(),
    [],
  );
  const list = notifications?.list ?? [];
  const unreadTotal = unreadCount?.unread_count ?? 0;
  const visibleList = filter === 'unread' ? list.filter((item) => !item.read_at) : list;

  const markItemReadLocally = (notificationNo: string) => {
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current
        ? {
            ...current,
            list: current.list.map((item) => (item.notification_no === notificationNo ? { ...item, read_at: item.read_at ?? readAt } : item)),
          }
        : current,
    );
    setUnreadCount((current) => ({ unread_count: Math.max(0, (current?.unread_count ?? 1) - 1) }));
  };

  const openNotification = (item: UserNotificationItem) => {
    if (!item.read_at) {
      const previousNotifications = notifications;
      const previousUnreadCount = unreadCount;
      markItemReadLocally(item.notification_no);
      void webApi.markNotificationRead(item.notification_no).catch(() => {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
        setMessage('消息状态同步失败，请稍后重试。');
      });
    }

    if (item.target_type === 'record' && item.target_no) {
      navigate(`/record/${item.target_no}`);
    }
  };

  const markAllRead = async () => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    setMarkingAll(true);
    setMessage(null);
    try {
      await webApi.markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current
          ? {
              ...current,
              list: current.list.map((item) => ({ ...item, read_at: item.read_at ?? readAt })),
            }
          : current,
      );
      setUnreadCount({ unread_count: 0 });
      setMessage('全部已读');
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setMessage('操作失败，请稍后重试。');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <PageShell
      title="消息"
      backTo="/profile"
      className="messages-shell"
      action={
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={markingAll || unreadTotal === 0}
          style={{ minHeight: 44, border: 'none', background: 'transparent', color: unreadTotal ? 'var(--nl-accent)' : 'var(--nl-muted)', fontSize: 15, fontWeight: 500, cursor: unreadTotal ? 'pointer' : 'default' }}
        >
          {markingAll ? '处理中' : '全部已读'}
        </button>
      }
    >
      <div className="msg-segmented" role="tablist" aria-label="消息筛选">
        <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>全部</button>
        <button type="button" role="tab" aria-selected={filter === 'unread'} className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>未读 {unreadTotal}</button>
      </div>
      {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)', margin: 0 }}>{message}</p> : null}
      {loading ? <p style={{ ...helperTextStyle, margin: 0 }}>同步中…</p> : null}
      {!loading && visibleList.length === 0 ? <EmptyState message={filter === 'unread' ? '没有未读消息' : '暂无消息'} /> : null}
      <div className="msg-list">
        {visibleList.map((item) => (
          <MessageCard key={item.notification_no} item={item} onClick={() => openNotification(item)} />
        ))}
      </div>
    </PageShell>
  );
};

export const NotificationSettingsPage = () => {
  const [settings, setSettings] = useState<LocalSettings>(() => loadLocalSettings());
  const [permissionStatus, setPermissionStatus] = useState<NativeNotificationPermissionStatus | 'checking'>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [pushConnectionStatus, setPushConnectionStatus] = useState<HmsPushConnectionStatus>(() => getHmsPushConnectionStatus());
  const settingRequestRef = useRef(0);
  const { data: notificationCount } = useAsyncData<NotificationUnreadCountResponse>(
    async () => webApi.notificationUnreadCount(),
    [],
  );

  const refreshPermissionStatus = async () => {
    if (permissionBusy) return;
    setPermissionBusy(true);
    setPermissionStatus('checking');
    try {
      const status = await getNativeNotificationPermissionStatus();
      setPermissionStatus(status);
    } catch {
      setPermissionStatus('unknown');
      setMessage('暂时无法读取系统通知权限，请稍后重试。');
    } finally {
      setPermissionBusy(false);
    }
  };

  useEffect(() => {
    void refreshPermissionStatus();
    const updateConnectionStatus = () => setPushConnectionStatus(getHmsPushConnectionStatus());
    window.addEventListener('nianlun:hms-push-status', updateConnectionStatus);
    return () => window.removeEventListener('nianlun:hms-push-status', updateConnectionStatus);
  }, []);

  const saveNotificationSettings = (next: LocalSettings) => {
    setSettings(next);
    saveLocalSettings(next);
    setMessage('通知偏好已保存在本机。');
  };

  const updateSetting = async (key: keyof Pick<LocalSettings, 'notificationPushEnabled' | 'notificationFamilyEnabled' | 'notificationUpdateEnabled'>) => {
    const requestId = ++settingRequestRef.current;
    const previous = settings;
    const next = { ...settings, [key]: !settings[key] };
    saveNotificationSettings(next);
    if (key === 'notificationPushEnabled' || key === 'notificationFamilyEnabled') {
      const status = await setHmsRemotePushEnabled(next.notificationPushEnabled && next.notificationFamilyEnabled);
      if (requestId !== settingRequestRef.current) return;
      setPushConnectionStatus(status);
      if (status === 'failed') {
        setSettings(previous);
        saveLocalSettings(previous);
        setMessage('手机通知设置同步失败，已恢复上一次状态。');
      }
    }
  };

  const requestPermission = async () => {
    if (permissionBusy) return;
    setPermissionBusy(true);
    setMessage(null);
    let status: NativeNotificationPermissionStatus;
    try {
      status = await requestNativeNotificationPermission();
    } catch {
      setMessage('无法打开系统通知设置，请稍后重试。');
      setPermissionBusy(false);
      return;
    }
    setPermissionStatus(status);
    if (status === 'granted') {
      let connectionStatus: HmsPushConnectionStatus;
      try {
        connectionStatus = await setHmsRemotePushEnabled(settings.notificationPushEnabled && settings.notificationFamilyEnabled);
      } catch {
        setMessage('系统通知已开启，但设备注册失败，消息仍可在 App 内查看。');
        setPermissionBusy(false);
        return;
      }
      setPushConnectionStatus(connectionStatus);
      setMessage(connectionStatus === 'registered' ? '手机通知已开启。' : '系统通知已开启，消息仍可在 App 内查看。');
      setPermissionBusy(false);
      return;
    }
    setMessage('系统通知未开启，请在手机系统设置中允许通知。');
    setPermissionBusy(false);
  };

  const unreadText = `${notificationCount?.unread_count ?? 0} 条未读`;
  const permissionText = notificationPermissionLabel(permissionStatus);
  const remotePushText =
    pushConnectionStatus === 'registered'
      ? '手机通知已开启'
      : pushConnectionStatus === 'connecting'
        ? '正在开启手机通知'
        : permissionStatus === 'granted'
          ? '应用内消息正常'
          : '手机通知待开启';
  const shouldShowPermissionButton = permissionStatus !== 'checking' && permissionStatus !== 'granted' && permissionStatus !== 'web';

  const [notifyPrefs, setNotifyPrefs] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {
      daily: true,
      birthday: true,
      milestone: true,
      familyRecord: true,
      familyReply: true,
      familyJoin: true,
      quiet: false,
    };
    try {
      const raw = window.localStorage.getItem('nianlun:notification-prefs');
      return raw ? { ...defaults, ...(JSON.parse(raw) as Record<string, boolean>) } : defaults;
    } catch {
      return defaults;
    }
  });

  const toggleNotifyPref = (key: string) => {
    setNotifyPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      try {
        window.localStorage.setItem('nianlun:notification-prefs', JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };

  const notifyGroups: Array<{ title: string; items: Array<{ key: string; label: string; desc?: string }> }> = [
    {
      title: '提醒',
      items: [
        { key: 'daily', label: '每天提醒我记录', desc: '暂未开放 · 需系统推送支持' },
        { key: 'birthday', label: '孩子生日提醒', desc: '暂未开放 · 需系统推送支持' },
        { key: 'milestone', label: '里程碑提醒', desc: '暂未开放 · 需系统推送支持' },
      ],
    },
    {
      title: '家人的动态',
      items: [
        { key: 'familyRecord', label: '有人新增记录' },
        { key: 'familyReply', label: '有人评论或回应' },
        { key: 'familyJoin', label: '有人加入家庭' },
      ],
    },
    {
      title: '免打扰',
      items: [{ key: 'quiet', label: '免打扰时段', desc: '22:00 – 07:00' }],
    },
  ];

  return (
    <PageShell title="通知设置" backTo="/profile" className="settings-shell">
      <div className="notify-status-card">
        <div className="notify-status-head">
          <span>手机通知状态</span>
          <button type="button" onClick={shouldShowPermissionButton ? requestPermission : refreshPermissionStatus} disabled={permissionBusy}>
            {permissionBusy ? '处理中…' : shouldShowPermissionButton ? '开启通知' : '检查状态'}
          </button>
        </div>
        <strong className="notify-status-title">{remotePushText}</strong>
        <span className="notify-status-desc">{permissionText} · {unreadText}</span>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        {notifyGroups.map((group) => (
          <section className="set-group" key={group.title} aria-label={group.title}>
            <h2 className="set-group-title">{group.title}</h2>
            <div className="set-card">
              {group.items.map((item, index) => {
                const enabled = Boolean(notifyPrefs[item.key]);
                const unsupported = ['daily', 'birthday', 'milestone'].includes(item.key);
                return (
                  <div className={index === group.items.length - 1 ? 'set-row is-static is-last' : 'set-row is-static'} key={item.key} style={unsupported ? { opacity: 0.45 } : undefined}>
                    <span className="set-body"><strong>{item.label}</strong>{item.desc ? <small>{item.desc}</small> : null}</span>
                    <button type="button" aria-label={item.label} aria-pressed={enabled} disabled={unsupported} style={toggleButtonStyle(enabled)} onClick={() => { if (!unsupported) toggleNotifyPref(item.key); }}>
                      <span style={toggleTrackStyle(enabled)}><span style={toggleKnobStyle(enabled)} /></span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <section className="set-group" aria-label="手机系统">
          <h2 className="set-group-title">手机系统</h2>
          <div className="set-card">
            <div className="set-row is-static">
              <span className="set-body"><strong>手机通知</strong><small>允许年轮发送系统通知</small></span>
              <button type="button" aria-label="手机通知" aria-pressed={settings.notificationPushEnabled} style={toggleButtonStyle(settings.notificationPushEnabled)} onClick={() => void updateSetting('notificationPushEnabled')}>
                <span style={toggleTrackStyle(settings.notificationPushEnabled)}><span style={toggleKnobStyle(settings.notificationPushEnabled)} /></span>
              </button>
            </div>
            <div className="set-row is-static is-last">
              <span className="set-body"><strong>版本更新提醒</strong></span>
              <button type="button" aria-label="版本更新提醒" aria-pressed={settings.notificationUpdateEnabled} style={toggleButtonStyle(settings.notificationUpdateEnabled)} onClick={() => void updateSetting('notificationUpdateEnabled')} disabled={!settings.notificationPushEnabled}>
                <span style={toggleTrackStyle(settings.notificationUpdateEnabled)}><span style={toggleKnobStyle(settings.notificationUpdateEnabled)} /></span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {message ? <p className="ac-message">{message}</p> : null}
    </PageShell>
  );
};

export const AccountPage = () => {
  const { user, activeChild, children, setUserProfile } = useAuth();
  const settings = loadLocalSettings();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const maskMobile = (value?: string | null) => {
    const raw = (value ?? '').trim();
    if (!raw) return '当前未提供';
    return raw.length >= 7 ? `${raw.slice(0, 3)}****${raw.slice(-4)}` : raw;
  };
  const displayMobile = settings.hideMobileMask ? '已隐藏' : maskMobile(user?.mobile);

  useEffect(() => {
    setNickname(user?.nickname ?? '');
  }, [user?.nickname]);

  useEffect(() => {
    setMobile('');
  }, [user?.mobile]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const onSave = async () => {
    const trimmed = nickname.trim();
    const trimmedMobile = mobile.trim();
    if (!trimmed) {
      setMessage('昵称不能为空');
      return;
    }
    if (trimmedMobile && !mobilePattern.test(trimmedMobile)) {
      setMessage('手机号需为 11 位数字');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const nextProfile = await webApi.updateMe({
        nickname: trimmed,
        ...(trimmedMobile ? { mobile: trimmedMobile } : {}),
      });
      setUserProfile(nextProfile);
      if (trimmedMobile) setMobile('');
      setMessage(trimmedMobile ? '资料保存成功' : '昵称保存成功');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '资料保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isSupportedImageFile(file)) {
      setMessage('头像仅支持 JPG、PNG、WebP、HEIC 图片');
      return;
    }

    const uploadFile = withResolvedFileMimeType(file);
    const previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(uploadFile) : null;
    setAvatarPreviewUrl(previewUrl);
    setAvatarUploading(true);
    setMessage('头像保存中…');
    try {
      const uploadChildNo = activeChild?.child_no ?? children[0]?.child_no;
      if (!uploadChildNo) {
        throw new Error('当前账号还没有可关联的家庭档案，暂时无法上传头像');
      }
      const avatarUrl = await uploadAvatarImage(uploadChildNo, uploadFile, previewUrl);
      const nextProfile = await webApi.updateMe({ avatar_url: avatarUrl });
      setUserProfile({ ...(user ?? nextProfile), ...nextProfile, avatar_url: avatarUrl });
      setAvatarPreviewUrl(null);
      setMessage('头像已更新');
    } catch (err) {
      setAvatarPreviewUrl(null);
      setMessage(normalizeUploadErrorMessage(err instanceof Error ? err.message : '头像上传失败', 'image'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const registeredAt = (() => {
    const raw = (user as { created_at?: string } | null)?.created_at;
    if (!raw) return '未记录';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '未记录';
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  })();

  return (
    <PageShell title="账号" backTo="/profile" className="account-shell">
      <div className="ac-card ac-hero">
        <label aria-label="更换头像" className="ac-avatar">
          <ProfileAvatar src={avatarPreviewUrl ?? user?.avatar_url} mediaNo={user?.avatar_media_no} label={user?.nickname ?? '我的头像'} />
          <span className="ac-avatar-badge" aria-hidden="true"><Camera size={15} strokeWidth={2.2} /></span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={avatarUploading} onChange={(event) => void onAvatarChange(event)} style={{ display: 'none' }} />
        </label>
        <span className="ac-avatar-tip">{avatarUploading ? '头像上传中…' : '更换头像'}</span>
      </div>

      <div className="ac-card">
        <div className="ac-row">
          <span className="ac-label">昵称</span>
          <input className="ac-input" value={nickname} onChange={(event) => setNickname(event.target.value)} aria-label="昵称" />
          <Pencil size={16} className="ac-chevron" aria-hidden="true" />
        </div>
        <div className="ac-row">
          <span className="ac-label">手机号</span>
          <input
            className="ac-input"
            value={mobile}
            onChange={(event) => {
              const digits = event.target.value.replace(/[^\d]/g, '');
              const withoutCountryCode = digits.length > 11 && digits.startsWith('86') ? digits.slice(2) : digits;
              setMobile(withoutCountryCode.slice(0, 11));
            }}
            placeholder={displayMobile}
            inputMode="tel"
            aria-label="手机号"
          />
          <Pencil size={16} className="ac-chevron" aria-hidden="true" />
        </div>
        <div className="ac-row is-static">
          <span className="ac-label">微信</span>
          <span className="ac-value">未绑定</span>
        </div>
        <div className="ac-row is-static">
          <span className="ac-label">注册时间</span>
          <span className="ac-value">{registeredAt}</span>
        </div>
      </div>

      {message ? <p className="ac-message">{message}</p> : null}

      <button type="button" className="ac-save" onClick={() => void onSave()} disabled={saving}>
        {saving ? '保存中…' : '保存修改'}
      </button>
      <p className="ac-footnote">昵称会显示在家人看到的记录里</p>
    </PageShell>
  );
};

const displayPreferenceKey = 'nianlun:display-prefs:v1';

type DisplayPreferences = { elder: boolean; night: boolean };

const readDisplayPreferences = (): DisplayPreferences => {
  if (typeof window === 'undefined') return { elder: false, night: false };
  try {
    const raw = window.localStorage.getItem(displayPreferenceKey);
    if (!raw) return { elder: false, night: false };
    const parsed = JSON.parse(raw) as Partial<DisplayPreferences>;
    return { elder: Boolean(parsed.elder), night: Boolean(parsed.night) };
  } catch {
    return { elder: false, night: false };
  }
};

const applyDisplayPreferences = ({ elder, night }: DisplayPreferences) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (elder) root.dataset.elder = 'true';
  else delete root.dataset.elder;
  if (night) root.dataset.theme = 'night';
  else delete root.dataset.theme;
};

const saveDisplayPreferences = (preferences: DisplayPreferences) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(displayPreferenceKey, JSON.stringify(preferences));
  } catch {
    // A blocked storage write must not break the settings screen.
  }
};

export const SettingsPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<LocalSettings>(() => loadLocalSettings());
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [display, setDisplay] = useState<DisplayPreferences>(readDisplayPreferences);
  const preferenceSyncSeqRef = useRef(0);

  useEffect(() => {
    applyDisplayPreferences(display);
    saveDisplayPreferences(display);
  }, [display]);

  useEffect(() => {
    let active = true;
    void webApi
      .preferences()
      .then((preferences) => {
        if (!active || preferenceSyncSeqRef.current > 0) return;
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
    const seq = preferenceSyncSeqRef.current + 1;
    preferenceSyncSeqRef.current = seq;
    setSettings(next);
    saveLocalSettings(next);
    setSyncing(true);
    setMessage('设置已保存在本机，正在同步账号。');

    try {
      const synced = await webApi.updatePreferences(localSettingsToPreferences(next));
      if (seq !== preferenceSyncSeqRef.current) return;
      const syncedSettings = preferencesToLocalSettings(synced);
      setSettings(syncedSettings);
      saveLocalSettings(syncedSettings);
      setMessage('设置已同步到账号。');
    } catch {
      if (seq === preferenceSyncSeqRef.current) {
        setMessage('设置已保存在本机，服务器同步稍后可重试。');
      }
    } finally {
      if (seq === preferenceSyncSeqRef.current) setSyncing(false);
    }
  };

  const appVersion = import.meta.env.VITE_APP_VERSION ?? '2.0.4';
  const clearLocalCaches = () => {
    try {
      const keys: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key && (key.startsWith('nianlun.search.history') || key.startsWith('nianlun.media') || key.startsWith('nianlun.runtime-media'))) keys.push(key);
      }
      keys.forEach((key) => window.localStorage.removeItem(key));
      setMessage('本机缓存已清理。');
    } catch {
      setMessage('当前环境无法清理缓存。');
    }
  };

  return (
    <PageShell title="设置" backTo="/profile" className="settings-shell">
      <section className="set-group" aria-label="记录">
        <h2 className="set-group-title">记录</h2>
        <div className="set-card">
          <button type="button" className="set-row" onClick={() => navigate('/profile/notifications')}>
            <span className="set-icon"><Bell size={22} strokeWidth={1.8} /></span>
            <span className="set-body"><strong>通知提醒</strong><small>开启家庭成员动态提醒</small></span>
            <ChevronRight size={18} className="set-chevron" />
          </button>
          <button type="button" className="set-row" onClick={() => setMessage('当前默认仅家庭成员可见。')}>
            <span className="set-icon"><ShieldCheck size={22} strokeWidth={1.8} /></span>
            <span className="set-body"><strong>默认可见范围</strong><small>新记录默认对家人可见</small></span>
            <span className="set-value">仅家庭成员</span>
            <ChevronRight size={18} className="set-chevron" />
          </button>
          <div className="set-row is-static">
            <span className="set-icon"><Users size={22} strokeWidth={1.8} /></span>
            <span className="set-body"><strong>手机号搜索</strong><small>允许家人通过手机号找到你</small></span>
            <button type="button" aria-label="手机号搜索" aria-pressed={!settings.hideMobileMask} style={toggleButtonStyle(!settings.hideMobileMask)} onClick={() => void updateSetting('hideMobileMask')} disabled={syncing}>
              <span style={toggleTrackStyle(!settings.hideMobileMask)}><span style={toggleKnobStyle(!settings.hideMobileMask)} /></span>
            </button>
          </div>
        </div>
      </section>

      <section className="set-group" aria-label="长辈与阅读">
        <h2 className="set-group-title">长辈与阅读</h2>
        <div className="set-card">
          {[
            { key: 'elder' as const, icon: <Type size={22} strokeWidth={1.8} />, title: '长辈模式', description: '字号 ×1.2 · 加大行高' },
            { key: 'night' as const, icon: <Moon size={22} strokeWidth={1.8} />, title: '夜间暖光', description: '深色底 · 低亮度' },
          ].map((item) => {
            const enabled = display[item.key];
            return (
              <div key={item.key} className="set-row is-static">
                <span className="set-icon">{item.icon}</span>
                <span className="set-body"><strong>{item.title}</strong><small>{item.description}</small></span>
                <button type="button" aria-label={item.title} aria-pressed={enabled} style={toggleButtonStyle(enabled)} onClick={() => setDisplay((current) => ({ ...current, [item.key]: !current[item.key] }))}>
                  <span style={toggleTrackStyle(enabled)}><span style={toggleKnobStyle(enabled)} /></span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="set-group" aria-label="数据">
        <h2 className="set-group-title">数据</h2>
        <div className="set-card">
          <button type="button" className="set-row" onClick={() => navigate('/profile/help')}>
            <span className="set-icon"><DownloadCloud size={22} strokeWidth={1.8} /></span>
            <span className="set-body"><strong>导出与备份</strong><small>申请导出全部记录</small></span>
            <ChevronRight size={18} className="set-chevron" />
          </button>
          <button type="button" className="set-row" onClick={clearLocalCaches}>
            <span className="set-icon"><Trash2 size={22} strokeWidth={1.8} /></span>
            <span className="set-body"><strong>清理本机缓存</strong><small>搜索记录与本地预览</small></span>
          </button>
        </div>
      </section>

      <section className="set-group" aria-label="关于">
        <h2 className="set-group-title">关于</h2>
        <div className="set-card">
          <button type="button" className="set-row" onClick={() => navigate('/profile/legal?doc=privacy')}>
            <span className="set-icon"><ShieldCheck size={22} strokeWidth={1.8} /></span>
            <span className="set-body"><strong>隐私政策</strong></span>
            <ChevronRight size={18} className="set-chevron" />
          </button>
          <button type="button" className="set-row" onClick={() => navigate('/profile/legal?doc=terms')}>
            <span className="set-icon"><FileText size={22} strokeWidth={1.8} /></span>
            <span className="set-body"><strong>用户协议</strong></span>
            <ChevronRight size={18} className="set-chevron" />
          </button>
          <div className="set-row is-static">
            <span className="set-icon"><Info size={22} strokeWidth={1.8} /></span>
            <span className="set-body"><strong>版本 {appVersion}</strong></span>
          </div>
        </div>
      </section>

      {message ? <p style={{ ...helperTextStyle, color: 'var(--nl-success)' }}>{message}</p> : null}
      <p className="set-footer">年轮 · 留住每一天</p>
    </PageShell>
  );
};

export const ReportsPage = () => {
  const navigate = useNavigate();
  const { activeChild } = useAuth();
  const [submittingBookRequest, setSubmittingBookRequest] = useState(false);
  const [bookMessage, setBookMessage] = useState<string | null>(null);
  const { data: records, loading, error } = useAsyncData<RecordSummary[]>(
    async () => {
      if (!activeChild) return [];
      return listRecordsForReport(activeChild.child_no);
    },
    [activeChild?.child_no],
  );
  const {
    data: membershipBookRequests,
    loading: membershipBookLoading,
    error: membershipBookError,
    setData: setMembershipBookRequests,
  } = useAsyncData<MembershipBookRequestItem[]>(
    async () => {
      if (!activeChild) return [];
      const result = await webApi.listMembershipBookRequests();
      return result.list;
    },
    [activeChild?.child_no],
  );
  const currentDate = new Date();
  const reportDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const reportYear = reportDate.getFullYear();
  const reportMonth = reportDate.getMonth() + 1;
  const bookYear = currentDate.getFullYear();
  const monthKey = toMonthKey(reportDate);
  const monthlyRecords = (records ?? []).filter((item) => toMonthKey(item.event_time) === monthKey);
  const milestoneCount = monthlyRecords.filter((item) => item.is_milestone).length;
  const mediaRecords = monthlyRecords.filter((item) => item.cover_url && item.cover_media_type !== 'audio');
  const imageCount = mediaRecords.length;
  const textCount = monthlyRecords.filter((item) => item.record_type === 'text').length;
  const hasMonthlyRecords = monthlyRecords.length > 0;
  const latest = monthlyRecords[0];
  const coverRecord = mediaRecords[0] ?? latest;
  const coverMediaKind = getRecordMediaKind(coverRecord);
  const coverUrl = useCachedMediaUrl(coverRecord?.cover_media_no, coverRecord?.cover_url, coverMediaKind ?? 'image', {
    cacheRemote: coverMediaKind !== 'audio',
  });
  const monthlyKeywords = Array.from(
    new Set([
      ...monthlyRecords.flatMap((item) => item.tags ?? []),
      ...(milestoneCount ? ['里程碑'] : []),
      ...(imageCount ? ['影像'] : []),
      ...(textCount ? ['文字'] : []),
    ]),
  ).slice(0, 5);
  const monthlySummary = monthlyRecords.length
    ? `${monthlyRecords.length} 个成长瞬间，${milestoneCount} 个里程碑，${imageCount} 条影像记录。`
    : '本月暂无真实记录。';
  const bookRequestsList = membershipBookRequests ?? [];

  const submitMembershipBookRequest = async () => {
    setSubmittingBookRequest(true);
    setBookMessage(null);
    try {
      const result = await webApi.requestMembershipBook({
        year: bookYear,
        note: `${reportYear}年${reportMonth}月月报页发起纪念册整理`,
      });
      const nextRequest: MembershipBookRequestItem = {
        request_no: result.request_no,
        year: result.year,
        status: result.status,
        contact: null,
        note: null,
        created_at: result.created_at,
      };
      setMembershipBookRequests((current) => [nextRequest, ...(current ?? []).filter((item) => item.request_no !== nextRequest.request_no)].slice(0, 10));
      setBookMessage(result.message);
    } catch (err) {
      setBookMessage(err instanceof Error ? err.message : '纪念册申请提交失败，请稍后再试');
    } finally {
      setSubmittingBookRequest(false);
    }
  };

  return (
    <PageShell title="月报与纪念册" backTo="/profile">
      {loading ? <Panel><EmptyState message="正在整理月度记录…" /></Panel> : null}
      {error ? <Panel><EmptyState message={`月报加载失败：${error}`} /></Panel> : null}
      {!loading && !error ? (
        <>
          <section
            style={{
              borderRadius: '8px',
              padding: '0',
              position: 'relative',
              border: '1px solid var(--nl-border)',
              background: 'var(--nl-surface)',
              boxShadow: 'none',
              display: 'grid',
              gap: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'relative', minHeight: '154px', background: 'rgba(var(--nl-surface-rgb),0.72)' }}>
              {coverUrl ? (
                <img src={coverUrl} alt="月报封面" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={referenceAssets.childPhoto} alt="月报封面" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--nl-photo-hero-scrim)' }} />
              <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, display: 'grid', gap: 6 }}>
                <span style={{ color: 'var(--nl-on-dark-muted)', fontSize: '12px', fontWeight: 700 }}>{hasMonthlyRecords ? '月报' : '待生成'}</span>
                <h2 style={{ margin: 0, color: 'var(--nl-on-primary)', fontSize: '27px', fontWeight: 760, lineHeight: 1.12, textShadow: 'var(--nl-text-shadow-hero)' }}>
                  {reportYear}年{reportMonth}月成长月报
                </h2>
              </div>
            </div>

            <div style={{ padding: '18px 18px 20px', display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {[
                { label: '记录数量', value: monthlyRecords.length },
                { label: '影像记录', value: imageCount },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: '8px', background: 'rgba(var(--nl-surface-rgb),0.72)', border: '1px solid var(--nl-border)', padding: '12px', textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: '19px', color: 'var(--nl-ink)', lineHeight: 1 }}>{item.value}</strong>
                  <span style={{ display: 'block', marginTop: '6px', color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 700 }}>{item.label}</span>
                </div>
              ))}
            </div>

            {monthlyKeywords.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {monthlyKeywords.map((item) => (
                <span key={item} style={{ borderRadius: '8px', border: '1px solid var(--nl-border-muted)', background: 'transparent', color: 'var(--nl-muted-strong)', padding: '6px 10px', fontSize: '11px', fontWeight: 600 }}>#{item}</span>
              ))}
            </div>
            ) : null}

            <div style={{ borderRadius: '8px', background: 'rgba(var(--nl-primary-rgb),0.08)', border: '1px solid var(--nl-border)', padding: '14px', display: 'grid', gap: '8px' }}>
              <strong style={{ color: 'var(--nl-accent)', fontSize: '13px' }}>月度故事摘要</strong>
              <p style={{ ...helperTextStyle, lineHeight: 1.8 }}>{monthlySummary}</p>
            </div>

            {!hasMonthlyRecords ? (
              <div style={{ borderRadius: '8px', background: 'rgba(var(--nl-accent-rgb),0.1)', border: '1px dashed rgba(var(--nl-accent-rgb),0.34)', padding: '14px', display: 'grid', gap: '8px' }}>
                <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 700 }}>本月还没有记录</strong>
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 48px', gap: '10px', alignItems: 'center' }}>
              <button type="button" style={{ ...primaryButtonStyle, width: '100%', minHeight: '44px' }} onClick={() => latest ? navigate(`/record/${latest.record_no}`) : navigate('/record/create')}>
                {hasMonthlyRecords ? '查看月报' : '添加记录'}
              </button>
              <button type="button" aria-label="导出月报摘要" title="导出月报摘要" style={{ ...secondaryButtonStyle, width: '48px', minWidth: '48px', minHeight: '48px', padding: 0, borderRadius: '8px', justifyContent: 'center' }} onClick={() => navigate('/profile/export')}>
                <DownloadCloud size={18} strokeWidth={2.2} />
              </button>
            </div>

            </div>
          </section>

          <Panel style={{ display: 'grid', gap: 12, borderRadius: '8px', boxShadow: 'none', background: 'transparent' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 680 }}>纪念册同步</strong>
              <button
                type="button"
                style={{ ...secondaryButtonStyle, minHeight: 38, padding: '8px 12px', borderRadius: '8px', boxShadow: 'none', flexShrink: 0 }}
                onClick={() => void submitMembershipBookRequest()}
                disabled={submittingBookRequest}
              >
                {submittingBookRequest ? '提交中…' : `${bookYear}年纪念册整理`}
              </button>
            </div>
            {membershipBookLoading ? <p style={{ ...helperTextStyle, margin: 0 }}>正在同步纪念册状态…</p> : null}
            {membershipBookError ? <p style={{ ...helperTextStyle, margin: 0, color: 'var(--nl-danger)' }}>纪念册状态同步失败：{membershipBookError}</p> : null}
            {bookMessage ? <p style={{ ...helperTextStyle, margin: 0, color: isPositiveStatusMessage(bookMessage) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{bookMessage}</p> : null}
            {!membershipBookLoading && !membershipBookError && !bookRequestsList.length ? (
              <p style={{ ...helperTextStyle, margin: 0 }}>暂无纪念册申请记录。</p>
            ) : null}
            {bookRequestsList.slice(0, 3).map((item) => (
              <div key={item.request_no} style={{ borderTop: '1px solid var(--nl-border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <span style={{ minWidth: 0, display: 'grid', gap: 3 }}>
                  <strong style={{ color: 'var(--nl-ink)', fontSize: 13, fontWeight: 660 }}>{item.year}年纪念册</strong>
                  <span style={{ color: 'var(--nl-muted)', fontSize: 11, fontWeight: 600 }}>{formatProfileDateTime(item.created_at)}</span>
                </span>
                <span style={{ color: membershipBookStatusColor(item.status), fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{membershipBookStatusText(item.status)}</span>
              </div>
            ))}
          </Panel>

          {mediaRecords.length ? (
            <Panel>
              <div style={rowStyle}>
                <strong>影像墙</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  {mediaRecords.slice(0, 6).map((item) => (
                    <ReportMediaWallItem key={item.record_no} item={item} onClick={() => navigate(`/record/${item.record_no}`)} />
                  ))}
                </div>
              </div>
            </Panel>
          ) : null}

          {monthlyRecords.length ? (
            <Panel>
              <div style={rowStyle}>
                <strong>记录清单</strong>
                {monthlyRecords.slice(0, 6).map((item) => (
                  <button key={item.record_no} type="button" style={{ ...secondaryButtonStyle, borderRadius: '8px', textAlign: 'left', justifyContent: 'space-between' }} onClick={() => navigate(`/record/${item.record_no}`)}>
                    <span style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontWeight: 700 }}>{item.title ?? '未命名记录'}</span>
                      <span style={{ color: 'var(--nl-muted)', fontSize: '12px' }}>{formatAppDateTime(item.event_time)}</span>
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
  const [summaryPreview, setSummaryPreview] = useState<ArchiveExportSummaryResponse | null>(null);
  const [summaryCopied, setSummaryCopied] = useState(false);
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
      setSummaryPreview(result);
      setSummaryCopied(false);
      const nativeSave = await saveTextFileToDownloads({
        fileName: result.file_name,
        content: result.content,
        mimeType: result.mime_type,
      });
      const savedToDownloads = Boolean(nativeSave?.saved);
      if (!savedToDownloads) {
        try {
          const blob = new Blob([result.content], { type: result.mime_type });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = result.file_name;
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch {
          // Some mobile WebViews block download gestures; the preview below remains usable.
        }
      }
      setMessage(
        savedToDownloads
          ? `档案摘要已生成：${result.summary.record_count} 条记录、${result.summary.media_count} 个媒体。已保存到系统下载目录，下方可查看和复制。`
          : `档案摘要已生成：${result.summary.record_count} 条记录、${result.summary.media_count} 个媒体。下方可查看和复制；若系统支持下载，已同时触发保存。`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '档案摘要生成失败，请稍后再试');
    } finally {
      setDownloadingSummary(false);
    }
  };

  const copySummary = async () => {
    if (!summaryPreview) return;
    try {
      await navigator.clipboard.writeText(summaryPreview.content);
      setSummaryCopied(true);
      setMessage('档案摘要已复制，可粘贴保存。');
    } catch {
      setSummaryCopied(false);
      setMessage('当前系统不允许自动复制，请长按下方内容手动选择。');
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
    { value: 'all' as const, title: '全部数据' },
    { value: 'media' as const, title: '图片和视频' },
    { value: 'text' as const, title: '文字记录' },
  ];
  const archiveRequestDisabled = !canExportArchive || Boolean(submittingArchiveRequest);

  return (
    <PageShell title="导出与备份" backTo="/profile">
      <Panel style={{ borderRadius: '8px', display: 'grid', gap: '11px', boxShadow: 'none', background: 'transparent' }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 660 }}>
          <ShieldCheck size={17} color="var(--nl-success)" />
          安全规则
        </strong>
        <div style={{ display: 'grid', gap: '8px' }}>
          {[
            '只有家庭管理员可以发起完整导出和成年移交申请。',
            '导出申请会写入后台审计，方便追踪谁在什么时候处理过档案。',
            '记录默认家庭成员可见，不会自动公开到家庭外部。',
          ].map((item) => (
            <p key={item} style={{ ...helperTextStyle, margin: 0, lineHeight: 1.65 }}>· {item}</p>
          ))}
        </div>
      </Panel>

      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 760, color: 'var(--nl-ink)' }}>导出内容</h2>
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
                  borderRadius: '8px',
                  border: selected ? '1.5px solid rgba(var(--nl-primary-rgb),0.32)' : '1px solid var(--nl-border)',
                  background: selected ? 'rgba(var(--nl-primary-rgb),0.12)' : 'transparent',
                  minHeight: '68px',
                  padding: '13px 15px',
                  display: 'grid',
                  gridTemplateColumns: '36px minmax(0, 1fr) 22px',
                  gap: '12px',
                  alignItems: 'center',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: 'none',
                }}
              >
                <span style={{ width: '36px', height: '36px', borderRadius: '8px', background: selected ? 'rgba(var(--nl-primary-rgb),0.12)' : 'transparent', border: '1px solid var(--nl-border)', color: selected ? 'var(--nl-primary-2)' : 'var(--nl-muted)', display: 'grid', placeItems: 'center' }}>
                  <FileBox size={17} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 700 }}>{item.title}</strong>
                </span>
                {selected ? <CheckCircle2 size={20} color="var(--nl-accent)" strokeWidth={2.4} /> : <span style={{ width: '18px', height: '18px', borderRadius: '999px', border: '1px solid var(--nl-border)', background: 'var(--nl-on-dark-faint)' }} />}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? <EmptyState message="正在整理档案摘要…" /> : null}
      {error ? <EmptyState message={`摘要整理失败：${error}`} /> : null}

      <Panel style={{ display: 'grid', gap: '12px', borderRadius: '8px', boxShadow: 'none', background: 'transparent' }}>
        <div style={{ display: 'grid', gap: '6px' }}>
          <strong style={{ color: 'var(--nl-ink)', fontSize: '15px' }}>交付记录</strong>
          <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.65, color: canExportArchive ? 'var(--nl-success)' : 'var(--nl-primary-2)' }}>
            {canExportArchive ? '家庭管理员可提交导出申请。' : '仅家庭管理员可导出。'}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: '10px' }}>
          <button
            type="button"
            style={{ ...secondaryButtonStyle, minHeight: '46px', borderRadius: '8px', justifyContent: 'center' }}
            onClick={() => void submitArchiveRequest('backup')}
            disabled={archiveRequestDisabled}
          >
            {submittingArchiveRequest === 'backup' ? '提交中…' : '打包申请'}
          </button>
          <button
            type="button"
            style={{ ...secondaryButtonStyle, minHeight: '46px', borderRadius: '8px', justifyContent: 'center' }}
            onClick={() => void submitArchiveRequest('adult_handoff')}
            disabled={archiveRequestDisabled}
          >
            {submittingArchiveRequest === 'adult_handoff' ? '提交中…' : '成年移交'}
          </button>
        </div>
        <div style={{ display: 'grid', gap: '10px', paddingTop: '2px' }}>
          <strong style={{ color: 'var(--nl-ink)', fontSize: '14px' }}>最近申请</strong>
          {archiveRequestsLoading ? <p style={{ ...helperTextStyle, margin: 0 }}>正在读取最近交付申请…</p> : null}
      {archiveRequestsError ? <p style={{ ...helperTextStyle, margin: 0, color: 'var(--nl-danger)' }}>最近申请读取失败：{archiveRequestsError}</p> : null}
          {!archiveRequestsLoading && !archiveRequestsError && archiveRequestsList.length === 0 ? (
            <p style={{ ...helperTextStyle, margin: 0 }}>暂无交付申请。</p>
          ) : null}
          {archiveRequestsList.map((item) => (
            <div
              key={item.request_no}
              style={{
                border: '1px solid var(--nl-border)',
                borderRadius: '8px',
                padding: '12px',
                display: 'grid',
                gap: '8px',
                background: 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', lineHeight: 1.35 }}>
                  {archiveExportPurposeText(item.purpose)} · {archiveExportTypeText(item.export_type)}
                </strong>
                <span style={{ color: archiveExportStatusColor(item.status), fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {archiveExportStatusText(item.status)}
                </span>
              </div>
              <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.6 }}>
                {item.record_count} 条记录、{item.media_count} 个媒体、{item.milestone_count} 个里程碑 · {formatProfileDateTime(item.created_at)}
              </p>
              {item.process_note ? <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.6 }}>处理备注：{item.process_note}</p> : null}
              {item.status === 'completed' ? (
                <button
                  type="button"
                  style={{ ...secondaryButtonStyle, minHeight: '40px', padding: '8px 12px', borderRadius: '8px', justifyContent: 'center', width: 'fit-content', boxShadow: 'none' }}
                  onClick={() => void downloadSummary()}
                  disabled={downloadingSummary}
                >
                  {downloadingSummary ? '生成中…' : '下载交付摘要'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>

        {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
      {summaryPreview ? (
        <Panel style={{ display: 'grid', gap: '12px', borderRadius: '8px', boxShadow: 'none', background: 'transparent' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
            <span style={{ minWidth: 0, display: 'grid', gap: '3px' }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: '15px', fontWeight: 660 }}>档案摘要</strong>
              <span style={{ color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 620, overflowWrap: 'anywhere' }}>{summaryPreview.file_name}</span>
            </span>
            <button type="button" style={{ ...secondaryButtonStyle, minHeight: '40px', padding: '8px 12px', borderRadius: '8px', boxShadow: 'none', flexShrink: 0 }} onClick={() => void copySummary()}>
              {summaryCopied ? '已复制' : '复制摘要'}
            </button>
          </div>
          <textarea
            aria-label="档案摘要内容"
            readOnly
            value={summaryPreview.content}
            style={{
              ...textareaStyle,
              minHeight: '180px',
              resize: 'vertical',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '12px',
              lineHeight: 1.7,
              userSelect: 'text',
            }}
          />
        </Panel>
      ) : null}
      <button type="button" style={{ ...primaryButtonStyle, width: '100%', minHeight: '50px', borderRadius: '8px' }} onClick={() => void downloadSummary()} disabled={loading || downloadingSummary || Boolean(error) || !canExportArchive}>
        {downloadingSummary ? '正在生成…' : '下载摘要'}
      </button>
    </PageShell>
  );
};

export const MembershipPage = () => {
  const { user, setUserProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const membershipType = user?.membership_type ?? 'free';
  const hasEnhancedAccess = ['premium', 'family', 'family_member', 'ai_plus'].includes(membershipType);
  const serviceBadge = hasEnhancedAccess ? (membershipType === 'ai_plus' ? '增强整理' : membershipType === 'premium' ? '高级权限' : '家庭协作') : '基础账号';
  const serviceStatusText = '服务状态仅反映当前账号配置，具体能力以页面实际可用为准。';
  const membershipMessageIsError = message ? /失败|无法|暂时|错误/.test(message) : false;

  const refreshMembership = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const profile = await webApi.me();
      setUserProfile(profile);
      setMessage('服务状态已刷新');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '服务状态刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <PageShell title="服务状态" backTo="/profile">
      <section style={{ borderRadius: '8px', border: '1px solid var(--nl-border-strong)', background: 'rgba(var(--nl-surface-strong-rgb),0.46)', padding: '16px', minHeight: '124px', color: 'var(--nl-ink)', display: 'grid', gap: '13px', boxShadow: 'var(--nl-shadow-sm)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
            <ProfileAvatar src={user?.avatar_url} mediaNo={user?.avatar_media_no} label={user?.nickname ?? '账号'} />
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '16px', fontWeight: 720 }}>{user?.nickname ?? '年轮账号'}</strong>
              <span style={{ display: 'block', marginTop: '5px', color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 650 }}>{membershipTypeLabel(user?.membership_type)}</span>
            </div>
          </div>
          <span style={{ borderRadius: '8px', background: 'transparent', color: hasEnhancedAccess ? 'var(--nl-primary-2)' : 'var(--nl-muted-strong)', border: hasEnhancedAccess ? '1px solid rgba(var(--nl-primary-rgb),0.18)' : '1px solid var(--nl-border-muted)', padding: '4px 8px', fontSize: '10px', fontWeight: 620 }}>{serviceBadge}</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '12px' }}>
          <p style={{ margin: 0, color: 'var(--nl-muted)', fontSize: '12px', lineHeight: 1.6 }}>
            有效期：{user?.membership_expire_at ? formatAppDateTime(user.membership_expire_at, '日期待确认') : '长期有效'}
          </p>
          <button type="button" style={{ ...secondaryButtonStyle, minHeight: '44px', padding: '8px 12px', color: 'var(--nl-ink)', fontSize: '12px' }} onClick={() => void refreshMembership()} disabled={refreshing}>
            {refreshing ? '刷新中' : '刷新状态'}
          </button>
        </div>
      </section>

      <Panel style={{ borderRadius: '8px' }}>
        <div style={rowStyle}>
          <p style={{ ...helperTextStyle, lineHeight: 1.75 }}>{serviceStatusText}</p>
          {message ? <p style={{ ...helperTextStyle, color: membershipMessageIsError ? 'var(--nl-danger)' : 'var(--nl-success)' }}>{message}</p> : null}
        </div>
      </Panel>
    </PageShell>
  );
};

export const SecurityPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const rows = [
    { title: '手机号码', value: user?.mobile ?? '当前未提供', icon: Smartphone, action: '修改', onClick: () => navigate('/profile/account') },
    {
      title: '登录密码',
      value: '已设置',
      icon: KeyRound,
      action: passwordPanelOpen ? '收起' : '修改',
      onClick: () => setPasswordPanelOpen((open) => !open),
    },
  ];

  const submitPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCurrent = currentPassword.trim();
    const normalizedNext = newPassword.trim();
    const normalizedConfirm = newPasswordConfirm.trim();
    if (!normalizedCurrent) {
      setPasswordMessage('请输入当前密码');
      return;
    }
    if (normalizedCurrent.length < 8) {
      setPasswordMessage('当前密码至少 8 位');
      return;
    }
    if (normalizedNext.length < 8 || normalizedNext.length > 12) {
      setPasswordMessage('新密码需为 8 到 12 位');
      return;
    }
    if (normalizedNext !== normalizedConfirm) {
      setPasswordMessage('两次新密码不一致');
      return;
    }
    if (normalizedNext === normalizedCurrent) {
      setPasswordMessage('新密码不能与当前密码相同');
      return;
    }

    setPasswordSubmitting(true);
    setPasswordMessage(null);
    try {
      const result = await webApi.changePassword({
        current_password: normalizedCurrent,
        new_password: normalizedNext,
        new_password_confirm: normalizedConfirm,
      });
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setPasswordMessage(result.message || '登录密码已更新');
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '密码修改失败，请稍后再试');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <PageShell className="info-shell" title="账号与安全" backTo="/profile">
      <Panel className="info-card" style={{ padding: 0, overflow: 'hidden', background: 'transparent', border: 'none', boxShadow: 'none' }}>
        {rows.map((item, index) => {
          const Icon = item.icon;
          const clickable = Boolean(item.onClick);
          return (
          <div
            key={item.title}
            style={{
              width: '100%',
              minHeight: '62px',
              border: 'none',
              borderBottom: index === rows.length - 1 ? 'none' : '1px solid var(--nl-border-muted)',
              background: 'transparent',
              padding: '0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'left',
              boxSizing: 'border-box',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--nl-muted-strong)', fontSize: '14px', fontWeight: 700 }}>
              <Icon size={17} color="var(--nl-primary-2)" strokeWidth={2} />
              {item.title}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--nl-muted)', fontSize: '13px', fontWeight: 700, minWidth: 0 }}>
              <span style={{ whiteSpace: 'nowrap' }}>{item.value}</span>
              {clickable ? (
                <button type="button" onClick={item.onClick} aria-expanded={item.title === '登录密码' ? passwordPanelOpen : undefined} style={{ border: 'none', background: 'transparent', color: 'var(--nl-primary-2)', fontSize: '12px', fontWeight: 700, padding: '6px 0', cursor: 'pointer' }}>
                  {item.action}
                </button>
              ) : (
                <span style={{ color: 'var(--nl-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>{item.action}</span>
              )}
            </span>
          </div>
          );
        })}
      </Panel>
      {passwordPanelOpen ? (
      <Panel className="info-card security-form" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '16px 18px' }}>
        <form onSubmit={(event) => void submitPasswordChange(event)} style={rowStyle}>
          <strong>修改登录密码</strong>
          <Field label="当前密码">
            <input
              style={inputStyle}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="请输入当前密码"
              maxLength={72}
            />
          </Field>
          <Field label="新密码">
            <input
              style={inputStyle}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="8 到 12 位"
              maxLength={12}
            />
          </Field>
          <Field label="确认新密码">
            <input
              style={inputStyle}
              type="password"
              autoComplete="new-password"
              value={newPasswordConfirm}
              onChange={(event) => setNewPasswordConfirm(event.target.value)}
              placeholder="再次输入新密码"
              maxLength={12}
            />
          </Field>
          {passwordMessage ? (
            <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(passwordMessage) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>
              {passwordMessage}
            </p>
          ) : null}
          <button type="submit" disabled={passwordSubmitting} style={{ ...primaryButtonStyle, width: '100%', justifyContent: 'center', minHeight: '48px', borderRadius: '8px', opacity: passwordSubmitting ? 0.72 : 1 }}>
            {passwordSubmitting ? '修改中…' : '修改密码'}
          </button>
        </form>
      </Panel>
      ) : null}
      <button type="button" className="info-danger-row" onClick={() => navigate('/profile/account-delete')} style={{ ...secondaryButtonStyle, width: '100%', color: 'var(--nl-danger)', justifyContent: 'center', minHeight: '48px', marginTop: '10px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--nl-danger-soft)' }}>
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
    <PageShell className="info-shell" title="注销账号" backTo="/profile/security">
      <Panel className="info-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '16px 18px' }}>
        <div style={rowStyle}>
          <strong style={{ color: 'var(--nl-ink)', fontSize: '16px', fontWeight: 720 }}>注销前检查</strong>
          <p style={helperTextStyle}>系统会先检查家庭所有权和儿童信息。</p>
          {loading ? <p style={helperTextStyle}>正在检查当前账号状态…</p> : null}
          {!loading && check ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                <Panel style={{ padding: '14px 16px', borderRadius: '8px', boxShadow: 'none', background: 'rgba(var(--nl-surface-rgb),0.14)', border: '1px solid var(--nl-border-muted)' }}>
                  <strong style={{ fontSize: '20px', color: 'var(--nl-ink)' }}>{check.summary.owned_family_count}</strong>
                  <p style={helperTextStyle}>拥有家庭</p>
                </Panel>
                <Panel style={{ padding: '14px 16px', borderRadius: '8px', boxShadow: 'none', background: 'rgba(var(--nl-surface-rgb),0.14)', border: '1px solid var(--nl-border-muted)' }}>
                  <strong style={{ fontSize: '20px', color: 'var(--nl-ink)' }}>{check.summary.joined_family_count}</strong>
                  <p style={helperTextStyle}>加入家庭</p>
                </Panel>
                <Panel style={{ padding: '14px 16px', borderRadius: '8px', boxShadow: 'none', background: 'rgba(var(--nl-surface-rgb),0.14)', border: '1px solid var(--nl-border-muted)' }}>
                  <strong style={{ fontSize: '20px', color: 'var(--nl-ink)' }}>{check.summary.active_child_count}</strong>
                  <p style={helperTextStyle}>孩子档案</p>
                </Panel>
                <Panel style={{ padding: '14px 16px', borderRadius: '8px', boxShadow: 'none', background: 'rgba(var(--nl-surface-rgb),0.14)', border: '1px solid var(--nl-border-muted)' }}>
                  <strong style={{ fontSize: '20px', color: 'var(--nl-ink)' }}>{check.summary.active_record_count}</strong>
                  <p style={helperTextStyle}>有效记录</p>
                </Panel>
              </div>
              {check.blockers.length ? (
                <div style={{ borderRadius: '8px', background: 'rgba(var(--nl-primary-rgb),0.12)', border: '1px solid rgba(var(--nl-primary-rgb),0.24)', padding: '14px 16px', color: 'var(--nl-primary-2)', display: 'grid', gap: '8px' }}>
                  <strong>当前还不能直接注销</strong>
                  {check.blockers.map((item) => (
                    <p key={item} style={{ margin: 0, fontSize: '13px', lineHeight: 1.6 }}>{item}</p>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginTop: '4px' }}>
                    <button type="button" style={{ ...secondaryButtonStyle, minHeight: '48px', borderRadius: '8px', boxShadow: 'none', color: 'var(--nl-primary-2)', whiteSpace: 'nowrap', fontSize: 13 }} onClick={() => navigate('/family/members')}>
                      去处理成员
                    </button>
                    <button type="button" style={{ ...secondaryButtonStyle, minHeight: '48px', borderRadius: '8px', boxShadow: 'none', color: 'var(--nl-primary-2)', whiteSpace: 'nowrap', fontSize: 13 }} onClick={() => navigate('/profile/help?topic=account-delete')}>
                      提交协助
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ borderRadius: '8px', background: 'rgba(var(--nl-success-rgb),0.12)', border: '1px solid rgba(var(--nl-success-rgb),0.24)', padding: '14px 16px', color: 'var(--nl-success)', display: 'grid', gap: '6px' }}>
                  <strong>当前账号可以注销</strong>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6 }}>注销后将立即退出登录，密码和账号凭据会失效，不能恢复。</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Panel>
      <Panel className="info-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '16px 18px' }}>
        <form style={rowStyle} onSubmit={(event) => void submit(event)}>
          <strong style={{ color: 'var(--nl-ink)', fontSize: '16px', fontWeight: 720 }}>确认信息</strong>
          <Field label="登录密码">
            <input style={inputStyle} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入当前登录密码" />
          </Field>
          <Field label={`确认文案（输入“${check?.confirm_text ?? '确认注销'}”）`}>
            <input style={inputStyle} value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={check?.confirm_text ?? '确认注销'} />
          </Field>
          {message ? <p style={{ ...helperTextStyle, color: message.includes('已') ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
          {(() => {
            const inputReady = Boolean(confirmText.trim()) && (!check?.requires_password || password.trim().length >= 8);
            const enabled = Boolean(check?.can_delete) && inputReady && !submitting && !loading;
            return (
              <div style={buttonRowStyle}>
                <button
                  type="submit"
                  aria-disabled={!enabled}
                  style={{
                    ...primaryButtonStyle,
                    background: enabled ? 'transparent' : 'var(--btn-disabled-bg, rgba(111,87,69,.14))',
                    border: enabled ? '1px solid var(--nl-danger)' : '1px solid transparent',
                    color: enabled ? 'var(--nl-danger)' : 'var(--nl-muted)',
                    boxShadow: 'none',
                    cursor: enabled ? 'pointer' : 'not-allowed',
                  }}
                  disabled={!enabled}
                >
                  {submitting ? '正在注销…' : '确认注销'}
                </button>
              </div>
            );
          })()}
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
    category: '使用问题',
    content: '咨询账号服务状态显示问题，请联系我确认当前账号配置。',
    description: '账号服务状态咨询会自动带入反馈内容，提交后等待联系。',
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

const feedbackStatusText = (status: FeedbackTicketItem['status']) => {
  if (status === 'processing') return '处理中';
  if (status === 'resolved') return '已解决';
  if (status === 'closed') return '已关闭';
  return '已提交';
};

const feedbackStatusColor = (status: FeedbackTicketItem['status']) => {
  if (status === 'resolved' || status === 'closed') return 'var(--nl-success)';
  if (status === 'processing') return 'var(--nl-accent)';
  return 'var(--nl-muted)';
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
  const {
    data: feedbackTickets,
    loading: feedbackLoading,
    error: feedbackError,
    setData: setFeedbackTickets,
  } = useAsyncData<FeedbackTicketItem[]>(async () => {
    const result = await webApi.listFeedback();
    return result.list;
  }, []);

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
      const nextTicket: FeedbackTicketItem = {
        feedback_no: result.feedback_no,
        ticket_no: result.ticket_no ?? result.feedback_no,
        category,
        topic: topic ?? null,
        content: normalized,
        contact: contact.trim() || null,
        status: result.status,
        priority: 'normal',
        handled_at: null,
        handle_note: null,
        created_at: result.created_at,
        updated_at: result.created_at,
      };
      setFeedbackTickets((current) => [nextTicket, ...(current ?? []).filter((item) => item.ticket_no !== nextTicket.ticket_no)].slice(0, 10));
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
    <PageShell className="info-shell" title="帮助与反馈" backTo="/profile">
      <Panel className="info-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '14px 16px 16px' }}>
        <div style={rowStyle}>
          <strong style={{ color: 'var(--nl-ink)', fontSize: '16px', fontWeight: 720 }}>提交反馈</strong>
          <Field label="问题类型">
            <AppSelect aria-label="问题类型" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="使用问题">使用问题</option>
              <option value="页面显示">页面显示</option>
              <option value="数据异常">数据异常</option>
              <option value="功能建议">功能建议</option>
            </AppSelect>
          </Field>
          <Field label="反馈内容">
            <textarea style={textareaStyle} value={content} onChange={(event) => setContent(event.target.value)} placeholder="问题、页面、操作" />
          </Field>
          <Field label="联系方式">
            <input style={inputStyle} value={contact} onChange={(event) => setContact(event.target.value)} />
          </Field>
          {message ? <p style={{ ...helperTextStyle, color: isPositiveStatusMessage(message) ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{message}</p> : null}
          <div style={buttonRowStyle}>
            <button type="button" style={primaryButtonStyle} onClick={() => void submitFeedback()} disabled={submitting}>
              {submitting ? '提交中…' : '提交反馈'}
            </button>
          </div>
        </div>
      </Panel>
      <Panel className="info-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '14px 16px 16px' }}>
        <div style={rowStyle}>
          <strong style={{ color: 'var(--nl-ink)', fontSize: '16px', fontWeight: 720 }}>最近反馈</strong>
          {feedbackLoading ? <p style={helperTextStyle}>正在同步反馈状态…</p> : null}
          {feedbackError ? <p style={{ ...helperTextStyle, color: 'var(--nl-danger)' }}>反馈状态同步失败：{feedbackError}</p> : null}
          {!feedbackLoading && !feedbackError && !(feedbackTickets ?? []).length ? <p style={helperTextStyle}>暂无反馈记录。</p> : null}
          {(feedbackTickets ?? []).slice(0, 5).map((item) => (
            <div key={item.ticket_no} style={{ borderTop: '1px solid var(--nl-border-muted)', paddingTop: '11px', display: 'grid', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                <strong style={{ color: 'var(--nl-ink)', fontSize: '13px', fontWeight: 600 }}>{item.category}</strong>
                <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 26, padding: '4px 10px', borderRadius: 999, background: item.status === 'processing' ? 'rgba(200, 140, 70, 0.14)' : 'rgba(255, 255, 255, 0.44)', border: '1px solid rgba(58, 42, 28, 0.08)', color: feedbackStatusColor(item.status), fontSize: '11px', fontWeight: 600 }}>{feedbackStatusText(item.status)}</span>
              </div>
              <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.6 }}>{item.content}</p>
              {item.handle_note ? <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.6 }}>处理备注：{item.handle_note}</p> : null}
            </div>
          ))}
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
      '用户可以查看和修改个人资料、孩子档案、家庭成员关系和成长记录；平台提供注销、删除申请和隐私问题反馈渠道。',
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
    className="info-row"
    onClick={onClick}
    style={{
      width: '100%',
      minHeight: '54px',
      border: 'none',
      borderBottom: isLast ? 'none' : '1px solid var(--nl-border-muted)',
      background: 'transparent',
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
      <Icon size={18} color="var(--nl-primary-2)" strokeWidth={2} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </span>
    {value ? (
      <span style={{ color: 'var(--nl-muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>{value}</span>
    ) : (
      <ChevronRight size={16} color="var(--nl-muted)" strokeWidth={2.2} />
    )}
  </button>
);

const appVersion = import.meta.env.VITE_APP_VERSION ?? '2.0.4';
const appBuildNumber = import.meta.env.VITE_APP_BUILD_NUMBER ?? 'dev';
const appBuildNumberValue = Number.isFinite(Number(appBuildNumber)) ? Number(appBuildNumber) : 0;
const appBuildTime = import.meta.env.VITE_APP_BUILD_TIME ?? null;
const appBuildTimeText = appBuildTime
  ? new Date(appBuildTime).toLocaleString('zh-CN', { hour12: false })
  : '开发构建';

export const AboutPage = () => {
  const navigate = useNavigate();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<AppUpdateCheckResponse | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const download = useAppUpdateDownload(updateResult);

  const checkUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateError(null);
    try {
      const result = await webApi.checkAppUpdate({
        platform: 'android',
        version: appVersion,
        build_number: appBuildNumberValue,
      });
      setUpdateResult(result);
    } catch {
      setUpdateError('检查更新失败，请稍后重试。');
    } finally {
      setCheckingUpdate(false);
    }
  };
  const updateStatusText = checkingUpdate ? '检查中' : updateResult ? (updateResult.update_available ? (updateResult.force_update ? '强制更新' : '有更新') : '已是最新') : '手动检查';

  return (
    <PageShell title="关于我们" backTo="/profile" className="info-shell">
      <section style={{ display: 'grid', justifyItems: 'center', padding: '18px 0 12px' }}>
        <img
          src="/brand/nianlun-logo-192.png"
          alt="年轮"
          width={96}
          height={96}
          style={{ boxSizing: 'border-box', objectFit: 'contain', borderRadius: '22%', boxShadow: '0 18px 42px rgba(var(--nl-shadow-rgb),0.18)', marginBottom: '16px' }}
        />
        <h2 style={{ margin: 0, color: 'var(--nl-ink)', fontFamily: 'var(--nl-font-display)', fontSize: '26px', lineHeight: 1.08, fontWeight: 800 }}>nianlun</h2>
        <p style={{ margin: '6px 0 0', color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 600 }}>版本 {appVersion}（构建 {appBuildNumber} · {appBuildTimeText}）</p>
      </section>

      <div className="info-card">
        <AboutMenuLink icon={RefreshCw} label="检查更新" value={updateStatusText} isLast={!updateResult && !updateError} onClick={checkingUpdate ? undefined : () => void checkUpdate()} />
        {updateError ? <p style={{ ...helperTextStyle, color: 'var(--nl-danger)', margin: 0, padding: '0 16px 14px' }}>{updateError}</p> : null}
        {updateResult?.update_available ? (
          <div style={{ borderTop: '1px solid var(--nl-border-muted)', padding: '14px 0 16px', display: 'grid', gap: '9px', background: 'transparent' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 700 }}>
                发现新版本
              </strong>
              <span style={{ color: updateResult.force_update ? 'var(--nl-danger)' : 'var(--nl-primary-2)', fontSize: '12px', fontWeight: 720 }}>
                {updateResult.force_update ? '需要更新' : '可更新'}
              </span>
            </div>
            <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.65 }}>
              最新版本 {updateResult.latest_version}（构建 {updateResult.latest_build_number}）
            </p>
            {updateResult.release_notes ? <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{updateResult.release_notes}</p> : null}
            {hasVerifiedAppUpdateMetadata(updateResult) && updateResult.download_available !== false && updateResult.can_download_update !== false ? (
              <div style={{ display: 'grid', gap: '8px' }}>
                {download.state === 'downloading' || download.state === 'verifying' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: 'var(--nl-muted)', fontSize: '11px', fontWeight: 650 }}>
                      <span>{updateDownloadStateLabel(download.state)}</span>
                      <span>{Math.round(download.progress)}%</span>
                    </div>
                    <div role="progressbar" aria-label={`更新下载进度 ${Math.round(download.progress)}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(download.progress)} style={{ height: '6px', borderRadius: '999px', overflow: 'hidden', background: 'var(--nl-border-muted)' }}>
                      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, download.progress))}%`, background: 'var(--nl-primary-gradient)', transition: 'width 0.2s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--nl-muted)', fontSize: '11px' }}>{formatUpdateBytes(download.downloadedBytes)}{download.totalBytes ? ` / ${formatUpdateBytes(download.totalBytes)}` : ''}</span>
                      <button type="button" onClick={() => void download.cancelDownload()} style={{ ...secondaryButtonStyle, minHeight: '34px', padding: '0 11px' }}>取消</button>
                    </div>
                  </>
                ) : download.state === 'ready' || download.state === 'permission' ? (
                  <button type="button" onClick={() => void download.install()} style={{ ...primaryButtonStyle, minHeight: '42px', borderRadius: '8px' }}>
                    {download.state === 'permission' ? '再次安装' : '安装更新'}
                  </button>
                ) : download.state === 'installing' ? (
                  <button type="button" disabled style={{ ...primaryButtonStyle, minHeight: '42px', borderRadius: '8px', opacity: 0.65 }}>
                    正在打开系统安装器
                  </button>
                ) : (
                  <button type="button" onClick={() => void download.startDownload()} style={{ ...primaryButtonStyle, minHeight: '42px', borderRadius: '8px' }}>
                    {download.state === 'error' ? '重试下载' : '下载并安装'}
                  </button>
                )}
                {download.error ? <p style={{ ...helperTextStyle, margin: 0, color: 'var(--nl-danger)', whiteSpace: 'pre-wrap' }}>{download.error}</p> : null}
                {download.state === 'installing' ? <p style={{ ...helperTextStyle, margin: 0 }}>{updateDownloadStateLabel(download.state)}</p> : null}
              </div>
            ) : (
              <p style={{ ...helperTextStyle, margin: 0, color: 'var(--nl-danger)' }}>新版本已发布，但更新包暂不可下载，请稍后重试或联系管理员。</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="info-card">
        <AboutMenuLink icon={FileText} label="用户服务协议" onClick={() => navigate('/profile/legal')} />
        <AboutMenuLink icon={Shield} label="隐私政策" isLast onClick={() => navigate('/profile/legal?doc=privacy')} />
      </div>

      <div className="info-card">
        <AboutMenuLink icon={Mail} label="联系我们" value="联系方式" isLast onClick={() => navigate('/profile/contact')} />
      </div>

      <div style={{ textAlign: 'center', color: 'var(--nl-muted)', fontSize: '10px', lineHeight: 1.7, paddingTop: '8px' }}>
        <p style={{ margin: 0 }}>年轮 © 2026</p>
      </div>
    </PageShell>
  );
};

export const ContactPage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const contacts = [
    { icon: Mail, title: '服务邮箱', value: 'support@xmlga.top', detail: '账号、档案与服务协助。' },
    { icon: Shield, title: '隐私与数据保护', value: 'privacy@xmlga.top', detail: '儿童信息保护、权限与注销事务。' },
    { icon: Smartphone, title: '服务时间', value: '工作日 10:00-18:00', detail: '非工作时间会在下一服务时段处理。' },
  ];

  const copyEmail = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`已复制 ${value}`);
    } catch {
      setMessage('复制失败，请长按邮箱手动复制');
    }
  };

  return (
    <PageShell className="info-shell" title="联系我们" backTo="/profile/about">
      <p style={{ ...helperTextStyle, margin: 0, lineHeight: 1.7 }}>账号、档案、隐私和数据交付相关事项，都可以在这里找到我们。</p>

      <Panel className="info-card" style={{ padding: 0, overflow: 'hidden', background: 'transparent', border: 'none', boxShadow: 'none' }}>
        {contacts.map((item, index) => {
          const Icon = item.icon;
          const copyable = item.value.includes('@');
          return (
            <div
              key={item.title}
              style={{
                minHeight: copyable ? '72px' : '64px',
                padding: '14px 0',
                borderBottom: index === contacts.length - 1 ? 'none' : '1px solid var(--nl-border-muted)',
                display: 'grid',
                gridTemplateColumns: copyable ? '34px minmax(0, 1fr) 44px' : '34px minmax(0, 1fr)',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <span style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--nl-border-muted)', display: 'grid', placeItems: 'center', color: 'var(--nl-primary-2)' }}>
                <Icon size={17} strokeWidth={2.1} />
              </span>
              <span style={{ minWidth: 0, display: 'grid', gap: '4px' }}>
                <strong style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 660 }}>{item.title}</strong>
                <a href={`mailto:${item.value}`} style={{ color: 'var(--nl-ink)', fontSize: '14px', fontWeight: 600, overflowWrap: 'anywhere', textDecoration: 'none' }}>{item.value}</a>
                <span style={{ color: 'var(--nl-muted)', fontSize: '12px', lineHeight: 1.55 }}>{item.detail}</span>
              </span>
              {copyable ? (
                <button
                  type="button"
                  aria-label={`复制${item.title}`}
                  onClick={() => void copyEmail(item.value)}
                  style={{
                    width: 44,
                    height: 44,
                    border: '1px solid var(--nl-border-muted)',
                    borderRadius: 999,
                    background: 'var(--nl-surface-soft)',
                    color: 'var(--nl-accent)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Copy size={16} strokeWidth={2.1} />
                </button>
              ) : null}
            </div>
          );
        })}
      </Panel>

      {message ? <p style={{ ...helperTextStyle, margin: 0, color: 'var(--nl-success)' }}>{message}</p> : null}

      <button type="button" onClick={() => navigate('/profile/help')} style={{ ...secondaryButtonStyle, minHeight: 44, width: '100%' }}>
        去帮助与反馈提交问题
      </button>

      <section className="info-card" aria-label="常见问题" style={{ padding: '6px 0' }}>
        {[
          { title: '如何邀请家人一起记录？', topic: 'family-remove' },
          { title: '如何导出孩子的成长记录？', topic: 'membership' },
        ].map((item) => (
          <button
            key={item.topic}
            type="button"
            className="info-row"
            onClick={() => navigate(`/profile/help?topic=${item.topic}`)}
          >
            <span className="set-body"><strong style={{ fontSize: 14 }}>{item.title}</strong></span>
            <ChevronRight size={18} className="set-chevron" />
          </button>
        ))}
      </section>
    </PageShell>
  );
};

export const LegalPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = location.pathname.startsWith('/profile') ? '/profile' : '/auth/login';
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(backTo);
  };
  const isAboutPage = location.pathname.endsWith('/about');
  const docAliases: Record<string, string> = {
    terms: '用户协议',
    privacy: '隐私政策',
    child: '儿童信息保护摘要',
    children: '儿童信息保护摘要',
  };
  const resolveLegalTitle = () => {
    const doc = new URLSearchParams(location.search).get('doc');
    return (doc && docAliases[doc]) || legalSections[0].title;
  };
  const [activeTitle, setActiveTitle] = useState(resolveLegalTitle);
  const [largeText, setLargeText] = useState(false);
  const section = legalSections.find((item) => item.title === activeTitle) ?? legalSections[0];

  useEffect(() => {
    setActiveTitle(resolveLegalTitle());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const selectLegalDoc = (title: string) => {
    const nextAlias = Object.entries(docAliases).find(([, label]) => label === title)?.[0] ?? 'terms';
    setActiveTitle(title);
    navigate(`${location.pathname}?doc=${nextAlias}`, { replace: true });
  };

  useEffect(() => {
    if (!largeText) return undefined;
    const root = document.documentElement;
    const previous = root.dataset.elder;
    root.dataset.elder = 'true';
    return () => {
      if (previous === undefined) delete root.dataset.elder;
      else root.dataset.elder = previous;
    };
  }, [largeText]);

  return (
    <PageShell
      title={isAboutPage ? '关于我们' : '关于与协议'}
      onBack={handleBack}
      className="info-shell"
      action={
        <button
          type="button"
          aria-pressed={largeText}
          aria-label="放大字号"
          onClick={() => setLargeText((value) => !value)}
          style={{
            minWidth: 44,
            minHeight: 44,
            border: 'none',
            borderRadius: 999,
            background: largeText ? 'rgba(233, 160, 90, 0.3)' : 'transparent',
            color: 'var(--nl-accent)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          A+
        </button>
      }
    >
      <AppSegmentedControl
        ariaLabel="协议分类"
        value={activeTitle}
        onChange={selectLegalDoc}
        options={legalSections.map((item) => ({ value: item.title, label: item.title }))}
      />
      <Panel style={{ padding: '22px 20px', display: 'grid', gap: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', color: 'var(--nl-muted)' }}>最后更新 2026年11月</span>
        <h2 style={{ margin: 0, fontFamily: 'var(--nl-font-display)', fontSize: 24, fontWeight: 600, lineHeight: 1.3, color: 'var(--nl-ink)' }}>{section.title}</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          {section.items.map((item, index) => (
            <p key={item} style={{ margin: 0, color: 'var(--nl-ink)', fontSize: 15, lineHeight: 1.75, fontWeight: 400, letterSpacing: '0.01em' }}>
              <span aria-hidden="true" style={{ color: 'var(--nl-accent)', fontWeight: 600, marginRight: 8 }}>{index + 1}</span>
              {item}
            </p>
          ))}
        </div>
      </Panel>
      <p style={{ margin: 0, textAlign: 'center', fontSize: 11, color: 'var(--nl-muted)' }}>年轮 · 儿童信息保护优先</p>
    </PageShell>
  );
};

export const ErrorPage = () => {
  const navigate = useNavigate();

  return (
    <PageShell title="页面加载失败" onBack={() => navigate('/home')} className="error-shell">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 16, padding: '56px 8px 24px', textAlign: 'center' }}>
        <span aria-hidden="true" style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(255, 250, 244, 0.72)', border: '1px solid rgba(255, 255, 255, 0.72)', display: 'grid', placeItems: 'center', color: 'var(--nl-accent)', boxShadow: '0 12px 30px rgba(146, 96, 52, 0.14)' }}>
          <AlertCircle size={36} strokeWidth={1.7} />
        </span>
        <h2 style={{ margin: 0, fontFamily: 'var(--nl-font-display)', fontSize: 24, fontWeight: 600, lineHeight: 1.3, color: 'var(--nl-ink)' }}>暂时打不开这一页</h2>
        <p style={{ margin: 0, maxWidth: 280, color: 'var(--nl-muted)', fontSize: 13, lineHeight: 1.6 }}>链接可能已失效，或者网络暂时不稳定</p>
        <button type="button" onClick={() => window.location.reload()} style={{ ...primaryButtonStyle, width: '100%', marginTop: 8 }}>重试</button>
        <button type="button" onClick={() => navigate('/home')} style={{ ...secondaryButtonStyle, width: '100%', minHeight: 44 }}>返回首页</button>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--nl-muted)' }}>如果一直失败，可以在「我的 · 帮助与反馈」里告诉我们</p>
        <button type="button" onClick={() => navigate('/profile/help')} style={{ ...secondaryButtonStyle, width: '100%', minHeight: 44 }}>帮助与反馈</button>
      </div>
    </PageShell>
  );
};
