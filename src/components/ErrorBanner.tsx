import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface ErrorBannerProps {
  errorCount: number;
  onOpenSourceManager: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ errorCount, onOpenSourceManager }) => {
  if (errorCount <= 0) return null;

  return (
    <div className="mb-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-amber-900 dark:text-amber-200 shadow-xs">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          <strong className="font-semibold">{errorCount} nguồn</strong> đang gặp sự cố khi tải tin tức.
        </span>
      </div>
      <button
        onClick={onOpenSourceManager}
        className="inline-flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 hover:underline shrink-0 ml-3 cursor-pointer"
      >
        <span>Quản lý nguồn RSS</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
