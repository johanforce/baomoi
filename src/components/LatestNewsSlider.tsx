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
  onLoopRestart?: () => void;
}

export const LatestNewsSlider: React.FC<LatestNewsSliderProps> = ({
  articles,
  onLoopRestart,
}) => {
  const sliderItems = articles.slice(0, 10);
  const total = sliderItems.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

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

  // Auto-slide every 5 seconds (5000ms), paused on hover
  useEffect(() => {
    if (total <= 1 || isPaused) return;

    const timer = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(timer);
  }, [total, isPaused, handleNext]);

  if (total === 0) return null;

  const currentArticle = sliderItems[currentIndex];
  if (!currentArticle) return null;

  const isRead = readArticleIds.has(currentArticle.id);
  const isBookmarked = bookmarks.some((b) => b.id === currentArticle.id);
  const hasImageError = imageErrorMap[currentArticle.id];

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sourcesStore.toggleBookmark(currentArticle);
  };

  const handleArticleClick = () => {
    sourcesStore.markArticleRead(currentArticle.id);
  };

  // Touch & Mouse drag swipe support
  const isDragging = useRef<boolean>(false);
  const dragStartX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 40) {
      handleNext();
    } else if (diff < -40) {
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = dragStartX.current - e.clientX;
    if (diff > 40) {
      handleNext();
    } else if (diff < -40) {
      handlePrev();
    }
  };

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-sm transition-all mb-4 select-none cursor-grab active:cursor-grabbing"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        setIsPaused(false);
        if (isDragging.current) isDragging.current = false;
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* 1. Header Bar */}
      <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/70">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900 text-xs font-bold shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span className="uppercase tracking-wide">Tin mới nhất</span>
          </div>

          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
            {String(currentIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>

          {isPaused && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
              <Pause className="w-3 h-3" /> Tạm dừng
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsPaused((prev) => !prev)}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isPaused ? 'Tiếp tục tự động lướt' : 'Tạm dừng tự động lướt'}
            aria-label="Tự động lướt"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handlePrev}
            disabled={total <= 1}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-white hover:bg-[#00A859] rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#00A859] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Tin trước đó"
            aria-label="Tin trước đó"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={handleNext}
            disabled={total <= 1}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-white hover:bg-[#00A859] rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#00A859] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Tin tiếp theo"
            aria-label="Tin tiếp theo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Main Slide View Pager Content */}
      <div className="relative group">
        <a
          href={currentArticle.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleArticleClick}
          className="block"
        >
          <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            {!hasImageError && currentArticle.thumbnail ? (
              <img
                key={currentArticle.id}
                src={currentArticle.thumbnail}
                alt={currentArticle.title}
                onError={() =>
                  setImageErrorMap((prev) => ({ ...prev, [currentArticle.id]: true }))
                }
                loading="eager"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-950/20 via-slate-800 to-slate-900 p-6 text-center">
                <img
                  src="/cat.jpg"
                  alt="Lều Báo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = catLogo;
                  }}
                  className="w-14 h-14 rounded-full shadow-md mb-2 object-cover opacity-90"
                  referrerPolicy="no-referrer"
                />
                <span className="text-xl font-black text-white/90">Lều Báo</span>
                <span className="text-xs text-slate-400">{currentArticle.sourceName}</span>
              </div>
            )}

            {/* Gradient Scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent pointer-events-none" />

            {/* Top-left Badges */}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-2">
              <span className="bg-emerald-600/90 backdrop-blur-md text-white text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-md shadow-md flex items-center gap-1.5">
                <span>{currentArticle.sourceName}</span>
              </span>
              <span className="bg-black/60 backdrop-blur-md text-white/90 text-[11px] sm:text-xs font-medium px-2 py-1 rounded-md hidden sm:inline-block">
                {currentArticle.categoryName}
              </span>
            </div>

            {/* Bookmark */}
            <button
              onClick={handleBookmark}
              className={`absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full backdrop-blur-md transition-all z-10 ${
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
                <time>{formatRelativeTimeVi(currentArticle.pubDate)}</time>
                <span>·</span>
                <span className="text-emerald-400 font-semibold">{currentArticle.categoryName}</span>
              </div>

              <h2
                className={`text-base sm:text-xl lg:text-2xl font-bold tracking-tight text-white leading-snug line-clamp-2 drop-shadow-sm group-hover:text-emerald-300 transition-colors ${
                  isRead ? 'opacity-85 font-normal' : ''
                }`}
              >
                {currentArticle.title}
              </h2>

              {currentArticle.description && (
                <p className="hidden sm:block text-xs sm:text-sm text-slate-200/90 line-clamp-2 mt-1.5 leading-relaxed drop-shadow-xs max-w-3xl">
                  {currentArticle.description.replace(/<[^>]*>/g, '').trim()}
                </p>
              )}
            </div>
          </div>
        </a>
      </div>

      {/* 3. Bottom View Pager Dots (10 items) with 5s countdown animation */}
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
                    key={`${item.id}-${isPaused ? 'paused' : 'running'}`}
                    className={`h-full bg-[#00A859] rounded-full transition-all ${
                      !isPaused ? 'w-full duration-5000 ease-linear' : 'w-full'
                    }`}
                    style={{
                      animation: !isPaused ? 'sliderProgress 5s linear forwards' : 'none',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
          <span className="hidden md:inline">Tự động lướt sau 5 giây</span>
          <a
            href={currentArticle.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleArticleClick}
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
