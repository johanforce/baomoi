import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}) => {
  if (totalCount === 0 || totalPages <= 1) {
    return (
      <div className="flex items-center justify-between py-3 px-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Hiển thị <strong>{totalCount}</strong> bài viết
        </span>
        <span className="text-slate-400 dark:text-slate-500">Trang 1 / 1</span>
      </div>
    );
  }

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (page >= totalPages - 3) {
      return [
        1,
        '...',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  const handleSelectPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange(p);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 shadow-xs mt-5 transition-colors">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Info label */}
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left">
          Hiển thị{' '}
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {startItem} - {endItem}
          </span>{' '}
          trong{' '}
          <span className="font-bold text-[#00A859]">
            {totalCount.toLocaleString('vi-VN')}
          </span>{' '}
          bài viết (15 bài / trang)
        </div>

        {/* Navigation controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
          {/* First page button */}
          <button
            onClick={() => handleSelectPage(1)}
            disabled={page === 1}
            className="p-1.5 sm:p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Về trang đầu tiên"
            aria-label="Về trang đầu tiên"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous page button */}
          <button
            onClick={() => handleSelectPage(page - 1)}
            disabled={page === 1}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Trang trước"
            aria-label="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Trước</span>
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1 text-slate-400 text-xs font-bold select-none"
                  >
                    …
                  </span>
                );
              }

              const pageNum = Number(p);
              const isActive = pageNum === page;

              return (
                <button
                  key={`page-${pageNum}`}
                  onClick={() => handleSelectPage(pageNum)}
                  className={`min-w-8 h-8 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#00A859] text-white shadow-xs scale-102 font-extrabold'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next page button */}
          <button
            onClick={() => handleSelectPage(page + 1)}
            disabled={page === totalPages}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Trang kế tiếp"
            aria-label="Trang kế tiếp"
          >
            <span className="hidden xs:inline">Sau</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last page button */}
          <button
            onClick={() => handleSelectPage(totalPages)}
            disabled={page === totalPages}
            className="p-1.5 sm:p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Đến trang cuối cùng"
            aria-label="Đến trang cuối cùng"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
