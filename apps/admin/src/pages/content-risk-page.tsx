import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ExternalLink, ShieldAlert } from 'lucide-react';

import { adminApi, type AdminContentRiskItem } from '../shared/request';
import { formatDateTime } from '../shared/format';
import { AdminButton, AdminSelect, Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { inputStyle, mutedTextStyle, secondaryButtonStyle } from '../shared/uiStyles';
import { useAdminListPage } from './list-page-state';
import { PaginationPanel, TableShell } from './shared';

const contentRiskCategoryValues = ['content_safety', 'media_exception', 'child_safety', 'ai_exception'] as const;

/** 只接受后端认可的类别值：URL 参数来自首页卡片的跳转，值不合法时按"未筛选"处理。 */
const normalizeContentRiskCategory = (value: string | null) =>
  (contentRiskCategoryValues as readonly string[]).includes(value ?? '') ? (value as string) : '';

const categoryLabel = (value: AdminContentRiskItem['category']) =>
  ({
    content_safety: '内容安全',
    media_exception: '媒体异常',
    child_safety: '儿童安全',
    ai_exception: 'AI 异常',
  })[value];

const severityLabel = (value: AdminContentRiskItem['severity']) =>
  ({
    p0: 'P0 阻塞',
    p1: 'P1 优先',
    p2: 'P2 关注',
  })[value];

const statusLabel = (value: AdminContentRiskItem['status']) =>
  ({
    open: '待处理',
    processing: '处理中',
    resolved: '已处理',
  })[value];

const badgeTone = (value: string) => {
  if (['p0', 'open'].includes(value)) return 'danger' as const;
  if (['p1', 'processing'].includes(value)) return 'warning' as const;
  if (['resolved'].includes(value)) return 'success' as const;
  return 'info' as const;
};

const RiskTitle = ({ item }: { item: AdminContentRiskItem }) => (
  <span className="admin-risk-title-stack">
        <strong className="admin-risk-title-text">{item.title}</strong>
        <span className="admin-risk-title-reason">{item.reason}</span>
  </span>
);

export const ContentRisksPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // 支持 ?category=：首页「记录风险」卡片跳过来时（category=content_safety）列表数量要和卡片一致。
  const initialCategory = normalizeContentRiskCategory(searchParams.get('category'));
  const [category, setCategory] = useState(initialCategory);
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');

  // 列表脚手架（分页 / 加载中 / 错误 / 请求版本号）统一由 hook 提供。
  // 本页原来是手写的一套：没有请求版本号保护，快速切换筛选时旧响应可能覆盖新响应，
  // 而且首屏请求不带筛选（带 ?category= 跳进来也显示未筛选的数量）。
  const state = useAdminListPage<AdminContentRiskItem>(
    (params) =>
      adminApi.listContentRisks({
        keyword: params.keyword,
        page: params.page,
        page_size: params.page_size,
        category: category || undefined,
        severity: severity || undefined,
        status: status || undefined,
      }),
    { filters: { category, severity, status } },
  );
  const { keyword, setKeyword, loading, error, result } = state;

  const onClear = () => {
    setKeyword('');
    setCategory('');
    setSeverity('');
    setStatus('');
    setSearchParams({}, { replace: true });
    state.reloadAfterFiltersReset();
  };

  const rows =
    result?.list.map((item) => ({
      key: item.risk_no,
      cells: [
        <RiskTitle key={`${item.risk_no}-title`} item={item} />,
        <Badge key={`${item.risk_no}-category`} tone="info">{categoryLabel(item.category)}</Badge>,
        <Badge key={`${item.risk_no}-severity`} tone={badgeTone(item.severity)}>{severityLabel(item.severity)}</Badge>,
        <Badge key={`${item.risk_no}-status`} tone={badgeTone(item.status)}>{statusLabel(item.status)}</Badge>,
        item.subject_name ? `${item.subject_name}（${item.subject_no}）` : item.subject_no ?? '—',
        formatDateTime(item.created_at),
        <Link key={`${item.risk_no}-action`} className="admin-table-action-link" to={item.action_to} style={{ ...secondaryButtonStyle, textDecoration: 'none', minHeight: '38px', justifyContent: 'center' }}>
          <ExternalLink size={16} />
          {item.action_label}
        </Link>,
      ],
    })) ?? [];

  const openCount = result?.list.filter((item) => item.status === 'open').length ?? 0;
  const p0Count = result?.list.filter((item) => item.severity === 'p0').length ?? 0;

  return (
    <PageShell title="内容风险" description="集中复核敏感文本、异常媒体、儿童安全反馈和失败 AI 任务，运营可从这里跳转到对应处理队列。">
      <Panel>
        <form className="admin-audit-filter-form" onSubmit={(event) => void state.onSearch(event)} style={{ display: 'grid', gap: '12px' }}>
          <div className="admin-row-between-top">
            <div>
          <strong style={{ display: 'block', color: '#221b12', marginBottom: '4px' }}>筛选条件</strong>
              <p style={mutedTextStyle}>支持按风险内容、编号、孩子、用户或处理来源筛选。</p>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#756b5c', fontSize: '13px', fontWeight: 600 }}>
              <ShieldAlert size={16} />
              本页只做风险归集，实际处置在记录、媒体、客服或 AI 队列完成。
            </span>
          </div>
          <div className="admin-audit-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <input style={inputStyle} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="编号 / 用户 / 内容" />
            <AdminSelect
              aria-label="风险类型"
              value={category}
              onChange={(event) => {
                const next = event.target.value;
                setCategory(next);
                // 与 URL 同步：首页「记录风险」卡片带 ?category=content_safety 跳过来，
                // 这里选完也要让地址栏保持一致（可刷新、可分享）；重新取数由 hook 的 filters 变化触发。
                setSearchParams(next ? { category: next } : {}, { replace: true });
              }}
            >
              <option value="">全部类型</option>
              <option value="content_safety">内容安全</option>
              <option value="media_exception">媒体异常</option>
              <option value="child_safety">儿童安全</option>
              <option value="ai_exception">AI 异常</option>
            </AdminSelect>
            <AdminSelect aria-label="风险级别" value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="">全部级别</option>
              <option value="p0">P0 阻塞</option>
              <option value="p1">P1 优先</option>
              <option value="p2">P2 关注</option>
            </AdminSelect>
            <AdminSelect aria-label="处理状态" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="open">待处理</option>
              <option value="processing">处理中</option>
              <option value="resolved">已处理</option>
            </AdminSelect>
          </div>
          <div className="admin-audit-filter-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <AdminButton type="submit" tone="primary" disabled={loading}>
              {loading ? '查询中…' : '查询'}
            </AdminButton>
            <AdminButton type="button" tone="ghost" onClick={() => void onClear()} disabled={loading}>
              清空
            </AdminButton>
          </div>
        </form>
      </Panel>

      <Panel>
        <div className="admin-row-between-top">
              <span className="admin-risk-summary-title">
            <AlertTriangle size={18} />
            本页风险概览
          </span>
          <div className="admin-chip-row">
            <Badge tone={p0Count > 0 ? 'danger' : 'success'}>本页 P0：{p0Count}</Badge>
            <Badge tone={openCount > 0 ? 'danger' : 'success'}>本页待处理：{openCount}</Badge>
            <Badge tone="info">总数：{result?.total ?? 0}</Badge>
          </div>
        </div>
      </Panel>

      {error ? <Panel><EmptyState title="加载失败" message={error} /></Panel> : null}
      <TableShell columns={['风险内容', '类型', '级别', '状态', '关联对象', '发现时间', '操作']} rows={rows} emptyMessage="暂无内容风险项。可切换筛选条件或在系统运维页查看整体风险。" loading={loading} />
      {result ? (
        <PaginationPanel
          page={result.page}
          pageSize={result.page_size}
          total={result.total}
          hasMore={result.has_more}
          loading={loading}
          onPrevPage={state.onPrevPage}
          onNextPage={state.onNextPage}
        />
      ) : null}
    </PageShell>
  );
};
