import type { FormEvent, ReactNode } from 'react';

import { AdminButton, EmptyState } from '../shared/ui';
import { tableStyle, thTdStyle } from '../shared/uiStyles';

export const SearchPanel = ({
  keyword,
  setKeyword,
  loading,
  onSearch,
  onClearSearch,
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
}) => (
    <div className="admin-table-panel">
      {!rows.length ? (
        <EmptyState title={loading ? '正在加载数据' : '暂无可处理数据'} message={loading ? '正在获取最新列表，加载完成后会自动显示。' : emptyMessage}>
          <span>{loading ? '请稍候，不需要重复点击查询。' : '可清空筛选后重新查看。'}</span>
        </EmptyState>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-responsive-table" style={{ ...tableStyle, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} data-column={column} style={{ ...thTdStyle, color: '#7d7162', fontSize: '12px', background: '#f7efe1' }}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
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
  <div className="admin-pagination-panel">
      <div className="admin-pagination" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ color: '#7d7162', fontSize: '14px', fontWeight: 600 }}>
        当前第 {page} 页 · 每页 {pageSize} 条 · 共 {total} 条
      </div>
      <div className="admin-pagination-actions" style={{ display: 'flex', gap: '8px' }}>
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
