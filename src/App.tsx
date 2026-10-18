/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { CategoryBar } from './components/CategoryBar';
import { SourceSidebar } from './components/SourceSidebar';
import { FeaturedArticle } from './components/FeaturedArticle';
import { ArticleItem } from './components/ArticleItem';
import { TrendingPanel } from './components/TrendingPanel';
import { SkeletonList } from './components/SkeletonList';
import { ToastContainer } from './components/Toast';
import { ErrorBanner } from './components/ErrorBanner';
import { FilterBottomSheet } from './components/FilterBottomSheet';
import { SavedArticlesView } from './components/SavedArticlesView';
import { SourceManager } from './pages/SourceManager';
import { useArticles } from './hooks/useArticles';
import { useFeedHealth } from './hooks/useFeedHealth';
import { sourcesStore, useSourcesStore } from './store/sourcesStore';
import { getVietnamTodayString, formatFriendlyDate } from './utils/date';
import { SlidersHorizontal, RefreshCw, Newspaper, Calendar, Inbox } from 'lucide-react';

export default function App() {
  const { isRefreshingAll } = useSourcesStore();
  const { hasErrors, errorCount } = useFeedHealth();

  // 1. URL Sync & State Initialization
  const initialParams = useMemo(() => {
    try {
      const search = window.location.search;
      const params = new URLSearchParams(search);
      return {
        category: params.get('category') || 'Mới nhất',
        date: params.get('date') || getVietnamTodayString(),
        sources: params.get('sources') ? params.get('sources')!.split(',').filter(Boolean) : [],
        view: (params.get('view') as 'feed' | 'sources' | 'bookmarks') || 'feed',
      };
    } catch {
      return {
        category: 'Mới nhất',
        date: getVietnamTodayString(),
        sources: [],
        view: 'feed' as const,
      };
    }
  }, []);

  const [currentView, setCurrentView] = useState<'feed' | 'sources' | 'bookmarks'>(
    initialParams.view
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(initialParams.category);
  const [selectedDate, setSelectedDate] = useState<string>(initialParams.date);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(initialParams.sources);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);
  const [sourceManagerInitialFilter, setSourceManagerInitialFilter] = useState<
    'all' | 'error' | 'success' | 'idle'
  >('all');

  // Sync state back to URL query params
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'Mới nhất') {
        params.set('category', selectedCategory);
      }
      if (selectedDate && selectedDate !== getVietnamTodayString()) {
        params.set('date', selectedDate);
      }
      if (selectedSourceIds.length > 0) {
        params.set('sources', selectedSourceIds.join(','));
      }
      if (currentView !== 'feed') {
        params.set('view', currentView);
      }
      const newQuery = params.toString();
      const newUrl = newQuery ? `?${newQuery}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    } catch {
      // ignore
    }
  }, [selectedCategory, selectedDate, selectedSourceIds, currentView]);

  // 2. Query articles using custom hook
  const {
    articles,
    totalCount,
    isLoading,
    hasMore,
    loadMore,
    sourceCounts,
    storedDates,
    topRecentArticles,
  } = useArticles({
    categoryName: selectedCategory,
    dateStr: selectedDate,
    sourceIds: selectedSourceIds,
    searchQuery,
  });

  // 3. Initial Fetch on Mount if needed & 10-minute background auto-refresh
  useEffect(() => {
    // Tự động fetch ban đầu nếu danh sách trống hoặc chưa có dữ liệu
    const checkAndInitialFetch = async () => {
      const storeState = sourcesStore.getState();
      const hasCheckedAny = Object.values(storeState.statuses).some((s) => s.state === 'success');
      if (!hasCheckedAny) {
        sourcesStore.fetchAllSources(false);
      }
    };
    checkAndInitialFetch();

    // Tự động làm mới nền mỗi 10 phút (600,000 ms)
    const interval = setInterval(() => {
      sourcesStore.fetchAllSources(false);
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Filter handlers
  const handleToggleSourceId = useCallback((sourceId: string) => {
    setSelectedSourceIds((prev) => {
      if (prev.length === 0) {
        // Nếu trước đó đang chọn tất cả ngầm định, bấm vào thì loại trừ nguồn này
        return [sourceId];
      }
      if (prev.includes(sourceId)) {
        return prev.filter((id) => id !== sourceId);
      }
      return [...prev, sourceId];
    });
  }, []);

  const handleSelectOnlySourceId = useCallback((sourceId: string) => {
    setSelectedSourceIds([sourceId]);
  }, []);

  const handleSelectAllSources = useCallback((allIds: string[]) => {
    setSelectedSourceIds(allIds);
  }, []);

  const handleOpenSourceManager = useCallback(
    (initialFilter: 'all' | 'error' | 'success' | 'idle' = 'all') => {
      setSourceManagerInitialFilter(initialFilter);
      setCurrentView('sources');
    },
    []
  );

  const handleLogoClick = useCallback(() => {
    setCurrentView('feed');
    setSelectedCategory('Mới nhất');
    setSelectedDate(getVietnamTodayString());
    setSelectedSourceIds([]);
    setSearchQuery('');
  }, []);

  // Featured Article is the first article, remaining are list articles
  const featuredArticle = articles.length > 0 ? articles[0] : null;
  const listArticles = articles.length > 1 ? articles.slice(1) : [];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sticky Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSourceManager={handleOpenSourceManager}
        onOpenBookmarks={() => setCurrentView((prev) => (prev === 'bookmarks' ? 'feed' : 'bookmarks'))}
        isBookmarksOpen={currentView === 'bookmarks'}
        onLogoClick={handleLogoClick}
      />

      {/* Main Views */}
      {currentView === 'sources' ? (
        <main className="flex-1">
          <SourceManager
            onBack={() => setCurrentView('feed')}
            initialFilter={sourceManagerInitialFilter}
          />
        </main>
      ) : currentView === 'bookmarks' ? (
        <main className="flex-1">
          <SavedArticlesView onBack={() => setCurrentView('feed')} />
        </main>
      ) : (
        <>
          {/* Category Navigation Bar */}
          <CategoryBar
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setSelectedSourceIds([]); // reset source filter when switching category
            }}
          />

          {/* Main 3-Column Content Layout */}
          <main className="flex-1 w-full px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-3.5 sm:py-5">
            {/* Mobile Filter Action Bar */}
            <div className="md:hidden flex items-center justify-between gap-2 mb-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                <Calendar className="w-3.5 h-3.5 text-[#00A859] shrink-0" />
                <span className="truncate">{formatFriendlyDate(selectedDate)}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => sourcesStore.fetchAllSources({ forceAll: false })}
                  disabled={isRefreshingAll}
                  className="p-1.5 text-slate-500 hover:text-[#00A859] rounded-lg active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
                  title="Tải lại tin mới"
                  aria-label="Tải lại tin mới"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin text-[#00A859]' : ''}`} />
                </button>
                <button
                  onClick={() => setIsMobileFilterOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#00A859]/10 text-[#00A859] hover:bg-[#00A859]/20 rounded-lg text-xs font-bold active:scale-95 transition-all"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Lọc báo ({selectedSourceIds.length === 0 ? 'Tất cả' : selectedSourceIds.length})</span>
                </button>
              </div>
            </div>

            {/* Error Banner when feeds fail */}
            <ErrorBanner
              errorCount={errorCount}
              onOpenSourceManager={() => handleOpenSourceManager('error')}
            />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 xl:gap-8 items-start">
              {/* Left Column (Desktop): Date & Newspaper Filters */}
              <div className="hidden md:block md:col-span-4 lg:col-span-3 xl:col-span-3 2xl:col-span-2 sticky top-20">
                <SourceSidebar
                  selectedCategory={selectedCategory}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  selectedSourceIds={selectedSourceIds}
                  onToggleSourceId={handleToggleSourceId}
                  onSelectOnlySourceId={handleSelectOnlySourceId}
                  onSelectAllSources={handleSelectAllSources}
                  sourceCounts={sourceCounts}
                  availableDates={storedDates}
                />
              </div>

              {/* Middle Column: News Feed */}
              <div className="col-span-1 md:col-span-8 lg:col-span-6 xl:col-span-6 2xl:col-span-7 space-y-3.5 sm:space-y-4">
                {/* Status Bar */}
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      {selectedCategory}
                    </span>
                    <span className="tabular-nums font-medium">{totalCount} bài viết</span>
                  </div>

                  {isRefreshingAll ? (
                    <span className="flex items-center gap-1.5 text-xs text-[#00A859] font-medium animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Đang cập nhật tin mới...
                    </span>
                  ) : (
                    <button
                      onClick={() => sourcesStore.fetchAllSources({ forceAll: false })}
                      className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-[#00A859] dark:hover:text-[#00A859] font-semibold transition-colors cursor-pointer"
                      title="Tải lại toàn bộ RSS các kênh đang bật"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Tải lại toàn bộ RSS</span>
                    </button>
                  )}
                </div>

                {/* Content rendering */}
                {isLoading && articles.length === 0 ? (
                  <SkeletonList count={4} />
                ) : articles.length === 0 ? (
                  /* Empty state */
                  <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
                    <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                      Chưa có bài viết nào cho ngày {formatFriendlyDate(selectedDate)}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Dữ liệu tin tức của ngày này có thể chưa được đồng bộ hoặc nguồn báo đã cập nhật phiên bản mới.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => setSelectedDate(getVietnamTodayString())}
                        className="px-3.5 py-2 bg-[#00A859] hover:bg-[#008f4c] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Xem tin hôm nay
                      </button>
                      <button
                        onClick={() => sourcesStore.fetchAllSources(false)}
                        className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Tải lại dữ liệu ngay
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Featured Top Story */}
                    {featuredArticle && <FeaturedArticle article={featuredArticle} />}

                    {/* News items list */}
                    <div className="space-y-3">
                      {listArticles.map((article) => (
                        <ArticleItem key={article.id} article={article} />
                      ))}
                    </div>

                    {/* Pagination Button */}
                    {hasMore && (
                      <div className="pt-4 text-center">
                        <button
                          onClick={loadMore}
                          className="w-full py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs transition-colors cursor-pointer"
                        >
                          Xem thêm bài viết ({articles.length}/{totalCount})
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right Column (Desktop LG): Trending & Newspaper Stats (3 cols) */}
              <div className="hidden lg:block lg:col-span-3 xl:col-span-3 2xl:col-span-3 sticky top-20">
                <TrendingPanel
                  topArticles={topRecentArticles}
                  sourceCounts={sourceCounts}
                  onSelectSource={handleSelectOnlySourceId}
                />
              </div>
            </div>
          </main>
        </>
      )}

      {/* Mobile Filter Bottom Sheet */}
      <FilterBottomSheet
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        selectedCategory={selectedCategory}
        selectedDate={selectedDate}
        onSelectDate={(d) => {
          setSelectedDate(d);
          setIsMobileFilterOpen(false);
        }}
        selectedSourceIds={selectedSourceIds}
        onToggleSourceId={handleToggleSourceId}
        onSelectAllSources={handleSelectAllSources}
        sourceCounts={sourceCounts}
        availableDates={storedDates}
      />

      {/* Toast Alert System */}
      <ToastContainer />
    </div>
  );
}
