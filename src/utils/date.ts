/**
 * Xử lý ngày tháng và múi giờ Asia/Ho_Chi_Minh
 */

const TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo giờ Việt Nam từ Date hoặc timestamp
 */
export function getVietnamDateString(dateInput: Date | string | number = new Date()): string {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return getVietnamTodayString();
  }

  // Format parts in Asia/Ho_Chi_Minh
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d); // Output standard YYYY-MM-DD
}

/**
 * Lấy ngày hôm nay theo giờ Việt Nam YYYY-MM-DD
 */
export function getVietnamTodayString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Lấy ngày hôm qua theo giờ Việt Nam YYYY-MM-DD
 */
export function getVietnamYesterdayString(): string {
  return shiftDateString(getVietnamTodayString(), -1);
}

/**
 * Cộng/trừ số ngày từ chuỗi YYYY-MM-DD
 */
export function shiftDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format ngày thành văn bản thân thiện tiếng Việt (vd: "Hôm nay, 18/10/2026", "Thứ Hai, 13/10/2026")
 */
export function formatFriendlyDate(dateStr: string): string {
  const today = getVietnamTodayString();
  const yesterday = getVietnamYesterdayString();

  const [year, month, day] = dateStr.split('-').map(Number);
  // Create midday date for formatting
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const dayOfWeekFormatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIMEZONE,
    weekday: 'long',
  });
  const dayOfWeek = dayOfWeekFormatter.format(d);

  if (dateStr === today) {
    return `Hôm nay (${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')})`;
  }
  if (dateStr === yesterday) {
    return `Hôm qua (${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')})`;
  }

  // Capitalize first letter of weekday
  const capitalizedWeekday = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
  return `${capitalizedWeekday}, ${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
}

/**
 * Format thời gian tương đối bằng tiếng Việt: "vừa xong", "15 phút trước", "2 giờ trước", "Hôm qua 14:20", "15/10/2026"
 */
export function formatRelativeTimeVi(dateInput: string | Date | number): string {
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) {
    return 'Gần đây';
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 45) {
    return 'Vừa xong';
  }
  if (diffMin < 60) {
    return `${diffMin} phút trước`;
  }
  if (diffHour < 24) {
    return `${diffHour} giờ trước`;
  }

  const todayStr = getVietnamTodayString();
  const articleDateStr = getVietnamDateString(date);
  const yesterdayStr = getVietnamYesterdayString();

  const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const timeStr = timeFormatter.format(date);

  if (articleDateStr === todayStr) {
    return `Hôm nay ${timeStr}`;
  }
  if (articleDateStr === yesterdayStr) {
    return `Hôm qua ${timeStr}`;
  }

  const fullFormatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return fullFormatter.format(date);
}

/**
 * Chuyển đổi ngày RSS (RFC 822 chuẩn, năm 2 chữ số, kiểu Mỹ, ISO,...) thành ISO string hợp lệ
 */
export function parseRssDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return new Date().toISOString();

  let s = dateStr.trim();

  // 1. Định dạng ISO "YYYY-MM-DD HH:mm:ss" (CafeBiz) hoặc "YYYY-MM-DDTHH:mm:ss", không có múi giờ
  const isoNoTz = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/i.exec(s);
  if (isoNoTz) {
    const [, year, month, day, hour = '00', min = '00', sec = '00'] = isoNoTz;
    // Coi là giờ Việt Nam (UTC+7)
    const utcMs = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 7,
      Number(min),
      Number(sec)
    );
    const d = new Date(utcMs);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // 2. Kiểu Mỹ MM/DD/YYYY hh:mm:ss AM/PM (Tuổi Trẻ, ví dụ "10/18/2026 12:10:00 PM"), không có múi giờ
  const usDateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i.exec(s);
  if (usDateMatch) {
    const [, month, day, year, hourStr, minStr = '00', secStr = '00', ampm] = usDateMatch;
    let h = hourStr ? Number(hourStr) : 0;
    const m = Number(minStr);
    const sec = Number(secStr);

    if (ampm) {
      const isPm = ampm.toUpperCase() === 'PM';
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
    }

    // Coi là giờ Việt Nam (UTC+7)
    const utcMs = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      h - 7,
      m,
      sec
    );
    const d = new Date(utcMs);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // 3. Múi giờ viết tắt "+07", "-05" (thiếu 2 số 0) -> "+0700"
  s = s.replace(/([+-]\d{2})$/, '$100').replace(/([+-]\d{2})\s+/, '$100 ');

  // 4. RFC 822 với năm 2 chữ số (ví dụ "Sun, 18 Oct 26 12:00:00 +0700") -> năm 2026
  const rfc2DigitYear = /(\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+)(\d{2})(\s+\d{2}:\d{2}(?::\d{2})?)/i;
  if (rfc2DigitYear.test(s)) {
    s = s.replace(rfc2DigitYear, (_m, prefix, yy, suffix) => {
      const yearNum = Number(yy);
      const fullYear = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
      return `${prefix}${fullYear}${suffix}`;
    });
  }

  // 5. Thử parse ngày bằng Date thông thường
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1990 && parsed.getFullYear() <= 2100) {
      const hasTz = /(?:Z|GMT|UTC|[+-]\d{2}:?\d{2})$/i.test(s) || /[+-]\d{4}/.test(s);
      if (!hasTz) {
        // Chuỗi không có múi giờ -> coi là giờ Việt Nam (UTC+7)
        const y = parsed.getFullYear();
        const m = parsed.getMonth();
        const d = parsed.getDate();
        const h = parsed.getHours();
        const min = parsed.getMinutes();
        const sec = parsed.getSeconds();
        return new Date(Date.UTC(y, m, d, h - 7, min, sec)).toISOString();
      }
      return parsed.toISOString();
    }
  } catch {
    // fallback
  }

  return new Date().toISOString();
}
