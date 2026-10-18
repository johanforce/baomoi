import React from 'react';
import { Search, Rss, Bookmark, Sun, Moon, X } from 'lucide-react';
import { useFeedHealth } from '../hooks/useFeedHealth';
import { sourcesStore, useSourcesStore } from '../store/sourcesStore';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSourceManager: (initialFilter?: 'all' | 'error' | 'success' | 'idle') => void;
  onOpenBookmarks: () => void;
  isBookmarksOpen: boolean;
  onLogoClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenSourceManager,
  onOpenBookmarks,
  isBookmarksOpen,
  onLogoClick,
}) => {
  const { theme, bookmarks } = useSourcesStore();
  const { hasErrors, errorCount, allHealthy, loadingCount } = useFeedHealth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2 group text-left shrink-0 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-[#00A859] flex items-center justify-center text-white shadow-sm font-bold text-lg group-hover:opacity-95 transition-opacity">
            T
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
              TinTổngHợp
              <span className="w-1.5 h-1.5 rounded-full bg-[#00A859] ml-1"></span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline -mt-1">
              Báo Mới 24h
            </span>
          </div>
        </button>

        {/* Zone 2: Search Input */}
        <div className="flex-1 max-w-lg mx-2 sm:mx-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm kiếm tin tức (hỗ trợ không dấu)..."
              className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm rounded-full border border-transparent focus:border-[#00A859] focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Nút Đã lưu */}
          <button
            onClick={onOpenBookmarks}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isBookmarksOpen
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#00A859]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Bài viết đã lưu"
          >
            <Bookmark className="w-4 h-4" />
            <span className="hidden md:inline">Đã lưu</span>
            {bookmarks.length > 0 && (
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold tabular-nums">
                {bookmarks.length}
              </span>
            )}
          </button>

          {/* Nút Nguồn RSS kèm Badge tình trạng */}
          <button
            onClick={() => onOpenSourceManager(hasErrors ? 'error' : 'all')}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Quản lý nguồn RSS"
          >
            <Rss className="w-4 h-4 text-[#00A859]" />
            <span className="hidden sm:inline">Nguồn RSS</span>

            {/* Badge tình trạng */}
            {loadingCount > 0 ? (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 text-xs font-bold animate-pulse">
                ...
              </span>
            ) : hasErrors ? (
              <span className="flex items-center justify-center px-1.5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold tabular-nums shadow-xs">
                {errorCount}
              </span>
            ) : allHealthy ? (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-xs">
                ✓
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
            )}
          </button>

          {/* Nút Chế độ Tối / Sáng */}
          <button
            onClick={() => sourcesStore.toggleTheme()}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Đổi giao diện sáng/tối"
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
