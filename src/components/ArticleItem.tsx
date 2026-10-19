import React, { useState } from 'react';
import { Bookmark, ExternalLink, Headphones } from 'lucide-react';
import { sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { Article } from '../types';
import { formatRelativeTimeVi } from '../utils/date';
import { decodeHtmlEntities } from '../utils/text';

interface ArticleItemProps {
  article: Article;
}

export const ArticleItem: React.FC<ArticleItemProps> = ({ article }) => {
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
    <article className="group bg-white dark:bg-slate-900 p-3 sm:p-4 md:p-5 rounded-xl border border-slate-200/70 dark:border-slate-800 transition-all hover:border-[#00A859]/40 hover:shadow-xs active:bg-slate-50/50 dark:active:bg-slate-800/40">
      <div className="flex gap-3 sm:gap-4 md:gap-5 items-start justify-between">
        {/* Left: Text Content */}
        <div className="flex-1 min-w-0">
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="block"
          >
            <h3
              className={`text-sm sm:text-base md:text-lg font-bold tracking-tight leading-snug mb-1.5 sm:mb-2 group-hover:text-[#00A859] transition-colors line-clamp-2 ${
                isRead
                  ? 'text-slate-400 dark:text-slate-500 font-medium'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {decodeHtmlEntities(article.title)}
            </h3>

            {article.description && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2 sm:mb-3">
                {decodeHtmlEntities(article.description)}
              </p>
            )}
          </a>

          {/* Metadata Row */}
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 gap-1 pt-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2 font-medium min-w-0 truncate">
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[100px] xs:max-w-[130px] sm:max-w-none">
                {article.sourceName}
              </span>
              <span aria-hidden="true" className="shrink-0 text-slate-300 dark:text-slate-600">·</span>
              <time className="shrink-0">{formatRelativeTimeVi(article.pubDate)}</time>
              <span aria-hidden="true" className="hidden sm:inline text-slate-300 dark:text-slate-600">·</span>
              <span className="hidden sm:inline text-slate-400 dark:text-slate-500 truncate">
                {article.categoryName}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleOpenAudio}
                className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 transition-colors active:scale-95 text-[11px] sm:text-xs font-semibold cursor-pointer"
                title="Nghe bot đọc bài báo này"
                aria-label="Bot đọc báo"
              >
                <Headphones className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xs:inline">Đọc báo</span>
              </button>

              <button
                onClick={handleBookmark}
                className={`p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 ${
                  isBookmarked ? 'text-[#00A859]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title={isBookmarked ? 'Bỏ lưu' : 'Lưu đọc sau'}
                aria-label="Lưu bài viết"
              >
                <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClick}
                className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-[#00A859] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                title="Mở link gốc"
                aria-label="Mở link gốc"
              >
                <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Right: Square Thumbnail */}
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="shrink-0 block self-start"
        >
          <div className="w-20 h-20 sm:w-28 sm:h-24 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
            {!imageError && article.thumbnail ? (
              <img
                src={article.thumbnail}
                alt={article.title}
                onError={() => setImageError(true)}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-400 p-1 text-center font-semibold">
                <span>{article.sourceName}</span>
              </div>
            )}
          </div>
        </a>
      </div>
    </article>
  );
};
