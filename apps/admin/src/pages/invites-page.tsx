import { useState, type FormEvent } from 'react';
import { Clipboard, KeyRound, Plus } from 'lucide-react';

import { adminApi, type AdminInviteCreateResponse, type AdminInviteItem } from '../shared/request';
import { inviteStatusLabel } from '../shared/labels';
import { formatDateTime, getErrorMessage } from '../shared/format';
import { Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { inputStyle, mutedTextStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/uiStyles';
import { ActionButton, useOperationReasonDialog } from './shared';
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
  const state = useAdminListPage<AdminInviteItem>(adminApi.listInvites);
  const { requestOperationReason, reasonDialog } = useOperationReasonDialog();
  const [mobile, setMobile] = useState('');
  const [expiresInHoursText, setExpiresInHoursText] = useState('168');
  const [creating, setCreating] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<AdminInviteCreateResponse | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [revokingInviteNo, setRevokingInviteNo] = useState<string | null>(null);

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
    const reason = await requestOperationReason('生成注册邀请码');
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
    const reason = await requestOperationReason('撤销邀请码');
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
      <ActionButton
        onClick={() => void onRevoke(item)}
        disabled={item.status !== 'pending' || revokingInviteNo === item.invite_no}
        tone="danger"
      >
        {revokingInviteNo === item.invite_no ? '撤销中…' : '撤销'}
      </ActionButton>
    </div>,
  ], (item) => item.invite_no);

  return (
    <PageShell title="邀请码管理" description="运营在这里生成新用户注册用的邀请码；用户注册成功后会自动创建自己的家庭。">
      <Panel>
        <form onSubmit={onCreateInvite} className="admin-form-stack-lg">
          <div className="admin-row-between-top">
            <div>
        <strong className="admin-form-block-title">
                <KeyRound size={18} />
                生成注册邀请码
              </strong>
              <p style={mutedTextStyle}>可选绑定手机号；不绑定时，任何新用户拿到该码都能完成注册。</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Badge tone="neutral">当前页待使用 {pendingCount}</Badge>
              <Badge tone="neutral">当前页已使用 {usedCount}</Badge>
            </div>
          </div>
          <div className="admin-search-controls admin-invite-create-controls">
        <label className="admin-field-label">
              绑定手机号
              <input style={inputStyle} value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="可选，例如 13800000000" />
            </label>
        <label className="admin-field-label">
              有效期（小时，1-720）
              <input style={inputStyle} type="number" min={1} max={720} value={expiresInHoursText} onChange={(event) => setExpiresInHoursText(event.target.value)} />
            </label>
            <button type="submit" style={primaryButtonStyle} disabled={creating}>
              <Plus size={16} />
              {creating ? '生成中…' : '生成邀请码'}
            </button>
          </div>
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
      <SearchPanel {...state} description="按邀请码编号、绑定手机号、创建人或使用人查询。" placeholder="输入邀请码编号或手机号" />
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
