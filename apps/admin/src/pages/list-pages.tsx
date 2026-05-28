import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, ArchiveX, Ban, CheckCircle2, ClipboardCheck, Crown, Eye, LockKeyhole, RotateCcw, Snowflake, XCircle } from 'lucide-react';

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
  type AdminRecordDetail,
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
  auditActorTypeLabel,
  auditTargetTypeLabel,
  authTypeLabel,
  childStatusLabel,
  familyStatusLabel,
  familyRoleLabel,
  genderLabel,
  mediaStatusLabel,
  mediaTypeLabel,
  membershipTypeLabel,
  recordStatusLabel,
  recordTypeLabel,
  supportTicketPriorityLabel,
  supportTicketStatusLabel,
  userStatusLabel,
  visibilityScopeLabel,
} from '../shared/labels';
import { AdminSelect, Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { inputStyle, mutedTextStyle, primaryButtonStyle, secondaryButtonStyle, tableStyle, thTdStyle } from '../shared/uiStyles';
import { useAdminAuth } from '../shared/useAdminAuth';
import { DetailDrawer, DetailGrid, DetailList, DetailSection, JsonBlock, MediaPreview } from './detail-drawer';
import { formatListRows, useAdminListPage } from './list-page-state';
import { PaginationPanel, SearchPanel, TableShell } from './shared';

const badgeToneForStatus = (value: string) => {
  if (['active', 'normal', 'published', 'success', 'ready', 'completed', 'resolved'].includes(value)) return 'success' as const;
  if (['disabled', 'failed', 'cancelled', 'removed', 'rejected', 'child_safety', 'deleted'].includes(value)) return 'danger' as const;
  if (['draft', 'pending', 'processing', 'uploading', 'submitted'].includes(value)) return 'warning' as const;
  return 'neutral' as const;
};

const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : '操作失败，请稍后重试');

const formatBytes = (value: number | null | undefined) => {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

const auditActionFilterOptions = [
  'admin_login',
  'admin_view_dashboard',
  'admin_view_family_detail',
  'admin_view_user_detail',
  'admin_view_child_detail',
  'admin_view_record_detail',
  'admin_view_media_detail',
  'admin_view_ai_job_detail',
  'admin_list_users',
  'admin_list_families',
  'admin_list_registration_invites',
  'admin_create_registration_invite',
  'admin_revoke_registration_invite',
  'admin_list_children',
  'admin_list_records',
  'admin_list_media',
  'admin_list_ai_jobs',
  'admin_list_content_risks',
  'admin_list_support_tickets',
  'admin_list_archive_export_requests',
  'admin_list_system_configs',
  'admin_list_audit_logs',
  'admin_update_system_config',
  'admin_update_user_membership',
  'admin_disable_user',
  'admin_activate_user',
  'admin_reset_user_password',
  'admin_unpublish_record',
  'admin_restore_record',
  'admin_approve_media',
  'admin_reject_media',
  'admin_remove_media',
  'admin_retry_ai_job',
  'admin_cancel_ai_job',
  'admin_support_ticket_start_processing',
  'admin_support_ticket_resolve',
  'admin_support_ticket_close',
  'admin_archive_export_start_processing',
  'admin_archive_export_complete',
  'admin_archive_export_reject',
  'user.archive_export_requested',
  'user.adult_handoff_requested',
  'user.feedback_submitted',
];

const auditTargetTypeFilterOptions = ['list', 'admin_user', 'user', 'family', 'registration_invite', 'child', 'record', 'media', 'ai_job', 'content_risk', 'support_ticket', 'archive_export_request', 'system_config', 'audit_log'];

const toIsoDateTime = (value: string) => (value ? new Date(value).toISOString() : undefined);
const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—');
const formatDateOnly = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString('zh-CN') : '—');

const CompactText = ({ value, maxWidth = 220 }: { value: string | null | undefined; maxWidth?: number }) => (
  <span
    title={value ?? '—'}
    style={{
      display: 'block',
      maxWidth,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {value ?? '—'}
  </span>
);

const SummaryStat = ({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) => (
  <div className={`admin-list-summary-pill admin-list-summary-pill-${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const ListSummary = ({
  total,
  label,
  description = '列表按运营处置设计：先识别状态，再执行详情、恢复、冻结、下架等动作。',
  children,
}: {
  total?: number;
  label: string;
  description?: string;
  children?: ReactNode;
}) => (
  <Panel>
    <div className="admin-list-summary">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <div className="admin-list-summary-stat">
        <span>结果总数</span>
        <strong>{total ?? 0}</strong>
      </div>
      {children ? <div className="admin-list-summary-pills">{children}</div> : null}
    </div>
  </Panel>
);

const EntityTitle = ({ title, meta }: { title: ReactNode; meta?: ReactNode }) => (
  <span style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
    <strong style={{ color: '#16211f', fontSize: '14px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</strong>
    {meta ? <span style={{ color: '#66736f', fontSize: '12px', lineHeight: 1.4 }}>{meta}</span> : null}
  </span>
);

const MediaReviewCell = ({ item }: { item: AdminMediaItem }) => {
  const needsReview = item.status === 'uploading' || item.status === 'failed';
  const isOrphan = !item.record_no;
  const tone = needsReview || isOrphan ? 'warning' : 'success';

  return (
    <span style={{ display: 'grid', gap: '6px', minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Badge tone={tone}>{needsReview ? '优先处理' : isOrphan ? '待关联' : '可归档'}</Badge>
        <Badge tone={badgeToneForStatus(item.status)}>{mediaStatusLabel(item.status)}</Badge>
      </span>
      <span style={{ color: '#66736f', fontSize: '12px', lineHeight: 1.45 }}>
        {isOrphan ? '未关联成长记录，建议先确认是否为孤立上传。' : `关联：${item.record_title ?? '未命名记录'}`}
      </span>
    </span>
  );
};

const ActionButton = ({
  children,
  onClick,
  disabled,
  tone = 'secondary',
  icon,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
}) => (
  <button
    className={`admin-action-button admin-action-button-${tone}`}
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{ opacity: disabled ? 0.62 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
  >
    {icon}
    {children}
  </button>
);

const ActionGroup = ({ children }: { children: ReactNode }) => <div className="admin-action-group">{children}</div>;

type AuditFilterOverride = {
  keyword?: string;
  action?: string;
  targetType?: string;
  startTime?: string;
  endTime?: string;
};

type ArchiveExportRequestFilterOverride = {
  keyword?: string;
  purpose?: string;
  status?: string;
};

type SupportTicketFilterOverride = {
  keyword?: string;
  category?: string;
  status?: string;
  priority?: string;
};

const useOperationReasonDialog = () => {
  const resolverRef = useRef<((value: string | null) => void) | null>(null);
  const [dialog, setDialog] = useState<{ actionName: string; reason: string; error: string | null } | null>(null);

  const requestOperationReason = (actionName: string) =>
    new Promise<string | null>((resolve) => {
      resolverRef.current?.(null);
      resolverRef.current = resolve;
      setDialog({ actionName, reason: '', error: null });
    });

  const closeDialog = (value: string | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  };

  useEffect(() => () => resolverRef.current?.(null), []);

  const reasonDialog = dialog ? (
    <div className="admin-modal-overlay" role="presentation">
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-action-dialog-title">
        <div className="admin-modal-header">
          <div>
            <span>后台操作确认</span>
            <h2 id="admin-action-dialog-title">{dialog.actionName}</h2>
          </div>
          <button type="button" className="admin-modal-close" onClick={() => closeDialog(null)} aria-label="关闭确认弹窗">
            ×
          </button>
        </div>
        <label className="admin-modal-field">
          操作原因
          <textarea
            value={dialog.reason}
            onChange={(event) => setDialog((current) => (current ? { ...current, reason: event.target.value, error: null } : current))}
            placeholder="写清楚为什么要执行这次操作，方便审计复盘"
            autoFocus
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
              const normalized = dialog.reason.trim();
              if (!normalized) {
                setDialog((current) => (current ? { ...current, error: '请填写操作原因' } : current));
                return;
              }
              closeDialog(normalized);
            }}
          >
            确认执行
          </button>
        </div>
      </section>
    </div>
  ) : null;

  return { requestOperationReason, reasonDialog };
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
    <div className="admin-modal-overlay" role="presentation">
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-reset-password-title">
        <div className="admin-modal-header">
          <div>
            <span>账号安全操作</span>
            <h2 id="admin-reset-password-title">重置登录密码</h2>
            <p style={{ margin: '6px 0 0', color: '#66736f', fontSize: '13px', lineHeight: 1.5 }}>
              {dialog.user.nickname}（{dialog.user.mobile ?? dialog.user.user_no}）
            </p>
          </div>
          <button type="button" className="admin-modal-close" onClick={() => closeDialog(null)} aria-label="关闭重置密码弹窗">
            ×
          </button>
        </div>
        <label className="admin-modal-field">
          新密码
          <input
            type="password"
            value={dialog.newPassword}
            onChange={(event) => setDialog((current) => (current ? { ...current, newPassword: event.target.value, error: null } : current))}
            placeholder="8 到 72 位，交给用户下次登录使用"
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
              if (newPassword.length < 8 || newPassword.length > 72) {
                setDialog((current) => (current ? { ...current, error: '新密码长度必须为 8 到 72 位' } : current));
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
      </section>
    </div>
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
    <div className="admin-modal-overlay" role="presentation">
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-membership-title">
        <div className="admin-modal-header">
          <div>
            <span>套餐权益操作</span>
            <h2 id="admin-membership-title">调整用户套餐权益</h2>
            <p style={{ margin: '6px 0 0', color: '#66736f', fontSize: '13px', lineHeight: 1.5 }}>
              {dialog.user.nickname}（{dialog.user.mobile ?? dialog.user.user_no}）
            </p>
          </div>
          <button type="button" className="admin-modal-close" onClick={() => closeDialog(null)} aria-label="关闭套餐权益弹窗">
            ×
          </button>
        </div>
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
            <option value="ai_plus">AI 增强会员</option>
          </AdminSelect>
        </label>
        <label className="admin-modal-field">
          到期日期
          <input
            type="date"
            value={dialog.expireDate}
            disabled={dialog.membershipType === 'free'}
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
              if (!reason) {
                setDialog((current) => (current ? { ...current, error: '请填写操作原因' } : current));
                return;
              }
              closeDialog({
                membership_type: dialog.membershipType,
                membership_expire_at: dialog.membershipType === 'free' ? null : `${dialog.expireDate}T23:59:59.000Z`,
                reason,
              });
            }}
          >
            确认调整
          </button>
        </div>
      </section>
    </div>
  ) : null;

  return { requestMembershipUpdate, membershipDialog };
};

const MiniTable = ({ columns, rows, emptyMessage }: { columns: string[]; rows: Array<Array<ReactNode>>; emptyMessage: string }) => {
  if (!rows.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="admin-table-scroll" style={{ overflowX: 'auto' }}>
      <table className="admin-responsive-table admin-mini-table" style={tableStyle}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} style={{ ...thTdStyle, color: '#66736f', fontSize: '13px', background: '#f6f8f7' }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} data-label={columns[cellIndex]} style={thTdStyle}>
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

  const closeDetail = () => {
    requestVersionRef.current += 1;
    setState((current) => ({ ...current, open: false, loading: false }));
  };

  const updateDetail = (updater: (current: T) => T) => {
    setState((current) => (current.data ? { ...current, data: updater(current.data) } : current));
  };

  return { state, openDetail, closeDetail, updateDetail };
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
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
      <DetailGrid
        items={[
          { label: '孩子编号', value: data.child_no },
          { label: '姓名', value: data.name },
          { label: '生日', value: formatDateOnly(data.birthday) },
          { label: '性别', value: genderLabel(data.gender) },
          { label: '出生地', value: data.birth_place },
          { label: '档案状态', value: <Badge tone={badgeToneForStatus(data.status)}>{childStatusLabel(data.status)}</Badge> },
          { label: '家庭编号', value: data.family_no },
          { label: '家庭名称', value: data.family_name },
          { label: '拥有者', value: `${data.owner_name}（${data.owner_user_no}）` },
          { label: '运营备注', value: data.remark },
        ]}
      />
    </DetailSection>
    <DetailSection title="家庭成员">
      <MiniTable
        columns={['用户编号', '昵称', '手机号', '角色', '状态', '加入时间']}
        rows={data.family_members.map((item) => [item.user_no, item.nickname, item.mobile, familyRoleLabel(item.role), userStatusLabel(item.status), formatDateTime(item.joined_at)])}
        emptyMessage="暂无家庭成员。"
      />
    </DetailSection>
    <DetailSection title="最近记录">
      <MiniTable
        columns={['记录编号', '标题', '类型', '状态', '发生时间']}
        rows={data.recent_records.map((item) => [item.record_no, item.title, recordTypeLabel(item.record_type), recordStatusLabel(item.status), formatDateTime(item.event_time)])}
        emptyMessage="暂无成长记录。"
      />
    </DetailSection>
  </>
);

const RecordDetailContent = ({ data }: { data: AdminRecordDetail }) => (
  <>
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
    <DetailSection title="媒体">
      <MiniTable
        columns={['媒体编号', '类型', '状态', '文件名', '大小', '预览']}
        rows={data.media_list.map((item) => [
          item.media_no,
          mediaTypeLabel(item.media_type),
          mediaStatusLabel(item.status),
          item.original_name,
          formatBytes(item.size_bytes),
          item.access_url ? <a href={item.access_url} target="_blank" rel="noreferrer">打开</a> : '—',
        ])}
        emptyMessage="暂无关联媒体。"
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

const MediaDetailContent = ({ data }: { data: AdminMediaDetail }) => (
  <>
    <DetailSection title="图片预览">
      <MediaPreview src={data.access_url} alt={data.original_name ?? data.media_no} />
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
  const rows = formatListRows(currentUsers, (item) => [
    <EntityTitle key={`${item.user_no}-profile`} title={item.nickname} meta={item.mobile} />,
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
  ]);

  return (
    <PageShell title="账号管理" description="按关键字查询用户账号，处理冻结、解冻、登录信息核查和密码重置。">
      <SearchPanel {...state} />
      <ListSummary total={state.result?.total} label="账号状态概览" description="默认展示用户列表，先看账号状态，再决定是否进入详情、冻结、解冻或重置登录密码。">
        <SummaryStat label="正常" value={activeUsers} tone="success" />
        <SummaryStat label="已冻结" value={disabledUsers} tone={disabledUsers > 0 ? 'danger' : 'neutral'} />
      </ListSummary>
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      {actionError ? <Panel><EmptyState message={`操作失败：${actionError}`} /></Panel> : null}
      {actionMessage ? <Panel><EmptyState title="操作完成" message={actionMessage} /></Panel> : null}
      <TableShell columns={['用户', '手机号', '会员', '状态', '最近登录', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配用户。可输入手机号、昵称或清空筛选后重新查询。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail}>
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
      <span style={{ color: '#66736f', fontSize: '12px' }}>{item.records_count} 条记录 / {item.media_count} 个媒体</span>
    </span>,
    item.archive_export_requests_count,
    <Badge key={`${item.family_no}-status`} tone={badgeToneForStatus(item.status)}>{familyStatusLabel(item.status)}</Badge>,
    formatDateTime(item.created_at),
    <ActionButton key={`${item.family_no}-detail`} icon={<Eye size={15} />} onClick={() => void detail.openDetail('家庭详情', item.family_no, () => adminApi.getFamilyDetail(item.family_no))}>详情</ActionButton>,
  ]);

  return (
    <PageShell title="家庭管理" description="按家庭维度查看成员、孩子档案、成长资产和档案交付申请，方便运营处理家庭协作与长期托管问题。">
      <SearchPanel {...state} description="输入家庭编号、家庭名称、拥有者昵称或手机号后查询。" placeholder="家庭编号 / 家庭名称 / 拥有者" />
      <ListSummary total={state.result?.total} label="家庭资产概览" description="家庭是孩子档案、成员协作、媒体资产和交付申请的归属中心；运营先按家庭定位，再进入详情核查成员和记录。">
        <SummaryStat label="当前页家庭" value={currentFamilies.length} />
        <SummaryStat label="状态正常" value={activeFamilies} tone="success" />
        <SummaryStat label="孩子档案" value={totalChildren} />
        <SummaryStat label="成长记录" value={totalRecords} />
      </ListSummary>
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell columns={['家庭', '拥有者', '资产规模', '交付申请', '状态', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配家庭。可按家庭编号、家庭名称或拥有者重新查询。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail}>
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
  const rows = formatListRows(currentChildren, (item) => [
    item.child_no,
    item.family_no,
    item.owner_user_no,
    item.name,
    formatDateOnly(item.birthday),
    genderLabel(item.gender),
    <Badge key={item.child_no} tone={badgeToneForStatus(item.status)}>{childStatusLabel(item.status)}</Badge>,
    <ActionButton key={`${item.child_no}-detail`} icon={<Eye size={15} />} onClick={() => void detail.openDetail('孩子档案详情', item.child_no, () => adminApi.getChildDetail(item.child_no))}>详情</ActionButton>,
  ]);

  return (
    <PageShell title="孩子列表" description="查询孩子档案、归属家庭与拥有者。">
      <SearchPanel {...state} />
      <ListSummary total={state.result?.total} label="孩子档案概览" description="默认展示档案归属和状态，发现异常时进入详情核查家庭关系。">
        <SummaryStat label="当前页档案" value={currentChildren.length} />
        <SummaryStat label="状态正常" value={activeChildren} tone="success" />
      </ListSummary>
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell columns={['孩子编号', '家庭编号', '拥有者', '姓名', '生日', '性别', '状态', '操作']} rows={rows} emptyMessage="暂无匹配孩子档案。可按孩子、家庭或拥有者重新查询。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail}>
        {detail.state.data ? <ChildDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
    </PageShell>
  );
};

export const RecordsPage = () => {
  const state = useAdminListPage<AdminRecordItem>(adminApi.listRecords);
  const detail = useDetailState<AdminRecordDetail>();
  const { requestOperationReason, reasonDialog } = useOperationReasonDialog();
  const [updatingRecordNo, setUpdatingRecordNo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const currentRecords = state.result?.list ?? [];
  const publishedRecords = currentRecords.filter((item) => item.status === 'published').length;
  const draftRecords = currentRecords.filter((item) => item.status === 'draft').length;
  const rows = formatListRows(currentRecords, (item) => [
    <EntityTitle key={`${item.record_no}-title`} title={item.title ?? '未命名记录'} meta={`创建者：${item.creator_name ?? item.creator_user_no}`} />,
    item.child_name ?? item.child_no,
    <Badge key={`${item.record_no}-type`} tone="info">{recordTypeLabel(item.record_type)}</Badge>,
    visibilityScopeLabel(item.visibility_scope),
    <Badge key={`${item.record_no}-status`} tone={badgeToneForStatus(item.status)}>{recordStatusLabel(item.status)}</Badge>,
    formatDateTime(item.created_at),
    <ActionGroup key={`${item.record_no}-actions`}>
      <ActionButton icon={<Eye size={15} />} onClick={() => void detail.openDetail('成长记录详情', item.record_no, () => adminApi.getRecordDetail(item.record_no))}>详情</ActionButton>
      <ActionButton icon={item.status === 'published' ? <ArchiveX size={15} /> : <RotateCcw size={15} />} onClick={() => void updateStatus(item)} disabled={updatingRecordNo === item.record_no} tone={item.status === 'published' ? 'danger' : 'success'}>
        {updatingRecordNo === item.record_no ? '处理中…' : item.status === 'published' ? '下架' : '恢复'}
      </ActionButton>
    </ActionGroup>,
  ]);

  return (
    <PageShell title="记录列表" description="用于排查记录状态、归属孩子和创建者。">
      <SearchPanel {...state} />
      <ListSummary total={state.result?.total} label="成长记录概览" description="默认展示最近记录，先看发布状态和可见范围，再处理详情、下架或恢复。">
        <SummaryStat label="已发布" value={publishedRecords} tone="success" />
        <SummaryStat label="草稿" value={draftRecords} tone={draftRecords > 0 ? 'warning' : 'neutral'} />
      </ListSummary>
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      {actionError ? <Panel><EmptyState message={`操作失败：${actionError}`} /></Panel> : null}
      <TableShell columns={['记录', '孩子', '类型', '可见范围', '状态', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配成长记录。可按标题、孩子或发布状态重新查询。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail}>
        {detail.state.data ? <RecordDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
      {reasonDialog}
    </PageShell>
  );
};

export const MediaPage = () => {
  const state = useAdminListPage<AdminMediaItem>(adminApi.listMedia);
  const detail = useDetailState<AdminMediaDetail>();
  const { requestOperationReason, reasonDialog } = useOperationReasonDialog();
  const [updatingMediaNo, setUpdatingMediaNo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const updateStatus = async (media: AdminMediaItem, status: 'ready' | 'failed' | 'removed') => {
    const actionName = status === 'ready' ? '通过媒体审核' : status === 'removed' ? '下架媒体' : '标记媒体异常';
    const reason = await requestOperationReason(actionName);
    if (!reason) return;

    setActionError(null);
    setUpdatingMediaNo(media.media_no);
    try {
      const updated = await adminApi.updateMediaStatus(media.media_no, { status, reason });
      state.updateResult((current) =>
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

  const currentMedia = state.result?.list ?? [];
  const readyMedia = currentMedia.filter((item) => item.status === 'ready').length;
  const needsReviewMedia = currentMedia.filter((item) => item.status === 'uploading' || item.status === 'failed' || !item.record_no).length;
  const rows = formatListRows(currentMedia, (item) => [
    <EntityTitle key={`${item.media_no}-file`} title={item.original_name ?? mediaTypeLabel(item.media_type)} meta={`${formatBytes(item.size_bytes)} · ${formatDateTime(item.created_at)}`} />,
    <MediaReviewCell key={`${item.media_no}-review`} item={item} />,
    item.child_name ?? item.child_no ?? '未关联孩子',
    <CompactText key={`${item.media_no}-uploader`} value={item.uploader_name ?? item.uploader_user_no} maxWidth={150} />,
    <Badge key={`${item.media_no}-type`} tone="info">{mediaTypeLabel(item.media_type)}</Badge>,
    <ActionGroup key={`${item.media_no}-actions`}>
      <ActionButton icon={<Eye size={15} />} onClick={() => void detail.openDetail('媒体详情', item.media_no, () => adminApi.getMediaDetail(item.media_no))}>详情</ActionButton>
      <ActionButton icon={<CheckCircle2 size={15} />} onClick={() => void updateStatus(item, 'ready')} disabled={updatingMediaNo === item.media_no} tone="success">通过</ActionButton>
      <ActionButton icon={<AlertTriangle size={15} />} onClick={() => void updateStatus(item, 'failed')} disabled={updatingMediaNo === item.media_no} tone="warning">异常</ActionButton>
      <ActionButton icon={<ArchiveX size={15} />} onClick={() => void updateStatus(item, 'removed')} disabled={updatingMediaNo === item.media_no} tone="danger">下架</ActionButton>
    </ActionGroup>,
  ]);

  return (
    <PageShell title="媒体列表" description="用于查看媒体上传记录、归属关系和类型。">
      <SearchPanel {...state} />
      <ListSummary total={state.result?.total} label="媒体库概览" description="默认展示媒体清单，优先识别异常、上传中和未关联素材。">
        <SummaryStat label="可用" value={readyMedia} tone="success" />
        <SummaryStat label="待处理" value={needsReviewMedia} tone={needsReviewMedia > 0 ? 'warning' : 'neutral'} />
      </ListSummary>
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      {actionError ? <Panel><EmptyState message={`操作失败：${actionError}`} /></Panel> : null}
      <TableShell columns={['媒体', '处理建议', '孩子', '上传者', '类型', '操作']} rows={rows} emptyMessage="暂无匹配媒体。可清空筛选，或优先查看上传中、异常、未关联媒体。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail}>
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
  ]);

  return (
    <PageShell title="AI 任务列表" description="查看 AI 任务状态和失败原因。">
      <SearchPanel {...state} />
      <ListSummary total={state.result?.total} label="AI 任务概览" description="默认展示任务队列，优先处理失败、卡住和待重试的链路。">
        <SummaryStat label="处理中/待处理" value={activeJobs} tone={activeJobs > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="失败" value={failedJobs} tone={failedJobs > 0 ? 'danger' : 'success'} />
      </ListSummary>
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      {actionError ? <Panel><EmptyState message={`操作失败：${actionError}`} /></Panel> : null}
      <TableShell columns={['任务编号', '记录编号', '请求人', '任务类型', '状态', '错误信息', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配 AI 任务。可清空筛选，或从总览进入失败、待处理队列。" loading={state.loading} />
      {state.result ? <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail}>
        {detail.state.data ? <AiJobDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
      {reasonDialog}
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

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize, event?: FormEvent, override?: SupportTicketFilterOverride) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const activeKeyword = override?.keyword ?? keyword;
      const activeCategory = override?.category ?? category;
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
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
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
      <ActionButton icon={<Eye size={15} />} onClick={() => void detail.openDetail('客服反馈详情', item.ticket_no, async () => item)}>详情</ActionButton>
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
  ]);

  return (
    <PageShell title="客服反馈" description="集中处理用户在帮助与反馈提交的问题、账号注销和儿童信息保护诉求，避免客服事项只散落在审计日志中。">
      <Panel>
        <form className="admin-audit-filter-form" onSubmit={(event) => void load(1, pageSize, event)} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <strong style={{ display: 'block', color: '#16211f', marginBottom: '4px' }}>筛选条件</strong>
            <p style={mutedTextStyle}>支持按反馈编号、提交人、联系方式、问题内容、类型、优先级和处理状态筛选。</p>
          </div>
          <div className="admin-audit-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <input style={inputStyle} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="编号 / 用户 / 内容" />
            <input style={inputStyle} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="问题类型" />
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
          <div className="admin-audit-filter-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? '查询中…' : '查询'}
            </button>
            <button type="button" style={secondaryButtonStyle} disabled={loading} onClick={() => void clearFilters()}>
              清空
            </button>
          </div>
        </form>
      </Panel>
      <ListSummary total={result?.total} label="客服反馈概览" description="儿童安全和待处理反馈优先进入值班视野；每次状态推进都会写入审计日志。">
        <SummaryStat label="待处理" value={submittedCount} tone={submittedCount > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="处理中" value={processingCount} tone={processingCount > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="儿童安全" value={childSafetyCount} tone={childSafetyCount > 0 ? 'danger' : 'neutral'} />
      </ListSummary>
      {actionError ? <Panel><EmptyState message={`操作失败：${actionError}`} /></Panel> : null}
      {error ? <Panel><EmptyState message={`加载失败：${error}`} /></Panel> : null}
      <TableShell columns={['反馈编号', '提交人', '反馈内容', '优先级', '状态', '提交时间', '操作']} rows={rows} emptyMessage="暂无客服反馈。用户可在 App 的帮助与反馈页提交问题。" loading={loading} />
      {result ? <PaginationPanel page={result.page} pageSize={result.page_size} total={result.total} hasMore={result.has_more} loading={loading} onPrevPage={async () => { if (!loading && page > 1) await load(page - 1, pageSize); }} onNextPage={async () => { if (!loading && result.has_more) await load(page + 1, pageSize); }} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail}>
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

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize, event?: FormEvent, override?: ArchiveExportRequestFilterOverride) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const activeKeyword = override?.keyword ?? keyword;
      const activePurpose = override?.purpose ?? purpose;
      const activeStatus = override?.status ?? status;
      const next = await adminApi.listArchiveExportRequests({
        keyword: activeKeyword || undefined,
        purpose: activePurpose || undefined,
        status: activeStatus || undefined,
        page: nextPage,
        page_size: nextPageSize,
      });
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
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
    const reason = await requestOperationReason(actionName);
    if (!reason) return;

    setActionError(null);
    setUpdatingRequestNo(item.request_no);
    try {
      const updated = await adminApi.updateArchiveExportRequestStatus(item.request_no, { status: nextStatus, note: reason });
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
    <span key={`${item.request_no}-snapshot`} style={{ display: 'grid', gap: '4px', color: '#4b5a56', fontSize: '12px', fontWeight: 700 }}>
      <span>{archiveExportTypeLabel(item.export_type)}</span>
      <span>{item.record_count} 条记录 · {item.media_count} 个媒体 · {item.milestone_count} 个里程碑</span>
    </span>,
    <Badge key={`${item.request_no}-status`} tone={badgeToneForStatus(item.status)}>{archiveExportStatusLabel(item.status)}</Badge>,
    formatDateTime(item.created_at),
    <ActionGroup key={`${item.request_no}-actions`}>
      <ActionButton icon={<Eye size={15} />} onClick={() => void detail.openDetail('档案交付申请详情', item.request_no, async () => item)}>详情</ActionButton>
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
  ]);

  return (
    <PageShell title="档案交付申请" description="集中处理用户发起的云端档案打包和成年移交准备，避免长期资产交付只停留在审计日志里。">
      <Panel>
        <form className="admin-audit-filter-form" onSubmit={(event) => void load(1, pageSize, event)} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <strong style={{ display: 'block', color: '#16211f', marginBottom: '4px' }}>筛选条件</strong>
            <p style={mutedTextStyle}>支持按申请编号、孩子、家庭、申请人、联系方式、申请类型和处理状态筛选。</p>
          </div>
          <div className="admin-audit-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
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
          <div className="admin-audit-filter-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? '查询中…' : '查询'}
            </button>
            <button type="button" style={secondaryButtonStyle} disabled={loading} onClick={() => void clearFilters()}>
              清空
            </button>
          </div>
        </form>
      </Panel>
      <ListSummary total={result?.total} label="交付申请概览" description="优先处理成年移交和待处理申请；每次状态推进都会写入审计，方便复盘责任链。">
        <SummaryStat label="待处理" value={submittedCount} tone={submittedCount > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="处理中" value={processingCount} tone={processingCount > 0 ? 'warning' : 'neutral'} />
        <SummaryStat label="成年移交" value={handoffCount} tone={handoffCount > 0 ? 'danger' : 'neutral'} />
      </ListSummary>
      {actionError ? <Panel><EmptyState message={`操作失败：${actionError}`} /></Panel> : null}
      {error ? <Panel><EmptyState message={`加载失败：${error}`} /></Panel> : null}
      <TableShell columns={['申请编号', '孩子档案', '申请人', '资产快照', '状态', '提交时间', '操作']} rows={rows} emptyMessage="暂无档案交付申请。可清空筛选，或提醒用户在导出与备份页提交云端打包申请。" loading={loading} />
      {result ? <PaginationPanel page={result.page} pageSize={result.page_size} total={result.total} hasMore={result.has_more} loading={loading} onPrevPage={async () => { if (!loading && page > 1) await load(page - 1, pageSize); }} onNextPage={async () => { if (!loading && result.has_more) await load(page + 1, pageSize); }} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail}>
        {detail.state.data ? <ArchiveExportRequestDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
      {reasonDialog}
    </PageShell>
  );
};

export const AuditLogsPage = () => {
  const detail = useDetailState<AdminAuditLogItem>();
  const [keyword, setKeyword] = useState('');
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ list: AdminAuditLogItem[]; page: number; page_size: number; total: number; has_more: boolean } | null>(null);
  const autoLoadedRef = useRef(false);

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize, event?: FormEvent, override?: AuditFilterOverride) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const activeKeyword = override?.keyword ?? keyword;
      const activeAction = override?.action ?? action;
      const activeTargetType = override?.targetType ?? targetType;
      const activeStartTime = override?.startTime ?? startTime;
      const activeEndTime = override?.endTime ?? endTime;
      const next = await adminApi.listAuditLogs({
        keyword: activeKeyword || undefined,
        action: activeAction || undefined,
        target_type: activeTargetType || undefined,
        start_time: toIsoDateTime(activeStartTime),
        end_time: toIsoDateTime(activeEndTime),
        page: nextPage,
        page_size: nextPageSize,
      });
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [action, endTime, keyword, page, pageSize, startTime, targetType]);

  const clearFilters = async () => {
    setKeyword('');
    setAction('');
    setTargetType('');
    setStartTime('');
    setEndTime('');
    await load(1, pageSize, undefined, { keyword: '', action: '', targetType: '', startTime: '', endTime: '' });
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
    auditActorTypeLabel(item.actor_type),
    formatDateTime(item.created_at),
    <ActionButton key={`${item.created_at}-${item.action}`} icon={<Eye size={15} />} onClick={() => void detail.openDetail('审计日志详情', item.action, async () => item)}>详情</ActionButton>,
  ]);

  return (
    <PageShell title="审计日志" description="查看后台关键行为和访问记录。仅超级管理员可见。">
      <Panel>
        <form className="admin-audit-filter-form" onSubmit={(event) => void load(1, pageSize, event)} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <strong style={{ display: 'block', color: '#16211f', marginBottom: '4px' }}>筛选条件</strong>
            <p style={mutedTextStyle}>支持按关键字、动作、目标类型和发生时间筛选。</p>
          </div>
          <div className="admin-audit-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <input style={inputStyle} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="关键字" />
            <AdminSelect value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">全部动作</option>
              {auditActionFilterOptions.map((value) => (
                <option key={value} value={value}>
                  {auditActionLabel(value)}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect value={targetType} onChange={(event) => setTargetType(event.target.value)}>
              <option value="">全部目标类型</option>
              {auditTargetTypeFilterOptions.map((value) => (
                <option key={value} value={value}>
                  {auditTargetTypeLabel(value)}
                </option>
              ))}
            </AdminSelect>
            <input style={inputStyle} type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} aria-label="开始时间" />
            <input style={inputStyle} type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} aria-label="结束时间" />
          </div>
          <div className="admin-audit-filter-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
      <ListSummary total={result?.total} label="审计日志概览" description="进入页面即展示最近留痕，筛选只用于缩小范围，不再让页面默认空白。">
        <SummaryStat label="当前页留痕" value={currentLogs.length} />
        <SummaryStat label="后台登录" value={recentLoginLogs} tone={recentLoginLogs > 0 ? 'success' : 'neutral'} />
      </ListSummary>
      {error ? <Panel><EmptyState message={`加载失败：${error}`} /></Panel> : null}
      <TableShell columns={['动作', '目标类型', '目标编号', '操作者', '创建时间', '操作']} rows={rows} emptyMessage="暂无匹配审计日志。可缩短时间范围、清空动作筛选，或回到总览查看最近留痕。" loading={loading} />
      {result ? <PaginationPanel page={result.page} pageSize={result.page_size} total={result.total} hasMore={result.has_more} loading={loading} onPrevPage={async () => { if (!loading && page > 1) await load(page - 1, pageSize); }} onNextPage={async () => { if (!loading && result.has_more) await load(page + 1, pageSize); }} /> : null}
      <DetailDrawer open={detail.state.open} title={detail.state.title} subtitle={detail.state.subtitle} loading={detail.state.loading} error={detail.state.error} onClose={detail.closeDetail}>
        {detail.state.data ? <AuditLogDetailContent data={detail.state.data} /> : null}
      </DetailDrawer>
    </PageShell>
  );
};
