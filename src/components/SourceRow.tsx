import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Save,
  ExternalLink,
  RotateCcw,
  Trash2,
  AlertCircle,
  HelpCircle,
  Check,
} from 'lucide-react';
import { StatusDot } from './StatusDot';
import { sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { FeedStatus, SourceItem } from '../types';
import { formatRelativeTimeVi } from '../utils/date';
import { isValidFeedUrl } from '../utils/url';

interface SourceRowProps {
  source: SourceItem;
  status?: FeedStatus;
  onViewErrorDetails: (source: SourceItem, status: FeedStatus) => void;
}

export const SourceRow: React.FC<SourceRowProps> = ({
  source,
  status,
  onViewErrorDetails,
}) => {
  const [urlInput, setUrlInput] = useState(source.feed_url);
  const [isUrlDirty, setIsUrlDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setUrlInput(source.feed_url);
    setIsUrlDirty(false);
  }, [source.feed_url]);

  const handleUrlChange = (newVal: string) => {
    setUrlInput(newVal);
    setIsUrlDirty(newVal.trim() !== source.feed_url.trim());
  };

  const handleSaveAndReload = async () => {
    const trimmed = urlInput.trim();
    if (!isValidFeedUrl(trimmed)) {
      sourcesStore.addToast('error', 'URL không hợp lệ. Phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    sourcesStore.updateSourceUrl(source.id, trimmed);
    setIsUrlDirty(false);
    await sourcesStore.fetchSingleSource(source.id);
  };

  const handleReload = async () => {
    await sourcesStore.fetchSingleSource(source.id);
  };

  const handleReset = () => {
    sourcesStore.resetSourceToDefault(source.id);
    setUrlInput(source.defaultFeedUrl);
    setIsUrlDirty(false);
  };

  const currentState = status?.state || 'idle';
  const isLoading = currentState === 'loading';
  const isModified = source.feed_url !== source.defaultFeedUrl;

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        !source.enabled
          ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-60'
          : currentState === 'error'
          ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/60'
          : currentState === 'success'
          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left info: Status, Title, Category */}
        <div className="flex items-start gap-3 min-w-0 lg:w-1/3">
          {/* Toggle enable checkbox */}
          <div className="pt-0.5">
            <input
              type="checkbox"
              checked={source.enabled}
              onChange={(e) => sourcesStore.toggleSource(source.id, e.target.checked)}
              className="w-4 h-4 rounded text-[#00A859] focus:ring-[#00A859] border-slate-300 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"
              title={source.enabled ? 'Đang bật - Bấm để tạm ngưng' : 'Đang tắt - Bấm để bật lại'}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                {source.title}
              </span>
              <StatusDot state={currentState} showLabel={true} />
              {isModified && (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  Đã tùy biến
                </span>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span>{source.categoryName}</span>
              {source.rss_page && (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    href={source.rss_page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00A859] hover:underline inline-flex items-center gap-0.5"
                    title="Mở trang danh sách RSS chính thức của báo để tìm link feed mới"
                  >
                    Trang RSS báo <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Editable URL input */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://domain.com/rss/..."
                className={`w-full px-3 py-1.5 text-xs font-mono rounded-lg border focus:outline-none transition-colors ${
                  isUrlDirty
                    ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:border-[#00A859]'
                }`}
              />
            </div>

            {/* Nút "Lưu & tải lại" khi có thay đổi */}
            {isUrlDirty ? (
              <button
                onClick={handleSaveAndReload}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#00A859] hover:bg-[#008f4c] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0 animate-in fade-in"
                title="Lưu URL mới và tải lại dữ liệu"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu & tải lại</span>
              </button>
            ) : (
              <button
                onClick={handleReload}
                disabled={isLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors shrink-0"
                title="Tải lại nguồn này"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#00A859]' : ''}`} />
                <span className="hidden sm:inline">Tải lại</span>
              </button>
            )}

            {/* Mở feed xem trực tiếp */}
            <a
              href={source.feed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              title="Mở feed trong tab mới để kiểm tra cấu trúc XML"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Metrics & Error Reason line */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {currentState === 'success' && (
              <>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                  ✓ {status?.articleCount || 0} bài
                </span>
                <span>·</span>
                <span className="tabular-nums">{status?.latencyMs}ms</span>
                <span>·</span>
                <span className="text-slate-500">proxy: {status?.proxyUsed || 'trực tiếp'}</span>
                <span>·</span>
                <span>{status?.lastChecked ? formatRelativeTimeVi(status.lastChecked) : ''}</span>
              </>
            )}

            {currentState === 'error' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {status?.errorReason || 'Fetch thất bại'}
                </span>
                {status?.proxyErrors && status.proxyErrors.length > 0 && (
                  <button
                    onClick={() => onViewErrorDetails(source, status)}
                    className="text-xs text-rose-700 dark:text-rose-300 underline font-medium hover:text-rose-900 cursor-pointer"
                  >
                    Xem chi tiết lỗi proxy
                  </button>
                )}
                <span>·</span>
                <span>{status?.lastChecked ? formatRelativeTimeVi(status.lastChecked) : ''}</span>
              </div>
            )}

            {currentState === 'idle' && (
              <span className="text-slate-400 italic">Chưa kiểm tra (bấm Tải lại để nạp tin)</span>
            )}
          </div>
        </div>

        {/* Right actions: Reset default, Delete */}
        <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-center">
          {/* Khôi phục mặc định nếu đã sửa */}
          {isModified && (
            <button
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
              title="Khôi phục URL gốc mặc định"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Xóa nguồn */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 p-1 rounded-lg border border-rose-200 dark:border-rose-800">
              <span className="text-[11px] text-rose-700 dark:text-rose-300 font-medium px-1">
                Xóa?
              </span>
              <button
                onClick={() => sourcesStore.deleteSource(source.id)}
                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded transition-colors"
              >
                Có
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium rounded transition-colors"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
              title="Xóa nguồn này"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
