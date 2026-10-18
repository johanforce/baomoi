import React, { useState } from 'react';
import { Bookmark, ExternalLink } from 'lucide-react';
import { sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { Article } from '../types';
import { formatRelativeTimeVi } from '../utils/date';

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

  return (
    <article className="group bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200/70 dark:border-slate-800 transition-all hover:border-[#00A859]/40 hover:shadow-xs">
      <div className="flex gap-4 sm:gap-5 items-start justify-between">
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
              className={`text-base sm:text-lg font-bold tracking-tight leading-snug mb-2 group-hover:text-[#00A859] transition-colors line-clamp-2 ${
                isRead
                  ? 'text-slate-400 dark:text-slate-500 font-medium'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {article.title}
            </h3>

            {article.description && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
                {article.description}
              </p>
            )}
          </a>

          {/* Metadata Row */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2 font-medium">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {article.sourceName}
              </span>
              <span aria-hidden="true">·</span>
              <time>{formatRelativeTimeVi(article.pubDate)}</time>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span className="hidden sm:inline text-slate-400 dark:text-slate-500">
                {article.categoryName}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleBookmark}
                className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                  isBookmarked ? 'text-[#00A859]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title={isBookmarked ? 'Bỏ lưu' : 'Lưu đọc sau'}
                aria-label="Lưu bài viết"
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClick}
                className="p-1.5 rounded-md text-slate-400 hover:text-[#00A859] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Mở link gốc"
                aria-label="Mở link gốc"
              >
                <ExternalLink className="w-4 h-4" />
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
          className="shrink-0 block"
        >
          <div className="w-24 h-24 sm:w-28 sm:h-24 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
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
