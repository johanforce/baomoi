import React, { useState } from 'react';
import { Bookmark, ArrowLeft, Trash2, ExternalLink, Headphones } from 'lucide-react';
import { sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { formatRelativeTimeVi } from '../utils/date';
import { decodeHtmlEntities, removeVietnameseTones } from '../utils/text';

interface SavedArticlesViewProps {
  onBack: () => void;
}

export const SavedArticlesView: React.FC<SavedArticlesViewProps> = ({ onBack }) => {
  const { bookmarks } = useSourcesStore();
  const [filterText, setFilterText] = useState('');

  const filteredBookmarks = React.useMemo(() => {
    if (!filterText.trim()) return bookmarks;
    const clean = removeVietnameseTones(filterText.trim());
    return bookmarks.filter(
      (b) =>
        removeVietnameseTones(b.title).includes(clean) ||
        removeVietnameseTones(b.description).includes(clean) ||
        removeVietnameseTones(b.sourceName).includes(clean)
    );
  }, [bookmarks, filterText]);

  return (
    <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Quay lại đọc báo"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-[#00A859] fill-[#00A859]" />
              Bài viết đã lưu ({bookmarks.length})
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Danh sách các tin tức bạn đã đánh dấu để đọc sau (lưu trên trình duyệt)
            </p>
          </div>
        </div>

        {bookmarks.length > 0 && (
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Lọc trong bài đã lưu..."
            className="px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#00A859]"
          />
        )}
      </div>

      {/* List */}
      {bookmarks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-8">
          <Bookmark className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">
            Bạn chưa lưu bài viết nào
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Bấm vào biểu tượng bookmark trên mỗi bài viết ở trang chủ để lưu lại đọc sau.
          </p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-[#00A859] hover:bg-[#008f4c] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Khám phá tin tức ngay
          </button>
        </div>
      ) : filteredBookmarks.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          Không tìm thấy bài viết nào khớp với từ khóa "{filterText}".
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookmarks.map((art) => (
            <div
              key={art.id}
              className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-[#00A859]/40 transition-all flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <a
                  href={art.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => sourcesStore.markArticleRead(art.id)}
                  className="block text-base font-bold text-slate-900 dark:text-white hover:text-[#00A859] transition-colors line-clamp-2 mb-1"
                >
                  {decodeHtmlEntities(art.title)}
                </a>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2.5 leading-relaxed">
                  {decodeHtmlEntities(art.description)}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {art.sourceName}
                  </span>
                  <span>·</span>
                  <time>{formatRelativeTimeVi(art.pubDate)}</time>
                  <span>·</span>
                  <span>{art.categoryName}</span>
                </div>
              </div>

              {/* Actions & Thumbnail */}
              <div className="flex flex-col items-end gap-3 shrink-0">
                {art.thumbnail && (
                  <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={art.thumbnail}
                      alt={art.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => sourcesStore.openAudio(art)}
                    className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md transition-colors"
                    title="Nghe bot đọc bài viết này"
                    aria-label="Bot đọc báo"
                  >
                    <Headphones className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => sourcesStore.toggleBookmark(art)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                    title="Xóa khỏi danh sách lưu"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <a
                    href={art.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-[#00A859] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                    title="Đọc link gốc"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
