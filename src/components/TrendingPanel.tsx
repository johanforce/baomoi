import React from 'react';
import { Flame, BarChart3, ExternalLink } from 'lucide-react';
import { sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { Article } from '../types';
import { formatRelativeTimeVi } from '../utils/date';

interface TrendingPanelProps {
  topArticles: Article[];
  sourceCounts: Record<string, number>;
  onSelectSource?: (sourceId: string) => void;
}

export const TrendingPanel: React.FC<TrendingPanelProps> = ({
  topArticles,
  sourceCounts,
  onSelectSource,
}) => {
  const { sources } = useSourcesStore();

  // Danh sách các báo có bài và sắp xếp theo số bài giảm dần
  const sortedSources = React.useMemo(() => {
    return sources
      .filter((s) => s.enabled)
      .map((s) => ({
        ...s,
        count: sourceCounts[s.id] || 0,
      }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [sources, sourceCounts]);

  const maxCount = sortedSources.length > 0 ? sortedSources[0].count : 1;

  return (
    <aside className="space-y-6">
      {/* Block 1: Tin mới cập nhật */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
            Tin mới cập nhật
          </h3>
        </div>

        {topArticles.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Chưa có bài viết mới cập nhật.</p>
        ) : (
          <div className="space-y-3.5">
            {topArticles.map((art, index) => {
              const numStr = String(index + 1).padStart(2, '0');
              const isTop3 = index < 3;

              return (
                <div key={art.id} className="group flex items-start gap-3">
                  {/* Số thứ tự 01, 02... */}
                  <span
                    className={`text-sm font-black tabular-nums shrink-0 mt-0.5 ${
                      isTop3
                        ? 'text-[#00A859]'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  >
                    {numStr}
                  </span>

                  <div className="flex-1 min-w-0">
                    <a
                      href={art.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => sourcesStore.markArticleRead(art.id)}
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#00A859] transition-colors line-clamp-2 leading-snug"
                    >
                      {art.title}
                    </a>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                      <span>{art.sourceName}</span>
                      <span>·</span>
                      <span>{formatRelativeTimeVi(art.pubDate)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Block 2: Thống kê số bài theo từng báo */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <BarChart3 className="w-4 h-4 text-[#00A859]" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
            Thống kê nguồn tin
          </h3>
        </div>

        {sortedSources.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Chưa có dữ liệu thống kê bài viết.</p>
        ) : (
          <div className="space-y-2.5">
            {sortedSources.map((s) => {
              const percentage = Math.round((s.count / maxCount) * 100);

              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSource && onSelectSource(s.id)}
                  className="group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-[#00A859] transition-colors truncate">
                      {s.title}
                    </span>
                    <span className="font-bold tabular-nums text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                      {s.count} bài
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00A859]/80 rounded-full group-hover:bg-[#00A859] transition-all"
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
