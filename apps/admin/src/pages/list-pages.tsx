import { Children, Fragment, cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, ArchiveX, AudioLines, Ban, CheckCircle2, ClipboardCheck, Crown, Eye, LockKeyhole, MoreHorizontal, RotateCcw, SlidersHorizontal, Snowflake, Video, XCircle } from 'lucide-react';

import {
  adminApi,
  type AdminAiJobDetail,
  type AdminAiJobItem,
  type AdminArchiveExportRequestItem,
  type AdminAuditLogItem,
  type AdminChildDetail,
  type AdminChildItem,
  type AdminFamilyDetail,
  type AdminFamilyItem,
  type AdminMediaDetail,
  type AdminMediaItem,
  type AdminMediaListParams,
  type AdminNotificationItem,
  type AdminRecordDetail,
  type AdminRecordFilter,
  type AdminRecordItem,
  type AdminSupportTicketItem,
  type AdminUserDetail,
  type AdminUserItem,
} from '../shared/request';
import {
  aiJobStatusLabel,
  aiJobTypeLabel,
  aiProviderLabel,
  archiveExportPurposeLabel,
  archiveExportStatusLabel,
  archiveExportTypeLabel,
  auditActionLabel,
  auditActionValues,
  auditActorTypeLabel,
  auditTargetTypeLabel,
  auditTargetTypeValues,
  authTypeLabel,
  childStatusLabel,
  familyStatusLabel,
  familyRoleLabel,
  genderLabel,
  mediaStatusLabel,
  mediaTypeLabel,
  membershipTypeLabel,
  notificationDeliveryStatusLabel,
  notificationReadStateLabel,
  notificationTypeLabel,
  notificationTypeValues,
  recordStatusLabel,
  recordTypeLabel,
  supportTicketPriorityLabel,
  supportTicketStatusLabel,
  userStatusLabel,
  visibilityScopeLabel,
} from '../shared/labels';
import { formatBytes, formatDateOnly, formatDateTime, getErrorMessage, optionalFilter, toIsoDateTime } from '../shared/format';
import { AdminButton, AdminDateInput, AdminSelect, Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { inputStyle, mutedTextStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/uiStyles';
import { AdminModal } from '../shared/modal';
import { useAdminAuth } from '../shared/useAdminAuth';
import { DetailDrawer, DetailGrid, DetailList, DetailSection, JsonBlock, MediaPreview } from './detail-drawer';
import { formatListRows, useAdminListPage } from './list-page-state';
import { ActionButton, ActionFeedback, PaginationPanel, SearchPanel, TableShell, useOperationReasonDialog } from './shared';

const badgeToneForStatus = (value: string) => {
  if (['active', 'normal', 'published', 'success', 'ready', 'completed', 'resolved'].includes(value)) return 'success' as const;
  if (['disabled', 'failed', 'cancelled', 'removed', 'rejected', 'child_safety', 'deleted'].includes(value)) return 'danger' as const;
  if (['draft', 'pending', 'processing', 'uploading', 'submitted'].includes(value)) return 'warning' as const;
  return 'neutral' as const;
};

const recordFilterOptions: Array<{ key: AdminRecordFilter; label: string }> = [
  { key: 'all', label: '全部记录' },
  { key: 'image', label: '含图片' },
  { key: 'video', label: '含视频' },
  { key: 'audio', label: '含录音' },
  { key: 'media_exception', label: '媒体异常' },
  { key: 'pending', label: '待处理' },
  { key: 'risk', label: '风险标记' },
];

const normalizeRecordFilter = (value: string | null | undefined): AdminRecordFilter =>
  recordFilterOptions.some((item) => item.key === value) ? (value as AdminRecordFilter) : 'all';

const CompactText = ({ value, maxWidth = 220 }: { value: string | null | undefined; maxWidth?: number }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <span
      title={value ?? '—'}
      role={value && value.length > 24 ? 'button' : undefined}
      tabIndex={value && value.length > 24 ? 0 : undefined}
      onClick={value && value.length > 24 ? () => setExpanded((current) => !current) : undefined}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && value && value.length > 24) {
          event.preventDefault();
          setExpanded((current) => !current);
        }
      }}
      style={{
        display: 'block',
        maxWidth,
        overflow: 'hidden',
        textOverflow: expanded ? 'clip' : 'ellipsis',
        whiteSpace: expanded ? 'normal' : 'nowrap',
        cursor: value && value.length > 24 ? 'pointer' : undefined,
      }}
    >
      {value ?? '—'}
    </span>
  );
};

const SummaryStat = ({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) => (
  <div className={`admin-list-summary-pill admin-list-summary-pill-${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const ListSummary = ({
  label,
  children,
}: {
  label: string;
  description?: string;
  children?: ReactNode;
}) => (
  <section className="admin-list-summary-panel" aria-label={label}>
    <div className="admin-list-summary">
      <strong>{label}</strong>
      {children ? <div className="admin-list-summary-pills">{children}</div> : null}
    </div>
  </section>
);

const EntityTitle = ({ title, meta }: { title: ReactNode; meta?: ReactNode }) => (
  <span className="admin-entity-title">
    <strong>{title}</strong>
    {meta ? <span>{meta}</span> : null}
  </span>
);

const AvatarThumb = ({ src, label, size = 44 }: { src?: string | null; label: string; size?: number }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initial = label.trim().slice(0, 1) || '?';
  const canLoad = Boolean(src && failedSrc !== src);

  return (
    <span className={`admin-avatar-thumb ${canLoad ? '' : 'admin-avatar-thumb-fallback'}`} style={{ width: size, height: size, minWidth: size }}>
      {canLoad ? <img src={src} alt={label} loading="lazy" decoding="async" onError={() => setFailedSrc(src)} /> : <span>{initial}</span>}
    </span>
  );
};

const EntityWithAvatar = ({ avatarUrl, title, meta }: { avatarUrl?: string | null; title: ReactNode; meta?: ReactNode }) => (
  <span className="admin-entity-avatar-line">
    <AvatarThumb src={avatarUrl} label={typeof title === 'string' ? title : ''} />
    <EntityTitle title={title} meta={meta} />
  </span>
);

const MediaThumb = ({ item, size = 72 }: { item: AdminMediaItem; size?: number }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const previewUrl = item.thumbnail_url ?? (item.media_type === 'image' ? item.access_url : null);
  const canPreview = Boolean(previewUrl && failedSrc !== previewUrl);
  const stateLabel = item.status !== 'ready' ? mediaStatusLabel(item.status) : mediaTypeLabel(item.media_type);
  const previewStateLabel = failedSrc && failedSrc === previewUrl ? '预览不可用' : !previewUrl ? '暂无预览' : null;
  const canExpand = Boolean(item.access_url && (item.media_type === 'image' || item.media_type === 'video'));

  useEffect(() => {
    if (!expanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [expanded]);

  if (item.media_type === 'audio') {
    return (
      <span
        className={`admin-media-thumb admin-media-thumb-audio ${item.status !== 'ready' ? 'admin-media-thumb-muted' : ''}`}
        style={{ width: size, height: size, minWidth: size }}
        title={`${item.original_name ?? item.media_no} · ${stateLabel}`}
      >
        <AudioLines size={Math.max(22, Math.round(size * 0.36))} strokeWidth={2.2} />
        <span>录音</span>
      </span>
    );
  }

  if (item.media_type === 'video' && !previewUrl) {
    const thumb = (
      <span
        className={`admin-media-thumb admin-media-thumb-video ${item.status !== 'ready' ? 'admin-media-thumb-muted' : ''}`}
        style={{ width: size, height: size, minWidth: size }}
        title={`${item.original_name ?? item.media_no} · ${stateLabel}`}
      >
        <Video size={Math.max(22, Math.round(size * 0.36))} strokeWidth={2.2} />
        <span>视频</span>
      </span>
    );

    return (
      <>
        {canExpand ? (
          <button type="button" className="admin-media-thumb-button" onClick={() => setExpanded(true)} aria-label="放大查看视频" title="放大查看视频">
            {thumb}
          </button>
        ) : (
          thumb
        )}
        {expanded && item.access_url ? (
          <div className="admin-media-lightbox" role="dialog" aria-modal="true" aria-label="视频预览" onClick={() => setExpanded(false)}>
            <video src={item.access_url} controls autoPlay muted onClick={(event) => event.stopPropagation()}>
              当前浏览器不支持视频预览。
            </video>
          </div>
        ) : null}
      </>
    );
  }

  const thumb = (
    <span
      className={`admin-media-thumb ${canPreview ? '' : 'admin-media-thumb-empty'} ${failedSrc === previewUrl ? 'admin-media-thumb-failed' : ''}`}
      style={{ width: size, height: size, minWidth: size }}
      title={`${item.original_name ?? item.media_no} · ${previewStateLabel ?? stateLabel}`}
    >
      {canPreview ? (
        <img
          src={previewUrl}
          alt={item.original_name ?? item.media_no}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(previewUrl)}
        />
      ) : (
        <span>{previewStateLabel ?? stateLabel}</span>
      )}
    </span>
  );

  return (
    <>
      {canExpand ? (
        <button type="button" className="admin-media-thumb-button" onClick={() => setExpanded(true)} aria-label={item.media_type === 'video' ? '放大查看视频' : '放大查看图片'} title={item.media_type === 'video' ? '放大查看视频' : '放大查看图片'}>
          {thumb}
        </button>
      ) : (
        thumb
      )}
      {expanded && item.access_url ? (
        <div className="admin-media-lightbox" role="dialog" aria-modal="true" aria-label={item.media_type === 'video' ? '视频预览' : '图片预览'} onClick={() => setExpanded(false)}>
          {item.media_type === 'video' ? (
            <video src={item.access_url} controls autoPlay muted onClick={(event) => event.stopPropagation()}>
              当前浏览器不支持视频预览。
            </video>
          ) : (
            <img src={item.access_url} alt={item.original_name ?? item.media_no} onClick={(event) => event.stopPropagation()} />
          )}
        </div>
      ) : null}
    </>
  );
};

const MediaReviewCell = ({ item }: { item: AdminMediaItem }) => {
  const needsReview = item.status === 'uploading' || item.status === 'failed';
  const isOrphan = !item.record_no;
  const tone = needsReview || isOrphan ? 'warning' : 'success';

  return (
    <span className="admin-media-review-cell">
      <span>
        <Badge tone={tone}>{needsReview ? '需处理' : isOrphan ? '待关联' : '已关联'}</Badge>
        <Badge tone={badgeToneForStatus(item.status)}>{mediaStatusLabel(item.status)}</Badge>
      </span>
    </span>
  );
};

const flattenActionItems = (children: ReactNode): ReactNode[] =>
  Children.toArray(children).flatMap((child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      return flattenActionItems(child.props.children);
    }

    return [child];
  });

const ActionGroup = ({ children }: { children: ReactNode }) => {
  const items = flattenActionItems(children).filter(Boolean);

  if (items.length <= 1) {
    return <div className="admin-action-group">{items}</div>;
  }

  const [primaryAction, ...extraActions] = items;

  return (
    <div className="admin-action-group admin-action-group-compact">
      {primaryAction}
      <ActionMenu>{extraActions}</ActionMenu>
    </div>
  );
};

const ActionMenu = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const menuChildren = Children.map(children, (child) => {
    if (!isValidElement<{ onClick?: () => void | Promise<void> }>(child)) return child;
    return cloneElement(child, {
      onClick: () => {
        setOpen(false);
        const action = child.props.onClick?.();
        return action;
      },
    });
  });

  return (
    <div className="admin-action-menu">
      <button type="button" className="admin-action-menu-trigger" aria-label="更多操作" title="更多操作" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)}>
        <MoreHorizontal size={17} strokeWidth={2.2} />
      </button>
      {open ? <div className="admin-action-menu-popover" role="menu">{menuChildren}</div> : null}
    </div>
  );
};

type AuditFilterOverride = {
  keyword?: string;
  action?: string;
  targetType?: string;
  actorId?: string;
  startTime?: string;
  endTime?: string;
};

type ArchiveExportRequestFilterOverride = {
  keyword?: string;
  purpose?: string;
  status?: string;
};

type NotificationFilterOverride = {
  keyword?: string;
  readState?: string;
  notificationType?: string;
  deliveryStatus?: string;
  startTime?: string;
  endTime?: string;
};

type ArchiveExportCompletionRequest = {
  note: string;
  download_url?: string;
  file_sha256?: string;
  delivery_evidence?: string;
};

type SupportTicketFilterOverride = {
  keyword?: string;
  category?: string;
  status?: string;
  priority?: string;
};

const useArchiveCompletionDialog = () => {
  const resolverRef = useRef<((value: ArchiveExportCompletionRequest | null) => void) | null>(null);
  const [dialog, setDialog] = useState<{
    requestNo: string;
    note: string;
    downloadUrl: string;
    fileSha256: string;
    deliveryEvidence: string;
    error: string | null;
  } | null>(null);

  const requestArchiveCompletion = (requestNo: string) =>
    new Promise<ArchiveExportCompletionRequest | null>((resolve) => {
      resolverRef.current?.(null);
      resolverRef.current = resolve;
      setDialog({ requestNo, note: '', downloadUrl: '', fileSha256: '', deliveryEvidence: '', error: null });
    });

  const closeDialog = (value: ArchiveExportCompletionRequest | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  };

  useEffect(() => () => resolverRef.current?.(null), []);

  const completionDialog = dialog ? (
    <AdminModal open={Boolean(dialog)} title="完成档案交付" eyebrow="档案交付确认" onClose={() => closeDialog(null)}>
        <p className="admin-modal-subtitle">{dialog.requestNo}</p>
        <label className="admin-modal-field">
          处理备注
          <textarea
            value={dialog.note}
            onChange={(event) => setDialog((current) => (current ? { ...current, note: event.target.value, error: null } : current))}
            placeholder="说明本次交付内容和核对结果"
            autoFocus
          />
        </label>
        <label className="admin-modal-field">
          下载地址
          <input
            value={dialog.downloadUrl}
            onChange={(event) => setDialog((current) => (current ? { ...current, downloadUrl: event.target.value, error: null } : current))}
            placeholder="https://..."
          />
        </label>
        <label className="admin-modal-field">
          文件 SHA256
          <input
            value={dialog.fileSha256}
            onChange={(event) => setDialog((current) => (current ? { ...current, fileSha256: event.target.value, error: null } : current))}
            placeholder="64 位 SHA256"
          />
        </label>
        <label className="admin-modal-field">
          交付证据
          <textarea
            value={dialog.deliveryEvidence}
            onChange={(event) => setDialog((current) => (current ? { ...current, deliveryEvidence: event.target.value, error: null } : current))}
            placeholder="例如：交付单号、客服记录或对象存储路径"
          />
        </label>
        {dialog.error ? <p className="admin-modal-error">{dialog.error}</p> : null}
        <div className="admin-modal-actions">
          <button type="button" style={secondaryButtonStyle} onClick={() => closeDialog(null)}>
            取消
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => {
              const note = dialog.note.trim();
              const downloadUrl = dialog.downloadUrl.trim();
              const fileSha256 = dialog.fileSha256.trim().toLowerCase();
              const deliveryEvidence = dialog.deliveryEvidence.trim();
              if (note.length < 2) {
                setDialog((current) => (current ? { ...current, error: '请填写处理备注' } : current));
                return;
              }
              if (!/^https?:\/\//i.test(downloadUrl)) {
                setDialog((current) => (current ? { ...current, error: '下载地址必须是 http 或 https 链接' } : current));
                return;
              }
              if (!/^[a-f0-9]{64}$/i.test(fileSha256)) {
                setDialog((current) => (current ? { ...current, error: '文件 SHA256 必须是 64 位十六进制字符串' } : current));
                return;
              }
              if (deliveryEvidence.length < 2) {
                setDialog((current) => (current ? { ...current, error: '请填写交付证据' } : current));
                return;
              }
              closeDialog({ note, download_url: downloadUrl, file_sha256: fileSha256, delivery_evidence: deliveryEvidence });
            }}
          >
            确认完成
          </button>
        </div>
    </AdminModal>
  ) : null;

  return { requestArchiveCompletion, completionDialog };
};

type ResetPasswordRequest = {
  new_password: string;
  password_confirm: string;
  reason: string;
};

const useResetPasswordDialog = () => {
  const resolverRef = useRef<((value: ResetPasswordRequest | null) => void) | null>(null);
  const [dialog, setDialog] = useState<{
    user: Pick<AdminUserItem, 'user_no' | 'nickname' | 'mobile'>;
    newPassword: string;
    passwordConfirm: string;
    reason: string;
    error: string | null;
  } | null>(null);

  const requestResetPassword = (user: Pick<AdminUserItem, 'user_no' | 'nickname' | 'mobile'>) =>
    new Promise<ResetPasswordRequest | null>((resolve) => {
      resolverRef.current?.(null);
      resolverRef.current = resolve;
      setDialog({ user, newPassword: '', passwordConfirm: '', reason: '', error: null });
    });

  const closeDialog = (value: ResetPasswordRequest | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  };

  useEffect(() => () => resolverRef.current?.(null), []);

  const resetPasswordDialog = dialog ? (
    <AdminModal open={Boolean(dialog)} title="重置登录密码" eyebrow="账号安全操作" onClose={() => closeDialog(null)}>
            <p className="admin-modal-subtitle">
              {dialog.user.nickname}（{dialog.user.mobile ?? dialog.user.user_no}）
            </p>
        <label className="admin-modal-field">
          新密码
          <input
            type="password"
            value={dialog.newPassword}
            onChange={(event) => setDialog((current) => (current ? { ...current, newPassword: event.target.value, error: null } : current))}
            placeholder="8 到 12 位，需包含字母和数字"
            autoComplete="new-password"
            autoFocus
          />
        </label>
        <label className="admin-modal-field">
          确认新密码
          <input
            type="password"
            value={dialog.passwordConfirm}
            onChange={(event) => setDialog((current) => (current ? { ...current, passwordConfirm: event.target.value, error: null } : current))}
            placeholder="再次输入新密码"
            autoComplete="new-password"
          />
        </label>
        <label className="admin-modal-field">
          操作原因
          <textarea
            value={dialog.reason}
            onChange={(event) => setDialog((current) => (current ? { ...current, reason: event.target.value, error: null } : current))}
            placeholder="例如：用户本人申请重置，客服已核验身份"
          />
        </label>
        {dialog.error ? <p className="admin-modal-error">{dialog.error}</p> : null}
        <div className="admin-modal-actions">
          <button type="button" style={secondaryButtonStyle} onClick={() => closeDialog(null)}>
            取消
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => {
              const newPassword = dialog.newPassword;
              const passwordConfirm = dialog.passwordConfirm;
              const reason = dialog.reason.trim();
              if (newPassword.length < 8 || newPassword.length > 12) {
                setDialog((current) => (current ? { ...current, error: '新密码长度必须为 8 到 12 位' } : current));
                return;
              }
              if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
                setDialog((current) => (current ? { ...current, error: '新密码必须同时包含字母和数字' } : current));
                return;
              }
              if (newPassword !== passwordConfirm) {
                setDialog((current) => (current ? { ...current, error: '两次输入的密码不一致' } : current));
                return;
              }
              if (!reason) {
                setDialog((current) => (current ? { ...current, error: '请填写操作原因' } : current));
                return;
              }
              closeDialog({ new_password: newPassword, password_confirm: passwordConfirm, reason });
            }}
          >
            确认重置
          </button>
        </div>
    </AdminModal>
  ) : null;

  return { requestResetPassword, resetPasswordDialog };
};

type MembershipUpdateRequest = {
  membership_type: 'free' | 'family_member' | 'ai_plus';
  membership_expire_at: string | null;
  reason: string;
};

const toDateInputValue = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');

const useMembershipDialog = () => {
  const resolverRef = useRef<((value: MembershipUpdateRequest | null) => void) | null>(null);
  const [dialog, setDialog] = useState<{
    user: Pick<AdminUserItem, 'user_no' | 'nickname' | 'mobile' | 'membership_type'> & { membership_expire_at?: string | null };
    membershipType: MembershipUpdateRequest['membership_type'];
    expireDate: string;
    reason: string;
    error: string | null;
  } | null>(null);

  const requestMembershipUpdate = (user: Pick<AdminUserItem, 'user_no' | 'nickname' | 'mobile' | 'membership_type'> & { membership_expire_at?: string | null }) =>
    new Promise<MembershipUpdateRequest | null>((resolve) => {
      resolverRef.current?.(null);
      resolverRef.current = resolve;
      setDialog({
        user,
        membershipType: user.membership_type === 'family_member' || user.membership_type === 'ai_plus' ? user.membership_type : 'free',
        expireDate: toDateInputValue(user.membership_expire_at),
        reason: '',
        error: null,
      });
    });

  const closeDialog = (value: MembershipUpdateRequest | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  };

  useEffect(() => () => resolverRef.current?.(null), []);

  const membershipDialog = dialog ? (
    <AdminModal open={Boolean(dialog)} title="调整用户套餐权益" eyebrow="套餐权益操作" onClose={() => closeDialog(null)}>
            <p className="admin-modal-subtitle">
              {dialog.user.nickname}（{dialog.user.mobile ?? dialog.user.user_no}）
            </p>
        <label className="admin-modal-field">
          权益类型
          <AdminSelect
            value={dialog.membershipType}
            onChange={(event) =>
              setDialog((current) =>
                current ? { ...current, membershipType: event.target.value as MembershipUpdateRequest['membership_type'], error: null } : current,
              )
            }
          >
            <option value="free">基础会员</option>
            <option value="family_member">家庭会员</option>
            <option value="ai_plus">增强整理会员</option>
          </AdminSelect>
        </label>
        <label className="admin-modal-field admin-membership-expiry-field">
          <span className="admin-modal-field-label">
            到期日期
            {dialog.membershipType !== 'free' ? <span className="admin-modal-required">必填</span> : null}
          </span>
          <AdminDateInput
            aria-label="到期日期"
            placeholder={dialog.membershipType === 'free' ? '基础会员无需设置' : '请选择到期日期'}
            value={dialog.expireDate}
            min={new Date().toISOString().slice(0, 10)}
            disabled={dialog.membershipType === 'free'}
            title={dialog.membershipType === 'free' ? '基础会员无需设置到期日期' : '选择到期日期'}
            onChange={(event) => setDialog((current) => (current ? { ...current, expireDate: event.target.value, error: null } : current))}
          />
        </label>
        <label className="admin-modal-field">
          操作原因
          <textarea
            value={dialog.reason}
            onChange={(event) => setDialog((current) => (current ? { ...current, reason: event.target.value, error: null } : current))}
            placeholder="例如：年付套餐开通、客服补偿、退款后回收权益"
          />
        </label>
        {dialog.error ? <p className="admin-modal-error">{dialog.error}</p> : null}
        <div className="admin-modal-actions">
          <button type="button" style={secondaryButtonStyle} onClick={() => closeDialog(null)}>
            取消
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => {
              const reason = dialog.reason.trim();
              if (dialog.membershipType !== 'free' && !dialog.expireDate) {
                setDialog((current) => (current ? { ...current, error: '付费权益必须填写到期日期' } : current));
                return;
              }
              if (dialog.membershipType !== 'free' && dialog.expireDate < new Date().toISOString().slice(0, 10)) {
                setDialog((current) => (current ? { ...current, error: '到期日期不能早于今天' } : current));
                return;
              }
              if (!reason) {
                setDialog((current) => (current ? { ...current, error: '请填写操作原因' } : current));
                return;
              }
              // 到期时刻按管理员本地时区的当天 23:59:59 计算，避免 UTC 硬编码造成时区偏移。
              const expireAt = dialog.membershipType === 'free' ? null : new Date(`${dialog.expireDate}T23:59:59`).toISOString();
              closeDialog({
                membership_type: dialog.membershipType,
                membership_expire_at: expireAt,
                reason,
              });
            }}
          >
            确认调整
          </button>
        </div>
    </AdminModal>
  ) : null;

  return { requestMembershipUpdate, membershipDialog };
};

const MiniTable = ({ columns, rows, emptyMessage }: { columns: string[]; rows: Array<Array<ReactNode>>; emptyMessage: string }) => {
  if (!rows.length) return <EmptyState title="暂无数据" message={emptyMessage} />;

  return (
    <div className="admin-table-scroll" style={{ overflowX: 'auto' }}>
      <table className="admin-responsive-table admin-mini-table admin-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="admin-table-head-cell">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} data-label={columns[cellIndex]}>
                  {cell ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const useDetailState = <T,>() => {
  const requestVersionRef = useRef(0);
  const loaderRef = useRef<(() => Promise<T>) | null>(null);
  const metaRef = useRef<{ title: string; subtitle?: string }>({ title: '' });
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    subtitle?: string;
    loading: boolean;
    error: string | null;
    data: T | null;
  }>({
    open: false,
    title: '',
    loading: false,
    error: null,
    data: null,
  });

  const openDetail = async (title: string, subtitle: string | undefined, loader: () => Promise<T>) => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    loaderRef.current = loader;
    metaRef.current = { title, subtitle };
    setState({ open: true, title, subtitle, loading: true, error: null, data: null });
    try {
      const data = await loader();
      if (requestVersionRef.current !== requestVersion) return;
      setState({ open: true, title, subtitle, loading: false, error: null, data });
    } catch (err) {
      if (requestVersionRef.current !== requestVersion) return;
      setState({ open: true, title, subtitle, loading: false, error: getErrorMessage(err), data: null });
    }
  };

  const retryDetail = () => {
    if (!loaderRef.current) return;
    void openDetail(metaRef.current.title, metaRef.current.subtitle, loaderRef.current);
  };

  const closeDetail = () => {
    requestVersionRef.current += 1;
    loaderRef.current = null;
    setState((current) => ({ ...current, open: false, loading: false }));
  };

  const updateDetail = (updater: (current: T) => T) => {
    setState((current) => (current.data ? { ...current, data: updater(current.data) } : current));
  };

  return { state, openDetail, closeDetail, retryDetail, updateDetail };
};

const UserDetailContent = ({
  data,
  canResetPassword,
  canUpdateMembership,
  onResetPassword,
  onUpdateMembership,
  feedbackMessage,
  feedbackError,
}: {
  data: AdminUserDetail;
  canResetPassword: boolean;
  canUpdateMembership: boolean;
  onResetPassword: () => void;
  onUpdateMembership: () => void;
  feedbackMessage?: string | null;
  feedbackError?: string | null;
}) => (
  <>
    {feedbackMessage || feedbackError ? (
      <DetailSection title="操作反馈">
        <EmptyState title={feedbackError ? '操作失败' : '操作完成'} message={feedbackError ?? feedbackMessage ?? ''} />
      </DetailSection>
    ) : null}
    <DetailSection title="基础资料">
      <DetailGrid
        items={[
          { label: '用户编号', value: data.user_no },
          { label: '昵称', value: data.nickname },
          { label: '手机号', value: data.mobile },
          { label: '邮箱', value: data.email },
          { label: '会员', value: membershipTypeLabel(data.membership_type) },
          { label: '会员到期', value: formatDateTime(data.membership_expire_at) },
          { label: '状态', value: <Badge tone={badgeToneForStatus(data.status)}>{userStatusLabel(data.status)}</Badge> },
          { label: '最近登录', value: formatDateTime(data.last_login_at) },
          { label: '创建时间', value: formatDateTime(data.created_at) },
          { label: '更新时间', value: formatDateTime(data.updated_at) },
        ]}
      />
      {canUpdateMembership ? (
        <div className="admin-row-end">
          <ActionButton icon={<Crown size={15} />} onClick={onUpdateMembership} tone="success">
            调整权益
          </ActionButton>
        </div>
      ) : null}
    </DetailSection>
    <DetailSection title="登录信息">
      <MiniTable
        columns={['登录方式', '登录账号', '状态', '创建时间', '更新时间']}
        rows={data.auth_accounts.map((item) => [
          authTypeLabel(item.auth_type),
          item.auth_key,
          userStatusLabel(item.status),
          formatDateTime(item.created_at),
          formatDateTime(item.updated_at),
        ])}
        emptyMessage="暂无登录凭据。"
      />
      {canResetPassword ? (
        <div className="admin-row-end">
          <ActionButton icon={<LockKeyhole size={15} />} onClick={onResetPassword} tone="warning">
            重置密码
          </ActionButton>
        </div>
      ) : null}
    </DetailSection>
    <DetailSection title="关联孩子">
      <MiniTable
        columns={['孩子编号', '姓名', '生日', '性别', '状态']}
        rows={data.children.map((item) => [item.child_no, item.name, formatDateOnly(item.birthday), genderLabel(item.gender), childStatusLabel(item.status)])}
        emptyMessage="暂无关联孩子。"
      />
    </DetailSection>
    <DetailSection title="关联家庭">
      <MiniTable
        columns={['家庭编号', '家庭名称', '角色', '状态', '加入时间']}
        rows={data.families.map((item) => [item.family_no, item.family_name, familyRoleLabel(item.role), userStatusLabel(item.status), formatDateTime(item.joined_at)])}
        emptyMessage="暂无关联家庭。"
      />
    </DetailSection>
  </>
);

const FamilyDetailContent = ({ data }: { data: AdminFamilyDetail }) => (
  <>
    <DetailSection title="家庭概览">
      <DetailGrid
        items={[
          { label: '家庭编号', value: data.family_no },
          { label: '家庭名称', value: data.family_name },
          { label: '拥有者', value: `${data.owner_name}（${data.owner_user_no}）` },
          { label: '拥有者手机号', value: data.owner_mobile },
          { label: '状态', value: <Badge tone={badgeToneForStatus(data.status)}>{familyStatusLabel(data.status)}</Badge> },
          { label: '成员数', value: data.members_count },
          { label: '孩子档案数', value: data.children_count },
          { label: '成长记录数', value: data.records_count },
          { label: '媒体数', value: data.media_count },
          { label: '档案交付申请', value: data.archive_export_requests_count },
          { label: '创建时间', value: formatDateTime(data.created_at) },
          { label: '更新时间', value: formatDateTime(data.updated_at) },
        ]}
      />
    </DetailSection>
    <DetailSection title="家庭成员">
      <MiniTable
        columns={['用户编号', '昵称', '手机号', '角色', '状态', '加入时间']}
        rows={data.members.map((item) => [item.user_no, item.nickname, item.mobile, familyRoleLabel(item.role), userStatusLabel(item.status), formatDateTime(item.joined_at)])}
        emptyMessage="暂无家庭成员。"
      />
    </DetailSection>
    <DetailSection title="孩子档案">
      <MiniTable
        columns={['孩子编号', '姓名', '生日', '性别', '状态']}
        rows={data.children.map((item) => [item.child_no, item.name, formatDateOnly(item.birthday), genderLabel(item.gender), childStatusLabel(item.status)])}
        emptyMessage="暂无孩子档案。"
      />
    </DetailSection>
    <DetailSection title="最近成长记录">
      <MiniTable
        columns={['记录编号', '孩子', '标题', '类型', '状态', '创建者', '发生时间']}
        rows={data.recent_records.map((item) => [
          item.record_no,
          `${item.child_name}（${item.child_no}）`,
          item.title,
          recordTypeLabel(item.record_type),
          recordStatusLabel(item.status),
          item.creator_name,
          formatDateTime(item.event_time),
        ])}
        emptyMessage="暂无成长记录。"
      />
    </DetailSection>
    <DetailSection title="档案交付申请">
      <MiniTable
        columns={['申请编号', '孩子', '申请人', '类型', '状态', '提交时间']}
        rows={data.archive_export_requests.map((item) => [
          item.request_no,
          `${item.child_name}（${item.child_no}）`,
          `${item.user_name}（${item.user_no}）`,
          archiveExportPurposeLabel(item.purpose),
          archiveExportStatusLabel(item.status),
          formatDateTime(item.created_at),
        ])}
        emptyMessage="暂无档案交付申请。"
      />
    </DetailSection>
  </>
);

const ChildDetailContent = ({ data }: { data: AdminChildDetail }) => (
  <>
    <DetailSection title="孩子资料">
      <div className="admin-child-profile-head">
        <AvatarThumb src={data.avatar_url} label={data.name} size={72} />
        <div>
          <h3>{data.name}</h3>
          <p>{data.current_age_display ?? formatDateOnly(data.birthday)} · {genderLabel(data.gender)}</p>
        </div>
      </div>
      <DetailGrid
        items={[
          { label: '孩子编号', value: data.child_no },
          { label: '生日', value: formatDateOnly(data.birthday) },
          { label: '当前年龄', value: data.current_age_display },
          { label: '出生地', value: data.birth_place },
          { label: '档案状态', value: <Badge tone={badgeToneForStatus(data.status)}>{childStatusLabel(data.status)}</Badge> },
          { label: '家庭编号', value: data.family_no },
          { label: '家庭名称', value: data.family_name },
          { label: '拥有者', value: `${data.owner_name}（${data.owner_user_no}）` },
          { label: '头像媒体', value: data.avatar_media_no },
          { label: '运营备注', value: data.remark },
        ]}
      />
    </DetailSection>
    <DetailSection title="家庭成员">
      <MiniTable
        columns={['成员', '手机号', '角色', '状态', '加入时间']}
        rows={data.family_members.map((item) => [
          <EntityWithAvatar key={item.user_no} avatarUrl={item.avatar_url} title={item.nickname} meta={item.user_no} />,
          item.mobile,
          familyRoleLabel(item.role),
          userStatusLabel(item.status),
          formatDateTime(item.joined_at),
        ])}
        emptyMessage="暂无家庭成员。"
      />
    </DetailSection>
    <DetailSection title="最近记录">
      <MiniTable
        columns={['记录', '类型', '状态', '媒体', '创建者', '发生时间']}
        rows={data.recent_records.map((item) => [
          <span key={item.record_no} className="admin-record-summary-line">
            {item.cover_url ? <img src={item.cover_url} alt={item.title ?? item.record_no} loading="lazy" decoding="async" /> : <span className="admin-record-summary-placeholder">无封面</span>}
            <EntityTitle title={item.title ?? '未命名记录'} meta={item.record_no} />
          </span>,
          recordTypeLabel(item.record_type),
          recordStatusLabel(item.status),
          `${item.media_count} 个`,
          item.creator_name ?? item.creator_user_no,
          formatDateTime(item.event_time),
        ])}
        emptyMessage="暂无成长记录。"
      />
    </DetailSection>
  </>
);

const RecordMediaPreview = ({
  item,
}: {
  item: AdminRecordDetail['media_list'][number];
}) => {
  const previewSource = item.thumbnail_url ?? item.access_url;

  if (!previewSource) {
    return <div className="admin-media-preview-placeholder"><span>暂无预览地址</span></div>;
  }

  return (
    <MediaPreview
      src={previewSource}
      fullSrc={item.access_url ?? previewSource}
      alt={item.original_name ?? item.media_no}
      mediaType={item.media_type}
      mimeType={item.mime_type}
    />
  );
};

const RecordContentPreview = ({ data }: { data: AdminRecordDetail }) => (
  <DetailSection title="内容预览">
    <div className="admin-content-preview">
      <article className="admin-record-preview-text">
        <div className="admin-record-preview-eyebrow">{recordTypeLabel(data.record_type)}</div>
        <h4>{data.title ?? '未命名记录'}</h4>
        {data.content_text ? <p>{data.content_text}</p> : <p className="admin-record-preview-muted">暂无文字内容</p>}
      </article>
      {data.media_list.length ? (
        <div className="admin-media-preview-grid">
          {data.media_list.map((item) => {
            const diagnostics = [
              item.status === 'uploading' ? '处理中' : null,
              item.status === 'failed' ? '处理失败' : null,
              item.upload_expired ? '会话过期' : null,
              item.failure_reason ? item.failure_reason : null,
            ].filter(Boolean);

            return (
              <article key={item.media_no} className="admin-media-preview-card">
                <div className="admin-media-preview-card-head">
                  <strong>{item.original_name ?? item.media_no}</strong>
                  <span>{mediaTypeLabel(item.media_type)}</span>
                </div>
                <RecordMediaPreview item={item} />
                <div className="admin-media-preview-meta">
                  <Badge tone={badgeToneForStatus(item.status)}>{mediaStatusLabel(item.status)}</Badge>
                  <span>{formatBytes(item.size_bytes)}</span>
                  {item.width && item.height ? <span>{item.width}×{item.height}</span> : null}
                  {item.duration_seconds ? <span>{Math.round(item.duration_seconds)} 秒</span> : null}
                </div>
                {diagnostics.length ? <div className="admin-media-preview-diagnostics">{diagnostics.map((text) => <span key={text}>{text}</span>)}</div> : null}
                {item.access_url ? <a className="admin-media-preview-open" href={item.access_url} target="_blank" rel="noreferrer">打开原文件</a> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-media-preview-empty">暂无关联媒体</div>
      )}
    </div>
  </DetailSection>
);

const RecordDetailContent = ({ data }: { data: AdminRecordDetail }) => (
  <>
    <RecordContentPreview data={data} />
    <DetailSection title="记录概要">
      <DetailGrid
        items={[
          { label: '记录编号', value: data.record_no },
          { label: '标题', value: data.title },
          { label: '孩子', value: `${data.child_name}（${data.child_no}）` },
          { label: '创建者', value: `${data.creator_name}（${data.creator_user_no}）` },
          { label: '类型', value: recordTypeLabel(data.record_type) },
          { label: '可见范围', value: visibilityScopeLabel(data.visibility_scope) },
          { label: '状态', value: <Badge tone={badgeToneForStatus(data.status)}>{recordStatusLabel(data.status)}</Badge> },
          { label: '发生时间', value: formatDateTime(data.event_time) },
          { label: '发布时间', value: formatDateTime(data.published_at) },
          { label: '里程碑', value: data.is_milestone ? '是' : '否' },
        ]}
      />
    </DetailSection>
    <DetailSection title="正文与 AI 摘要">
      <DetailList
        items={[
          { label: '正文', value: data.content_text },
          { label: 'AI 标题', value: data.ai_generated_title },
          { label: 'AI 摘要', value: data.ai_summary },
          { label: 'AI 状态', value: data.ai_status ? aiJobStatusLabel(data.ai_status) : '—' },
          { label: '标签', value: data.tags.length ? data.tags.map((item) => `${item.tag_name}（${item.source === 'ai' ? 'AI' : '手动'}）`).join('、') : '—' },
        ]}
      />
    </DetailSection>
    <DetailSection title="AI 任务">
      <MiniTable
        columns={['任务编号', '类型', '状态', '错误信息', '重试次数', '创建时间']}
        rows={data.ai_jobs.map((item) => [item.job_no, aiJobTypeLabel(item.job_type), aiJobStatusLabel(item.status), item.error_message, item.retry_count ?? 0, formatDateTime(item.created_at)])}
        emptyMessage="暂无关联 AI 任务。"
      />
    </DetailSection>
  </>
);

const MediaDetailContent = ({ data }: { data: AdminMediaDetail }) => {
  const previewSource = data.thumbnail_url ?? data.access_url;
  const pendingDiagnostics = [
    data.status === 'uploading' ? (data.access_url ? '后台审查地址已生成' : '后台审查地址未生成') : null,
    data.status === 'uploading' ? (data.object_key ? '对象路径已记录' : '对象路径缺失') : null,
    data.upload_expired ? '上传会话已过期' : null,
    data.failure_reason ? `失败原因：${data.failure_reason}` : null,
  ].filter(Boolean);

  return (
  <>
    <DetailSection title="媒体预览">
      <div className="admin-media-preview-card">
        <div className="admin-media-preview-card-head">
          <strong>{data.original_name ?? data.media_no}</strong>
          <span>{mediaTypeLabel(data.media_type)} · {mediaStatusLabel(data.status)}</span>
        </div>
        <MediaPreview src={previewSource} fullSrc={data.access_url ?? previewSource} alt={data.original_name ?? data.media_no} mediaType={data.media_type} mimeType={data.mime_type} />
        {pendingDiagnostics.length > 0 ? (
          <div className="admin-media-preview-diagnostics">
            {pendingDiagnostics.map((item) => <span key={item}>{item}</span>)}
          </div>
        ) : !previewSource ? (
          <div className="admin-media-preview-diagnostics">
            <span>无可用预览：未返回缩略图或访问地址</span>
          </div>
        ) : null}
        {data.access_url ? <a className="admin-media-preview-open" href={data.access_url} target="_blank" rel="noreferrer">打开原文件</a> : null}
      </div>
    </DetailSection>
    <DetailSection title="文件信息">
      <DetailGrid
        items={[
          { label: '媒体编号', value: data.media_no },
          { label: '类型', value: mediaTypeLabel(data.media_type) },
          { label: '状态', value: <Badge tone={badgeToneForStatus(data.status)}>{mediaStatusLabel(data.status)}</Badge> },
          { label: '文件名', value: data.original_name },
          { label: '文件类型', value: data.mime_type },
          { label: '大小', value: formatBytes(data.size_bytes) },
          { label: '宽度', value: data.width },
          { label: '高度', value: data.height },
          { label: '存储桶', value: data.bucket },
          { label: '对象路径', value: data.object_key },
        ]}
      />
    </DetailSection>
    <DetailSection title="归属关系">
      <DetailGrid
        items={[
          { label: '家庭编号', value: data.family_no },
          { label: '孩子', value: data.child_no ? `${data.child_name ?? '未命名'}（${data.child_no}）` : '—' },
          { label: '记录', value: data.record_no ? `${data.record_title ?? '未命名'}（${data.record_no}）` : '—' },
          { label: '上传者', value: `${data.uploader_name}（${data.uploader_user_no}）` },
          { label: '上传者手机号', value: data.uploader_mobile },
          { label: '创建时间', value: formatDateTime(data.created_at) },
          { label: '更新时间', value: formatDateTime(data.updated_at) },
        ]}
      />
    </DetailSection>
  </>
  );
};

const AiJobDetailContent = ({ data }: { data: AdminAiJobDetail }) => (
  <>
    <DetailSection title="任务信息">
      <DetailGrid
        items={[
          { label: '任务编号', value: data.job_no },
          { label: '任务类型', value: aiJobTypeLabel(data.job_type) },
          { label: '状态', value: <Badge tone={badgeToneForStatus(data.status)}>{aiJobStatusLabel(data.status)}</Badge> },
          { label: '服务商', value: aiProviderLabel(data.provider) },
          { label: '重试次数', value: data.retry_count },
          { label: '失败原因', value: data.error_message },
          { label: '请求人', value: `${data.requester_name}（${data.requester_user_no}）` },
          { label: '关联记录', value: data.record_no ? `${data.record_title ?? '未命名'}（${data.record_no}）` : '—' },
          { label: '开始时间', value: formatDateTime(data.started_at) },
          { label: '完成时间', value: formatDateTime(data.finished_at) },
          { label: '创建时间', value: formatDateTime(data.created_at) },
          { label: '更新时间', value: formatDateTime(data.updated_at) },
        ]}
      />
    </DetailSection>
    <DetailSection title="输入快照">
      <JsonBlock value={data.input_snapshot} />
    </DetailSection>
    <DetailSection title="输出结果">
      <JsonBlock value={data.output_json} />
    </DetailSection>
  </>
);

const AuditLogDetailContent = ({ data }: { data: AdminAuditLogItem }) => (
  <>
    <DetailSection title="审计详情">
      <DetailGrid
        items={[
          { label: '操作者类型', value: auditActorTypeLabel(data.actor_type) },
          { label: '操作者编号', value: data.actor_id },
          { label: '动作', value: auditActionLabel(data.action) },
          { label: '目标类型', value: auditTargetTypeLabel(data.target_type) },
          { label: '目标编号', value: data.target_id },
          { label: 'IP 地址', value: data.ip_address },
          { label: '客户端标识', value: data.user_agent },
          { label: '发生时间', value: formatDateTime(data.created_at) },
        ]}
      />
    </DetailSection>
    <DetailSection title="扩展数据">
      <JsonBlock value={data.metadata} />
    </DetailSection>
  </>
);

const NotificationDeliveryBadges = ({ item }: { item: AdminNotificationItem }) => {
  const entries = Object.entries(item.delivery_status_counts);
  if (!entries.length) return <Badge tone="neutral">暂无投递</Badge>;

  return (
    <span className="admin-chip-row">
      {entries.map(([status, count]) => (
        <Badge key={status} tone={badgeToneForStatus(status)}>
          {notificationDeliveryStatusLabel(status)} {count}
        </Badge>
      ))}
    </span>
  );
};

const NotificationDetailContent = ({ data }: { data: AdminNotificationItem }) => (
  <>
    <DetailSection title="通知内容">
      <DetailGrid
        items={[
          { label: '通知编号', value: data.notification_no },
          { label: '通知类型', value: notificationTypeLabel(data.notification_type) },
          { label: '已读状态', value: <Badge tone={data.read_at ? 'success' : 'warning'}>{notificationReadStateLabel(data.read_at ? 'read' : 'unread')}</Badge> },
          { label: '目标对象', value: data.target_no ? `${data.target_type ?? 'target'}（${data.target_no}）` : '—' },
          { label: '创建时间', value: formatDateTime(data.created_at) },
          { label: '已读时间', value: formatDateTime(data.read_at) },
        ]}
      />
    </DetailSection>
    <DetailSection title="接收人与家庭">
      <DetailGrid
        items={[
          { label: '接收人', value: `${data.user_name}（${data.user_no}）` },
          { label: '接收人手机号', value: data.user_mobile },
          { label: '家庭', value: `${data.family_name ?? '未命名家庭'}（${data.family_no}）` },
          { label: '触发人', value: data.actor_user_no ? `${data.actor_name ?? '未知用户'}（${data.actor_user_no}）` : '系统' },
        ]}
      />
    </DetailSection>
    <DetailSection title="标题与正文">
      <DetailList
        items={[
          { label: '标题', value: data.title },
          { label: '正文', value: data.body },
        ]}
      />
    </DetailSection>
    <DetailSection title="投递记录">
      {data.deliveries.length ? (
        <DetailList
          items={data.deliveries.map((delivery, index) => ({
            label: `${delivery.channel} · ${notificationDeliveryStatusLabel(delivery.status)} · #${index + 1}`,
            value: [
              `服务商：${delivery.provider ?? '—'}`,
              `尝试次数：${delivery.attempts}`,
              `送达时间：${formatDateTime(delivery.delivered_at)}`,
              `下次重试：${formatDateTime(delivery.next_retry_at)}`,
              `错误信息：${delivery.last_error ?? '—'}`,
              `更新时间：${formatDateTime(delivery.updated_at)}`,
            ].join('\n'),
          }))}
        />
      ) : (
        <EmptyState title="暂无投递记录" message="这条通知目前只有站内消息，没有生成推送投递任务。" />
      )}
    </DetailSection>
  </>
);

const SupportTicketDetailContent = ({ data }: { data: AdminSupportTicketItem }) => (
  <>
    <DetailSection title="反馈信息">
      <DetailGrid
        items={[
          { label: '反馈编号', value: data.ticket_no },
          { label: '问题类型', value: data.category },
          { label: '处理状态', value: supportTicketStatusLabel(data.status) },
          { label: '优先级', value: supportTicketPriorityLabel(data.priority) },
          { label: '提交时间', value: formatDateTime(data.created_at) },
          { label: '更新时间', value: formatDateTime(data.updated_at) },
        ]}
      />
    </DetailSection>
    <DetailSection title="提交人">
      <DetailGrid
        items={[
          { label: '用户编号', value: data.user_no },
          { label: '用户昵称', value: data.user_name },
          { label: '用户手机', value: data.user_mobile },
          { label: '联系方式', value: data.contact },
          { label: '主题', value: data.topic },
        ]}
      />
    </DetailSection>
    <DetailSection title="反馈内容">
      <DetailList items={[{ label: '用户描述', value: data.content }]} />
    </DetailSection>
    <DetailSection title="处理记录">
      <DetailList
        items={[
          { label: '处理人', value: data.assigned_admin_name },
          { label: '处理时间', value: formatDateTime(data.handled_at) },
          { label: '处理备注', value: data.handle_note },
        ]}
      />
    </DetailSection>
  </>
);

const ArchiveExportRequestDetailContent = ({ data }: { data: AdminArchiveExportRequestItem }) => (
  <>
    <DetailSection title="申请信息">
      <DetailGrid
        items={[
          { label: '申请编号', value: data.request_no },
          { label: '申请类型', value: archiveExportPurposeLabel(data.purpose) },
          { label: '导出范围', value: archiveExportTypeLabel(data.export_type) },
          { label: '处理状态', value: archiveExportStatusLabel(data.status) },
          { label: '提交时间', value: formatDateTime(data.created_at) },
          { label: '更新时间', value: formatDateTime(data.updated_at) },
        ]}
      />
    </DetailSection>
    <DetailSection title="档案归属">
      <DetailGrid
        items={[
          { label: '孩子档案', value: `${data.child_name}（${data.child_no}）` },
          { label: '家庭编号', value: data.family_no },
          { label: '家庭名称', value: data.family_name },
          { label: '申请人', value: `${data.user_name}（${data.user_no}）` },
          { label: '申请人手机', value: data.user_mobile },
          { label: '联系信息', value: data.contact },
        ]}
      />
    </DetailSection>
    <DetailSection title="资产快照">
      <DetailGrid
        items={[
          { label: '记录数', value: data.record_count },
          { label: '媒体数', value: data.media_count },
          { label: '里程碑数', value: data.milestone_count },
          { label: '最早记录', value: formatDateTime(data.first_record_time) },
          { label: '最新记录', value: formatDateTime(data.latest_record_time) },
        ]}
      />
    </DetailSection>
    <DetailSection title="处理备注">
      <DetailList
        items={[
          { label: '用户备注', value: data.note },
          { label: '处理人', value: data.processed_by_name },
          { label: '处理时间', value: formatDateTime(data.processed_at) },
          { label: '运营备注', value: data.process_note },
        ]}
      />
    </DetailSection>
  </>
);

export const UsersPage = () => {
  const state = useAdminListPage<AdminUserItem>(adminApi.listUsers);
  const detail = useDetailState<AdminUserDetail>();
  const { admin } = useAdminAuth();
  const { requestOperationReason, reasonDialog } = useOperationReasonDialog();
  const { requestResetPassword, resetPasswordDialog } = useResetPasswordDialog();
  const { requestMembershipUpdate, membershipDialog } = useMembershipDialog();
  const [updatingUserNo, setUpdatingUserNo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const canResetPassword = admin?.role === 'super_admin';
  const canUpdateMembership = admin?.role === 'super_admin' || admin?.role === 'operator';

  const onToggleStatus = async (user: AdminUserItem) => {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    const actionName = nextStatus === 'disabled' ? '冻结用户' : '解冻用户';
    const reason = await requestOperationReason(actionName);
    if (!reason) return;

    setActionError(null);
    setActionMessage(null);
    setUpdatingUserNo(user.user_no);
    try {
      const updated = await adminApi.updateUserStatus(user.user_no, { status: nextStatus, reason });
      state.updateResult((current) =>
        current
          ? {
              ...current,
              list: current.list.map((item) => (item.user_no === updated.user_no ? { ...item, status: updated.status } : item)),
            }
          : current,
      );
      detail.updateDetail((current) => (current.user_no === updated.user_no ? { ...current, status: updated.status } : current));
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingUserNo(null);
    }
  };

  const onResetPassword = async (user: Pick<AdminUserItem, 'user_no' | 'nickname' | 'mobile'>) => {
    const payload = await requestResetPassword(user);
    if (!payload) return;

    setActionError(null);
    setActionMessage(null);
    setUpdatingUserNo(user.user_no);
    try {
      const result = await adminApi.resetUserPassword(user.user_no, payload);
      setActionMessage(`已重置 ${user.nickname} 的登录密码，并撤销 ${result.revoked_sessions} 个登录会话。`);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingUserNo(null);
    }
  };

  const onUpdateMembership = async (user: Pick<AdminUserItem, 'user_no' | 'nickname' | 'mobile' | 'membership_type'> & { membership_expire_at?: string | null }) => {
    const payload = await requestMembershipUpdate(user);
    if (!payload) return;

    setActionError(null);
    setActionMessage(null);
    setUpdatingUserNo(user.user_no);
    try {
      const updated = await adminApi.updateUserMembership(user.user_no, payload);
      state.updateResult((current) =>
        current
          ? {
              ...current,
              list: current.list.map((item) => (item.user_no === updated.user_no ? { ...item, membership_type: updated.membership_type } : item)),
            }
          : current,
      );
      detail.updateDetail((current) =>
        current.user_no === updated.user_no
          ? { ...current, membership_type: updated.membership_type, membership_expire_at: updated.membership_expire_at }
          : current,
      );
      setActionMessage(`已将 ${user.nickname} 的套餐权益调整为 ${membershipTypeLabel(updated.membership_type)}。`);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingUserNo(null);
    }
  };

  const currentUsers = state.result?.list ?? [];
  const activeUsers = currentUsers.filter((item) => item.status === 'active').length;
  const disabledUsers = currentUsers.filter((item) => item.status === 'disabled').length;
  const rows = formatListRows(currentUsers, (item) => [    <EntityTitle key={`${item.user_no}-profile`} title={item.nickname} meta={item.mobile} />,
    item.mobile,
    <Badge key={`${item.user_no}-membership`} tone="info">{membershipTypeLabel(item.membership_type)}</Badge>,
    <Badge key={`${item.user_no}-status`} tone={badgeToneForStatus(item.status)}>{userStatusLabel(item.status)}</Badge>,
    formatDateTime(item.last_login_at),
    formatDateTime(item.created_at),
    <ActionGroup key={`${item.user_no}-actions`}>
      <ActionButton icon={<Eye size={15} />} onClick={() => void detail.openDetail('用户详情', item.user_no, () => adminApi.getUserDetail(item.user_no))}>详情</ActionButton>
      <ActionButton icon={item.status === 'active' ? <Snowflake size={15} /> : <CheckCircle2 size={15} />} onClick={() => void onToggleStatus(item)} disabled={updatingUserNo === item.user_no} tone={item.status === 'active' ? 'danger' : 'success'}>
        {updatingUserNo === item.user_no ? '处理中…' : item.status === 'active' ? '冻结' : '解冻'}
      </ActionButton>
      {canResetPassword ? (
        <ActionButton icon={<LockKeyhole size={15} />} onClick={() => void onResetPassword(item)} disabled={updatingUserNo === item.user_no} tone="warning">
          重置密码
        </ActionButton>
      ) : null}
      {canUpdateMembership ? (
        <ActionButton icon={<Crown size={15} />} onClick={() => void onUpdateMembership(item)} disabled={updatingUserNo === item.user_no} tone="success">
          调整权益
        </ActionButton>
      ) : null}
    </ActionGroup>,
  ],
    (item) => item.user_no,
  );

  return (
    <PageShell title="账号管理" description="按关键字查询用户账号，处理冻结、解冻、登录信息核查和密码重置。">
      <SearchPanel {...state} />
      <ListSummary label="账号状态概览" description="默认展示用户列表，先看账号状态，再决定是否进入详情、冻结、解冻或重置登录密码。">
        <SummaryStat label="当前页正常" value={activeUsers} tone="success" />
        <SummaryStat label="当前页已冻结" value={disabledUsers} tone={disabledUsers > 0 ? 'danger' : 'neutral'} />
      </ListSummary>
      <ActionFeedback message={actionMessage} error={actionError} />
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell className="admin-users-table" columns={['用户', '手机号', '会员', '状态', '最近登录', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配用户。可输入手机号、昵称或清空筛选后重新查询。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} onPageSizeChange={state.onPageSizeChange} onJumpToPage={state.onJumpToPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail} onRetry={detail.retryDetail}>
        {detail.state.data ? (
          <UserDetailContent
            data={detail.state.data}
            canResetPassword={canResetPassword}
            canUpdateMembership={canUpdateMembership}
            onResetPassword={() => void onResetPassword(detail.state.data!)}
            onUpdateMembership={() => void onUpdateMembership(detail.state.data!)}
            feedbackMessage={actionMessage}
            feedbackError={actionError}
          />
        ) : null}
      </DetailDrawer>
      {reasonDialog}
      {resetPasswordDialog}
      {membershipDialog}
    </PageShell>
  );
};

export const FamiliesPage = () => {
  const state = useAdminListPage<AdminFamilyItem>(adminApi.listFamilies);
  const detail = useDetailState<AdminFamilyDetail>();
  const currentFamilies = state.result?.list ?? [];
  const activeFamilies = currentFamilies.filter((item) => item.status === 'active').length;
  const totalChildren = currentFamilies.reduce((sum, item) => sum + item.children_count, 0);
  const totalRecords = currentFamilies.reduce((sum, item) => sum + item.records_count, 0);
  const rows = formatListRows(currentFamilies, (item) => [
    <EntityTitle key={`${item.family_no}-profile`} title={item.family_name ?? item.family_no} meta={item.family_no} />,
    <EntityTitle key={`${item.family_no}-owner`} title={item.owner_name} meta={item.owner_mobile ?? item.owner_user_no} />,
    <span key={`${item.family_no}-assets`} style={{ display: 'grid', gap: '4px' }}>
      <span>{item.children_count} 个孩子 / {item.members_count} 位成员</span>
        <span style={{ color: '#7d7162', fontSize: '12px' }}>{item.records_count} 条记录 / {item.media_count} 个媒体</span>
    </span>,
    `${item.archive_export_requests_count} 项`,
    <Badge key={`${item.family_no}-status`} tone={badgeToneForStatus(item.status)}>{familyStatusLabel(item.status)}</Badge>,
    formatDateTime(item.created_at),
    <ActionButton key={`${item.family_no}-detail`} icon={<Eye size={15} />} onClick={() => void detail.openDetail('家庭详情', item.family_no, () => adminApi.getFamilyDetail(item.family_no))}>详情</ActionButton>,
  ], (item) => item.family_no);

  return (
    <PageShell title="家庭管理" description="按家庭维度查看成员、孩子档案、成长资产和档案交付申请，方便运营处理家庭协作与长期托管问题。">
      <SearchPanel {...state} description="输入家庭编号、家庭名称、拥有者昵称或手机号后查询。" placeholder="家庭编号 / 家庭名称 / 拥有者" />
      <ListSummary label="家庭资产概览" description="家庭是孩子档案、成员协作、媒体资产和交付申请的归属中心；运营先按家庭定位，再进入详情核查成员和记录。">
        <SummaryStat label="当前页家庭" value={currentFamilies.length} />
        <SummaryStat label="当前页状态正常" value={activeFamilies} tone="success" />
        <SummaryStat label="当前页孩子档案" value={totalChildren} />
        <SummaryStat label="当前页成长记录" value={totalRecords} />
      </ListSummary>
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell columns={['家庭', '拥有者', '资产规模', '交付申请', '状态', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配家庭。可按家庭编号、家庭名称或拥有者重新查询。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} onPageSizeChange={state.onPageSizeChange} onJumpToPage={state.onJumpToPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail} onRetry={detail.retryDetail}>
        {detail.state.data ? <FamilyDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
    </PageShell>
  );
};

export const ChildrenPage = () => {
  const state = useAdminListPage<AdminChildItem>(adminApi.listChildren);
  const detail = useDetailState<AdminChildDetail>();
  const currentChildren = state.result?.list ?? [];
  const activeChildren = currentChildren.filter((item) => item.status === 'active' || item.status === 'normal').length;
  const avatarReadyCount = currentChildren.filter((item) => Boolean(item.avatar_url)).length;
  const rows = formatListRows(currentChildren, (item) => [
    <EntityWithAvatar key={`${item.child_no}-profile`} avatarUrl={item.avatar_url} title={item.name} meta={`${item.current_age_display ?? formatDateOnly(item.birthday)} · ${genderLabel(item.gender)}`} />,
    <EntityTitle key={`${item.child_no}-family`} title={item.family_name ?? item.family_no} meta={item.family_no} />,
    <EntityTitle key={`${item.child_no}-owner`} title={item.owner_name ?? item.owner_user_no} meta={item.owner_user_no} />,
    item.birth_place ?? '—',
    formatDateOnly(item.updated_at ?? item.created_at),
    <Badge key={item.child_no} tone={badgeToneForStatus(item.status)}>{childStatusLabel(item.status)}</Badge>,
    <ActionButton key={`${item.child_no}-detail`} icon={<Eye size={15} />} onClick={() => void detail.openDetail('孩子档案详情', item.child_no, () => adminApi.getChildDetail(item.child_no))}>详情</ActionButton>,
  ], (item) => item.child_no);

  return (
    <PageShell title="孩子列表" description="查询孩子档案、归属家庭与拥有者。">
      <SearchPanel {...state} />
      <ListSummary label="孩子档案概览" description="默认展示档案归属和状态，发现异常时进入详情核查家庭关系。">
        <SummaryStat label="当前页头像可用" value={`${avatarReadyCount}/${currentChildren.length}`} tone={avatarReadyCount === currentChildren.length ? 'success' : 'warning'} />
        <SummaryStat label="当前页档案" value={currentChildren.length} />
        <SummaryStat label="当前页状态正常" value={activeChildren} tone="success" />
      </ListSummary>
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell columns={['孩子', '家庭', '拥有者', '出生地', '更新日期', '状态', '操作']} rows={rows} emptyMessage="暂无匹配孩子档案。可按孩子、家庭或拥有者重新查询。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} onPageSizeChange={state.onPageSizeChange} onJumpToPage={state.onJumpToPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail} onRetry={detail.retryDetail}>
        {detail.state.data ? <ChildDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
    </PageShell>
  );
};

export const RecordsPage = () => {
  const [recordFilter, setRecordFilter] = useState<AdminRecordFilter>(() => normalizeRecordFilter(new URLSearchParams(window.location.search).get('record_filter')));
  const state = useAdminListPage<AdminRecordItem>((params) => adminApi.listRecords({ ...params, record_filter: recordFilter }));
  const detail = useDetailState<AdminRecordDetail>();
  const { requestOperationReason, reasonDialog } = useOperationReasonDialog();
  const [updatingRecordNo, setUpdatingRecordNo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const filterLoadedRef = useRef(recordFilter);

  const updateStatus = async (record: AdminRecordItem) => {
    const nextStatus = record.status === 'published' ? 'draft' : 'published';
    const actionName = nextStatus === 'draft' ? '下架记录' : '恢复记录';
    const reason = await requestOperationReason(actionName);
    if (!reason) return;

    setActionError(null);
    setUpdatingRecordNo(record.record_no);
    try {
      const updated = await adminApi.updateRecordStatus(record.record_no, { status: nextStatus, reason });
      state.updateResult((current) =>
        current
          ? {
              ...current,
              list: current.list.map((item) => (item.record_no === updated.record_no ? { ...item, status: updated.status } : item)),
            }
          : current,
      );
      detail.updateDetail((current) => (current.record_no === updated.record_no ? { ...current, status: updated.status } : current));
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingRecordNo(null);
    }
  };

  useEffect(() => {
    if (filterLoadedRef.current === recordFilter) return;
    filterLoadedRef.current = recordFilter;
    void state.load(1, state.pageSize);
  }, [recordFilter, state]);

  const currentRecords = state.result?.list ?? [];
  const publishedRecords = currentRecords.filter((item) => item.status === 'published').length;
  const draftRecords = currentRecords.filter((item) => item.status === 'draft').length;
  const mediaExceptionRecords = currentRecords.filter((item) => item.has_media_exception).length;
  const riskFlagRecords = currentRecords.filter((item) => item.has_risk_flag).length;
  const rows = formatListRows(currentRecords, (item) => [
    <EntityTitle key={`${item.record_no}-title`} title={item.title ?? '未命名记录'} meta={`创建者：${item.creator_name ?? item.creator_user_no}`} />,
    item.child_name ?? item.child_no,
    <Badge key={`${item.record_no}-type`} tone="info">{recordTypeLabel(item.record_type)}</Badge>,
    item.media_count ? (
      <span key={`${item.record_no}-media`} className="admin-record-media-tags">
        {(item.media_types ?? []).map((type) => <Badge key={`${item.record_no}-${type}`} tone="neutral">{mediaTypeLabel(type)}</Badge>)}
        {item.has_media_exception ? <Badge tone="warning">异常 {item.pending_media_count ?? 0}</Badge> : null}
      </span>
    ) : '—',
    visibilityScopeLabel(item.visibility_scope),
    <Badge key={`${item.record_no}-status`} tone={badgeToneForStatus(item.status)}>{recordStatusLabel(item.status)}</Badge>,
    formatDateTime(item.created_at),
    <ActionGroup key={`${item.record_no}-actions`}>
      <ActionButton icon={<Eye size={15} />} onClick={() => void detail.openDetail('成长记录详情', item.record_no, () => adminApi.getRecordDetail(item.record_no))}>详情</ActionButton>
      <ActionButton icon={item.status === 'published' ? <ArchiveX size={15} /> : <RotateCcw size={15} />} onClick={() => void updateStatus(item)} disabled={updatingRecordNo === item.record_no} tone={item.status === 'published' ? 'danger' : 'success'}>
        {updatingRecordNo === item.record_no ? '处理中…' : item.status === 'published' ? '下架' : '恢复'}
      </ActionButton>
    </ActionGroup>,
  ], (item) => item.record_no);

  return (
    <PageShell title="成长记录">
      <SearchPanel {...state} />
      <Panel className="admin-record-filter-panel">
        <div className="admin-record-filter-bar">
          <div className="admin-record-filter-tabs" role="tablist" aria-label="成长记录筛选">
            {recordFilterOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                className={recordFilter === item.key ? 'is-active' : ''}
                onClick={() => {
                  setRecordFilter(item.key);
                  // 基于当前路径写查询串，避免硬编码路径在子路径部署下失效。
                  const query = item.key === 'all' ? '' : `?record_filter=${item.key}`;
                  window.history.replaceState(null, '', `${window.location.pathname}${query}`);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>
      <ListSummary label="记录概览">
        <SummaryStat label="当前页已发布" value={publishedRecords} tone="success" />
        <SummaryStat label="当前页草稿" value={draftRecords} tone={draftRecords > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="当前页媒体异常" value={mediaExceptionRecords} tone={mediaExceptionRecords > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="当前页风险标记" value={riskFlagRecords} tone={riskFlagRecords > 0 ? 'danger' : 'neutral'} />
      </ListSummary>
      <ActionFeedback error={actionError} />
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell className="admin-records-table" columns={['记录', '孩子', '类型', '媒体', '可见范围', '状态', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配成长记录。可切换筛选或重新搜索。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} onPageSizeChange={state.onPageSizeChange} onJumpToPage={state.onJumpToPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail} onRetry={detail.retryDetail}>
        {detail.state.data ? <RecordDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
      {reasonDialog}
    </PageShell>
  );
};

export const MediaPage = () => {
  const detail = useDetailState<AdminMediaDetail>();
  const { requestOperationReason, reasonDialog } = useOperationReasonDialog();
  const [keyword, setKeyword] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [status, setStatus] = useState('');
  const [linked, setLinked] = useState('');
  const [childNo, setChildNo] = useState('');
  const [familyNo, setFamilyNo] = useState('');
  const [uploaderUserNo, setUploaderUserNo] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof adminApi.listMedia>> | null>(null);
  const mediaAutoLoadedRef = useRef(false);
  const [updatingMediaNo, setUpdatingMediaNo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const mediaLoadRequestRef = useRef(0);

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize, event?: FormEvent, override?: Partial<AdminMediaListParams>) => {
    event?.preventDefault();
    const requestId = ++mediaLoadRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await adminApi.listMedia({
        keyword: optionalFilter(override?.keyword ?? keyword),
        media_type: optionalFilter(override?.media_type ?? mediaType),
        status: optionalFilter(override?.status ?? status),
        linked: optionalFilter(override?.linked ?? linked),
        child_no: optionalFilter(override?.child_no ?? childNo),
        family_no: optionalFilter(override?.family_no ?? familyNo),
        uploader_user_no: optionalFilter(override?.uploader_user_no ?? uploaderUserNo),
        start_time: override?.start_time ?? toIsoDateTime(startTime),
        end_time: override?.end_time ?? toIsoDateTime(endTime),
         page: nextPage,
         page_size: nextPageSize,
       });
      if (requestId !== mediaLoadRequestRef.current) return;
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      if (requestId !== mediaLoadRequestRef.current) return;
      setError(getErrorMessage(err));
    } finally {
      if (requestId === mediaLoadRequestRef.current) setLoading(false);
    }
  }, [childNo, endTime, familyNo, keyword, linked, mediaType, page, pageSize, startTime, status, uploaderUserNo]);

  useEffect(() => {
    if (mediaAutoLoadedRef.current) return;
    mediaAutoLoadedRef.current = true;
    void load(1, pageSize);
  }, [load, pageSize]);

  const clearFilters = async () => {
    setKeyword('');
    setMediaType('');
    setStatus('');
    setLinked('');
    setChildNo('');
    setFamilyNo('');
    setUploaderUserNo('');
    setStartTime('');
    setEndTime('');
    await load(1, pageSize, undefined, {
      keyword: '',
      media_type: '',
      status: '',
      linked: '',
      child_no: '',
      family_no: '',
      uploader_user_no: '',
      start_time: undefined,
      end_time: undefined,
    });
  };

  const updateStatus = async (media: AdminMediaItem, status: 'ready' | 'failed' | 'removed') => {
    const actionName = status === 'ready' ? '通过媒体审核' : status === 'removed' ? '下架媒体' : '标记媒体异常';
    const reason = await requestOperationReason(actionName);
    if (!reason) return;

    setActionError(null);
    setUpdatingMediaNo(media.media_no);
    try {
      const updated = await adminApi.updateMediaStatus(media.media_no, { status, reason });
      setResult((current) =>
        current
          ? {
              ...current,
              list: current.list.map((item) => (item.media_no === updated.media_no ? { ...item, status: updated.status } : item)),
            }
          : current,
      );
      detail.updateDetail((current) => (current.media_no === updated.media_no ? { ...current, status: updated.status } : current));
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingMediaNo(null);
    }
  };

  const currentMedia = result?.list ?? [];
  const readyMedia = currentMedia.filter((item) => item.status === 'ready').length;
  const needsReviewMedia = currentMedia.filter((item) => item.status === 'uploading' || item.status === 'failed' || !item.record_no).length;
  const rows = formatListRows(currentMedia, (item) => [
    <span key={`${item.media_no}-file`} className="admin-media-list-file">
      <MediaThumb item={item} />
      <EntityTitle title={item.original_name ?? mediaTypeLabel(item.media_type)} meta={`${formatBytes(item.size_bytes)} · ${formatDateTime(item.created_at)}`} />
    </span>,
    <MediaReviewCell key={`${item.media_no}-review`} item={item} />,
    item.child_name ?? item.child_no ?? '未关联孩子',
    <CompactText key={`${item.media_no}-uploader`} value={item.uploader_name ?? item.uploader_user_no} maxWidth={150} />,
    <Badge key={`${item.media_no}-type`} tone="info">{mediaTypeLabel(item.media_type)}</Badge>,
    <ActionGroup key={`${item.media_no}-actions`}>
      <ActionButton icon={<Eye size={15} />} onClick={() => void detail.openDetail('媒体详情', item.media_no, () => adminApi.getMediaDetail(item.media_no))}>详情</ActionButton>
      <ActionButton icon={<CheckCircle2 size={15} />} onClick={() => updateStatus(item, 'ready')} disabled={updatingMediaNo === item.media_no} tone="success">通过</ActionButton>
      <ActionButton icon={<AlertTriangle size={15} />} onClick={() => updateStatus(item, 'failed')} disabled={updatingMediaNo === item.media_no} tone="warning">标记异常</ActionButton>
      <ActionButton icon={<ArchiveX size={15} />} onClick={() => updateStatus(item, 'removed')} disabled={updatingMediaNo === item.media_no} tone="danger">下架</ActionButton>
    </ActionGroup>,
  ], (item) => item.media_no);

  return (
    <PageShell title="媒体库">
      <Panel>
        <form className="admin-audit-filter-form admin-form-stack" onSubmit={(event) => void load(1, pageSize, event)}>
          <div className="admin-audit-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) repeat(2, minmax(160px, 0.45fr))', gap: '10px' }}>
            <input style={inputStyle} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="编号 / 文件 / 孩子 / 记录" />
            <AdminSelect value={mediaType} onChange={(event) => setMediaType(event.target.value)}>
              <option value="">全部类型</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
              <option value="audio">音频</option>
            </AdminSelect>
            <AdminSelect value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="uploading">处理中</option>
              <option value="ready">可用</option>
              <option value="failed">异常</option>
              <option value="removed">已下架</option>
            </AdminSelect>
          </div>
          {advancedFiltersOpen ? (
            <div className="admin-audit-filter-grid admin-advanced-filter-grid">
              <AdminSelect value={linked} onChange={(event) => setLinked(event.target.value)}>
                <option value="">全部关联</option>
                <option value="linked">已关联记录</option>
                <option value="unlinked">未关联记录</option>
              </AdminSelect>
              <input style={inputStyle} value={childNo} onChange={(event) => setChildNo(event.target.value)} placeholder="孩子编号" />
              <input style={inputStyle} value={familyNo} onChange={(event) => setFamilyNo(event.target.value)} placeholder="家庭编号" />
              <input style={inputStyle} value={uploaderUserNo} onChange={(event) => setUploaderUserNo(event.target.value)} placeholder="上传者编号" />
              <AdminDateInput type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} aria-label="开始时间" placeholder="开始时间" />
              <AdminDateInput type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} aria-label="结束时间" placeholder="结束时间" />
            </div>
          ) : null}
          <div className="admin-audit-filter-actions admin-row-actions-wrap" >
            <AdminButton type="submit" tone="primary" disabled={loading}>
              {loading ? '查询中…' : '查询'}
            </AdminButton>
            <AdminButton type="button" tone="ghost" disabled={loading} onClick={() => void clearFilters()}>
              清空
            </AdminButton>
            <AdminButton type="button" tone="ghost" disabled={loading} onClick={() => setAdvancedFiltersOpen((current) => !current)}>
              <SlidersHorizontal size={15} />
              {advancedFiltersOpen ? '收起筛选' : '高级筛选'}
            </AdminButton>
          </div>
        </form>
      </Panel>
      <Panel className="admin-media-compact-summary">
        <SummaryStat label="总数" value={result?.total ?? 0} />
        <SummaryStat label="可用" value={readyMedia} tone="success" />
        <SummaryStat label="待处理" value={needsReviewMedia} tone={needsReviewMedia > 0 ? 'warning' : 'neutral'} />
      </Panel>
      <ActionFeedback error={actionError} />
      {error ? <Panel><EmptyState message={`加载失败：${error}`} /></Panel> : null}
      <TableShell className="admin-media-table" columns={['媒体', '状态', '孩子', '上传者', '类型', '操作']} rows={rows} emptyMessage="暂无媒体" loading={loading} />
      {result ? <PaginationPanel page={result.page} pageSize={result.page_size} total={result.total} hasMore={result.has_more} loading={loading} onPrevPage={() => load(page - 1, pageSize)} onNextPage={() => load(page + 1, pageSize)} onPageSizeChange={(nextPageSize) => load(1, nextPageSize)} onJumpToPage={(nextPage) => load(nextPage, pageSize)} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail} onRetry={detail.retryDetail}>
        {detail.state.data ? <MediaDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
      {reasonDialog}
    </PageShell>
  );
};

export const AIJobsPage = () => {
  const state = useAdminListPage<AdminAiJobItem>(adminApi.listAiJobs);
  const detail = useDetailState<AdminAiJobDetail>();
  const { requestOperationReason, reasonDialog } = useOperationReasonDialog();
  const [updatingJobNo, setUpdatingJobNo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const retryJob = async (job: AdminAiJobItem) => {
    const reason = await requestOperationReason('重试 AI 任务');
    if (!reason) return;

    setActionError(null);
    setUpdatingJobNo(job.job_no);
    try {
      const updated = await adminApi.retryAiJob(job.job_no, { reason });
      state.updateResult((current) =>
        current
          ? {
              ...current,
              list: current.list.map((item) => (item.job_no === updated.job_no ? { ...item, status: updated.status, error_message: null } : item)),
            }
          : current,
      );
      detail.updateDetail((current) => (current.job_no === updated.job_no ? { ...current, status: updated.status, error_message: null, retry_count: updated.retry_count ?? current.retry_count } : current));
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingJobNo(null);
    }
  };

  const cancelJob = async (job: AdminAiJobItem) => {
    const reason = await requestOperationReason('取消 AI 任务');
    if (!reason) return;

    setActionError(null);
    setUpdatingJobNo(job.job_no);
    try {
      const updated = await adminApi.cancelAiJob(job.job_no, { reason });
      state.updateResult((current) =>
        current
          ? {
              ...current,
              list: current.list.map((item) => (item.job_no === updated.job_no ? { ...item, status: updated.status } : item)),
            }
          : current,
      );
      detail.updateDetail((current) => (current.job_no === updated.job_no ? { ...current, status: updated.status } : current));
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingJobNo(null);
    }
  };

  const currentJobs = state.result?.list ?? [];
  const activeJobs = currentJobs.filter((item) => ['pending', 'processing'].includes(item.status)).length;
  const failedJobs = currentJobs.filter((item) => item.status === 'failed').length;
  const rows = formatListRows(currentJobs, (item) => [
    item.job_no,
    item.record_no,
    item.requester_user_no,
    aiJobTypeLabel(item.job_type),
    <Badge key={item.job_no} tone={badgeToneForStatus(item.status)}>{aiJobStatusLabel(item.status)}</Badge>,
    item.error_message,
    formatDateTime(item.created_at),
    <ActionGroup key={`${item.job_no}-actions`}>
      <ActionButton icon={<Eye size={15} />} onClick={() => void detail.openDetail('AI 任务详情', item.job_no, () => adminApi.getAiJobDetail(item.job_no))}>详情</ActionButton>
      <ActionButton icon={<RotateCcw size={15} />} onClick={() => void retryJob(item)} disabled={updatingJobNo === item.job_no || !['failed', 'cancelled'].includes(item.status)} tone="success">重试</ActionButton>
      <ActionButton icon={<Ban size={15} />} onClick={() => void cancelJob(item)} disabled={updatingJobNo === item.job_no || !['pending', 'processing'].includes(item.status)} tone="danger">取消</ActionButton>
    </ActionGroup>,
  ], (item) => item.job_no);

  return (
    <PageShell title="AI 任务列表" description="查看 AI 任务状态和失败原因。">
      <SearchPanel {...state} />
      <ListSummary label="AI 任务概览" description="默认展示任务队列，优先处理失败、卡住和待重试的链路。">
        <SummaryStat label="当前页处理中/待处理" value={activeJobs} tone={activeJobs > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="当前页失败" value={failedJobs} tone={failedJobs > 0 ? 'danger' : 'success'} />
      </ListSummary>
      <ActionFeedback error={actionError} />
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell columns={['任务编号', '记录编号', '请求人', '任务类型', '状态', '错误信息', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配 AI 任务。可清空筛选，或从总览进入失败、待处理队列。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} onPageSizeChange={state.onPageSizeChange} onJumpToPage={state.onJumpToPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail} onRetry={detail.retryDetail}>
        {detail.state.data ? <AiJobDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
      {reasonDialog}
    </PageShell>
  );
};

export const NotificationsPage = () => {
  const detail = useDetailState<AdminNotificationItem>();
  const [keyword, setKeyword] = useState('');
  const [readState, setReadState] = useState('');
  const [notificationType, setNotificationType] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ list: AdminNotificationItem[]; page: number; page_size: number; total: number; has_more: boolean } | null>(null);
  const autoLoadedRef = useRef(false);
  const requestVersionRef = useRef(0);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize, event?: FormEvent, override?: NotificationFilterOverride) => {
    event?.preventDefault();
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError(null);
    try {
      const activeKeyword = (override?.keyword ?? keyword).trim();
      const activeReadState = override?.readState ?? readState;
      const activeNotificationType = override?.notificationType ?? notificationType;
      const activeDeliveryStatus = override?.deliveryStatus ?? deliveryStatus;
      const activeStartTime = override?.startTime ?? startTime;
      const activeEndTime = override?.endTime ?? endTime;
      const next = await adminApi.listNotifications({
        keyword: activeKeyword || undefined,
        read_state: activeReadState || undefined,
        notification_type: activeNotificationType || undefined,
        delivery_status: activeDeliveryStatus || undefined,
        start_time: toIsoDateTime(activeStartTime),
        end_time: toIsoDateTime(activeEndTime),
        page: nextPage,
        page_size: nextPageSize,
      });
      if (requestVersionRef.current !== requestVersion) return;
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      if (requestVersionRef.current !== requestVersion) return;
      setError(getErrorMessage(err));
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [deliveryStatus, endTime, keyword, notificationType, page, pageSize, readState, startTime]);

  const clearFilters = async () => {
    setKeyword('');
    setReadState('');
    setNotificationType('');
    setDeliveryStatus('');
    setStartTime('');
    setEndTime('');
    await load(1, pageSize, undefined, { keyword: '', readState: '', notificationType: '', deliveryStatus: '', startTime: '', endTime: '' });
  };

  useEffect(() => {
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    const timer = window.setTimeout(() => {
      void load(1, pageSize);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, pageSize]);

  const currentNotifications = result?.list ?? [];
  const unreadCount = currentNotifications.filter((item) => !item.read_at).length;
  const failedDeliveryCount = currentNotifications.filter((item) => (item.delivery_status_counts.failed ?? 0) > 0).length;
  const queuedDeliveryCount = currentNotifications.filter((item) => (item.delivery_status_counts.queued ?? 0) > 0).length;
  const rows = formatListRows(currentNotifications, (item) => [
    <EntityTitle key={`${item.notification_no}-content`} title={item.title} meta={`${notificationTypeLabel(item.notification_type)} · ${item.notification_no}`} />,
    <EntityTitle key={`${item.notification_no}-user`} title={item.user_name} meta={item.user_mobile ?? item.user_no} />,
    <EntityTitle key={`${item.notification_no}-family`} title={item.family_name ?? '未命名家庭'} meta={item.family_no} />,
    <Badge key={`${item.notification_no}-read`} tone={item.read_at ? 'success' : 'warning'}>{notificationReadStateLabel(item.read_at ? 'read' : 'unread')}</Badge>,
    <NotificationDeliveryBadges key={`${item.notification_no}-delivery`} item={item} />,
    <CompactText key={`${item.notification_no}-target`} value={item.target_no ? `${item.target_type ?? 'target'}:${item.target_no}` : null} maxWidth={160} />,
    formatDateTime(item.created_at),
    <ActionButton key={`${item.notification_no}-detail`} icon={<Eye size={15} />} onClick={() => void detail.openDetail('通知详情', item.notification_no, () => adminApi.getNotificationDetail(item.notification_no))}>详情</ActionButton>,
  ], (item) => item.notification_no);

  return (
    <PageShell title="通知管理" description="查看站内消息和手机通知投递状态，定位家庭成员收不到通知、推送失败和未读积压问题。">
      <Panel>
        <form className="admin-audit-filter-form admin-form-stack" onSubmit={(event) => void load(1, pageSize, event)}>
          <div className="admin-audit-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(180px, 0.45fr)', gap: '10px' }}>
            <input style={inputStyle} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="用户 / 家庭 / 通知 / 目标" />
            <AdminSelect value={readState} onChange={(event) => setReadState(event.target.value)}>
              <option value="">全部已读状态</option>
              <option value="unread">未读</option>
              <option value="read">已读</option>
            </AdminSelect>
          </div>
          {advancedFiltersOpen ? (
            <div className="admin-audit-filter-grid admin-advanced-filter-grid">
              <AdminSelect value={notificationType} onChange={(event) => setNotificationType(event.target.value)}>
                <option value="">全部通知类型</option>
                {notificationTypeValues.map((value) => (
                  <option key={value} value={value}>
                    {notificationTypeLabel(value)}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect value={deliveryStatus} onChange={(event) => setDeliveryStatus(event.target.value)}>
                <option value="">全部投递状态</option>
                <option value="queued">待投递</option>
                <option value="sent">已投递</option>
                <option value="failed">投递失败</option>
                <option value="skipped">已跳过</option>
              </AdminSelect>
              <AdminDateInput type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} aria-label="开始时间" placeholder="开始时间" />
              <AdminDateInput type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} aria-label="结束时间" placeholder="结束时间" />
            </div>
          ) : null}
          <div className="admin-audit-filter-actions admin-row-actions-wrap" >
            <AdminButton type="submit" tone="primary" disabled={loading}>
              {loading ? '查询中…' : '查询'}
            </AdminButton>
            <AdminButton type="button" tone="ghost" disabled={loading} onClick={() => void clearFilters()}>
              清空
            </AdminButton>
            <AdminButton type="button" tone="ghost" disabled={loading} onClick={() => setAdvancedFiltersOpen((current) => !current)}>
              <SlidersHorizontal size={15} />
              {advancedFiltersOpen ? '收起筛选' : '高级筛选'}
            </AdminButton>
          </div>
        </form>
      </Panel>
      <ListSummary label="通知状态概览" description="默认展示最近通知，优先关注未读积压、待投递和投递异常；投递失败不作为普通用户提示文案直接铺在列表中。">
        <SummaryStat label="当前页未读" value={unreadCount} tone={unreadCount > 0 ? 'warning' : 'success'} />
        <SummaryStat label="当前页待投递" value={queuedDeliveryCount} tone={queuedDeliveryCount > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="当前页投递失败" value={failedDeliveryCount} tone={failedDeliveryCount > 0 ? 'danger' : 'success'} />
      </ListSummary>
      {error ? <Panel><EmptyState message="通知数据暂时不可用，请稍后重试或查看系统运维日志。" /></Panel> : null}
      <TableShell columns={['通知', '接收人', '家庭', '已读', '投递', '目标', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配通知。可清空筛选，或等待用户发布记录后生成家庭通知。" loading={loading} />
      {result ? <PaginationPanel page={result.page} pageSize={result.page_size} total={result.total} hasMore={result.has_more} loading={loading} onPrevPage={async () => { if (!loading && page > 1) await load(page - 1, pageSize); }} onNextPage={async () => { if (!loading && result.has_more) await load(page + 1, pageSize); }} onPageSizeChange={async (nextPageSize) => { if (!loading) await load(1, nextPageSize); }} onJumpToPage={async (nextPage) => { if (!loading) await load(nextPage, pageSize); }} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail} onRetry={detail.retryDetail}>
        {detail.state.data ? <NotificationDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
    </PageShell>
  );
};

export const SupportTicketsPage = () => {
  const detail = useDetailState<AdminSupportTicketItem>();
  const { admin } = useAdminAuth();
  const { requestOperationReason, reasonDialog } = useOperationReasonDialog();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingTicketNo, setUpdatingTicketNo] = useState<string | null>(null);
  const [result, setResult] = useState<{ list: AdminSupportTicketItem[]; page: number; page_size: number; total: number; has_more: boolean } | null>(null);
  const autoLoadedRef = useRef(false);
  const requestVersionRef = useRef(0);

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize, event?: FormEvent, override?: SupportTicketFilterOverride) => {
    event?.preventDefault();
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError(null);
    try {
      const activeKeyword = (override?.keyword ?? keyword).trim();
      const activeCategory = (override?.category ?? category).trim();
      const activeStatus = override?.status ?? status;
      const activePriority = override?.priority ?? priority;
      const next = await adminApi.listSupportTickets({
        keyword: activeKeyword || undefined,
        category: activeCategory || undefined,
        status: activeStatus || undefined,
        priority: activePriority || undefined,
        page: nextPage,
        page_size: nextPageSize,
      });
      if (requestVersionRef.current !== requestVersion) return;
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      if (requestVersionRef.current !== requestVersion) return;
      setError(getErrorMessage(err));
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [category, keyword, page, pageSize, priority, status]);

  const clearFilters = async () => {
    setKeyword('');
    setCategory('');
    setStatus('');
    setPriority('');
    await load(1, pageSize, undefined, { keyword: '', category: '', status: '', priority: '' });
  };

  useEffect(() => {
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    const timer = window.setTimeout(() => {
      void load(1, pageSize);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, pageSize]);

  const updateStatus = async (item: AdminSupportTicketItem, nextStatus: 'processing' | 'resolved' | 'closed') => {
    const actionName = nextStatus === 'processing' ? '受理客服反馈' : nextStatus === 'resolved' ? '解决客服反馈' : '关闭客服反馈';
    const reason = await requestOperationReason(actionName);
    if (!reason) return;

    setActionError(null);
    setUpdatingTicketNo(item.ticket_no);
    try {
      const updated = await adminApi.updateSupportTicketStatus(item.ticket_no, { status: nextStatus, note: reason });
      setResult((current) =>
        current
          ? {
              ...current,
              list: current.list.map((currentItem) => (currentItem.ticket_no === updated.ticket_no ? updated : currentItem)),
            }
          : current,
      );
      if (detail.state.data?.ticket_no === updated.ticket_no) {
        detail.updateDetail(() => updated);
      }
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingTicketNo(null);
    }
  };

  const currentTickets = result?.list ?? [];
  const submittedCount = currentTickets.filter((item) => item.status === 'submitted').length;
  const processingCount = currentTickets.filter((item) => item.status === 'processing').length;
  const childSafetyCount = currentTickets.filter((item) => item.priority === 'child_safety').length;
  const canUpdateStatus = admin?.role === 'super_admin' || admin?.role === 'operator';
  const rows = formatListRows(currentTickets, (item) => [
    <EntityTitle key={`${item.ticket_no}-title`} title={item.ticket_no} meta={item.category} />,
    <EntityTitle key={`${item.ticket_no}-user`} title={item.user_name} meta={item.user_mobile ?? item.user_no} />,
    <CompactText key={`${item.ticket_no}-content`} value={item.content} maxWidth={260} />,
    <Badge key={`${item.ticket_no}-priority`} tone={badgeToneForStatus(item.priority)}>{supportTicketPriorityLabel(item.priority)}</Badge>,
    <Badge key={`${item.ticket_no}-status`} tone={badgeToneForStatus(item.status)}>{supportTicketStatusLabel(item.status)}</Badge>,
    formatDateTime(item.created_at),
    <ActionGroup key={`${item.ticket_no}-actions`}>
      <ActionButton icon={<Eye size={15} />} onClick={() => void detail.openDetail('客服反馈详情', item.ticket_no, () => adminApi.getSupportTicketDetail(item.ticket_no))}>详情</ActionButton>
      {canUpdateStatus && item.status === 'submitted' ? (
        <ActionButton tone="warning" icon={<ClipboardCheck size={15} />} disabled={updatingTicketNo === item.ticket_no} onClick={() => void updateStatus(item, 'processing')}>
          受理
        </ActionButton>
      ) : null}
      {canUpdateStatus && (item.status === 'submitted' || item.status === 'processing') ? (
        <ActionButton tone="success" icon={<CheckCircle2 size={15} />} disabled={updatingTicketNo === item.ticket_no} onClick={() => void updateStatus(item, 'resolved')}>
          解决
        </ActionButton>
      ) : null}
      {canUpdateStatus && item.status !== 'closed' ? (
        <ActionButton tone="danger" icon={<XCircle size={15} />} disabled={updatingTicketNo === item.ticket_no} onClick={() => void updateStatus(item, 'closed')}>
          关闭
        </ActionButton>
      ) : null}
    </ActionGroup>,
  ], (item) => item.ticket_no);

  return (
    <PageShell title="客服反馈" description="集中处理用户在帮助与反馈提交的问题、账号注销和儿童信息保护诉求，避免客服事项只散落在审计日志中。">
      <Panel>
        <form className="admin-audit-filter-form admin-form-stack" onSubmit={(event) => void load(1, pageSize, event)}>
          <div>
          <strong className="admin-filter-head-title">筛选条件</strong>
            <p style={mutedTextStyle}>支持按反馈编号、提交人、联系方式、问题内容、类型、优先级和处理状态筛选。</p>
          </div>
          <div className="admin-audit-filter-grid admin-filter-grid-auto" >
            <input style={inputStyle} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="编号 / 用户 / 内容" />
            <AdminSelect value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">全部类型</option>
              <option value="数据异常">数据异常</option>
              <option value="使用问题">使用问题</option>
            </AdminSelect>
            <AdminSelect value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="">全部优先级</option>
              <option value="child_safety">儿童安全</option>
              <option value="urgent">紧急</option>
              <option value="normal">普通</option>
            </AdminSelect>
            <AdminSelect value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="submitted">待处理</option>
              <option value="processing">处理中</option>
              <option value="resolved">已解决</option>
              <option value="closed">已关闭</option>
            </AdminSelect>
          </div>
          <div className="admin-audit-filter-actions admin-row-actions-wrap" >
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? '查询中…' : '查询'}
            </button>
            <button type="button" style={secondaryButtonStyle} disabled={loading} onClick={() => void clearFilters()}>
              清空
            </button>
          </div>
        </form>
      </Panel>
      <ListSummary label="客服反馈概览" description="儿童安全和待处理反馈优先进入值班视野；每次状态推进都会写入审计日志。">
        <SummaryStat label="当前页待处理" value={submittedCount} tone={submittedCount > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="当前页处理中" value={processingCount} tone={processingCount > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="当前页儿童安全" value={childSafetyCount} tone={childSafetyCount > 0 ? 'danger' : 'neutral'} />
      </ListSummary>
      <ActionFeedback error={actionError} />
      {error ? <Panel><EmptyState message={`加载失败：${error}`} /></Panel> : null}
      <TableShell columns={['反馈编号', '提交人', '反馈内容', '优先级', '状态', '提交时间', '操作']} rows={rows} emptyMessage="暂无客服反馈。用户可在 App 的帮助与反馈页提交问题。" loading={loading} />
      {result ? <PaginationPanel page={result.page} pageSize={result.page_size} total={result.total} hasMore={result.has_more} loading={loading} onPrevPage={async () => { if (!loading && page > 1) await load(page - 1, pageSize); }} onNextPage={async () => { if (!loading && result.has_more) await load(page + 1, pageSize); }} onPageSizeChange={async (nextPageSize) => { if (!loading) await load(1, nextPageSize); }} onJumpToPage={async (nextPage) => { if (!loading) await load(nextPage, pageSize); }} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail} onRetry={detail.retryDetail}>
        {detail.state.data ? <SupportTicketDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
      {reasonDialog}
    </PageShell>
  );
};

export const ArchiveExportRequestsPage = () => {
  const detail = useDetailState<AdminArchiveExportRequestItem>();
  const { admin } = useAdminAuth();
  const { requestOperationReason, reasonDialog } = useOperationReasonDialog();
  const { requestArchiveCompletion, completionDialog } = useArchiveCompletionDialog();
  const [keyword, setKeyword] = useState('');
  const [purpose, setPurpose] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingRequestNo, setUpdatingRequestNo] = useState<string | null>(null);
  const [result, setResult] = useState<{ list: AdminArchiveExportRequestItem[]; page: number; page_size: number; total: number; has_more: boolean } | null>(null);
  const autoLoadedRef = useRef(false);
  const requestVersionRef = useRef(0);

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize, event?: FormEvent, override?: ArchiveExportRequestFilterOverride) => {
    event?.preventDefault();
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError(null);
    try {
      const activeKeyword = (override?.keyword ?? keyword).trim();
      const activePurpose = override?.purpose ?? purpose;
      const activeStatus = override?.status ?? status;
      const next = await adminApi.listArchiveExportRequests({
        keyword: activeKeyword || undefined,
        purpose: activePurpose || undefined,
        status: activeStatus || undefined,
        page: nextPage,
        page_size: nextPageSize,
      });
      if (requestVersionRef.current !== requestVersion) return;
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      if (requestVersionRef.current !== requestVersion) return;
      setError(getErrorMessage(err));
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [keyword, page, pageSize, purpose, status]);

  const clearFilters = async () => {
    setKeyword('');
    setPurpose('');
    setStatus('');
    await load(1, pageSize, undefined, { keyword: '', purpose: '', status: '' });
  };

  useEffect(() => {
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    const timer = window.setTimeout(() => {
      void load(1, pageSize);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, pageSize]);

  const updateStatus = async (item: AdminArchiveExportRequestItem, nextStatus: 'processing' | 'completed' | 'rejected') => {
    const actionName = nextStatus === 'processing' ? '受理档案交付申请' : nextStatus === 'completed' ? '完成档案交付申请' : '驳回档案交付申请';
    const completion = nextStatus === 'completed' ? await requestArchiveCompletion(item.request_no) : null;
    const reason = nextStatus === 'completed' ? completion?.note ?? null : await requestOperationReason(actionName);
    if (!reason) return;

    setActionError(null);
    setUpdatingRequestNo(item.request_no);
    try {
      const updated = await adminApi.updateArchiveExportRequestStatus(item.request_no, {
        status: nextStatus,
        note: reason,
        ...(completion ?? {}),
      });
      setResult((current) =>
        current
          ? {
              ...current,
              list: current.list.map((currentItem) => (currentItem.request_no === updated.request_no ? updated : currentItem)),
            }
          : current,
      );
      if (detail.state.data?.request_no === updated.request_no) {
        detail.updateDetail(() => updated);
      }
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingRequestNo(null);
    }
  };

  const currentRequests = result?.list ?? [];
  const submittedCount = currentRequests.filter((item) => item.status === 'submitted').length;
  const processingCount = currentRequests.filter((item) => item.status === 'processing').length;
  const handoffCount = currentRequests.filter((item) => item.purpose === 'adult_handoff').length;
  const canUpdateStatus = admin?.role === 'super_admin' || admin?.role === 'operator';
  const rows = formatListRows(currentRequests, (item) => [
    <EntityTitle key={`${item.request_no}-title`} title={item.request_no} meta={archiveExportPurposeLabel(item.purpose)} />,
    <EntityTitle key={`${item.request_no}-child`} title={item.child_name} meta={item.child_no} />,
    <EntityTitle key={`${item.request_no}-user`} title={item.user_name} meta={item.user_mobile ?? item.user_no} />,
        <span key={`${item.request_no}-snapshot`} style={{ display: 'grid', gap: '4px', color: '#5d4d35', fontSize: '12px', fontWeight: 700 }}>
      <span>{archiveExportTypeLabel(item.export_type)}</span>
      <span>{item.record_count} 条记录 · {item.media_count} 个媒体 · {item.milestone_count} 个里程碑</span>
    </span>,
    <Badge key={`${item.request_no}-status`} tone={badgeToneForStatus(item.status)}>{archiveExportStatusLabel(item.status)}</Badge>,
    formatDateTime(item.created_at),
    <ActionGroup key={`${item.request_no}-actions`}>
      <ActionButton icon={<Eye size={15} />} onClick={() => void detail.openDetail('档案交付申请详情', item.request_no, () => adminApi.getArchiveExportRequestDetail(item.request_no))}>详情</ActionButton>
      {canUpdateStatus && item.status === 'submitted' ? (
        <ActionButton tone="warning" icon={<ClipboardCheck size={15} />} disabled={updatingRequestNo === item.request_no} onClick={() => void updateStatus(item, 'processing')}>
          受理
        </ActionButton>
      ) : null}
      {canUpdateStatus && (item.status === 'submitted' || item.status === 'processing') ? (
        <>
          <ActionButton tone="success" icon={<CheckCircle2 size={15} />} disabled={updatingRequestNo === item.request_no} onClick={() => void updateStatus(item, 'completed')}>
            完成
          </ActionButton>
          <ActionButton tone="danger" icon={<XCircle size={15} />} disabled={updatingRequestNo === item.request_no} onClick={() => void updateStatus(item, 'rejected')}>
            驳回
          </ActionButton>
        </>
      ) : null}
    </ActionGroup>,
  ], (item) => item.request_no);

  return (
    <PageShell title="档案交付申请" description="集中处理用户发起的云端档案打包和成年移交准备，避免长期资产交付只停留在审计日志里。">
      <Panel>
        <form className="admin-audit-filter-form admin-form-stack" onSubmit={(event) => void load(1, pageSize, event)}>
          <div>
          <strong className="admin-filter-head-title">筛选条件</strong>
            <p style={mutedTextStyle}>支持按申请编号、孩子、家庭、申请人、联系方式、申请类型和处理状态筛选。</p>
          </div>
          <div className="admin-audit-filter-grid admin-filter-grid-auto" >
            <input style={inputStyle} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="申请编号 / 孩子 / 申请人" />
            <AdminSelect value={purpose} onChange={(event) => setPurpose(event.target.value)}>
              <option value="">全部类型</option>
              <option value="backup">档案打包</option>
              <option value="adult_handoff">成年移交</option>
            </AdminSelect>
            <AdminSelect value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="submitted">待处理</option>
              <option value="processing">处理中</option>
              <option value="completed">已完成</option>
              <option value="rejected">已驳回</option>
            </AdminSelect>
          </div>
          <div className="admin-audit-filter-actions admin-row-actions-wrap" >
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? '查询中…' : '查询'}
            </button>
            <button type="button" style={secondaryButtonStyle} disabled={loading} onClick={() => void clearFilters()}>
              清空
            </button>
          </div>
        </form>
      </Panel>
      <ListSummary label="交付申请概览" description="优先处理成年移交和待处理申请；每次状态推进都会写入审计，方便复盘责任链。">
        <SummaryStat label="当前页待处理" value={submittedCount} tone={submittedCount > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="当前页处理中" value={processingCount} tone={processingCount > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="当前页成年移交" value={handoffCount} tone={handoffCount > 0 ? 'danger' : 'neutral'} />
      </ListSummary>
      <ActionFeedback error={actionError} />
      {error ? <Panel><EmptyState message={`加载失败：${error}`} /></Panel> : null}
      <TableShell columns={['申请编号', '孩子档案', '申请人', '资产快照', '状态', '提交时间', '操作']} rows={rows} emptyMessage="暂无档案交付申请。可清空筛选，或提醒用户在导出与备份页提交云端打包申请。" loading={loading} />
      {result ? <PaginationPanel page={result.page} pageSize={result.page_size} total={result.total} hasMore={result.has_more} loading={loading} onPrevPage={async () => { if (!loading && page > 1) await load(page - 1, pageSize); }} onNextPage={async () => { if (!loading && result.has_more) await load(page + 1, pageSize); }} onPageSizeChange={async (nextPageSize) => { if (!loading) await load(1, nextPageSize); }} onJumpToPage={async (nextPage) => { if (!loading) await load(nextPage, pageSize); }} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail} onRetry={detail.retryDetail}>
        {detail.state.data ? <ArchiveExportRequestDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
      {reasonDialog}
      {completionDialog}
    </PageShell>
  );
};

export const AuditLogsPage = () => {
  const detail = useDetailState<AdminAuditLogItem>();
  const [keyword, setKeyword] = useState('');
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [actorId, setActorId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ list: AdminAuditLogItem[]; page: number; page_size: number; total: number; has_more: boolean } | null>(null);
  const autoLoadedRef = useRef(false);
  const requestVersionRef = useRef(0);

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize, event?: FormEvent, override?: AuditFilterOverride) => {
    event?.preventDefault();
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError(null);
    try {
      const activeKeyword = (override?.keyword ?? keyword).trim();
      const activeAction = override?.action ?? action;
      const activeTargetType = override?.targetType ?? targetType;
      const activeActorId = (override?.actorId ?? actorId).trim();
      const activeStartTime = override?.startTime ?? startTime;
      const activeEndTime = override?.endTime ?? endTime;
      const next = await adminApi.listAuditLogs({
        keyword: activeKeyword || undefined,
        action: activeAction || undefined,
        target_type: activeTargetType || undefined,
        actor_id: activeActorId || undefined,
        start_time: toIsoDateTime(activeStartTime),
        end_time: toIsoDateTime(activeEndTime),
        page: nextPage,
        page_size: nextPageSize,
      });
      if (requestVersionRef.current !== requestVersion) return;
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      if (requestVersionRef.current !== requestVersion) return;
      setError(getErrorMessage(err));
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [action, actorId, endTime, keyword, page, pageSize, startTime, targetType]);

  const clearFilters = async () => {
    setKeyword('');
    setAction('');
    setTargetType('');
    setActorId('');
    setStartTime('');
    setEndTime('');
    await load(1, pageSize, undefined, { keyword: '', action: '', targetType: '', actorId: '', startTime: '', endTime: '' });
  };

  useEffect(() => {
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    const timer = window.setTimeout(() => {
      void load(1, pageSize);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, pageSize]);

  const currentLogs = result?.list ?? [];
  const recentLoginLogs = currentLogs.filter((item) => item.action === 'admin_login').length;
  const rows = formatListRows(currentLogs, (item) => [
    auditActionLabel(item.action),
    auditTargetTypeLabel(item.target_type),
    item.target_id,
    `${auditActorTypeLabel(item.actor_type)} #${item.actor_id}`,
    formatDateTime(item.created_at),
    <ActionButton key={`${item.actor_id}-${item.created_at}-${item.action}`} icon={<Eye size={15} />} onClick={() => void detail.openDetail('审计日志详情', item.action, async () => item)}>详情</ActionButton>,
  ], (item) => `${item.actor_id}-${item.created_at}-${item.action}-${item.target_id ?? ''}`);

  return (
    <PageShell title="审计日志" description="查看后台关键行为和访问记录。仅超级管理员可见。">
      <Panel>
        <form className="admin-audit-filter-form admin-form-stack" onSubmit={(event) => void load(1, pageSize, event)}>
          <div>
            <strong className="admin-filter-head-title">筛选条件</strong>
            <p style={mutedTextStyle}>支持按关键字、动作、目标类型和发生时间筛选。</p>
          </div>
          <div className="admin-audit-filter-grid admin-filter-grid-auto" >
            <input style={inputStyle} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="关键字" />
            <AdminSelect value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">全部动作</option>
              {auditActionValues.map((value) => (
                <option key={value} value={value}>
                  {auditActionLabel(value)}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect value={targetType} onChange={(event) => setTargetType(event.target.value)}>
              <option value="">全部目标类型</option>
              {auditTargetTypeValues.map((value) => (
                <option key={value} value={value}>
                  {auditTargetTypeLabel(value)}
                </option>
              ))}
            </AdminSelect>
            <input style={inputStyle} value={actorId} onChange={(event) => setActorId(event.target.value)} placeholder="操作者编号（如 1）" />
            <AdminDateInput type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} aria-label="开始时间" placeholder="开始时间" />
            <AdminDateInput type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} aria-label="结束时间" placeholder="结束时间" />
          </div>
          <div className="admin-audit-filter-actions admin-row-actions-wrap" >
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? '查询中…' : '查询'}
            </button>
            <button
              type="button"
              style={secondaryButtonStyle}
              disabled={loading}
              onClick={() => void clearFilters()}
            >
              清空
            </button>
          </div>
        </form>
      </Panel>
      <ListSummary label="审计日志概览" description="进入页面即展示最近留痕，筛选只用于缩小范围，不再让页面默认空白。">
        <SummaryStat label="当前页留痕" value={currentLogs.length} />
        <SummaryStat label="后台登录" value={recentLoginLogs} tone={recentLoginLogs > 0 ? 'success' : 'neutral'} />
      </ListSummary>
      {error ? <Panel><EmptyState message={`加载失败：${error}`} /></Panel> : null}
      <TableShell columns={['动作', '目标类型', '目标编号', '操作者', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配审计日志。可缩短时间范围、清空动作筛选，或回到总览查看最近留痕。" loading={loading} />
      {result ? <PaginationPanel page={result.page} pageSize={result.page_size} total={result.total} hasMore={result.has_more} loading={loading} onPrevPage={async () => { if (!loading && page > 1) await load(page - 1, pageSize); }} onNextPage={async () => { if (!loading && result.has_more) await load(page + 1, pageSize); }} onPageSizeChange={async (nextPageSize) => { if (!loading) await load(1, nextPageSize); }} onJumpToPage={async (nextPage) => { if (!loading) await load(nextPage, pageSize); }} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail} onRetry={detail.retryDetail}>
        {detail.state.data ? <AuditLogDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
    </PageShell>
  );
};
