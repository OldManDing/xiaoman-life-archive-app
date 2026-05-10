import { useMemo, useState } from 'react';

import {
  adminApi,
  type AdminAiJobItem,
  type AdminAuditLogItem,
  type AdminChildItem,
  type AdminMediaItem,
  type AdminRecordItem,
  type AdminUserItem,
} from '../shared/request';
import { EmptyState, PageShell, Panel } from '../shared/ui';
import { PaginationPanel, SearchPanel, TableShell, formatListRows, useAdminListPage } from './shared';

export const UsersPage = () => {
  const state = useAdminListPage<AdminUserItem>(adminApi.listUsers);
  const [updatingUserNo, setUpdatingUserNo] = useState<string | null>(null);

  const onToggleStatus = async (user: AdminUserItem) => {
    setUpdatingUserNo(user.user_no);
    try {
      const nextStatus = user.status === 'active' ? 'disabled' : 'active';
      const updated = await adminApi.updateUserStatus(user.user_no, {
        status: nextStatus,
        reason: nextStatus === 'disabled' ? 'admin manual disable' : 'admin manual enable',
      });

      if (!state.result) return;
      state.result.list = state.result.list.map((item) =>
        item.user_no === updated.user_no ? { ...item, status: updated.status } : item,
      );
    } catch (err) {
      state.setKeyword(state.keyword);
      throw err;
    } finally {
      setUpdatingUserNo(null);
    }
  };

  const rows = useMemo(
    () =>
      formatListRows(state.result?.list ?? [], (item) => [
        item.user_no,
        item.nickname,
        item.mobile,
        item.membership_type,
        item.status,
        item.last_login_at,
        item.created_at,
      ]),
    [state.result],
  );

  return (
    <PageShell title="用户列表" description="按关键字查询用户，并查看最近登录情况。">
      <SearchPanel {...state} />
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      {!rows.length ? (
        <TableShell columns={['用户编号', '昵称', '手机号', '会员', '状态', '最近登录', '创建时间']} rows={rows} emptyMessage="暂无用户数据，请先点击查询。" />
      ) : (
        <Panel>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead>
                <tr>
                  {['用户编号', '昵称', '手机号', '会员', '状态', '最近登录', '创建时间', '操作'].map((column) => (
                    <th key={column} style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '12px' }}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(state.result?.list ?? []).map((item) => (
                  <tr key={item.user_no}>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '12px' }}>{item.user_no}</td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '12px' }}>{item.nickname}</td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '12px' }}>{item.mobile ?? '—'}</td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '12px' }}>{item.membership_type}</td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '12px' }}>{item.status}</td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '12px' }}>{item.last_login_at ?? '—'}</td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '12px' }}>{item.created_at}</td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '12px' }}>
                      <button
                        type="button"
                        onClick={() => void onToggleStatus(item)}
                        disabled={updatingUserNo === item.user_no}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          border: '1px solid #d1d5db',
                          background: '#f9fafb',
                          cursor: 'pointer',
                        }}
                      >
                        {updatingUserNo === item.user_no ? '处理中…' : item.status === 'active' ? '冻结' : '解冻'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {state.result ? (
        <PaginationPanel
          page={state.result.page}
          pageSize={state.result.page_size}
          total={state.result.total}
          hasMore={state.result.has_more}
          loading={state.loading}
          onPrevPage={state.onPrevPage}
          onNextPage={state.onNextPage}
        />
      ) : null}
    </PageShell>
  );
};

export const ChildrenPage = () => {
  const state = useAdminListPage<AdminChildItem>(adminApi.listChildren);
  const rows = useMemo(
    () => formatListRows(state.result?.list ?? [], (item) => [item.child_no, item.family_no, item.owner_user_no, item.name, item.birthday, item.gender, item.status]),
    [state.result],
  );

  return (
    <PageShell title="孩子列表" description="查询孩子档案、归属家庭与拥有者。">
      <SearchPanel {...state} />
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell columns={['孩子编号', '家庭编号', '拥有者', '姓名', '生日', '性别', '状态']} rows={rows} emptyMessage="暂无孩子数据，请先点击查询。" />
      {state.result ? (
        <PaginationPanel
          page={state.result.page}
          pageSize={state.result.page_size}
          total={state.result.total}
          hasMore={state.result.has_more}
          loading={state.loading}
          onPrevPage={state.onPrevPage}
          onNextPage={state.onNextPage}
        />
      ) : null}
    </PageShell>
  );
};

export const RecordsPage = () => {
  const state = useAdminListPage<AdminRecordItem>(adminApi.listRecords);
  const rows = useMemo(
    () => formatListRows(state.result?.list ?? [], (item) => [item.record_no, item.child_no, item.creator_user_no, item.title, item.record_type, item.visibility_scope, item.status, item.created_at]),
    [state.result],
  );

  return (
    <PageShell title="记录列表" description="用于排查记录状态、归属孩子和创建者。">
      <SearchPanel {...state} />
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell columns={['记录编号', '孩子编号', '创建者', '标题', '类型', '可见范围', '状态', '创建时间']} rows={rows} emptyMessage="暂无记录数据，请先点击查询。" />
      {state.result ? (
        <PaginationPanel
          page={state.result.page}
          pageSize={state.result.page_size}
          total={state.result.total}
          hasMore={state.result.has_more}
          loading={state.loading}
          onPrevPage={state.onPrevPage}
          onNextPage={state.onNextPage}
        />
      ) : null}
    </PageShell>
  );
};

export const MediaPage = () => {
  const state = useAdminListPage<AdminMediaItem>(adminApi.listMedia);
  const rows = useMemo(
    () => formatListRows(state.result?.list ?? [], (item) => [item.media_no, item.family_no, item.child_no, item.uploader_user_no, item.media_type, item.mime_type, item.size_bytes, item.created_at]),
    [state.result],
  );

  return (
    <PageShell title="媒体列表" description="用于查看媒体上传记录、归属关系和类型。">
      <SearchPanel {...state} />
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell columns={['媒体编号', '家庭编号', '孩子编号', '上传者', '类型', 'MIME', '大小', '创建时间']} rows={rows} emptyMessage="暂无媒体数据，请先点击查询。" />
      {state.result ? (
        <PaginationPanel
          page={state.result.page}
          pageSize={state.result.page_size}
          total={state.result.total}
          hasMore={state.result.has_more}
          loading={state.loading}
          onPrevPage={state.onPrevPage}
          onNextPage={state.onNextPage}
        />
      ) : null}
    </PageShell>
  );
};

export const AIJobsPage = () => {
  const state = useAdminListPage<AdminAiJobItem>(adminApi.listAiJobs);
  const rows = useMemo(
    () => formatListRows(state.result?.list ?? [], (item) => [item.job_no, item.record_no, item.requester_user_no, item.job_type, item.status, item.error_message, item.created_at]),
    [state.result],
  );

  return (
    <PageShell title="AI 任务列表" description="查看 AI 任务状态和失败原因。">
      <SearchPanel {...state} />
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell columns={['任务编号', '记录编号', '请求人', '任务类型', '状态', '错误信息', '创建时间']} rows={rows} emptyMessage="暂无 AI 任务数据，请先点击查询。" />
      {state.result ? (
        <PaginationPanel
          page={state.result.page}
          pageSize={state.result.page_size}
          total={state.result.total}
          hasMore={state.result.has_more}
          loading={state.loading}
          onPrevPage={state.onPrevPage}
          onNextPage={state.onNextPage}
        />
      ) : null}
    </PageShell>
  );
};

export const AuditLogsPage = () => {
  const state = useAdminListPage<AdminAuditLogItem>(adminApi.listAuditLogs);
  const rows = useMemo(
    () => formatListRows(state.result?.list ?? [], (item) => [item.actor_type, item.actor_id, item.action, item.target_type, item.target_id, item.ip_address, item.created_at]),
    [state.result],
  );

  return (
    <PageShell title="审计日志" description="查看后台关键行为和访问记录。仅 super_admin 可见。">
      <SearchPanel {...state} />
      {state.error ? <Panel><EmptyState message={`加载失败：${state.error}`} /></Panel> : null}
      <TableShell columns={['行为主体', '主体 ID', '动作', '目标类型', '目标 ID', 'IP 地址', '创建时间']} rows={rows} emptyMessage="暂无审计日志数据，请先点击查询。" />
      {state.result ? (
        <PaginationPanel
          page={state.result.page}
          pageSize={state.result.page_size}
          total={state.result.total}
          hasMore={state.result.has_more}
          loading={state.loading}
          onPrevPage={state.onPrevPage}
          onNextPage={state.onNextPage}
        />
      ) : null}
    </PageShell>
  );
};
