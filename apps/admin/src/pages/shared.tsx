import { useState, type FormEvent } from 'react';

import type { AdminListResponse } from '../shared/request';
import { EmptyState, Panel } from '../shared/ui';
import { inputStyle, primaryButtonStyle, tableStyle, thTdStyle } from '../shared/uiStyles';

export const useAdminListPage = <T,>(loader: (params: { keyword?: string; page?: number; page_size?: number }) => Promise<AdminListResponse<T>>) => {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminListResponse<T> | null>(null);

  const load = async (nextPage = page, nextPageSize = pageSize, event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const next = await loader({ keyword: keyword || undefined, page: nextPage, page_size: nextPageSize });
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const onSearch = async (event?: FormEvent) => {
    await load(1, pageSize, event);
  };

  const onPrevPage = async () => {
    if (loading || page <= 1) return;
    await load(page - 1, pageSize);
  };

  const onNextPage = async () => {
    if (loading || !result?.has_more) return;
    await load(page + 1, pageSize);
  };

  return {
    keyword,
    setKeyword,
    page,
    pageSize,
    loading,
    error,
    result,
    load,
    onSearch,
    onPrevPage,
    onNextPage,
  };
};

export const SearchPanel = ({
  keyword,
  setKeyword,
  loading,
  onSearch,
}: {
  keyword: string;
  setKeyword: (value: string) => void;
  loading: boolean;
  onSearch: (event?: FormEvent) => Promise<void>;
}) => (
  <Panel>
    <form onSubmit={onSearch} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <input style={{ ...inputStyle, maxWidth: '320px' }} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="输入关键字筛选" />
      <button type="submit" style={primaryButtonStyle} disabled={loading}>
        {loading ? '查询中…' : '查询'}
      </button>
    </form>
  </Panel>
);

export const TableShell = ({
  columns,
  rows,
  emptyMessage,
}: {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  emptyMessage: string;
}) => (
  <Panel>
    {!rows.length ? (
      <EmptyState message={emptyMessage} />
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} style={thTdStyle}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} style={thTdStyle}>
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

export const formatListRows = <T,>(items: T[], mapper: (item: T) => Array<string | number | null>) => items.map(mapper);

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
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>
        当前第 {page} 页 · 每页 {pageSize} 条 · 共 {total} 条
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
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
