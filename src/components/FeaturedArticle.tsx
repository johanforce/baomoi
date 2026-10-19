import React, { useState } from 'react';
import { Bookmark, ExternalLink, Headphones } from 'lucide-react';
import { sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { Article } from '../types';
import { formatRelativeTimeVi } from '../utils/date';
import { decodeHtmlEntities } from '../utils/text';
import catLogo from '../assets/images/cat.jpg';

interface FeaturedArticleProps {
  article: Article;
}

export const FeaturedArticle: React.FC<FeaturedArticleProps> = ({ article }) => {
  const { readArticleIds, bookmarks } = useSourcesStore();
  const isRead = readArticleIds.has(article.id);
  const isBookmarked = bookmarks.some((b) => b.id === article.id);
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    sourcesStore.markArticleRead(article.id);
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sourcesStore.toggleBookmark(article);
  };

  const handleOpenAudio = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sourcesStore.openAudio(article);
  };

  return (
    <article className="group bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200/90 dark:border-slate-800 transition-all hover:border-[#00A859]/50 shadow-xs">
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="block"
      >
        {/* Large Image Container with 16:9 ratio */}
        <div className="relative aspect-[16/9] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          {!imageError && article.thumbnail ? (
            <img
              src={article.thumbnail}
              alt={article.title}
              onError={() => setImageError(true)}
              loading="eager"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900/10 via-slate-100 to-slate-200 dark:from-emerald-950/40 dark:via-slate-800 dark:to-slate-900 p-4 sm:p-6 text-center">
              <img
                src="/cat.jpg"
                alt="Lều Báo"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = catLogo;
                }}
                className="w-14 h-14 rounded-full shadow-sm mb-2 object-cover opacity-85"
                referrerPolicy="no-referrer"
              />
              <span className="text-xl sm:text-2xl font-extrabold text-slate-700 dark:text-slate-300">Lều Báo</span>
              <span className="text-xs text-slate-500">{article.sourceName}</span>
            </div>
          )}

          {/* Source badge overlay */}
          <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 bg-black/70 backdrop-blur-xs text-white text-[11px] sm:text-xs font-semibold px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1.5">
            <span>{article.sourceName}</span>
          </div>

          {/* Bookmark button */}
          <button
            onClick={handleBookmark}
            className={`absolute top-2.5 right-2.5 sm:top-3 sm:right-3 p-2 rounded-full backdrop-blur-xs transition-all ${
              isBookmarked
                ? 'bg-[#00A859] text-white shadow-md'
                : 'bg-black/50 text-white/90 hover:bg-black/80 hover:text-white'
            }`}
            title={isBookmarked ? 'Bỏ lưu' : 'Lưu đọc sau'}
            aria-label="Lưu bài viết"
          >
            <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>

          {/* Quick Audio Bot Button on image */}
          <button
            type="button"
            onClick={handleOpenAudio}
            className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 px-3 py-1.5 rounded-full bg-black/65 hover:bg-emerald-600 text-white backdrop-blur-md transition-all text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer hover:scale-105 active:scale-95"
            title="Nghe bot đọc bài báo này"
          >
            <Headphones className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nghe đọc</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-5">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1.5 sm:mb-2 font-medium">
            <span className="text-[#00A859] font-semibold">{article.categoryName}</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            <time>{formatRelativeTimeVi(article.pubDate)}</time>
          </div>

          <h2
            className={`text-base sm:text-xl md:text-2xl font-bold tracking-tight mb-2 sm:mb-2.5 group-hover:text-[#00A859] transition-colors leading-snug line-clamp-2 ${
              isRead ? 'text-slate-500 dark:text-slate-400 font-normal' : 'text-slate-900 dark:text-white'
            }`}
          >
            {decodeHtmlEntities(article.title)}
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mb-3 sm:mb-4">
            {decodeHtmlEntities(article.description)}
          </p>

          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{article.sourceName}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenAudio}
                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-semibold cursor-pointer"
                title="Nghe bot đọc bài báo này"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Bot đọc báo</span>
              </button>
              <span className="inline-flex items-center gap-1 text-[#00A859] font-medium group-hover:underline">
                Đọc bản gốc <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </a>
    </article>
  );
};
