import React, { useState } from 'react';
import { DateFilter } from './DateFilter';
import { getOutletName, sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { SourceItem } from '../types';
import { RefreshCw, ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react';

interface SourceSidebarProps {
  selectedCategory: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  selectedSourceIds: string[];
  onToggleSourceId: (sourceId: string) => void;
  onSelectOnlySourceId: (sourceId: string) => void;
  onSelectAllSources: (sourceIds: string[]) => void;
  sourceCounts: Record<string, number>;
  availableDates: string[];
}

interface OutletGroup {
  name: string;
  sources: SourceItem[];
  totalArticles: number;
  hasError: boolean;
  isLoading: boolean;
  allChecked: boolean;
  someChecked: boolean;
}

export const SourceSidebar: React.FC<SourceSidebarProps> = ({
  selectedCategory,
  selectedDate,
  onSelectDate,
  selectedSourceIds,
  onToggleSourceId,
  onSelectOnlySourceId,
  onSelectAllSources,
  sourceCounts,
  availableDates,
}) => {
  const { sources, statuses, isRefreshingAll } = useSourcesStore();
  const [expandedOutlets, setExpandedOutlets] = useState<Record<string, boolean>>({});

  // Lọc các báo thuộc danh mục đang chọn (hoặc tất cả nếu 'Mới nhất')
  const categorySources: SourceItem[] = React.useMemo(() => {
    return sources.filter((s) => {
      if (selectedCategory === 'Mới nhất') return true;
      return s.categoryName === selectedCategory;
    });
  }, [sources, selectedCategory]);

  // Gom nhóm các kênh theo trang báo gốc (Outlet)
  const outletGroups: OutletGroup[] = React.useMemo(() => {
    const map = new Map<string, SourceItem[]>();

    categorySources.forEach((s) => {
      const outlet = getOutletName(s.title);
      if (!map.has(outlet)) {
        map.set(outlet, []);
      }
      map.get(outlet)!.push(s);
    });

    const groups: OutletGroup[] = [];
    map.forEach((srcList, outletName) => {
      let totalArticles = 0;
      let hasError = false;
      let isLoading = false;
      let checkedCount = 0;

      srcList.forEach((s) => {
        totalArticles += sourceCounts[s.id] || 0;
        const st = statuses[s.id];
        if (st?.state === 'error') hasError = true;
        if (st?.state === 'loading') isLoading = true;

        const isChecked =
          selectedSourceIds.length === 0 || selectedSourceIds.includes(s.id);
        if (isChecked) checkedCount++;
      });

      groups.push({
        name: outletName,
        sources: srcList,
        totalArticles,
        hasError,
        isLoading,
        allChecked: checkedCount === srcList.length,
        someChecked: checkedCount > 0 && checkedCount < srcList.length,
      });
    });

    // Sắp xếp các báo có bài lên trước
    return groups.sort((a, b) => b.totalArticles - a.totalArticles || a.name.localeCompare(b.name));
  }, [categorySources, sourceCounts, statuses, selectedSourceIds]);

  const allCategorySourceIds = React.useMemo(
    () => categorySources.map((s) => s.id),
    [categorySources]
  );

  const isAllSelected =
    selectedSourceIds.length === 0 ||
    categorySources.every((s) => selectedSourceIds.includes(s.id));

  const handleToggleAll = () => {
    if (isAllSelected) {
      onSelectAllSources([]);
    } else {
      onSelectAllSources(allCategorySourceIds);
    }
  };

  const toggleOutletExpand = (outletName: string) => {
    setExpandedOutlets((prev) => ({
      ...prev,
      [outletName]: !prev[outletName],
    }));
  };

  const handleToggleOutlet = (group: OutletGroup) => {
    const groupSourceIds = group.sources.map((s) => s.id);
    if (group.allChecked) {
      // Bỏ chọn tất cả kênh của báo này
      const remaining = (
        selectedSourceIds.length === 0 ? allCategorySourceIds : selectedSourceIds
      ).filter((id) => !groupSourceIds.includes(id));
      onSelectAllSources(remaining);
    } else {
      // Chọn tất cả kênh của báo này
      const base = selectedSourceIds.length === 0 ? allCategorySourceIds : selectedSourceIds;
      const combined = Array.from(new Set([...base, ...groupSourceIds]));
      onSelectAllSources(combined);
    }
  };

  const handleSelectOnlyOutlet = (group: OutletGroup) => {
    onSelectAllSources(group.sources.map((s) => s.id));
  };

  const handleReloadOutlet = async (group: OutletGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    await sourcesStore.fetchSourcesByOutlet(group.name, false);
  };

  return (
    <aside className="space-y-5">
      {/* 1. Date Filter */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <DateFilter
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          availableDates={availableDates}
        />
      </div>

      {/* 2. Newspaper Outlets Filter */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => {
                if (el) {
                  const someSelected = selectedSourceIds.length > 0 && !isAllSelected;
                  el.indeterminate = someSelected;
                }
              }}
              onChange={handleToggleAll}
              className="w-4 h-4 rounded text-[#00A859] focus:ring-[#00A859] border-slate-300 dark:border-slate-600 dark:bg-slate-700 cursor-pointer shrink-0"
              title="Chọn / Bỏ chọn tất cả trang báo"
            />
            <div>
              <label
                onClick={handleToggleAll}
                className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none"
              >
                Trang báo ({outletGroups.length})
              </label>
              <span className="text-[11px] text-slate-400 block font-normal">
                {categorySources.length} kênh RSS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => sourcesStore.fetchAllSources(false)}
              disabled={isRefreshingAll}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-[#00A859] transition-colors"
              title="Tải lại toàn bộ RSS"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin text-[#00A859]' : ''}`} />
            </button>
            <button
              onClick={handleToggleAll}
              className="text-xs font-semibold text-[#00A859] hover:underline cursor-pointer"
            >
              {isAllSelected ? 'Bỏ chọn' : 'Tất cả'}
            </button>
          </div>
        </div>

        {/* List of Newspapers */}
        <div className="space-y-1 max-h-[460px] overflow-y-auto pr-1">
          {outletGroups.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Không có nguồn báo nào trong danh mục này.</p>
          ) : (
            outletGroups.map((group) => {
              const isExpanded = expandedOutlets[group.name];
              const hasMultipleChannels = group.sources.length > 1;

              return (
                <div key={group.name} className="rounded-lg transition-colors">
                  {/* Outlet Main Row */}
                  <div className="group flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                      {/* Checkbox for entire outlet */}
                      <input
                        type="checkbox"
                        checked={group.allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = group.someChecked;
                        }}
                        onChange={() => handleToggleOutlet(group)}
                        className="w-4 h-4 rounded text-[#00A859] focus:ring-[#00A859] border-slate-300 dark:border-slate-600 dark:bg-slate-700 cursor-pointer shrink-0"
                        title={`Bật/tắt tất cả ${group.sources.length} kênh của ${group.name}`}
                      />

                      {/* Expand Chevron if newspaper has multiple channels */}
                      {hasMultipleChannels ? (
                        <button
                          type="button"
                          onClick={() => toggleOutletExpand(group.name)}
                          className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                          title="Xem các chuyên mục con"
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

                      {/* Status indicator */}
                      {group.hasError ? (
                        <span
                          className="w-2 h-2 rounded-full bg-rose-500 shrink-0"
                          title="Có kênh đang gặp lỗi"
                        />
                      ) : group.isLoading ? (
                        <span
                          className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"
                          title="Đang tải dữ liệu"
                        />
                      ) : (
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                          title="Hoạt động bình thường"
                        />
                      )}

                      <span
                        onClick={() => handleToggleOutlet(group)}
                        className="text-sm font-semibold text-slate-800 dark:text-slate-200 select-none flex-1 break-words leading-snug"
                        title={group.name}
                      >
                        {group.name}
                      </span>
                    </div>

                    {/* Actions on right */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {/* Total article count */}
                      <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                        {group.totalArticles}
                      </span>

                      {/* Nút Tải lại TOÀN BỘ RSS của trang báo này */}
                      <button
                        onClick={(e) => handleReloadOutlet(group, e)}
                        disabled={group.isLoading || isRefreshingAll}
                        className="p-1 text-slate-400 hover:text-[#00A859] hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title={`Tải lại toàn bộ ${group.sources.length} kênh RSS của ${group.name}`}
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            group.isLoading ? 'animate-spin text-[#00A859]' : ''
                          }`}
                        />
                      </button>

                      {/* Nút chỉ xem báo này */}
                      <button
                        onClick={() => handleSelectOnlyOutlet(group)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 hover:text-[#00A859] px-1 py-0.5 rounded transition-all"
                        title={`Chỉ xem tin từ ${group.name}`}
                      >
                        chỉ xem
                      </button>
                    </div>
                  </div>

                  {/* Sub-channels if expanded */}
                  {isExpanded && hasMultipleChannels && (
                    <div className="ml-7 pl-2 border-l border-slate-200 dark:border-slate-800 space-y-1 my-1">
                      {group.sources.map((source) => {
                        const isChannelChecked =
                          selectedSourceIds.length === 0 ||
                          selectedSourceIds.includes(source.id);
                        const channelStatus = statuses[source.id];
                        const channelCount = sourceCounts[source.id] || 0;
                        const channelTitle = source.title.includes(' - ')
                          ? source.title.split(' - ').slice(1).join(' - ')
                          : 'Trang chủ';

                        return (
                          <div
                            key={source.id}
                            className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-100/60 dark:hover:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400"
                          >
                            <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChannelChecked}
                                onChange={() => onToggleSourceId(source.id)}
                                className="w-3.5 h-3.5 rounded text-[#00A859] focus:ring-[#00A859] border-slate-300 dark:border-slate-600"
                              />
                              <span className="truncate">{channelTitle}</span>
                            </label>
                            <div className="flex items-center gap-1.5 shrink-0 ml-1">
                              <span className="tabular-nums text-[11px] text-slate-400">
                                {channelCount}
                              </span>
                              <button
                                onClick={() => sourcesStore.fetchSingleSource(source.id)}
                                className="p-0.5 text-slate-400 hover:text-[#00A859]"
                                title="Tải lại kênh này"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};
