import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Article } from '../types';
import { decodeHtmlEntities, removeVietnameseTones } from '../utils/text';

interface TinTongHopDB extends DBSchema {
  articles: {
    key: string;
    value: Article;
    indexes: {
      'by-date': string;
      'by-source': string;
      'by-category': string;
      'by-fetchedAt': number;
      'by-pubDate': string;
    };
  };
}

const DB_NAME = 'tintonghop_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TinTongHopDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TinTongHopDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TinTongHopDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('articles')) {
          const store = db.createObjectStore('articles', { keyPath: 'id' });
          store.createIndex('by-date', 'dateStr');
          store.createIndex('by-source', 'sourceId');
          store.createIndex('by-category', 'categoryName');
          store.createIndex('by-fetchedAt', 'fetchedAt');
          store.createIndex('by-pubDate', 'pubDate');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Lưu danh sách bài viết vào IndexedDB, ghi đè nếu trùng id
 */
export async function saveArticlesToDB(articles: Article[]): Promise<number> {
  if (!articles || articles.length === 0) return 0;
  const db = await getDB();
  const tx = db.transaction('articles', 'readwrite');
  let savedCount = 0;

  for (const article of articles) {
    const cleanArticle: Article = {
      ...article,
      title: decodeHtmlEntities(article.title),
      description: decodeHtmlEntities(article.description),
    };
    await tx.store.put(cleanArticle);
    savedCount++;
  }
  await tx.done;
  return savedCount;
}

/**
 * Lấy danh sách tất cả các ngày (YYYY-MM-DD) đang có bài viết trong DB
 */
export async function getStoredDatesFromDB(): Promise<string[]> {
  const db = await getDB();
  const tx = db.transaction('articles', 'readonly');
  const index = tx.store.index('by-date');
  const keys = await index.getAllKeys();
  const uniqueDates = Array.from(new Set(keys)).sort((a, b) => b.localeCompare(a));
  return uniqueDates;
}

/**
 * Đếm số lượng bài viết của từng nguồn (sourceId) cho một ngày hoặc toàn bộ
 */
export async function getSourceCountsFromDB(dateStr?: string): Promise<Record<string, number>> {
  const db = await getDB();
  const tx = db.transaction('articles', 'readonly');
  let articles: Article[];

  if (dateStr) {
    const index = tx.store.index('by-date');
    articles = await index.getAll(dateStr);
  } else {
    articles = await tx.store.getAll();
  }

  const counts: Record<string, number> = {};
  for (const item of articles) {
    counts[item.sourceId] = (counts[item.sourceId] || 0) + 1;
  }
  return counts;
}

/**
 * Lấy ngày pubDate của bài viết mới nhất thuộc nguồn sourceId
 */
export async function getLatestArticleDateForSource(sourceId: string): Promise<string | null> {
  const db = await getDB();
  const tx = db.transaction('articles', 'readonly');
  const index = tx.store.index('by-source');
  const articles = await index.getAll(sourceId);
  if (!articles || articles.length === 0) return null;

  let maxTime = 0;
  let maxPubDate: string | null = null;
  for (const item of articles) {
    const t = new Date(item.pubDate).getTime();
    if (!isNaN(t) && t > maxTime) {
      maxTime = t;
      maxPubDate = item.pubDate;
    }
  }
  return maxPubDate;
}

export interface ArticleQueryFilter {
  dateStr?: string;
  categoryName?: string;
  sourceIds?: string[]; // null hoặc rỗng nghĩa là chọn tất cả
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

/**
 * Lấy danh sách bài viết theo bộ lọc kết hợp (ngày, danh mục, nguồn báo, từ khóa tìm kiếm)
 */
export async function queryArticlesFromDB(filter: ArticleQueryFilter): Promise<{
  articles: Article[];
  total: number;
}> {
  const db = await getDB();
  const tx = db.transaction('articles', 'readonly');
  let rawArticles: Article[] = [];

  // Tối ưu hóa truy vấn bằng index
  if (filter.dateStr) {
    const index = tx.store.index('by-date');
    rawArticles = await index.getAll(filter.dateStr);
  } else if (filter.categoryName && filter.categoryName !== 'Mới nhất') {
    const index = tx.store.index('by-category');
    rawArticles = await index.getAll(filter.categoryName);
  } else {
    rawArticles = await tx.store.getAll();
  }

  // Lọc theo Category nếu trước đó truy vấn bằng date
  if (filter.categoryName && filter.categoryName !== 'Mới nhất' && filter.dateStr) {
    rawArticles = rawArticles.filter((art) => art.categoryName === filter.categoryName);
  }

  // Lọc theo Nguồn báo (sourceIds)
  if (filter.sourceIds && filter.sourceIds.length > 0) {
    if (filter.sourceIds.includes('__NONE__')) {
      return { articles: [], total: 0 };
    }
    const allowedSourceSet = new Set(filter.sourceIds);
    rawArticles = rawArticles.filter((art) => allowedSourceSet.has(art.sourceId));
  }

  // Lọc theo từ khóa tìm kiếm (hỗ trợ tiếng Việt không dấu)
  if (filter.searchQuery && filter.searchQuery.trim()) {
    const cleanQuery = removeVietnameseTones(filter.searchQuery.trim());
    rawArticles = rawArticles.filter((art) => {
      const matchTitle = removeVietnameseTones(art.title).includes(cleanQuery);
      const matchDesc = removeVietnameseTones(art.description).includes(cleanQuery);
      const matchSource = removeVietnameseTones(art.sourceName).includes(cleanQuery);
      return matchTitle || matchDesc || matchSource;
    });
  }

  // Sắp xếp bài viết: bài mới nhất lên trước theo pubDate hoặc fetchedAt
  rawArticles.sort((a, b) => {
    const timeA = new Date(a.pubDate).getTime() || a.fetchedAt;
    const timeB = new Date(b.pubDate).getTime() || b.fetchedAt;
    return timeB - timeA;
  });

  const total = rawArticles.length;
  const offset = filter.offset || 0;
  const limit = filter.limit || 20;
  const paginated = rawArticles.slice(offset, offset + limit).map((art) => ({
    ...art,
    title: decodeHtmlEntities(art.title),
    description: decodeHtmlEntities(art.description),
  }));

  return {
    articles: paginated,
    total,
  };
}

/**
 * Xóa dữ liệu cũ hơn maxDays (mặc định 30 ngày)
 */
export async function cleanupOldArticles(maxDays = 30): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('articles', 'readwrite');
  const cutoffTime = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  const index = tx.store.index('by-fetchedAt');
  const range = IDBKeyRange.upperBound(cutoffTime);
  let cursor = await index.openCursor(range);
  let deletedCount = 0;

  while (cursor) {
    await cursor.delete();
    deletedCount++;
    cursor = await cursor.continue();
  }

  await tx.done;
  return deletedCount;
}

/**
 * Chuẩn hóa danh mục bài viết từ tên cũ sang hệ thống danh mục mới:
 * Thời sự, Thế giới, Kinh doanh, Công nghệ, Thể thao, Giải trí, Đời sống, Sức khỏe, Pháp luật, Xe
 */
export function normalizeCategoryName(rawCat: string, title?: string, sourceTitle?: string): string {
  if (!rawCat) return 'Thời sự';

  if (rawCat === 'Tài chính & Kinh tế') return 'Kinh doanh';
  if (rawCat === 'Thể thao') return 'Thể thao';

  const text = `${title || ''} ${sourceTitle || ''} ${rawCat}`.toLowerCase();

  if (rawCat === 'Tin tức & Thời sự tổng hợp') {
    if (text.includes('thế giới') || text.includes('quốc tế') || text.includes('quân sự')) return 'Thế giới';
    if (text.includes('pháp luật') || text.includes('vụ án') || text.includes('pháp đình')) return 'Pháp luật';
    return 'Thời sự';
  }

  if (rawCat === 'Công nghệ & Đời sống') {
    if (text.includes('sức khỏe') || text.includes('y tế') || text.includes('bệnh') || text.includes('dinh dưỡng')) return 'Sức khỏe';
    if (text.includes('ô tô') || text.includes('xe máy') || text.includes('xe điện') || text.includes(' xe ')) return 'Xe';
    if (text.includes('giải trí') || text.includes('sao') || text.includes('showbiz') || text.includes('phim') || text.includes('nhạc')) return 'Giải trí';
    if (text.includes('công nghệ') || text.includes('số hóa') || text.includes('khoa học') || text.includes('ai') || text.includes('tinhte')) return 'Công nghệ';
    return 'Đời sống';
  }

  return rawCat;
}

/**
 * Tự động quét và chuẩn hóa các bài viết trong IndexedDB sang 11 danh mục mới
 */
export async function migrateLegacyCategoriesInDB(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('articles', 'readwrite');
    let cursor = await tx.store.openCursor();
    while (cursor) {
      const art = cursor.value;
      const normalized = normalizeCategoryName(art.categoryName, art.title, art.sourceName);
      if (normalized !== art.categoryName) {
        art.categoryName = normalized;
        await cursor.update(art);
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (err) {
    console.warn('Lỗi migrate category trong DB:', err);
  }
}

/**
 * Lấy top bài mới cập nhật nhất (cho Slider theo từng Category hoặc Mới nhất)
 */
export async function getTopRecentArticles(
  limit = 10,
  categoryName?: string,
  dateStr?: string
): Promise<Article[]> {
  const db = await getDB();
  const tx = db.transaction('articles', 'readonly');
  let rawArticles: Article[] = [];

  if (categoryName && categoryName !== 'Mới nhất') {
    const index = tx.store.index('by-category');
    rawArticles = await index.getAll(categoryName);
  } else {
    rawArticles = await tx.store.getAll();
  }

  // Lọc theo dateStr nếu có
  let filtered = rawArticles;
  if (dateStr) {
    const onDate = rawArticles.filter((a) => a.dateStr === dateStr);
    // Nếu ngày được chọn có bài, ưu tiên ngày đó; nếu ít hơn 3 bài, vẫn lấy các bài gần nhất của chuyên mục
    if (onDate.length >= 3) {
      filtered = onDate;
    }
  }

  // Sắp xếp bài mới nhất lên đầu (ưu tiên bài có thumbnail hợp lệ)
  filtered.sort((a, b) => {
    const timeA = new Date(a.pubDate).getTime() || a.fetchedAt;
    const timeB = new Date(b.pubDate).getTime() || b.fetchedAt;
    return timeB - timeA;
  });

  return filtered.slice(0, limit).map((art) => ({
    ...art,
    title: decodeHtmlEntities(art.title),
    description: decodeHtmlEntities(art.description),
  }));
}

/**
 * Tự động quét và giải mã thực thể HTML còn sót lại trong IndexedDB (ví dụ bài Thanh Niên cũ)
 */
export async function migrateHtmlEntitiesInDB(): Promise<number> {
  try {
    const db = await getDB();
    const tx = db.transaction('articles', 'readwrite');
    let cursor = await tx.store.openCursor();
    let updatedCount = 0;
    while (cursor) {
      const art = cursor.value;
      let changed = false;
      if (art.title && art.title.includes('&')) {
        const decoded = decodeHtmlEntities(art.title);
        if (decoded !== art.title) {
          art.title = decoded;
          changed = true;
        }
      }
      if (art.description && art.description.includes('&')) {
        const decoded = decodeHtmlEntities(art.description);
        if (decoded !== art.description) {
          art.description = decoded;
          changed = true;
        }
      }
      if (changed) {
        await cursor.update(art);
        updatedCount++;
      }
      cursor = await cursor.continue();
    }
    await tx.done;
    return updatedCount;
  } catch (err) {
    console.warn('Lỗi migrate html entities trong DB:', err);
    return 0;
  }
}
