import type { CSSProperties, FormEvent, ReactNode } from 'react';

import { EmptyState, Panel } from '../shared/ui';
import { inputStyle, mutedTextStyle, primaryButtonStyle, secondaryButtonStyle, tableStyle, thTdStyle } from '../shared/uiStyles';

const stickyLastColumnStyle = (isHeader = false): CSSProperties => ({
  position: 'sticky',
  right: 0,
  zIndex: isHeader ? 2 : 1,
  background: isHeader ? '#f6f8f7' : '#ffffff',
  boxShadow: '-10px 0 14px rgba(15, 23, 42, 0.06)',
});

export const SearchPanel = ({
  keyword,
  setKeyword,
  loading,
  onSearch,
  onClearSearch,
  description = '输入用户、孩子、记录、媒体或任务相关关键字后查询。',
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
  <Panel>
    <form className="admin-search-form" onSubmit={onSearch} style={{ display: 'grid', gap: '12px' }}>
      <div>
        <strong style={{ display: 'block', color: '#16211f', marginBottom: '4px' }}>筛选条件</strong>
        <p style={mutedTextStyle}>{description}</p>
      </div>
      <div className="admin-search-controls" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inputStyle, maxWidth: '360px' }} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={placeholder} />
        <button type="submit" style={primaryButtonStyle} disabled={loading}>
          {loading ? '查询中…' : '查询'}
        </button>
        <button type="button" style={secondaryButtonStyle} onClick={() => void onClearSearch()} disabled={loading}>
          清空
        </button>
      </div>
    </form>
  </Panel>
);

export const TableShell = ({
  columns,
  rows,
  emptyMessage,
  loading = false,
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  emptyMessage: string;
  loading?: boolean;
}) => {
  const tableMinWidth = `${Math.max(1180, columns.length * 146)}px`;

  return (
    <Panel>
      {!rows.length ? (
        <EmptyState title={loading ? '正在加载数据' : '暂无可处理数据'} message={loading ? '正在获取最新列表，加载完成后会自动显示。' : emptyMessage}>
          <span>{loading ? '请稍候，不需要重复点击查询。' : '可清空筛选后重新查看。'}</span>
        </EmptyState>
      ) : (
        <div className="admin-table-scroll" style={{ overflowX: 'auto' }}>
          <table className="admin-responsive-table" style={{ ...tableStyle, minWidth: tableMinWidth }}>
            <thead>
              <tr>
                {columns.map((column, columnIndex) => (
                  <th key={column} data-column={column} style={{ ...thTdStyle, color: '#66736f', fontSize: '13px', background: '#f6f8f7', ...(columnIndex === columns.length - 1 ? stickyLastColumnStyle(true) : {}) }}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} data-label={columns[cellIndex]} data-column={columns[cellIndex]} style={{ ...thTdStyle, ...(cellIndex === row.length - 1 ? stickyLastColumnStyle() : {}) }}>
                      {cell ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};

export const PaginationPanel = ({
  page,
  pageSize,
  total,
  hasMore,
  loading,
  onPrevPage,
  onNextPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  onPrevPage: () => Promise<void>;
  onNextPage: () => Promise<void>;
}) => (
  <Panel>
    <div className="admin-pagination" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ color: '#66736f', fontSize: '14px', fontWeight: 600 }}>
        当前第 {page} 页 · 每页 {pageSize} 条 · 共 {total} 条
      </div>
      <div className="admin-pagination-actions" style={{ display: 'flex', gap: '8px' }}>
        <button type="button" style={primaryButtonStyle} onClick={() => void onPrevPage()} disabled={loading || page <= 1}>
          上一页
        </button>
        <button type="button" style={primaryButtonStyle} onClick={() => void onNextPage()} disabled={loading || !hasMore}>
          下一页
        </button>
      </div>
    </div>
  </Panel>
);
