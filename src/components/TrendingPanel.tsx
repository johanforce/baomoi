import React, { useState, useEffect } from 'react';
import { Flame, BarChart3, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [sidebarMode, setSidebarMode] = useState<'slide' | 'list'>('slide');
  const [slideIndex, setSlideIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-slide every 5s, loops from 10 back to 0
  useEffect(() => {
    if (sidebarMode !== 'slide' || topArticles.length <= 1 || isHovered) return;

    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % topArticles.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [sidebarMode, topArticles.length, isHovered]);

  // Reset slideIndex if list shrinks
  useEffect(() => {
    if (slideIndex >= topArticles.length && topArticles.length > 0) {
      setSlideIndex(0);
    }
  }, [topArticles.length, slideIndex]);

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
      {/* Block 1: Tin mới nhất (Hỗ trợ Slide View Pager & Danh sách) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Tin mới cập nhật
            </h3>
          </div>

          {topArticles.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
              <button
                onClick={() => setSidebarMode('slide')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  sidebarMode === 'slide'
                    ? 'bg-white dark:bg-slate-700 text-[#00A859] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Dạng trình chiếu tự động 5s"
              >
                Slide
              </button>
              <button
                onClick={() => setSidebarMode('list')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  sidebarMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-[#00A859] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Dạng danh sách 10 tin"
              >
                Danh sách
              </button>
            </div>
          )}
        </div>

        {topArticles.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Chưa có bài viết mới cập nhật.</p>
        ) : sidebarMode === 'slide' ? (
          /* Slide View Pager in Sidebar (10 items, auto-advance 5s, loops) */
          <div
            className="space-y-3"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {(() => {
              const currentArt = topArticles[slideIndex] || topArticles[0];
              const numStr = String(slideIndex + 1).padStart(2, '0');
              const totalStr = String(topArticles.length).padStart(2, '0');

              return (
                <div>
                  {/* Image & Source Badge */}
                  <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2.5">
                    {currentArt.thumbnail ? (
                      <img
                        key={currentArt.id}
                        src={currentArt.thumbnail}
                        alt={currentArt.title}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-950/20 to-slate-800 text-white font-bold text-sm">
                        <span>{currentArt.sourceName}</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      {currentArt.sourceName}
                    </div>
                    <div className="absolute top-2 right-2 bg-[#00A859] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                      {numStr} / {totalStr}
                    </div>
                  </div>

                  {/* Title & metadata */}
                  <a
                    href={currentArt.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sourcesStore.markArticleRead(currentArt.id)}
                    className="block text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-[#00A859] transition-colors line-clamp-2 leading-snug mb-1"
                  >
                    {currentArt.title}
                  </a>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                    <span>{formatRelativeTimeVi(currentArt.pubDate)}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Tự động lướt 5s
                    </span>
                  </div>

                  {/* Controls & Pager Track */}
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1 overflow-x-auto max-w-[170px] py-1">
                      {topArticles.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setSlideIndex(i)}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${
                            i === slideIndex
                              ? 'w-4 bg-[#00A859]'
                              : 'w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'
                          }`}
                          title={`Bài ${i + 1}`}
                          aria-label={`Bài ${i + 1}`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setSlideIndex((prev) => (prev - 1 + topArticles.length) % topArticles.length)
                        }
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Bài trước"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setSlideIndex((prev) => (prev + 1) % topArticles.length)
                        }
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Bài tiếp theo"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* List Mode */
          <div className="space-y-3.5">
            {topArticles.map((art, index) => {
              const numStr = String(index + 1).padStart(2, '0');
              const isTop3 = index < 3;

              return (
                <div key={art.id} className="group flex items-start gap-3">
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
