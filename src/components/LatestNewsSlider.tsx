import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Bookmark,
  ExternalLink,
  Clock,
  Pause,
  Play,
  Headphones,
} from 'lucide-react';
import { Article } from '../types';
import { formatRelativeTimeVi } from '../utils/date';
import { decodeHtmlEntities } from '../utils/text';
import { sourcesStore, useSourcesStore } from '../store/sourcesStore';
import catLogo from '../assets/images/cat.jpg';

interface LatestNewsSliderProps {
  articles: Article[];
  categoryTitle?: string;
  onLoopRestart?: () => void;
}

export const LatestNewsSlider: React.FC<LatestNewsSliderProps> = ({
  articles,
  categoryTitle,
  onLoopRestart,
}) => {
  const sliderItems = articles.slice(0, 10);
  const total = sliderItems.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  // Reset về slide đầu tiên khi đổi chuyên mục
  useEffect(() => {
    setCurrentIndex(0);
  }, [categoryTitle]);

  // Real-time drag/swipe state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const isSwiping = useRef(false);
  const dragActive = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const currentDragOffset = useRef(0);

  const { readArticleIds, bookmarks } = useSourcesStore();

  useEffect(() => {
    if (currentIndex >= total && total > 0) {
      setCurrentIndex(0);
    }
  }, [total, currentIndex]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => {
      const nextIndex = (prev + 1) % total;
      if (nextIndex === 0 && onLoopRestart) {
        onLoopRestart();
      }
      return nextIndex;
    });
  }, [total, onLoopRestart]);

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Auto-slide every 5 seconds, paused when hovering or dragging
  useEffect(() => {
    if (total <= 1 || isPaused || isDragging) return;

    const timer = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(timer);
  }, [total, isPaused, isDragging, handleNext]);

  if (total === 0) return null;

  const currentArticle = sliderItems[currentIndex];
  if (!currentArticle) return null;

  // -------------------------------------------------------------
  // Pointer & Touch gesture handlers - fully responsive over images
  // -------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary button for mouse or any touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, .no-drag')) return;

    dragActive.current = true;
    isSwiping.current = false;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    currentDragOffset.current = 0;
    setDragOffset(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragActive.current) return;

    const deltaX = e.clientX - dragStartX.current;
    const deltaY = e.clientY - dragStartY.current;

    // If initial vertical scroll detected, release to let page scroll naturally
    if (!isSwiping.current && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      dragActive.current = false;
      setIsDragging(false);
      setDragOffset(0);
      currentDragOffset.current = 0;
      return;
    }

    // Only confirm horizontal swiping when moved more than 8px
    if (Math.abs(deltaX) > 8) {
      if (!isSwiping.current) {
        isSwiping.current = true;
        setIsDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }

      // Elastic damping when pulling past the boundaries
      let effectiveDelta = deltaX;
      if ((currentIndex === 0 && deltaX > 0) || (currentIndex === total - 1 && deltaX < 0)) {
        effectiveDelta = deltaX * 0.35;
      }

      currentDragOffset.current = effectiveDelta;
      setDragOffset(effectiveDelta);
    }
  };

  const finishDrag = (e: React.PointerEvent) => {
    if (!dragActive.current) return;
    dragActive.current = false;
    const wasSwiping = isSwiping.current;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const finalOffset = currentDragOffset.current;
    setIsDragging(false);
    setDragOffset(0);
    currentDragOffset.current = 0;

    // Threshold of 35px for slide change
    if (wasSwiping) {
      if (finalOffset < -35) {
        handleNext();
      } else if (finalOffset > 35) {
        handlePrev();
      }

      // Reset swiping flag after short timeout so click doesn't trigger
      setTimeout(() => {
        isSwiping.current = false;
      }, 120);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    finishDrag(e);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    finishDrag(e);
  };

  const handleSlideLinkClick = (e: React.MouseEvent, article: Article) => {
    // If the user was swiping or dragging, ignore the click to avoid accidental navigation
    if (isSwiping.current) {
      e.preventDefault();
      return;
    }

    sourcesStore.markArticleRead(article.id);
  };

  const handleBookmarkClick = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    e.stopPropagation();
    sourcesStore.toggleBookmark(article);
  };

  const handleAudioClick = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    e.stopPropagation();
    sourcesStore.openAudio(article);
  };

  return (
    <div
      className="group/slider bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-sm transition-all mb-4 select-none touch-pan-y"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 1. Header Bar */}
      <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/70">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900 text-xs font-bold shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span className="uppercase tracking-wide font-extrabold">
              {categoryTitle && categoryTitle !== 'Mới nhất'
                ? `Top 10 · ${categoryTitle}`
                : 'Tin mới nhất'}
            </span>
          </div>

          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
            {String(currentIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>

          {isPaused}
        </div>
      </div>

      {/* 2. Interactive Swipeable Carousel Track (Works seamlessly across images and text) */}
      <div
        className="relative overflow-hidden w-full cursor-grab active:cursor-grabbing select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className="flex w-full will-change-transform"
          style={{
            transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
            transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {sliderItems.map((article, idx) => {
            const isRead = readArticleIds.has(article.id);
            const isBookmarked = bookmarks.some((b) => b.id === article.id);
            const hasImageError = imageErrorMap[article.id];

            return (
              <a
                key={article.id}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => handleSlideLinkClick(e, article)}
                className="w-full shrink-0 relative aspect-[16/9] sm:aspect-[21/9] bg-slate-100 dark:bg-slate-800 overflow-hidden group cursor-pointer block"
              >
                {/* Image layer: draggable=false, pointer-events-none ensures swiping on image works smoothly */}
                {!hasImageError && article.thumbnail ? (
                  <img
                    src={article.thumbnail}
                    alt={article.title}
                    onError={() =>
                      setImageErrorMap((prev) => ({ ...prev, [article.id]: true }))
                    }
                    loading={idx <= 1 ? 'eager' : 'lazy'}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500 pointer-events-none select-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-950/20 via-slate-800 to-slate-900 p-6 text-center pointer-events-none select-none">
                    <img
                      src="/cat.jpg"
                      alt="Lều Báo"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = catLogo;
                      }}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      className="w-14 h-14 rounded-full shadow-md mb-2 object-cover opacity-90 pointer-events-none select-none"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-xl font-black text-white/90">Lều Báo</span>
                    <span className="text-xs text-slate-400">{article.sourceName}</span>
                  </div>
                )}

                {/* Dark Gradient Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent pointer-events-none select-none" />

                {/* Top-left Badges */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-2 pointer-events-none">
                  <span className="bg-emerald-600/90 backdrop-blur-md text-white text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-md shadow-md flex items-center gap-1.5">
                    <span>{article.sourceName}</span>
                  </span>
                  <span className="bg-black/60 backdrop-blur-md text-white/90 text-[11px] sm:text-xs font-medium px-2 py-1 rounded-md hidden sm:inline-block">
                    {article.categoryName}
                  </span>
                </div>

                {/* Top-right Actions: Audio Bot & Bookmark */}
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 z-20">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => handleAudioClick(e, article)}
                    className="no-drag p-2 sm:px-3 sm:py-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer bg-black/55 text-emerald-300 hover:bg-emerald-600 hover:text-white flex items-center gap-1.5 text-xs font-bold shadow-lg active:scale-95 border border-white/10"
                    title="Nghe bot đọc bài báo này"
                    aria-label="Bot đọc báo"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Nghe đọc</span>
                  </button>

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => handleBookmarkClick(e, article)}
                    className={`no-drag p-2 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                      isBookmarked
                        ? 'bg-[#00A859] text-white shadow-lg'
                        : 'bg-black/50 text-white/90 hover:bg-black/80 hover:text-white'
                    }`}
                    title={isBookmarked ? 'Bỏ lưu bài viết' : 'Lưu đọc sau'}
                    aria-label="Lưu bài viết"
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Bottom Content overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white pointer-events-none">
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs text-white/80 mb-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <time>{formatRelativeTimeVi(article.pubDate)}</time>
                    <span>·</span>
                    <span className="text-emerald-400 font-semibold">{article.categoryName}</span>
                  </div>

                  <h2
                    className={`text-base sm:text-xl lg:text-2xl font-bold tracking-tight text-white leading-snug line-clamp-2 drop-shadow-sm group-hover:text-emerald-300 transition-colors ${
                      isRead ? 'opacity-85 font-normal' : ''
                    }`}
                  >
                    {decodeHtmlEntities(article.title)}
                  </h2>

                  {article.description && (
                    <p className="hidden sm:block text-xs sm:text-sm text-slate-200/90 line-clamp-2 mt-1.5 leading-relaxed drop-shadow-xs max-w-3xl">
                      {decodeHtmlEntities(article.description.replace(/<[^>]*>/g, '').trim())}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/10 text-[11px] sm:text-xs text-white/80">
                    <span className="font-semibold text-emerald-300">
                      {article.sourceName}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => handleAudioClick(e, article)}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer pointer-events-auto"
                        title="Nghe bot đọc bài báo này"
                      >
                        <Headphones className="w-3.5 h-3.5" />
                        <span>Nghe bot đọc</span>
                      </button>
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium group-hover:text-emerald-300 group-hover:underline">
                        Đọc bài gốc <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* 2b. Transparent Navigation Buttons (Back & Next - Visible on hover/focus) */}
        {total > 1 && (
          <>
            {/* Back Button (Left) */}
            <button
              type="button"
              className="no-drag absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-full bg-black/25 hover:bg-black/60 text-white/90 hover:text-white backdrop-blur-md border border-white/25 hover:border-white/50 shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 z-20 cursor-pointer group/btn opacity-0 -translate-x-2 pointer-events-none group-hover/slider:opacity-100 group-hover/slider:translate-x-0 group-hover/slider:pointer-events-auto group-focus-within/slider:opacity-100 group-focus-within/slider:translate-x-0 group-focus-within/slider:pointer-events-auto"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePrev();
              }}
              title="Bài trước"
              aria-label="Bài trước"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover/btn:-translate-x-0.5" />
            </button>

            {/* Next Button (Right) */}
            <button
              type="button"
              className="no-drag absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-full bg-black/25 hover:bg-black/60 text-white/90 hover:text-white backdrop-blur-md border border-white/25 hover:border-white/50 shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 z-20 cursor-pointer group/btn opacity-0 translate-x-2 pointer-events-none group-hover/slider:opacity-100 group-hover/slider:translate-x-0 group-hover/slider:pointer-events-auto group-focus-within/slider:opacity-100 group-focus-within/slider:translate-x-0 group-focus-within/slider:pointer-events-auto"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNext();
              }}
              title="Bài tiếp theo"
              aria-label="Bài tiếp theo"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover/btn:translate-x-0.5" />
            </button>
          </>
        )}
      </div>

      {/* 3. Bottom Dots Indicator Bar */}
      <div className="px-4 py-3 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto py-0.5 justify-center sm:justify-start">
          {sliderItems.map((item, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentIndex(idx)}
                className={`group relative h-2.5 rounded-full transition-all duration-300 cursor-pointer overflow-hidden ${
                  isActive
                    ? 'w-8 sm:w-10 bg-slate-200 dark:bg-slate-700'
                    : 'w-2 sm:w-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
                title={`Bài ${idx + 1}: ${item.title}`}
                aria-label={`Chuyển tới bài ${idx + 1}`}
              >
                {isActive && (
                  <div
                    key={`${item.id}-${isPaused || isDragging ? 'paused' : 'running'}`}
                    className={`h-full bg-[#00A859] rounded-full transition-all ${
                      !isPaused && !isDragging ? 'w-full duration-5000 ease-linear' : 'w-full'
                    }`}
                    style={{
                      animation:
                        !isPaused && !isDragging ? 'sliderProgress 5s linear forwards' : 'none',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
