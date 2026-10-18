import React from 'react';

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-4">
      {/* Featured Skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 animate-pulse">
        <div className="aspect-[16/9] w-full bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-4/5"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
      </div>

      {/* Row Skeletons */}
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-4 animate-pulse"
        >
          <div className="flex-1 space-y-2.5">
            <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-11/12"></div>
            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/4 pt-1"></div>
          </div>
          <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-lg shrink-0"></div>
        </div>
      ))}
    </div>
  );
};
