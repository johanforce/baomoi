import { Article, FetchFeedResult, ProxyAttemptError, SourceItem } from '../types';
import { getVietnamDateString, parseRssDate } from '../utils/date';
import { generateArticleId } from '../utils/hash';
import { extractFirstImageUrl, normalizeTitleForDedupe, stripHtml } from '../utils/text';
import { isValidFeedUrl } from '../utils/url';

const REQUEST_TIMEOUT_MS = 10000;

// Danh sách proxy theo thứ tự ưu tiên
const PROXIES = [
  {
    name: 'rss2json',
    type: 'json' as const,
    buildUrl: (feedUrl: string) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`,
  },
  {
    name: 'allorigins',
    type: 'raw' as const,
    buildUrl: (feedUrl: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`,
  },
  {
    name: 'corsproxy',
    type: 'raw' as const,
    buildUrl: (feedUrl: string) => `https://corsproxy.io/?${encodeURIComponent(feedUrl)}`,
  },
];

/**
 * Fetch với AbortController timeout 10 giây
 */
async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, application/json, */*',
      },
    });
    return response;
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') {
      throw new Error('Hết thời gian chờ (Timeout 10s)');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse XML từ RSS 2.0 hoặc Atom feed thành danh sách Article
 */
function parseXmlFeed(xmlText: string, source: SourceItem, fetchedAtMs: number): Article[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Kiểm tra lỗi parse XML
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Không phải định dạng RSS/XML hợp lệ');
  }

  const items = xmlDoc.querySelectorAll('item, entry');
  if (!items || items.length === 0) {
    throw new Error('Feed không có bài nào');
  }

  const articles: Article[] = [];
  const seenKeys = new Set<string>();

  items.forEach((itemNode) => {
    // 1. Title
    const titleEl = itemNode.querySelector('title');
    const rawTitle = titleEl ? titleEl.textContent || '' : '';
    const cleanTitle = stripHtml(rawTitle);
    if (!cleanTitle) return;

    // 2. Link
    let link = '';
    const linkEl = itemNode.querySelector('link');
    if (linkEl) {
      link = linkEl.getAttribute('href') || linkEl.textContent || '';
    }
    link = link.trim();
    if (!link) return;

    // Dedupe trong cùng 1 feed
    const dedupeKey = normalizeTitleForDedupe(cleanTitle);
    if (seenKeys.has(link) || seenKeys.has(dedupeKey)) return;
    seenKeys.add(link);
    seenKeys.add(dedupeKey);

    // 3. Description
    const descEl =
      itemNode.querySelector('description') ||
      itemNode.querySelector('summary') ||
      itemNode.querySelector('content\\:encoded') ||
      itemNode.querySelector('content');
    const rawDesc = descEl ? descEl.textContent || '' : '';
    const cleanDesc = stripHtml(rawDesc);

    // 4. PubDate
    const pubDateEl =
      itemNode.querySelector('pubDate') ||
      itemNode.querySelector('published') ||
      itemNode.querySelector('updated') ||
      itemNode.querySelector('dc\\:date');
    const pubDateStr = parseRssDate(pubDateEl ? pubDateEl.textContent : null);

    // 5. Thumbnail (thứ tự ưu tiên: enclosure -> media:content/thumbnail -> <img> trong desc)
    let thumbnail = '';

    // Enclosure
    const enclosure = itemNode.querySelector('enclosure');
    if (enclosure) {
      const encUrl = enclosure.getAttribute('url') || '';
      const encType = enclosure.getAttribute('type') || '';
      if (encUrl && (encType.includes('image') || /\.(jpe?g|png|webp|avif)/i.test(encUrl))) {
        thumbnail = encUrl;
      }
    }

    // Media content/thumbnail
    if (!thumbnail) {
      const mediaThumbnail =
        itemNode.querySelector('media\\:thumbnail, thumbnail') ||
        itemNode.querySelector('media\\:content, content[url]');
      if (mediaThumbnail) {
        const mUrl = mediaThumbnail.getAttribute('url');
        if (mUrl) thumbnail = mUrl;
      }
    }

    // Thẻ img trong description hoặc rawDesc
    if (!thumbnail) {
      const foundInDesc = extractFirstImageUrl(rawDesc);
      if (foundInDesc) thumbnail = foundInDesc;
    }

    // Fallback thumbnail nếu không tìm thấy
    if (!thumbnail) {
      thumbnail = `https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=400&auto=format&fit=crop&q=80`;
    }

    const articleId = generateArticleId(link);
    const dateStr = getVietnamDateString(pubDateStr);

    articles.push({
      id: articleId,
      title: cleanTitle,
      link,
      description: cleanDesc,
      thumbnail,
      pubDate: pubDateStr,
      dateStr,
      sourceId: source.id,
      sourceName: source.title,
      categoryName: source.categoryName,
      fetchedAt: fetchedAtMs,
    });
  });

  return articles;
}

/**
 * Parse JSON từ rss2json.com thành Article[]
 */
interface Rss2JsonItem {
  title?: string;
  link?: string;
  description?: string;
  content?: string;
  pubDate?: string;
  thumbnail?: string;
  enclosure?: { link?: string; type?: string };
}

function parseRss2Json(data: { status?: string; items?: Rss2JsonItem[] }, source: SourceItem, fetchedAtMs: number): Article[] {
  if (data.status !== 'ok' || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('Dịch vụ rss2json không trả về dữ liệu bài viết hợp lệ');
  }

  const articles: Article[] = [];
  const seenKeys = new Set<string>();

  data.items.forEach((item) => {
    const cleanTitle = stripHtml(item.title || '');
    const link = (item.link || '').trim();
    if (!cleanTitle || !link) return;

    const dedupeKey = normalizeTitleForDedupe(cleanTitle);
    if (seenKeys.has(link) || seenKeys.has(dedupeKey)) return;
    seenKeys.add(link);
    seenKeys.add(dedupeKey);

    const cleanDesc = stripHtml(item.description || item.content || '');
    const pubDateStr = parseRssDate(item.pubDate);

    // Thumbnail
    let thumbnail = item.thumbnail || '';
    if (!thumbnail && item.enclosure?.link && item.enclosure?.type?.includes('image')) {
      thumbnail = item.enclosure.link;
    }
    if (!thumbnail) {
      const fromDesc = extractFirstImageUrl(item.description || '') || extractFirstImageUrl(item.content || '');
      if (fromDesc) thumbnail = fromDesc;
    }
    if (!thumbnail) {
      thumbnail = `https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=400&auto=format&fit=crop&q=80`;
    }

    articles.push({
      id: generateArticleId(link),
      title: cleanTitle,
      link,
      description: cleanDesc,
      thumbnail,
      pubDate: pubDateStr,
      dateStr: getVietnamDateString(pubDateStr),
      sourceId: source.id,
      sourceName: source.title,
      categoryName: source.categoryName,
      fetchedAt: fetchedAtMs,
    });
  });

  return articles;
}

/**
 * Lấy tin tức từ một nguồn RSS, tự động fallback qua danh sách proxy
 */
export async function fetchFeed(source: SourceItem): Promise<FetchFeedResult> {
  const startTime = Date.now();
  const fetchedAtIso = new Date().toISOString();

  // 1. Kiểm tra tính hợp lệ của URL feed
  if (!isValidFeedUrl(source.feed_url)) {
    return {
      status: 'error',
      articles: [],
      error: 'URL feed không hợp lệ (phải bắt đầu bằng http:// hoặc https://)',
      proxyUsed: null,
      latencyMs: Date.now() - startTime,
      fetchedAt: fetchedAtIso,
      proxyErrors: [{ proxy: 'Client validation', error: 'URL không hợp lệ' }],
    };
  }

  const proxyErrors: ProxyAttemptError[] = [];

  // 2. Thử từng proxy theo thứ tự
  for (const proxy of PROXIES) {
    const proxyUrl = proxy.buildUrl(source.feed_url);
    try {
      const response = await fetchWithTimeout(proxyUrl, REQUEST_TIMEOUT_MS);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      let parsedArticles: Article[] = [];
      if (proxy.type === 'json') {
        const json = await response.json();
        parsedArticles = parseRss2Json(json, source, startTime);
      } else {
        const text = await response.text();
        if (!text || text.trim().length === 0) {
          throw new Error('Dữ liệu trả về rỗng');
        }
        parsedArticles = parseXmlFeed(text, source, startTime);
      }

      if (parsedArticles.length === 0) {
        throw new Error('Feed không có bài nào');
      }

      const latencyMs = Date.now() - startTime;
      return {
        status: 'success',
        articles: parsedArticles,
        error: null,
        proxyUsed: proxy.name,
        latencyMs,
        fetchedAt: fetchedAtIso,
        proxyErrors,
      };
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || 'Không rõ lỗi';
      proxyErrors.push({
        proxy: proxy.name,
        error: errMsg,
      });
      // Tiếp tục fallback sang proxy tiếp theo
    }
  }

  // Nếu tất cả proxy đều thất bại
  const latencyMs = Date.now() - startTime;
  let friendlyReason = 'Tất cả proxy đều thất bại';
  if (proxyErrors.some((e) => e.error.includes('Hết thời gian chờ'))) {
    friendlyReason = 'Hết thời gian chờ (Timeout)';
  } else if (proxyErrors.every((e) => e.error.includes('Không phải định dạng RSS'))) {
    friendlyReason = 'Không phải định dạng RSS hợp lệ';
  } else if (proxyErrors.some((e) => e.error.includes('không có bài nào'))) {
    friendlyReason = 'Feed không có bài nào';
  }

  return {
    status: 'error',
    articles: [],
    error: friendlyReason,
    proxyUsed: null,
    latencyMs,
    fetchedAt: fetchedAtIso,
    proxyErrors,
  };
}

/**
 * Thực hiện fetch đồng thời một danh sách nguồn, giới hạn số tác vụ đồng thời (concurrency limit)
 */
export async function fetchFeedsConcurrently(
  sources: SourceItem[],
  concurrency = 5,
  onSourceComplete?: (source: SourceItem, result: FetchFeedResult, completedCount: number, totalCount: number) => void
): Promise<Map<string, FetchFeedResult>> {
  const results = new Map<string, FetchFeedResult>();
  let completed = 0;
  const total = sources.length;

  let currentIndex = 0;
  async function worker() {
    while (currentIndex < sources.length) {
      const index = currentIndex++;
      const src = sources[index];
      const res = await fetchFeed(src);
      results.set(src.id, res);
      completed++;
      if (onSourceComplete) {
        onSourceComplete(src, res, completed, total);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, sources.length) }, () => worker());
  await Promise.allSettled(workers);

  return results;
}
