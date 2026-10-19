import { useCallback, useEffect, useState } from 'react';
import {
  getSourceCountsFromDB,
  getStoredDatesFromDB,
  getTopRecentArticles,
  queryArticlesFromDB,
} from '../services/db';
import { sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { Article } from '../types';

export interface UseArticlesOptions {
  categoryName: string;
  dateStr: string;
  sourceIds: string[];
  searchQuery: string;
}

export function useArticles({ categoryName, dateStr, sourceIds, searchQuery }: UseArticlesOptions) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [limit, setLimit] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [storedDates, setStoredDates] = useState<string[]>([]);
  const [topRecentArticles, setTopRecentArticles] = useState<Article[]>([]);

  // Lắng nghe thay đổi từ sourcesStore để cập nhật tự động khi tải bài mới
  const { statuses, isRefreshingAll } = useSourcesStore();

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

      const result = await queryArticlesFromDB({
        categoryName: categoryName === 'Mới nhất' ? undefined : categoryName,
        dateStr: dateStr || undefined,
        sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
        searchQuery: searchQuery || undefined,
        limit,
        offset: 0,
      });

      setArticles(result.articles);
      setTotalCount(result.total);

      // Lấy số lượng bài theo từng nguồn và danh sách ngày
      const counts = await getSourceCountsFromDB(dateStr || undefined);
      setSourceCounts(counts);

      const dates = await getStoredDatesFromDB();
      setStoredDates(dates);

      const topRecent = await getTopRecentArticles(10);
      setTopRecentArticles(topRecent);
    } catch (err) {
      console.error('Lỗi truy vấn bài viết từ DB:', err);
    } finally {
      setIsLoading(false);
    }
  }, [categoryName, dateStr, sourceIds, searchQuery, limit]);

  // Tải lại khi thay đổi bộ lọc hoặc limit
  useEffect(() => {
    loadData();
  }, [loadData, statuses]);

  // Tăng giới hạn để "Xem thêm"
  const loadMore = useCallback(() => {
    setLimit((prev) => prev + 20);
  }, []);

  const resetLimit = useCallback(() => {
    setLimit(20);
  }, []);

  return {
    articles,
    totalCount,
    isLoading,
    isRefreshingAll,
    hasMore: articles.length < totalCount,
    loadMore,
    resetLimit,
    reload: loadData,
    sourceCounts,
    storedDates,
    topRecentArticles,
  };
}
