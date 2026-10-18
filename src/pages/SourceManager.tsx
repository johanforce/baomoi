import React, { useState, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  Newspaper,
  CheckSquare,
  Square,
} from 'lucide-react';
import { SourceRow } from '../components/SourceRow';
import { useFeedHealth } from '../hooks/useFeedHealth';
import { fetchFeed } from '../services/rssService';
import { getOutletName, sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { FeedStatus, SourceItem } from '../types';
import { generateHash } from '../utils/hash';
import { isValidFeedUrl } from '../utils/url';

interface SourceManagerProps {
  onBack: () => void;
  initialFilter?: 'all' | 'error' | 'success' | 'idle';
}

export const SourceManager: React.FC<SourceManagerProps> = ({
  onBack,
  initialFilter = 'all',
}) => {
  const { sources, statuses, isRefreshingAll, refreshProgress } = useSourcesStore();
  const { totalSources, enabledSources, healthyCount, errorCount, idleCount, hasErrors } =
    useFeedHealth();

  const [activeFilter, setActiveFilter] = useState<'all' | 'success' | 'error' | 'idle'>(
    initialFilter
  );
  const [groupMode, setGroupMode] = useState<'category' | 'outlet'>('category');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOutletToReload, setSelectedOutletToReload] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isResetAllConfirmOpen, setIsResetAllConfirmOpen] = useState(false);
  const [inspectingSource, setInspectingSource] = useState<{
    source: SourceItem;
    status: FeedStatus;
  } | null>(null);

  // Add Source Form State
  const [addTitle, setAddTitle] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [addFeedUrl, setAddFeedUrl] = useState('');
  const [addRssPage, setAddRssPage] = useState('');
  const [isTestingFeed, setIsTestingFeed] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    articlesCount?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unique categories for the dropdown in Add Source
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    sources.forEach((s) => s.categoryName && set.add(s.categoryName));
    return Array.from(set);
  }, [sources]);

  // Unique outlets (trang báo)
  const uniqueOutlets = useMemo(() => {
    const set = new Set<string>();
    sources.forEach((s) => {
      const outlet = getOutletName(s.title);
      if (outlet) set.add(outlet);
    });
    return Array.from(set).sort();
  }, [sources]);

  // Filter sources according to active tab and search
  const filteredSources = useMemo(() => {
    return sources.filter((src) => {
      // 1. Filter by status
      const state = statuses[src.id]?.state || 'idle';
      if (activeFilter === 'success' && state !== 'success') return false;
      if (activeFilter === 'error' && state !== 'error') return false;
      if (activeFilter === 'idle' && state !== 'idle') return false;

      // 2. Filter by search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchTitle = src.title.toLowerCase().includes(query);
        const matchUrl = src.feed_url.toLowerCase().includes(query);
        const matchCat = src.categoryName.toLowerCase().includes(query);
        return matchTitle || matchUrl || matchCat;
      }

      return true;
    });
  }, [sources, statuses, activeFilter, searchTerm]);

  // Group filtered sources by category OR by newspaper outlet
  const groupedSources = useMemo(() => {
    const groups: Record<string, SourceItem[]> = {};
    filteredSources.forEach((src) => {
      const groupKey = groupMode === 'category' ? src.categoryName || 'Khác' : getOutletName(src.title);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(src);
    });
    return groups;
  }, [filteredSources, groupMode]);

  // Handle Export
  const handleExport = () => {
    const jsonStr = sourcesStore.exportConfig();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tintonghop_rss_sources_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    sourcesStore.addToast('success', 'Đã tải xuống file cấu hình nguồn JSON');
  };

  // Handle Import
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        sourcesStore.importConfig(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handle Test Feed in Add Modal
  const handleTestFeed = async () => {
    if (!isValidFeedUrl(addFeedUrl)) {
      setTestResult({
        success: false,
        message: 'URL không hợp lệ. Phải bắt đầu bằng http:// hoặc https://',
      });
      return;
    }

    setIsTestingFeed(true);
    setTestResult(null);

    const tempSource: SourceItem = {
      id: generateHash(addFeedUrl),
      title: addTitle || 'Nguồn kiểm tra',
      feed_url: addFeedUrl.trim(),
      rss_page: addRssPage.trim(),
      categoryName: addCategory === '__new__' ? customCategory : addCategory || 'Mặc định',
      enabled: true,
      defaultFeedUrl: addFeedUrl.trim(),
      defaultTitle: addTitle || 'Nguồn kiểm tra',
      defaultRssPage: addRssPage.trim(),
    };

    try {
      const res = await fetchFeed(tempSource);
      if (res.status === 'success') {
        setTestResult({
          success: true,
          message: `Kiểm tra thành công! Lấy được ${res.articles.length} bài qua proxy ${res.proxyUsed} (${res.latencyMs}ms)`,
          articlesCount: res.articles.length,
        });
      } else {
        setTestResult({
          success: false,
          message: `Kiểm tra thất bại: ${res.error || 'Không lấy được tin'}`,
        });
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: `Lỗi kết nối: ${(err as Error)?.message}`,
      });
    } finally {
      setIsTestingFeed(false);
    }
  };

  // Handle Save New Source
  const handleSaveNewSource = () => {
    if (!addTitle.trim()) {
      sourcesStore.addToast('error', 'Vui lòng nhập tên báo');
      return;
    }
    if (!isValidFeedUrl(addFeedUrl)) {
      sourcesStore.addToast('error', 'URL feed không hợp lệ');
      return;
    }

    const finalCategory =
      addCategory === '__new__' ? customCategory.trim() : addCategory || 'Tin tức & Thời sự tổng hợp';
    if (!finalCategory) {
      sourcesStore.addToast('error', 'Vui lòng chọn hoặc nhập tên danh mục');
      return;
    }

    const newSource = sourcesStore.addSource({
      title: addTitle.trim(),
      categoryName: finalCategory,
      feed_url: addFeedUrl.trim(),
      rss_page: addRssPage.trim(),
    });

    setIsAddModalOpen(false);
    setAddTitle('');
    setAddCategory('');
    setCustomCategory('');
    setAddFeedUrl('');
    setAddRssPage('');
    setTestResult(null);

    // Tải lại nguồn mới tạo ngay lập tức
    sourcesStore.fetchSingleSource(newSource.id);
  };

  // Handle quick reload of single outlet
  const handleReloadSelectedOutlet = () => {
    if (!selectedOutletToReload) return;
    sourcesStore.fetchSourcesByOutlet(selectedOutletToReload, false);
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
      {/* 1. Header with back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Quay lại trang đọc báo"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Quản lý nguồn RSS ({sources.length} kênh)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {enabledSources} kênh đang bật · {uniqueOutlets.length} tòa soạn báo điện tử
            </p>
          </div>
        </div>

        {/* Highlight Summary Banner */}
        <div
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border flex items-center gap-2 self-start sm:self-center flex-wrap ${
            hasErrors
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
          }`}
        >
          <span>🟢 {healthyCount} hoạt động</span>
          <span>·</span>
          <span>🔴 {errorCount} lỗi</span>
          <span>·</span>
          <span>⚪ {idleCount} chưa kiểm tra</span>
          <span>·</span>
          <span>Tổng {totalSources} kênh</span>
        </div>
      </div>

      {/* 2. Top Action Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        {/* Row 1: Major Reload Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tải lại toàn bộ RSS */}
            <button
              onClick={() => sourcesStore.fetchAllSources({ forceAll: false })}
              disabled={isRefreshingAll}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#00A859] hover:bg-[#008f4c] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Tải lại toàn bộ các kênh RSS đang bật"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingAll ? 'animate-spin' : ''}`} />
              <span>{isRefreshingAll ? 'Đang kiểm tra...' : 'Tải lại toàn bộ RSS'}</span>
            </button>

            {/* Tải lại tất cả kể cả kênh đang tắt */}
            <button
              onClick={() => sourcesStore.fetchAllSources({ forceAll: true })}
              disabled={isRefreshingAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Kiểm tra tất cả 100+ kênh kể cả kênh chưa bật"
            >
              <span>Kiểm tra toàn bộ {sources.length} kênh</span>
            </button>

            {/* Chỉ tải lại nguồn lỗi */}
            <button
              onClick={() => sourcesStore.fetchAllSources({ onlyFailed: true })}
              disabled={isRefreshingAll || errorCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              title="Chỉ tải lại các nguồn đang báo lỗi đỏ"
            >
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Chỉ tải nguồn lỗi ({errorCount})</span>
            </button>
          </div>

          {/* Backup, Import & Reset buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setAddCategory(existingCategories[0] || 'Tin tức & Thời sự tổng hợp');
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#00A859]" />
              <span>Thêm nguồn</span>
            </button>

            <button
              onClick={handleExport}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              title="Xuất cấu hình JSON"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              title="Nhập cấu hình từ file JSON"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => setIsResetAllConfirmOpen(true)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              title="Khôi phục toàn bộ về nguồn mặc định"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Reload by 1 Newspaper Outlet */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-[#00A859]" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Tải lại theo trang báo:
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            <select
              value={selectedOutletToReload}
              onChange={(e) => setSelectedOutletToReload(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#00A859] text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="">-- Chọn một trang báo để tải lại toàn bộ RSS --</option>
              {uniqueOutlets.map((outlet) => {
                const outletSources = sources.filter((s) => getOutletName(s.title) === outlet);
                return (
                  <option key={outlet} value={outlet}>
                    {outlet} ({outletSources.length} kênh)
                  </option>
                );
              })}
            </select>

            <button
              onClick={handleReloadSelectedOutlet}
              disabled={!selectedOutletToReload || isRefreshingAll}
              className="px-3.5 py-1.5 bg-[#00A859] hover:bg-[#008f4c] disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tải lại báo này</span>
            </button>
          </div>
        </div>

        {/* Progress Bar when refreshing all */}
        {isRefreshingAll && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              <span>
                {refreshProgress.currentLabel
                  ? `Đang kiểm tra: ${refreshProgress.currentLabel}`
                  : 'Đang kiểm tra các nguồn RSS...'}
              </span>
              <span className="tabular-nums">
                {refreshProgress.completed} / {refreshProgress.total} kênh
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00A859] transition-all duration-300"
                style={{
                  width: `${
                    refreshProgress.total > 0
                      ? (refreshProgress.completed / refreshProgress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Search, Filter Tabs & Group Mode */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Tất cả ({totalSources})
            </button>
            <button
              onClick={() => setActiveFilter('success')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                activeFilter === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              Hoạt động ({healthyCount})
            </button>
            <button
              onClick={() => setActiveFilter('error')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                activeFilter === 'error'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              Lỗi ({errorCount})
            </button>
            <button
              onClick={() => setActiveFilter('idle')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                activeFilter === 'idle'
                  ? 'bg-slate-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Chưa kiểm tra ({idleCount})
            </button>
          </div>

          {/* Group View Mode & Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium shrink-0">
              <button
                onClick={() => setGroupMode('category')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  groupMode === 'category'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Theo danh mục
              </button>
              <button
                onClick={() => setGroupMode('outlet')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  groupMode === 'outlet'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Theo báo
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên/URL..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00A859]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sources List Grouped by Category or Outlet */}
      {filteredSources.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
          <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Không có nguồn tin nào phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSources).map(([groupTitle, items]) => {
            const groupEnabled = items.filter((s) => s.enabled);
            const allEnabled = groupEnabled.length === items.length;

            const handleToggleGroup = () => {
              if (groupMode === 'outlet') {
                sourcesStore.toggleOutletSources(groupTitle, !allEnabled);
              } else {
                items.forEach((s) => sourcesStore.toggleSource(s.id, !allEnabled));
              }
            };

            const handleReloadGroup = () => {
              if (groupMode === 'outlet') {
                sourcesStore.fetchSourcesByOutlet(groupTitle, false);
              } else {
                sourcesStore.fetchMultipleSources(
                  items.filter((s) => s.enabled).map((s) => s.id),
                  groupTitle
                );
              }
            };

            return (
              <div key={groupTitle} className="space-y-3">
                {/* Section Header with Quick Actions */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    {groupMode === 'category' ? (
                      <Layers className="w-4 h-4 text-[#00A859]" />
                    ) : (
                      <Newspaper className="w-4 h-4 text-[#00A859]" />
                    )}
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      {groupTitle} ({items.length} kênh · {groupEnabled.length} đang bật)
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Bật / Tắt toàn bộ nhóm */}
                    <button
                      onClick={handleToggleGroup}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-[#00A859] font-medium"
                    >
                      {allEnabled ? 'Tắt tất cả' : 'Bật tất cả'}
                    </button>
                    <span>·</span>
                    {/* Tải lại toàn bộ RSS của nhóm/báo này */}
                    <button
                      onClick={handleReloadGroup}
                      disabled={isRefreshingAll || groupEnabled.length === 0}
                      className="inline-flex items-center gap-1 text-xs text-[#00A859] hover:underline font-bold disabled:opacity-40"
                      title={`Tải lại tất cả các kênh đang bật của ${groupTitle}`}
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Tải lại nhóm ({groupEnabled.length})</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {items.map((src) => (
                    <SourceRow
                      key={src.id}
                      source={src}
                      status={statuses[src.id]}
                      onViewErrorDetails={(source, status) =>
                        setInspectingSource({ source, status })
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Modal: Thêm nguồn mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#00A859]" />
                Thêm nguồn RSS mới
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên báo / Kênh tin <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="Ví dụ: Báo Người Lao Động - Kinh Tế"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#00A859] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Danh mục <span className="text-rose-500">*</span>
                </label>
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#00A859] text-slate-900 dark:text-white mb-2"
                >
                  {existingCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__new__">+ Tạo danh mục mới...</option>
                </select>

                {addCategory === '__new__' && (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Nhập tên danh mục mới..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#00A859] text-slate-900 dark:text-white"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  URL Feed RSS <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  value={addFeedUrl}
                  onChange={(e) => {
                    setAddFeedUrl(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="https://vnexpress.net/rss/tin-moi-nhat.rss"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#00A859] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Trang danh sách RSS của báo (tùy chọn)
                </label>
                <input
                  type="url"
                  value={addRssPage}
                  onChange={(e) => setAddRssPage(e.target.value)}
                  placeholder="https://vnexpress.net/rss"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#00A859] text-slate-900 dark:text-white"
                />
              </div>

              {/* Test Feed Button & Live Feedback */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestFeed}
                  disabled={isTestingFeed || !addFeedUrl.trim()}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingFeed ? 'animate-spin text-[#00A859]' : ''}`} />
                  <span>{isTestingFeed ? 'Đang kiểm tra kết nối...' : 'Kiểm tra thử trước khi lưu'}</span>
                </button>

                {testResult && (
                  <div
                    className={`mt-2.5 p-3 rounded-lg text-xs leading-relaxed flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>{testResult.message}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveNewSource}
                className="px-4 py-2 text-xs font-bold text-white bg-[#00A859] hover:bg-[#008f4c] rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Lưu nguồn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Xem chi tiết lỗi Proxy */}
      {inspectingSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                Chi tiết lỗi fetch: {inspectingSource.source.title}
              </h3>
              <button
                onClick={() => setInspectingSource(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-500">URL Feed hiện tại:</span>
                <p className="font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 p-2 rounded mt-1 break-all select-all">
                  {inspectingSource.source.feed_url}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-500">Kết quả thử qua từng proxy fallback:</span>
                <div className="space-y-2 mt-2">
                  {inspectingSource.status.proxyErrors && inspectingSource.status.proxyErrors.length > 0 ? (
                    inspectingSource.status.proxyErrors.map((pe, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20"
                      >
                        <div className="font-bold text-rose-700 dark:text-rose-300">
                          Proxy #{idx + 1}: {pe.proxy}
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 mt-0.5 font-mono">
                          {pe.error}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic">Không có dữ liệu lỗi chi tiết.</p>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3 rounded-lg text-amber-900 dark:text-amber-200">
                <strong>Gợi ý khắc phục:</strong> Bấm nút <em>"Trang RSS báo"</em> trên hàng để mở trang chủ RSS của báo và tìm URL feed thay thế, sau đó dán vào ô URL rồi bấm <em>"Lưu & tải lại"</em>.
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setInspectingSource(null)}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs rounded-lg cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Xác nhận khôi phục toàn bộ mặc định */}
      {isResetAllConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Khôi phục tất cả về mặc định?
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Toàn bộ URL feed đã sửa đổi và các nguồn tin tự thêm sẽ được đưa về lại danh sách nguồn gốc theo file <code>defaultSources.ts</code>.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsResetAllConfirmOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  sourcesStore.resetAllToDefault();
                  setIsResetAllConfirmOpen(false);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
              >
                Xác nhận khôi phục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
