import React, { useState } from 'react';
import { X, SlidersHorizontal, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { DateFilter } from './DateFilter';
import { getOutletName, sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { SourceItem } from '../types';

interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  selectedSourceIds: string[];
  onToggleSourceId: (sourceId: string) => void;
  onSelectAllSources: (sourceIds: string[]) => void;
  sourceCounts: Record<string, number>;
  availableDates: string[];
}

export const FilterBottomSheet: React.FC<FilterBottomSheetProps> = ({
  isOpen,
  onClose,
  selectedCategory,
  selectedDate,
  onSelectDate,
  selectedSourceIds,
  onToggleSourceId,
  onSelectAllSources,
  sourceCounts,
  availableDates,
}) => {
  const { sources, statuses, isRefreshingAll } = useSourcesStore();
  const [expandedOutlets, setExpandedOutlets] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const categorySources: SourceItem[] = sources.filter((s) => {
    if (selectedCategory === 'Mới nhất') return true;
    return s.categoryName === selectedCategory;
  });

  // Gom nhóm theo trang báo
  const outletGroups = (() => {
    const map = new Map<string, SourceItem[]>();
    categorySources.forEach((s) => {
      const outlet = getOutletName(s.title);
      if (!map.has(outlet)) map.set(outlet, []);
      map.get(outlet)!.push(s);
    });

    const groups: {
      name: string;
      sources: SourceItem[];
      totalArticles: number;
      hasError: boolean;
      allChecked: boolean;
      someChecked: boolean;
    }[] = [];

    const isNoneSelected = selectedSourceIds.includes('__NONE__');

    map.forEach((srcList, outletName) => {
      let totalArticles = 0;
      let hasError = false;
      let checkedCount = 0;

      srcList.forEach((s) => {
        totalArticles += sourceCounts[s.id] || 0;
        if (statuses[s.id]?.state === 'error') hasError = true;
        if (!isNoneSelected && (selectedSourceIds.length === 0 || selectedSourceIds.includes(s.id))) checkedCount++;
      });

      groups.push({
        name: outletName,
        sources: srcList,
        totalArticles,
        hasError,
        allChecked: checkedCount === srcList.length,
        someChecked: checkedCount > 0 && checkedCount < srcList.length,
      });
    });

    return groups.sort((a, b) => b.totalArticles - a.totalArticles || a.name.localeCompare(b.name));
  })();

  const isNoneSelected = selectedSourceIds.includes('__NONE__');
  const allCategorySourceIds = categorySources.map((s) => s.id);
  const isAllSelected =
    !isNoneSelected &&
    (selectedSourceIds.length === 0 ||
      (categorySources.length > 0 && categorySources.every((s) => selectedSourceIds.includes(s.id))));
  const isSomeSelected =
    !isNoneSelected &&
    !isAllSelected &&
    categorySources.some((s) => selectedSourceIds.includes(s.id));

  const handleToggleOutlet = (group: typeof outletGroups[0]) => {
    const groupSourceIds = group.sources.map((s) => s.id);
    if (group.allChecked) {
      const currentSelected = isNoneSelected
        ? []
        : selectedSourceIds.length === 0
        ? allCategorySourceIds
        : selectedSourceIds;
      const remaining = currentSelected.filter((id) => !groupSourceIds.includes(id));
      onSelectAllSources(remaining.length === 0 ? ['__NONE__'] : remaining);
    } else {
      const currentSelected = isNoneSelected
        ? []
        : selectedSourceIds.length === 0
        ? allCategorySourceIds
        : selectedSourceIds;
      const combined = Array.from(new Set([...currentSelected, ...groupSourceIds]));
      if (allCategorySourceIds.length > 0 && combined.length >= allCategorySourceIds.length) {
        onSelectAllSources([]);
      } else {
        onSelectAllSources(combined);
      }
    }
  };

  const handleToggleChannel = (channelId: string) => {
    const currentSelected = isNoneSelected
      ? []
      : selectedSourceIds.length === 0
      ? allCategorySourceIds
      : selectedSourceIds;
    if (currentSelected.includes(channelId)) {
      const remaining = currentSelected.filter((id) => id !== channelId);
      onSelectAllSources(remaining.length === 0 ? ['__NONE__'] : remaining);
    } else {
      const combined = [...currentSelected, channelId];
      if (allCategorySourceIds.length > 0 && combined.length >= allCategorySourceIds.length) {
        onSelectAllSources([]);
      } else {
        onSelectAllSources(combined);
      }
    }
  };

  const toggleExpand = (name: string) => {
    setExpandedOutlets((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#00A859]" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Bộ lọc ngày & trang báo
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Date Filter */}
          <DateFilter
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            availableDates={availableDates}
          />

          {/* Sources List Grouped by Outlet */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Trang báo ({outletGroups.length})
                </label>
                <span className="text-[11px] text-slate-400 block">
                  {categorySources.length} kênh RSS
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => sourcesStore.fetchAllSources(false)}
                  disabled={isRefreshingAll}
                  className="p-1 rounded text-slate-500 hover:text-[#00A859]"
                  title="Tải lại toàn bộ RSS"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin text-[#00A859]' : ''}`} />
                </button>
                <button
                  onClick={() => {
                    if (isAllSelected) onSelectAllSources(['__NONE__']);
                    else onSelectAllSources([]);
                  }}
                  className="text-xs font-semibold text-[#00A859] px-2 py-1 rounded bg-[#00A859]/10"
                >
                  {isAllSelected ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {outletGroups.map((group) => {
                const isExpanded = expandedOutlets[group.name];
                const hasMultiple = group.sources.length > 1;

                return (
                  <div
                    key={group.name}
                    className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={group.allChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = group.someChecked;
                          }}
                          onChange={() => handleToggleOutlet(group)}
                          className="w-4 h-4 rounded text-[#00A859] focus:ring-[#00A859] border-slate-300 dark:border-slate-600"
                        />
                        {hasMultiple ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(group.name)}
                            className="p-0.5 text-slate-400"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-3.5" />
                        )}
                        <span
                          onClick={() => handleToggleOutlet(group)}
                          className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate cursor-pointer"
                        >
                          {group.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-xs text-slate-400 tabular-nums">
                          {group.totalArticles} bài
                        </span>
                        <button
                          onClick={() => sourcesStore.fetchSourcesByOutlet(group.name, false)}
                          className="p-1 text-slate-400 hover:text-[#00A859]"
                          title={`Tải lại toàn bộ RSS của ${group.name}`}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && hasMultiple && (
                      <div className="mt-2 ml-7 pl-2 border-l border-slate-200 dark:border-slate-700 space-y-1.5 pt-1">
                        {group.sources.map((s) => {
                          const isChecked =
                            !isNoneSelected &&
                            (selectedSourceIds.length === 0 || selectedSourceIds.includes(s.id));
                          const channelName = s.title.includes(' - ')
                            ? s.title.split(' - ').slice(1).join(' - ')
                            : 'Trang chủ';
                          return (
                            <div key={s.id} className="flex items-center justify-between text-xs">
                              <label className="flex items-center gap-2 cursor-pointer truncate">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleChannel(s.id)}
                                  className="w-3.5 h-3.5 rounded text-[#00A859] border-slate-300"
                                />
                                <span className="truncate text-slate-600 dark:text-slate-300">
                                  {channelName}
                                </span>
                              </label>
                              <span className="text-slate-400 tabular-nums ml-1">
                                {sourceCounts[s.id] || 0}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Apply Button */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#00A859] hover:bg-[#008f4c] text-white font-bold text-sm rounded-xl shadow-xs transition-colors"
          >
            Áp dụng bộ lọc
          </button>
        </div>
      </div>
    </div>
  );
};
