import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, ShieldAlert } from 'lucide-react';

import { adminApi, type AdminContentRiskItem, type AdminListResponse } from '../shared/request';
import { AdminSelect, Badge, EmptyState, PageShell, Panel } from '../shared/ui';
import { inputStyle, mutedTextStyle, primaryButtonStyle, secondaryButtonStyle } from '../shared/uiStyles';
import { PaginationPanel, TableShell } from './shared';

const pageSize = 10;

const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—');

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
  <span style={{ display: 'grid', gap: '5px', minWidth: 0 }}>
    <strong style={{ color: '#16211f' }}>{item.title}</strong>
    <span style={{ color: '#66736f', fontSize: '12px' }}>{item.reason}</span>
  </span>
);

export const ContentRisksPage = () => {
  const [result, setResult] = useState<AdminListResponse<AdminContentRiskItem> | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminApi.listContentRisks({
          keyword: keyword.trim() || undefined,
          category: category || undefined,
          severity: severity || undefined,
          status: status || undefined,
          page: nextPage,
          page_size: pageSize,
        });
        setResult(data);
        setPage(nextPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : '内容风险队列加载失败');
      } finally {
        setLoading(false);
      }
    },
    [category, keyword, page, severity, status],
  );

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      try {
        const data = await adminApi.listContentRisks({ page: 1, page_size: pageSize });
        if (!active) return;
        setResult(data);
        setPage(1);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '内容风险队列加载失败');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitial();
    return () => {
      active = false;
    };
  }, []);

  const onSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    await load(1);
  };

  const onClear = async () => {
    setKeyword('');
    setCategory('');
    setSeverity('');
    setStatus('');
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listContentRisks({ page: 1, page_size: pageSize });
      setResult(data);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '内容风险队列加载失败');
    } finally {
      setLoading(false);
    }
  };

  const rows =
    result?.list.map((item) => [
      <RiskTitle key={`${item.risk_no}-title`} item={item} />,
      <Badge key={`${item.risk_no}-category`} tone="info">{categoryLabel(item.category)}</Badge>,
      <Badge key={`${item.risk_no}-severity`} tone={badgeTone(item.severity)}>{severityLabel(item.severity)}</Badge>,
      <Badge key={`${item.risk_no}-status`} tone={badgeTone(item.status)}>{statusLabel(item.status)}</Badge>,
      item.subject_name ? `${item.subject_name}（${item.subject_no}）` : item.subject_no ?? '—',
      formatDateTime(item.created_at),
      <Link key={`${item.risk_no}-action`} to={item.action_to} style={{ ...secondaryButtonStyle, textDecoration: 'none', minHeight: '38px', justifyContent: 'center' }}>
        <ExternalLink size={15} />
        {item.action_label}
      </Link>,
    ]) ?? [];

  const openCount = result?.list.filter((item) => item.status === 'open').length ?? 0;
  const p0Count = result?.list.filter((item) => item.severity === 'p0').length ?? 0;

  return (
    <PageShell title="内容风险" description="集中复核敏感文本、异常媒体、儿童安全反馈和失败 AI 任务，运营可从这里跳转到对应处理队列。">
      <Panel>
        <form className="admin-search-form" onSubmit={onSearch} style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ display: 'block', color: '#16211f', marginBottom: '4px' }}>筛选条件</strong>
              <p style={mutedTextStyle}>支持按风险内容、编号、孩子、用户或处理来源筛选。</p>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#9a3412', fontSize: '13px', fontWeight: 700 }}>
              <ShieldAlert size={16} />
              本页只做风险归集，实际处置在记录、媒体、客服或 AI 队列完成。
            </span>
          </div>
          <div className="admin-audit-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <input style={inputStyle} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="编号 / 用户 / 内容" />
            <AdminSelect value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">全部类型</option>
              <option value="content_safety">内容安全</option>
              <option value="media_exception">媒体异常</option>
              <option value="child_safety">儿童安全</option>
              <option value="ai_exception">AI 异常</option>
            </AdminSelect>
            <AdminSelect value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="">全部级别</option>
              <option value="p0">P0 阻塞</option>
              <option value="p1">P1 优先</option>
              <option value="p2">P2 关注</option>
            </AdminSelect>
            <AdminSelect value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="open">待处理</option>
              <option value="processing">处理中</option>
              <option value="resolved">已处理</option>
            </AdminSelect>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? '查询中…' : '查询'}
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={() => void onClear()} disabled={loading}>
              清空
            </button>
          </div>
        </form>
      </Panel>

      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#16211f', fontWeight: 800 }}>
            <AlertTriangle size={17} />
            当前页风险概览
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Badge tone={p0Count > 0 ? 'danger' : 'success'}>P0：{p0Count}</Badge>
            <Badge tone={openCount > 0 ? 'danger' : 'success'}>待处理：{openCount}</Badge>
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
          onPrevPage={async () => {
            if (!loading && page > 1) await load(page - 1);
          }}
          onNextPage={async () => {
            if (!loading && result.has_more) await load(page + 1);
          }}
        />
      ) : null}
    </PageShell>
  );
};
