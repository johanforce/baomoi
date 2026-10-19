import React from 'react';
import {
  Newspaper,
  Rss,
  Bot,
  Bookmark,
  ArrowUp,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Layers,
  Heart,
} from 'lucide-react';
import catLogo from '../assets/images/cat.jpg';

interface FooterProps {
  onSelectCategory?: (category: string) => void;
  onOpenBookmarks?: () => void;
  onOpenSourceManager?: () => void;
  onOpenAiSummary?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectCategory,
  onOpenBookmarks,
  onOpenSourceManager,
  onOpenAiSummary,
}) => {

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryClick = (cat: string) => {
    if (onSelectCategory) {
      onSelectCategory(cat);
      scrollToTop();
    }
  };

  const popularCategories = [
    'Thời sự',
    'Thế giới',
    'Kinh doanh',
    'Công nghệ',
    'Thể thao',
    'Giải trí',
    'Đời sống',
    'Sức khỏe',
    'Pháp luật',
    'Xe',
  ];

  const uniqueOutlets = [
    { name: 'VnExpress', url: 'https://vnexpress.net' },
    { name: 'Tuổi Trẻ', url: 'https://tuoitre.vn' },
    { name: 'Thanh Niên', url: 'https://thanhnien.vn' },
    { name: 'Dân Trí', url: 'https://dantri.com.vn' },
    { name: 'VietnamNet', url: 'https://vietnamnet.vn' },
    { name: 'Lao Động', url: 'https://laodong.vn' },
    { name: 'Tiền Phong', url: 'https://tienphong.vn' },
    { name: 'VTC News', url: 'https://vtcnews.vn' },
    { name: 'Sài Gòn GP', url: 'https://www.sggp.org.vn' },
    { name: 'Người Lao Động', url: 'https://nld.com.vn' },
  ];

  return (
    <footer className="mt-12 bg-white dark:bg-slate-950 border-t border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-400 transition-colors">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Brand Column (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={scrollToTop}>
              <img
                src="/cat.jpg"
                alt="Lều Báo"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = catLogo;
                }}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00A859] shadow-sm"
              />
              <div>
                <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1">
                  Lều Báo <span className="text-[#00A859]">.vn</span>
                </span>
                <p className="text-[11px] text-slate-500 font-medium">
                  Tin tức tổng hợp & Cập nhật đa nguồn 24/7
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-2">
              Nền tảng đọc báo thông minh tổng hợp tin tức tự động từ các cơ quan báo chí chính
              thống uy tín hàng đầu Việt Nam. Tối ưu trải nghiệm đọc nhanh, không quảng cáo rác,
              tích hợp tóm tắt AI thông minh và đồng bộ liên tục 10 phút/lần.
            </p>

            {/* Quick feature highlights */}
            <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-[#00A859] rounded-md border border-emerald-200/60 dark:border-emerald-900/40">
                <RefreshCw className="w-3 h-3" /> Tự động RSS 10m
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-md border border-purple-200/60 dark:border-purple-900/40">
                <Sparkles className="w-3 h-3" /> AI Tóm tắt
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md border border-blue-200/60 dark:border-blue-900/40">
                <ShieldCheck className="w-3 h-3" /> 100% Nguồn chính thống
              </span>
            </div>
          </div>

          {/* Categories Column (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00A859]" />
              <span>Chuyên mục chính</span>
            </h4>
            <ul className="grid grid-cols-2 gap-2 text-xs">
              {popularCategories.map((cat) => (
                <li key={cat}>
                  <button
                    onClick={() => handleCategoryClick(cat)}
                    className="hover:text-[#00A859] transition-colors text-slate-600 dark:text-slate-400 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                    <span>{cat}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Sources Column (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-[#00A859]" />
              <span>Báo chí liên kết</span>
            </h4>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {uniqueOutlets.map(({ name, url }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#00A859] transition-colors text-slate-600 dark:text-slate-400 inline-flex items-center gap-1 truncate"
                  title={`Truy cập trang gốc ${name}`}
                >
                  <span className="truncate">{name}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Actions Column (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Rss className="w-4 h-4 text-[#00A859]" />
              <span>Tiện ích</span>
            </h4>
            <ul className="space-y-2 text-xs">
              {onOpenAiSummary && (
                <li>
                  <button
                    onClick={onOpenAiSummary}
                    className="flex items-center gap-1.5 hover:text-[#00A859] transition-colors cursor-pointer text-slate-600 dark:text-slate-400"
                  >
                    <Bot className="w-3.5 h-3.5 text-purple-500" />
                    <span>AI Tóm tắt tin</span>
                  </button>
                </li>
              )}
              {onOpenBookmarks && (
                <li>
                  <button
                    onClick={onOpenBookmarks}
                    className="flex items-center gap-1.5 hover:text-[#00A859] transition-colors cursor-pointer text-slate-600 dark:text-slate-400"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                    <span>Tin đã lưu đọc sau</span>
                  </button>
                </li>
              )}
              {onOpenSourceManager && (
                <li>
                  <button
                    onClick={onOpenSourceManager}
                    className="flex items-center gap-1.5 hover:text-[#00A859] transition-colors cursor-pointer text-slate-600 dark:text-slate-400"
                  >
                    <Rss className="w-3.5 h-3.5 text-[#00A859]" />
                    <span>Quản lý nguồn tin</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Legal & Back to Top Bar */}
      <div className="border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="text-center sm:text-left space-y-1">
            <p className="font-medium text-slate-700 dark:text-slate-300">
              © {new Date().getFullYear()} Lều Báo. Toàn bộ bản quyền nội dung và hình ảnh bài viết thuộc về các cơ quan báo chí phát hành gốc.
            </p>
            <p className="text-[11px] text-slate-400">
              Trang web vận hành phi thương mại phục vụ tổng hợp thông tin và luôn điều hướng bạn đọc về nguồn báo gốc.
            </p>
          </div>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            title="Cuộn lên đầu trang"
            aria-label="Cuộn lên đầu trang"
          >
            <span>Lên đầu trang</span>
            <ArrowUp className="w-3.5 h-3.5 text-[#00A859]" />
          </button>
        </div>
      </div>
    </footer>
  );
};
