import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Article } from '../types';
import { removeVietnameseTones } from '../utils/text';

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
    await tx.store.put(article);
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
  const paginated = rawArticles.slice(offset, offset + limit);

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
 * Lấy top 10 bài mới cập nhật nhất (dành cho Trending panel)
 */
export async function getTopRecentArticles(limit = 10): Promise<Article[]> {
  const db = await getDB();
  const tx = db.transaction('articles', 'readonly');
  const articles = await tx.store.getAll();

  articles.sort((a, b) => {
    const timeA = new Date(a.pubDate).getTime() || a.fetchedAt;
    const timeB = new Date(b.pubDate).getTime() || b.fetchedAt;
    return timeB - timeA;
  });

  return articles.slice(0, limit);
}
