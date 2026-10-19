import { decode as heDecode } from 'he';

/**
 * Tiện ích xử lý văn bản tiếng Việt và chuỗi HTML
 */

/**
 * Giải mã đầy đủ các thực thể HTML (kể cả &aacute;, &ograve;, &#039;, &hellip;, hoặc bị double-encoded)
 */
export function decodeHtmlEntities(input: string): string {
  if (!input || typeof input !== 'string') return '';
  if (!input.includes('&')) return input;

  let str = input;
  // Giải mã tối đa 2 lần để xử lý các chuỗi bị escape nhiều lớp (ví dụ &amp;aacute; -> &aacute; -> á)
  for (let i = 0; i < 2; i++) {
    if (!str.includes('&')) break;
    try {
      const decoded = heDecode(str);
      if (decoded === str) break;
      str = decoded;
    } catch {
      break;
    }
  }

  // Fallback nếu còn sót thực thể HTML trong môi trường trình duyệt
  if (typeof document !== 'undefined' && str.includes('&')) {
    try {
      const txt = document.createElement('textarea');
      txt.innerHTML = str;
      if (txt.value && txt.value !== str) {
        str = txt.value;
      }
    } catch {
      // ignore
    }
  }

  return str;
}

/**
 * Loại bỏ toàn bộ thẻ HTML và giải mã đầy đủ các thực thể HTML
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  let text = html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  text = decodeHtmlEntities(text);
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Trích xuất link ảnh (thẻ img src) đầu tiên từ chuỗi HTML
 */
export function extractFirstImageUrl(html: string): string | null {
  if (!html) return null;

  // Thử match thẻ img có src
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1]) {
    const src = match[1].trim();
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }
  }

  // Thử tìm trong CDATA hoặc link ảnh thông dụng
  const urlMatch = html.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"'<>]*)?/i);
  if (urlMatch && urlMatch[0]) {
    return urlMatch[0];
  }

  return null;
}

/**
 * Xóa dấu tiếng Việt phục vụ tìm kiếm không dấu ("bong da" -> "bóng đá")
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Chuẩn hóa tiêu đề để so sánh trùng lặp
 */
export function normalizeTitleForDedupe(title: string): string {
  return removeVietnameseTones(decodeHtmlEntities(title))
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
