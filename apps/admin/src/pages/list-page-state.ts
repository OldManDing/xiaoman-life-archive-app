import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import type { AdminListResponse } from '../shared/request';

type AdminListFilters = Record<string, string | number | boolean | undefined>;

type UseAdminListPageOptions = {
  /**
   * 页面自己的筛选值（关键字与页码除外）。
   *
   * 只用于「变化后自动回到第 1 页重查」：hook 用稳定签名比较，所以每帧新建对象没关系。
   * 有了它，各页不再需要维护 requestVersionRef / filterLoadedRef / load 的 override 参数。
   */
  filters?: AdminListFilters;
};

export const useAdminListPage = <T,>(
  loader: (params: { keyword?: string; page?: number; page_size?: number }) => Promise<AdminListResponse<T>>,
  options: UseAdminListPageOptions = {},
) => {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // 首帧即视为加载中：否则会在请求发出前先渲染一次「暂无可处理数据」空态并可见地闪一下。
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminListResponse<T> | null>(null);
  const autoLoadedRef = useRef(false);
  const requestVersionRef = useRef(0);

  const load = useCallback(async (nextPage = page, nextPageSize = pageSize, event?: FormEvent, keywordOverride?: string) => {
    event?.preventDefault();
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError(null);
    try {
      const activeKeyword = (keywordOverride ?? keyword).trim();
      const next = await loader({ keyword: activeKeyword || undefined, page: nextPage, page_size: nextPageSize });
      if (requestVersionRef.current !== requestVersion) return;
      setResult(next);
      setPage(next.page);
      setPageSize(next.page_size);
    } catch (err) {
      if (requestVersionRef.current !== requestVersion) return;
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [keyword, loader, page, pageSize]);

  // loadRef 始终指向最新一次渲染的 load：延后一拍的场景（筛选变化/清空）必须用新值。
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const onSearch = async (event?: FormEvent) => {
    await load(1, pageSize, event);
  };

  const onClearSearch = async () => {
    setKeyword('');
    await load(1, pageSize, undefined, '');
  };

  const onPageSizeChange = async (nextPageSize: number) => {
    await load(1, nextPageSize);
  };

  const onJumpToPage = async (nextPage: number) => {
    await load(nextPage, pageSize);
  };

  useEffect(() => {
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    const timer = window.setTimeout(() => {
      void loadRef.current(1, pageSize);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pageSize]);

  const filtersSignature = JSON.stringify(options.filters ?? {});
  const loadedFiltersRef = useRef(filtersSignature);

  useEffect(() => {
    if (loadedFiltersRef.current === filtersSignature) return;
    loadedFiltersRef.current = filtersSignature;
    const timer = window.setTimeout(() => {
      void loadRef.current(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filtersSignature]);

  /**
   * 清空筛选后重查。
   * 页面的 setState 还没提交，直接 load 会用到旧筛选值，所以延后一拍：
   * 等重渲染完成（loadRef 已指向新闭包）再发请求。
   */
  const reloadAfterFiltersReset = () => {
    const timer = window.setTimeout(() => {
      void loadRef.current(1);
    }, 0);
    return () => window.clearTimeout(timer);
  };

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
    onPageSizeChange,
    onJumpToPage,
    reloadAfterFiltersReset,
  };
};

export const formatListRows = <T,>(items: T[], mapper: (item: T) => Array<ReactNode>, getKey: (item: T) => string) =>
  items.map((item) => ({ key: getKey(item), cells: mapper(item) }));
