import React, { useState, useEffect } from 'react';
import { X, Sparkles, Copy, Check, RefreshCw, Bot, Key, ShieldCheck } from 'lucide-react';
import { queryArticlesFromDB } from '../services/db';
import { getVietnamTodayString, formatFriendlyDate } from '../utils/date';
import { sourcesStore } from '../store/sourcesStore';
import { marked } from 'marked';

interface AiSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiSummaryModal: React.FC<AiSummaryModalProps> = ({ isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [summaryMarkdown, setSummaryMarkdown] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // API Key state for client
  const [isKeyConfigured, setIsKeyConfigured] = useState(true);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkApiKeyStatus();
    }
  }, [isOpen]);

  const checkApiKeyStatus = async () => {
    try {
      const res = await fetch('/api/check-api-key');
      const data = await res.json();
      setIsKeyConfigured(data.configured);
      if (!data.configured && !summaryMarkdown && !isLoading) {
        setShowKeyInput(true);
      } else if (data.configured && !summaryMarkdown && !isLoading) {
        handleGenerateSummary();
      }
    } catch {
      // ignore
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setIsSavingKey(true);
    try {
      const res = await fetch('/api/set-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu API Key');
      }
      setIsKeyConfigured(true);
      setShowKeyInput(false);
      setApiKeyInput('');
      sourcesStore.addToast('success', 'Đã lưu API Key của khách thành công và bảo mật!');
      handleGenerateSummary();
    } catch (err: any) {
      sourcesStore.addToast('error', err?.message || 'Lỗi khi lưu API Key');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const todayStr = getVietnamTodayString();
      const { articles } = await queryArticlesFromDB({ limit: 100 });

      if (!articles || articles.length === 0) {
        setErrorMsg('Chưa có bài viết nào trong dữ liệu để tổng hợp. Hãy tải thêm tin tức từ các nguồn RSS trước.');
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles,
          dateStr: formatFriendlyDate(todayStr),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && (data.error?.includes('API_KEY') || data.error?.includes('GEMINI_API_KEY'))) {
          setIsKeyConfigured(false);
          setShowKeyInput(true);
        }
        throw new Error(data.error || 'Lỗi kết nối đến máy chủ AI');
      }

      setSummaryMarkdown(data.summary);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tạo bản tin tổng hợp lúc này.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summaryMarkdown) return;
    navigator.clipboard.writeText(summaryMarkdown);
    setCopied(true);
    sourcesStore.addToast('success', 'Đã sao chép bản tin tổng hợp vào clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  // Render markdown to HTML with target="_blank" on links
  const renderedHtml = summaryMarkdown
    ? marked.parse(summaryMarkdown).toString().replace(
        /<a /g,
        '<a target="_blank" rel="noopener noreferrer" class="text-[#00A859] font-semibold hover:underline decoration-2 underline-offset-2" '
      )
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-[#00A859] flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Bản Tin Tổng Hợp Ngày Bằng AI
                <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-[#00A859] px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Gemini AI
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tóm tắt chi tiết, làm nổi bật thông tin trọng tâm, đọc trong 3-5 phút
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cài đặt API Key của khách"
            >
              <Key className="w-3.5 h-3.5 text-[#00A859]" />
              <span className="hidden sm:inline">API Key</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API Key Configuration Banner */}
        {showKeyInput && (
          <div className="bg-emerald-50/90 dark:bg-emerald-950/40 p-4 border-b border-emerald-200 dark:border-emerald-900/50 px-5 space-y-3 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-[#00A859]" />
                <span>Cấu hình Gemini API Key bảo mật cho khách</span>
              </div>
              <button
                onClick={() => setShowKeyInput(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                Đóng
              </button>
            </div>
            <form onSubmit={handleSaveApiKey} className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Dán Gemini API Key của khách vào đây (bảo mật tuyệt đối trên server)..."
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs rounded-lg border border-emerald-300 dark:border-emerald-800 focus:outline-none focus:ring-2 focus:ring-[#00A859]"
              />
              <button
                type="submit"
                disabled={isSavingKey || !apiKeyInput.trim()}
                className="px-4 py-2 bg-[#00A859] hover:bg-[#008f4c] text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingKey ? 'Đang lưu...' : 'Lưu & Bảo mật Key'}
              </button>
            </form>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              Key được bảo mật hoàn toàn trên server nội bộ, không bao giờ bị lộ ra ngoài trình duyệt.
            </p>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-[#00A859] animate-spin"></div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Tổng biên tập AI đang phân tích và tổng hợp bản tin chi tiết...
                </p>
                <p className="text-xs text-slate-400">
                  Đang lọc tin quan trọng, làm nổi bật số liệu và trích xuất nguồn tin chuẩn xác. Vui lòng đợi trong giây lát.
                </p>
              </div>
            </div>
          ) : errorMsg ? (
            <div className="py-16 text-center space-y-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/50 p-6">
              <Bot className="w-10 h-10 text-rose-500 mx-auto" />
              <h4 className="text-base font-bold text-rose-700 dark:text-rose-300">Không thể tạo bản tin</h4>
              <p className="text-xs text-rose-600/80 dark:text-rose-400 max-w-md mx-auto">{errorMsg}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" /> Nhập API Key của khách
                </button>
                <button
                  onClick={handleGenerateSummary}
                  className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Thử lại
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 space-y-4">
              <div
                className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed text-sm sm:text-base font-serif space-y-4 selection:bg-[#00A859]/20"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-400">
            {summaryMarkdown && !isLoading && 'Bản tin chi tiết hoàn tất · Click vào link nguồn để mở bài viết gốc'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateSummary}
              disabled={isLoading}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Tạo lại bản tin</span>
            </button>
            <button
              onClick={handleCopy}
              disabled={isLoading || !summaryMarkdown}
              className="px-4 py-2 bg-[#00A859] hover:bg-[#008f4c] text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép Markdown'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
