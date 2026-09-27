import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Clipboard, KeyRound, Plus } from 'lucide-react';

import { adminApi, type AdminInviteCreateResponse, type AdminInviteItem } from '../shared/request';
import { inviteStatusLabel } from '../shared/labels';
import { formatDateTime, getErrorMessage } from '../shared/format';
import { AdminSelect, Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { inputStyle, mutedTextStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/uiStyles';
import { ActionButton } from './shared';
import { useAdminAuth } from '../shared/useAdminAuth';
import { useOperationReasonDialog } from '../shared/useOperationReasonDialog';
import { formatListRows, useAdminListPage } from './list-page-state';
import { PaginationPanel, SearchPanel, TableShell } from './shared';

const inviteTone = (status: AdminInviteItem['status']) => {
  if (status === 'pending') return 'success' as const;
  if (status === 'accepted') return 'info' as const;
  if (status === 'revoked') return 'danger' as const;
  return 'warning' as const;
};

const copyInviteCode = async (value: string) => {
  await navigator.clipboard.writeText(value);
};

export const InvitesPage = () => {
  const [inviteStatus, setInviteStatus] = useState('');
  // 状态筛选走 loader 闭包（与成长记录的 record_filter 同一套做法）。
  const state = useAdminListPage<AdminInviteItem>((params) => adminApi.listInvites({ ...params, status: inviteStatus || undefined }));
  const { admin } = useAdminAuth();
  // 生成/撤销邀请码在后端仅限 super_admin / operator，只读账号不应看到可用按钮。
  const canOperate = admin?.role === 'super_admin' || admin?.role === 'operator';
  const { requestOperationReason, reasonDialog } = useOperationReasonDialog();
  const [mobile, setMobile] = useState('');
  const [expiresInHoursText, setExpiresInHoursText] = useState('168');
  const [creating, setCreating] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<AdminInviteCreateResponse | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [revokingInviteNo, setRevokingInviteNo] = useState<string | null>(null);

  // 状态筛选变化后重新查询。不能在 onChange 里同步调 load：那里闭包捕获的还是旧 inviteStatus。
  const inviteStatusRef = useRef(inviteStatus);
  useEffect(() => {
    if (inviteStatusRef.current === inviteStatus) return;
    inviteStatusRef.current = inviteStatus;
    void state.load(1, state.pageSize);
  }, [inviteStatus, state]);

  const onCreateInvite = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedMobile = mobile.trim();
    if (normalizedMobile && !/^1\d{10}$/.test(normalizedMobile)) {
      setCreateError('手机号格式不正确');
      return;
    }

    const expiresInHours = Number(expiresInHoursText);
    if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 720) {
      setCreateError('有效期必须是 1 到 720 之间的整数小时');
      return;
    }

    // 生成邀请码也写入审计原因，保持敏感操作留痕口径一致。
    const reason = await requestOperationReason('生成注册邀请码', {
      target: normalizedMobile ? `绑定手机号 ${normalizedMobile}` : '不绑定手机号（任何新用户可用）',
      consequence: `有效期 ${expiresInHours} 小时，邀请码明文只在生成后显示一次。`,
    });
    if (!reason) return;

    setCreating(true);
    setCreateError(null);
    setCreateMessage(null);
    setCopyMessage(null);
    try {
      const result = await adminApi.createInvite({
        mobile: normalizedMobile || undefined,
        expires_in_hours: expiresInHours,
        reason,
      });
      setCreatedInvite(result);
      setCreateMessage(`已生成邀请码 ${result.invite_no}，有效期 ${expiresInHours} 小时。`);
      setMobile('');
      setExpiresInHoursText('168');
      await state.load(1, state.pageSize);
    } catch (err) {
      setCreateError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const onCopy = async (inviteCode: string) => {
    try {
      await copyInviteCode(inviteCode);
      setCopyMessage('邀请码已复制');
    } catch {
      setCopyMessage('复制失败，请手动选中复制');
    }
  };

  const onRevoke = async (invite: AdminInviteItem) => {
    if (invite.status !== 'pending') return;
    // 与其它敏感操作一致：撤销必须填写原因，并写入审计。
    const reason = await requestOperationReason('撤销邀请码', {
      target: `${invite.invite_no}${invite.invitee_mobile ? ` · 绑定 ${invite.invitee_mobile}` : ' · 不限手机号'}`,
      consequence: '撤销后该邀请码立即失效，已使用的不受影响。',
    });
    if (!reason) return;

    setCreateError(null);
    setRevokingInviteNo(invite.invite_no);
    try {
      const result = await adminApi.revokeInvite(invite.invite_no, { reason });
      state.updateResult((current) =>
        current
          ? {
              ...current,
              list: current.list.map((item) => (item.invite_no === result.invite_no ? { ...item, status: result.status } : item)),
            }
          : current,
      );
    } catch (err) {
      setCreateError(getErrorMessage(err));
    } finally {
      setRevokingInviteNo(null);
    }
  };

  const list = state.result?.list ?? [];
  const pendingCount = list.filter((item) => item.status === 'pending').length;
  const usedCount = list.filter((item) => item.status === 'accepted').length;
  const rows = formatListRows(list, (item) => [
    item.invite_no,
    item.invitee_mobile ?? '不限手机号',
    <Badge key={`${item.invite_no}-status`} tone={inviteTone(item.status)}>{inviteStatusLabel(item.status)}</Badge>,
    `${item.created_by_name}（${item.created_by_username}）`,
    item.accepted_by_user_no ? `${item.accepted_by_name ?? '未命名'}（${item.accepted_by_user_no}）` : '—',
    formatDateTime(item.expires_at),
    formatDateTime(item.created_at),
    <div key={`${item.invite_no}-actions`} className="admin-action-group" style={{ gridTemplateColumns: '1fr', minWidth: '94px' }}>
      {canOperate ? (
        <ActionButton
          onClick={() => void onRevoke(item)}
          disabled={item.status !== 'pending' || revokingInviteNo === item.invite_no}
          tone="danger"
        >
          {revokingInviteNo === item.invite_no ? '撤销中…' : '撤销'}
        </ActionButton>
      ) : (
        <span className="admin-text-muted">只读</span>
      )}
    </div>,
  ], (item) => item.invite_no);

  return (
    <PageShell title="邀请码管理">
      <Panel>
        <form onSubmit={onCreateInvite} className="admin-form-stack-lg">
          <div className="admin-row-between-top">
            <div>
        <strong className="admin-form-block-title">
                <KeyRound size={18} />
                生成注册邀请码
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Badge tone="neutral">本页待使用 {pendingCount}</Badge>
              <Badge tone="neutral">本页已使用 {usedCount}</Badge>
            </div>
          </div>
          <div className="admin-search-controls admin-invite-create-controls">
        <label className="admin-field-label">
              绑定手机号
              <input style={inputStyle} value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="可选，例如 13800000000" disabled={!canOperate} />
            </label>
        <label className="admin-field-label">
              有效期（小时，1-720）
              <input style={inputStyle} type="number" min={1} max={720} value={expiresInHoursText} onChange={(event) => setExpiresInHoursText(event.target.value)} disabled={!canOperate} />
            </label>
            <button type="submit" style={primaryButtonStyle} disabled={creating || !canOperate}>
              <Plus size={16} />
              {creating ? '生成中…' : '生成邀请码'}
            </button>
          </div>
          {!canOperate ? <p style={mutedTextStyle}>当前账号为只读权限，无法生成或撤销邀请码。</p> : null}
          {createError ? <EmptyState title="操作失败" message={createError} /> : null}
          {createdInvite ? (
            <div className="admin-invite-result">
              <div>
                <span>本次生成的邀请码</span>
                <strong>{createdInvite.invite_code}</strong>
                <p>只在本次生成后显示明文，复制后发送给用户在注册页填写。</p>
              </div>
              <button type="button" style={secondaryButtonStyle} onClick={() => void onCopy(createdInvite.invite_code)}>
                <Clipboard size={16} />
                复制邀请码
              </button>
            </div>
          ) : null}
          {createMessage ? <p style={mutedTextStyle}>{createMessage}</p> : null}
          {copyMessage ? <p style={mutedTextStyle}>{copyMessage}</p> : null}
        </form>
      </Panel>
      {/* 状态下拉放进搜索面板同一行：原来它独占一个整宽面板，中间空一大片，看着像没加载出来。 */}
      <SearchPanel {...state} placeholder="输入邀请码编号或手机号">
        <AdminSelect aria-label="邀请码状态" value={inviteStatus} onChange={(event) => setInviteStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="pending">待使用</option>
          <option value="accepted">已使用</option>
          <option value="revoked">已撤销</option>
          <option value="expired">已过期</option>
        </AdminSelect>
      </SearchPanel>
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell
        className="admin-invites-table"
        columns={['邀请码编号', '绑定手机号', '状态', '创建人', '使用人', '失效时间', '创建时间', '操作']}
        rows={rows}
        emptyMessage="暂无邀请码。可以先生成一个注册邀请码，再发给用户注册。"
        loading={state.loading}
      />
      {state.result ? (
        <PaginationPanel page={state.result.page} pageSize={state.result.page_size} total={state.result.total} hasMore={state.result.has_more} loading={state.loading} onPrevPage={state.onPrevPage} onNextPage={state.onNextPage} onPageSizeChange={state.onPageSizeChange} onJumpToPage={state.onJumpToPage} />
      ) : null}
      {reasonDialog}
    </PageShell>
  );
};
