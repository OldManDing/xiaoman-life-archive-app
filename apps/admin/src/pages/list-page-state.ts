import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import type { AdminListResponse } from '../shared/request';

export const useAdminListPage = <T,>(
  loader: (params: { keyword?: string; page?: number; page_size?: number }) => Promise<AdminListResponse<T>>,
) => {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminListResponse<T> | null>(null);
  const autoLoadedRef = useRef(false);

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize, event?: FormEvent, keywordOverride?: string) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const activeKeyword = keywordOverride ?? keyword;
      const next = await loader({ keyword: activeKeyword || undefined, page: nextPage, page_size: nextPageSize });
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, loader, page, pageSize]);

  const onSearch = async (event?: FormEvent) => {
    await load(1, pageSize, event);
  };

  const onClearSearch = async () => {
    setKeyword('');
    await load(1, pageSize, undefined, '');
  };

  useEffect(() => {
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    const timer = window.setTimeout(() => {
      void load(1, pageSize);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, pageSize]);

  const onPrevPage = async () => {
    if (loading || page <= 1) return;
    await load(page - 1, pageSize);
  };

  const onNextPage = async () => {
    if (loading || !result?.has_more) return;
    await load(page + 1, pageSize);
  };

  const updateResult = (updater: (current: AdminListResponse<T> | null) => AdminListResponse<T> | null) => {
    setResult((current) => updater(current));
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
    updateResult,
    onSearch,
    onClearSearch,
    onPrevPage,
    onNextPage,
  };
};

export const formatListRows = <T,>(items: T[], mapper: (item: T) => Array<ReactNode>) => items.map(mapper);
