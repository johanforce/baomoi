import { useCallback, useEffect, useState, useRef } from 'react';
import {
  getSourceCountsFromDB,
  getStoredDatesFromDB,
  getTopRecentArticles,
  queryArticlesFromDB,
} from '../services/db';
import { useSourcesStore } from '../store/sourcesStore';
import { Article } from '../types';

export const PAGE_SIZE = 15;

export interface UseArticlesOptions {
  categoryName: string;
  dateStr: string;
  sourceIds: string[];
  searchQuery: string;
}

export function useArticles({ categoryName, dateStr, sourceIds, searchQuery }: UseArticlesOptions) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [storedDates, setStoredDates] = useState<string[]>([]);
  const [topRecentArticles, setTopRecentArticles] = useState<Article[]>([]);

  // Lắng nghe thay đổi từ sourcesStore để cập nhật tự động khi tải bài mới
  const { statuses, isRefreshingAll } = useSourcesStore();

  // Reset về trang 1 khi thay đổi bộ lọc
  const prevFilterRef = useRef<string>('');
  useEffect(() => {
    const filterKey = `${categoryName}|${dateStr}|${sourceIds.join(',')}|${searchQuery}`;
    if (prevFilterRef.current && prevFilterRef.current !== filterKey) {
      setPage(1);
    }
    prevFilterRef.current = filterKey;
  }, [categoryName, dateStr, sourceIds, searchQuery]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (sourceIds.includes('__NONE__')) {
        setArticles([]);
        setTotalCount(0);
        const counts = await getSourceCountsFromDB(dateStr || undefined);
        setSourceCounts(counts);
        const dates = await getStoredDatesFromDB();
        setStoredDates(dates);
        const topRecent = await getTopRecentArticles(10);
        setTopRecentArticles(topRecent);
        setIsLoading(false);
        return;
      }

      const offset = (page - 1) * PAGE_SIZE;

      const result = await queryArticlesFromDB({
        categoryName: categoryName === 'Mới nhất' ? undefined : categoryName,
        dateStr: dateStr || undefined,
        sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
        searchQuery: searchQuery || undefined,
        limit: PAGE_SIZE,
        offset,
      });

      setArticles(result.articles);
      setTotalCount(result.total);

      // Lấy số lượng bài theo từng nguồn và danh sách ngày
      const counts = await getSourceCountsFromDB(dateStr || undefined);
      setSourceCounts(counts);

      const dates = await getStoredDatesFromDB();
      setStoredDates(dates);

      // Lấy 10 bài nổi bật cho slider tương ứng với chuyên mục hiện tại
      let topRecent = await getTopRecentArticles(
        10,
        categoryName === 'Mới nhất' ? undefined : categoryName,
        dateStr || undefined
      );

      // Nếu ngày chọn chưa có bài, tự động lấy 10 bài mới nhất của chính chuyên mục đó
      if (topRecent.length < 3) {
        const fallback = await getTopRecentArticles(
          10,
          categoryName === 'Mới nhất' ? undefined : categoryName
        );
        if (fallback.length > 0) {
          topRecent = fallback;
        }
      }

      setTopRecentArticles(topRecent);
    } catch (err) {
      console.error('Lỗi truy vấn bài viết từ DB:', err);
    } finally {
      setIsLoading(false);
    }
  }, [categoryName, dateStr, sourceIds, searchQuery, page]);

  // Tải lại khi thay đổi bộ lọc, trang hoặc trạng thái RSS
  useEffect(() => {
    loadData();
  }, [loadData, statuses]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return {
    articles,
    totalCount,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    totalPages,
    isLoading,
    isRefreshingAll,
    reload: loadData,
    sourceCounts,
    storedDates,
    topRecentArticles,
  };
}
