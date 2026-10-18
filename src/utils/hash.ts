/**
 * Tạo chuỗi hash ổn định (deterministic string ID) từ một chuỗi (URL, link)
 */
export function generateHash(str: string): string {
  let hash = 5381;
  const cleanStr = (str || '').trim().toLowerCase();
  for (let i = 0; i < cleanStr.length; i++) {
    hash = (hash * 33) ^ cleanStr.charCodeAt(i);
  }
  return 'src_' + (hash >>> 0).toString(36);
}

export function generateArticleId(link: string): string {
  let hash = 5381;
  const cleanStr = (link || '').trim();
  for (let i = 0; i < cleanStr.length; i++) {
    hash = (hash * 33) ^ cleanStr.charCodeAt(i);
  }
  return 'art_' + (hash >>> 0).toString(36);
}
