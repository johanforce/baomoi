import React, { useRef } from 'react';
import { useSourcesStore } from '../store/sourcesStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryBarProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({ selectedCategory, onSelectCategory }) => {
  const { sources } = useSourcesStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lấy danh sách danh mục duy nhất từ các nguồn hiện tại
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    sources.forEach((s) => {
      if (s.categoryName) set.add(s.categoryName);
    });
    return ['Mới nhất', ...Array.from(set)];
  }, [sources]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors shadow-xs">
      <div className="w-full px-2 sm:px-6 lg:px-8 xl:px-10 relative flex items-center">
        {/* Left scroll button for desktop */}
        <button
          onClick={() => handleScroll('left')}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 absolute left-1 z-10 shadow-xs"
          aria-label="Cuộn trái"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-2.5 px-1 scroll-smooth w-full"
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`relative px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap rounded-md transition-colors shrink-0 cursor-pointer ${
                  isSelected
                    ? 'text-[#00A859] font-bold bg-emerald-50/70 dark:bg-emerald-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`}
              >
                {cat}
                {isSelected && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#00A859] rounded-full animate-in fade-in" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right scroll button for desktop */}
        <button
          onClick={() => handleScroll('right')}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 absolute right-1 z-10 shadow-xs"
          aria-label="Cuộn phải"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
