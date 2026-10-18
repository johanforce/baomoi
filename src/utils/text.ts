/**
 * Tiện ích xử lý văn bản tiếng Việt và chuỗi HTML
 */

/**
 * Loại bỏ toàn bộ thẻ HTML và giải mã các thực thể HTML phổ biến
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  // Chuyển đối tượng HTML cơ bản
  let text = html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/\s+/g, ' ')
    .trim();

  return text;
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
  return removeVietnameseTones(title)
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
