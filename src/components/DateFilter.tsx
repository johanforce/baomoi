import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  formatFriendlyDate,
  getVietnamTodayString,
  getVietnamYesterdayString,
  shiftDateString,
} from '../utils/date';

interface DateFilterProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  availableDates?: string[];
}

export const DateFilter: React.FC<DateFilterProps> = ({
  selectedDate,
  onSelectDate,
}) => {
  const today = getVietnamTodayString();
  const yesterday = getVietnamYesterdayString();

  const handlePrevDay = () => {
    onSelectDate(shiftDateString(selectedDate, -1));
  };

  const handleNextDay = () => {
    // Không cho chọn ngày trong tương lai
    if (selectedDate < today) {
      onSelectDate(shiftDateString(selectedDate, 1));
    }
  };

  const isToday = selectedDate === today;
  const isYesterday = selectedDate === yesterday;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Thời gian đọc tin
        </label>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevDay}
            className="p-1 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Ngày trước"
            aria-label="Ngày trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextDay}
            disabled={isToday}
            className={`p-1 rounded-md transition-colors ${
              isToday
                ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Ngày sau"
            aria-label="Ngày sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Select Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onSelectDate(today)}
          className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${
            isToday
              ? 'bg-[#00A859] text-white border-[#00A859] shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          Hôm nay
        </button>
        <button
          onClick={() => onSelectDate(yesterday)}
          className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${
            isYesterday
              ? 'bg-[#00A859] text-white border-[#00A859] shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          Hôm qua
        </button>
      </div>

      {/* Date Picker Input */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => e.target.value && onSelectDate(e.target.value)}
            className="w-full bg-transparent text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Friendly selected date label */}
      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
        Đang xem: <span className="text-slate-800 dark:text-slate-200 font-semibold">{formatFriendlyDate(selectedDate)}</span>
      </div>
    </div>
  );
};
