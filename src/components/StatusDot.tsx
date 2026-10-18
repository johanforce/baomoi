import React from 'react';
import { FeedState } from '../types';

interface StatusDotProps {
  state: FeedState;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const StatusDot: React.FC<StatusDotProps> = ({ state, showLabel = false, size = 'sm' }) => {
  const dotSizeClass = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  if (state === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
        <svg
          className={`animate-spin ${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-500`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        {showLabel && <span>Đang tải...</span>}
      </span>
    );
  }

  if (state === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
        <span className={`${dotSizeClass} rounded-full bg-emerald-500 shrink-0`}></span>
        {showLabel && <span>✓ Hoạt động</span>}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
        <span className={`${dotSizeClass} rounded-full bg-rose-500 shrink-0`}></span>
        {showLabel && <span>✕ Lỗi</span>}
      </span>
    );
  }

  // idle
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
      <span className={`${dotSizeClass} rounded-full bg-slate-300 dark:bg-slate-600 shrink-0`}></span>
      {showLabel && <span>Chưa kiểm tra</span>}
    </span>
  );
};
