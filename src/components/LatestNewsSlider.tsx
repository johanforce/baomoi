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
} from 'lucide-react';
import { Article } from '../types';
import { formatRelativeTimeVi } from '../utils/date';
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

    setIsDragging(true);
    isSwiping.current = false;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    currentDragOffset.current = 0;
    setDragOffset(0);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX.current;
    const deltaY = e.clientY - dragStartY.current;

    // If initial vertical scroll detected, release to let page scroll naturally
    if (!isSwiping.current && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      setIsDragging(false);
      setDragOffset(0);
      currentDragOffset.current = 0;
      return;
    }

    if (Math.abs(deltaX) > 6) {
      isSwiping.current = true;
    }

    // Elastic damping when pulling past the boundaries
    let effectiveDelta = deltaX;
    if ((currentIndex === 0 && deltaX > 0) || (currentIndex === total - 1 && deltaX < 0)) {
      effectiveDelta = deltaX * 0.35;
    }

    currentDragOffset.current = effectiveDelta;
    setDragOffset(effectiveDelta);
  };

  const finishDrag = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const finalOffset = currentDragOffset.current;
    setDragOffset(0);
    currentDragOffset.current = 0;

    // Threshold of 35px for slide change
    if (finalOffset < -35) {
      handleNext();
    } else if (finalOffset > 35) {
      handlePrev();
    }

    // Reset swiping flag after short timeout so click doesn't trigger
    setTimeout(() => {
      isSwiping.current = false;
    }, 50);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    finishDrag(e);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    finishDrag(e);
  };

  const handleSlideClick = (article: Article) => {
    // If the user was swiping or dragging, ignore the click
    if (isSwiping.current) return;

    sourcesStore.markArticleRead(article.id);
    window.open(article.link, '_blank', 'noopener,noreferrer');
  };

  const handleBookmarkClick = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    e.stopPropagation();
    sourcesStore.toggleBookmark(article);
  };

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-sm transition-all mb-4 select-none touch-pan-y"
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
              <div
                key={article.id}
                onClick={() => handleSlideClick(article)}
                className="w-full shrink-0 relative aspect-[16/9] sm:aspect-[21/9] bg-slate-100 dark:bg-slate-800 overflow-hidden group cursor-pointer"
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

                {/* Bookmark Button */}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleBookmarkClick(e, article)}
                  className={`absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full backdrop-blur-md transition-all z-10 cursor-pointer ${
                    isBookmarked
                      ? 'bg-[#00A859] text-white shadow-lg'
                      : 'bg-black/50 text-white/90 hover:bg-black/80 hover:text-white'
                  }`}
                  title={isBookmarked ? 'Bỏ lưu bài viết' : 'Lưu đọc sau'}
                  aria-label="Lưu bài viết"
                >
                  <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                </button>

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
                    {article.title}
                  </h2>

                  {article.description && (
                    <p className="hidden sm:block text-xs sm:text-sm text-slate-200/90 line-clamp-2 mt-1.5 leading-relaxed drop-shadow-xs max-w-3xl">
                      {article.description.replace(/<[^>]*>/g, '').trim()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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

        <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
          <a
            href={currentArticle.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => sourcesStore.markArticleRead(currentArticle.id)}
            className="inline-flex items-center gap-1 text-[#00A859] hover:underline font-semibold"
          >
            <span>Đọc tin gốc</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
