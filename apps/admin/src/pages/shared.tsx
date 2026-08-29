import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { AdminButton, EmptyState } from '../shared/ui';
import { AdminModal } from '../shared/modal';
import { primaryButtonStyle, secondaryButtonStyle, tableStyle, tableHeaderStyle, thTdStyle } from '../shared/uiStyles';

export const SearchPanel = ({
  keyword,
  setKeyword,
  loading,
  onSearch,
  onClearSearch,
  description,
  placeholder = '输入关键字筛选',
}: {
  keyword: string;
  setKeyword: (value: string) => void;
  loading: boolean;
  onSearch: (event?: FormEvent) => Promise<void>;
  onClearSearch: () => Promise<void>;
  description?: string;
  placeholder?: string;
}) => (
  <div className="admin-search-panel">
    {description ? <p className="admin-search-description">{description}</p> : null}
    <form className="admin-search-form" onSubmit={onSearch}>
      <div className="admin-search-controls">
        <input className="admin-filter-control admin-search-keyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={placeholder} />
        <AdminButton className="admin-filter-button" tone="primary" type="submit" disabled={loading}>
          {loading ? '查询中…' : '查询'}
        </AdminButton>
        <AdminButton className="admin-filter-button" tone="ghost" type="button" onClick={() => void onClearSearch()} disabled={loading}>
          清空
        </AdminButton>
      </div>
    </form>
  </div>
);

export type ListRow = { key: string; cells: Array<ReactNode> };

export const TableShell = ({
  columns,
  rows,
  emptyMessage,
  loading = false,
  className,
}: {
  columns: string[];
  rows: ListRow[];
  emptyMessage: string;
  loading?: boolean;
  className?: string;
}) => (
    <div className={['admin-table-panel', className].filter(Boolean).join(' ')}>
      {!rows.length ? (
        <EmptyState title={loading ? '正在加载数据' : '暂无可处理数据'} message={loading ? '正在获取最新列表，加载完成后会自动显示。' : emptyMessage}>
          <span>{loading ? '请稍候，不需要重复点击查询。' : '可清空筛选后重新查看。'}</span>
        </EmptyState>
      ) : (
        <div className={loading ? 'admin-table-scroll admin-table-loading' : 'admin-table-scroll'}>
          <table className="admin-responsive-table" style={{ ...tableStyle, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} data-column={column} style={{ ...thTdStyle, ...tableHeaderStyle }}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, cellIndex) => (
                    <td key={cellIndex} data-label={columns[cellIndex]} data-column={columns[cellIndex]} style={thTdStyle}>
                      {cell ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
);

const PAGE_SIZE_OPTIONS = [20, 50, 100];

export const PaginationPanel = ({
  page,
  pageSize,
  total,
  hasMore,
  loading,
  onPrevPage,
  onNextPage,
  onPageSizeChange,
  onJumpToPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  onPrevPage: () => Promise<void>;
  onNextPage: () => Promise<void>;
  onPageSizeChange?: (nextPageSize: number) => Promise<void>;
  onJumpToPage?: (nextPage: number) => Promise<void>;
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [jumpValue, setJumpValue] = useState('');

  useEffect(() => {
    setJumpValue('');
  }, [page]);

  const submitJump = async () => {
    const target = Number(jumpValue);
    if (!onJumpToPage || !Number.isInteger(target) || target < 1 || target > totalPages || target === page) return;
    await onJumpToPage(target);
  };

  return (
  <div className="admin-pagination-panel">
      <div className="admin-pagination" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ color: '#7d7162', fontSize: '14px', fontWeight: 600 }}>
        当前第 {page} 页 · 每页 {pageSize} 条 · 共 {total} 条{onJumpToPage ? ` · 共 ${totalPages} 页` : ''}
      </div>
      <div className="admin-pagination-actions admin-row-actions-wrap">
        {onPageSizeChange ? (
          <label className="admin-pagination-size">
            每页
            <select
              value={pageSize}
              disabled={loading}
              aria-label="每页条数"
              onChange={(event) => void onPageSizeChange(Number(event.target.value))}
              style={{ minHeight: '32px', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(35, 31, 27, 0.12)', background: '#fff' }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size} 条</option>
              ))}
            </select>
          </label>
        ) : null}
        {onJumpToPage ? (
          <span className="admin-pagination-jump">
            跳至
            <input
              value={jumpValue}
              disabled={loading}
              inputMode="numeric"
              aria-label="跳转页码"
              placeholder={`1-${totalPages}`}
              onChange={(event) => setJumpValue(event.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void submitJump();
                }
              }}
              style={{ width: '72px', minHeight: '32px', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(35, 31, 27, 0.12)' }}
            />
            页
            <AdminButton type="button" tone="secondary" disabled={loading || !jumpValue} onClick={() => void submitJump()}>
              跳转
            </AdminButton>
          </span>
        ) : null}
        <AdminButton type="button" tone="secondary" onClick={() => void onPrevPage()} disabled={loading || page <= 1}>
          上一页
        </AdminButton>
        <AdminButton type="button" tone="primary" onClick={() => void onNextPage()} disabled={loading || !hasMore}>
          下一页
        </AdminButton>
      </div>
    </div>
  </div>
  );
};

/**
 * 操作成功/失败的全局反馈。固定在右上角，保证从详情抽屉里发起的操作也能看到结果。
 */
export const ActionFeedback = ({ message, error }: { message?: string | null; error?: string | null }) => {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const current = error ? { tone: 'error' as const, text: error } : message ? { tone: 'success' as const, text: message } : null;
  const currentKey = current ? `${current.tone}:${current.text}` : '';

  useEffect(() => {
    setDismissed(null);
  }, [currentKey]);

  useEffect(() => {
    if (!current || current.tone !== 'success') return;
    const timer = window.setTimeout(() => setDismissed(currentKey), 6000);
    return () => window.clearTimeout(timer);
  }, [current, currentKey]);

  if (!current || dismissed === currentKey) return null;

  return (
    <div
      className={`admin-action-toast admin-action-toast-${current.tone}`}
      role={current.tone === 'error' ? 'alert' : 'status'}
      aria-live={current.tone === 'error' ? 'assertive' : 'polite'}
    >
      <span>{current.text}</span>
      <button type="button" aria-label="关闭提示" onClick={() => setDismissed(currentKey)}>
        ×
      </button>
    </div>
  );
};

export const ActionButton = ({
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

/**
 * 敏感操作统一走"填写原因"确认弹窗；原因会随请求写入审计日志。
 */
export const useOperationReasonDialog = () => {
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
    <AdminModal open={Boolean(dialog)} title={dialog.actionName} eyebrow="后台操作确认" onClose={() => closeDialog(null)}>
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
    </AdminModal>
  ) : null;

  return { requestOperationReason, reasonDialog };
};
