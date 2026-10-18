import { Article, FetchFeedResult, ProxyAttemptError, SourceItem } from '../types';
import { getVietnamDateString, parseRssDate } from '../utils/date';
import { generateArticleId } from '../utils/hash';
import { extractFirstImageUrl, normalizeTitleForDedupe, stripHtml } from '../utils/text';
import { isValidFeedUrl } from '../utils/url';

/**
 * Chuẩn hóa link bài viết: bỏ dấu "//" thừa sau tên miền
 * Ví dụ: https://vnbusiness.vn//bai.html -> https://vnbusiness.vn/bai.html
 */
export function normalizeLink(link: string): string {
  if (!link) return '';
  const trimmed = link.trim();
  try {
    const u = new URL(trimmed);
    u.pathname = u.pathname.replace(/\/+/g, '/');
    return u.toString();
  } catch {
    return trimmed.replace(/([^:])\/{2,}/g, '$1/');
  }
}

// Danh sách proxy theo thứ tự ưu tiên và timeoutMs riêng
const PROXIES = [
  {
    name: 'server',
    type: 'raw' as const,
    timeoutMs: 20000, // 20 giây
    buildUrl: (feedUrl: string) => `/api/feed?url=${encodeURIComponent(feedUrl)}`,
  },
  {
    name: 'allorigins',
    type: 'raw' as const,
    timeoutMs: 8000, // 8 giây
    buildUrl: (feedUrl: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`,
  },
  {
    name: 'rss2json',
    type: 'json' as const,
    timeoutMs: 8000, // 8 giây
    buildUrl: (feedUrl: string) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`,
  },
];

/**
 * Fetch với AbortController timeout theo từng proxy
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const timeoutSec = Math.round(timeoutMs / 1000);
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
      throw new Error(`Hết thời gian chờ (Timeout ${timeoutSec}s)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chuẩn hóa XML: sửa các ký tự & trần chưa được escape thành &amp; (lỗi rất phổ biến ở các báo VN)
 */
function sanitizeXmlEntities(xml: string): string {
  if (!xml) return '';
  // 1. Tạm bảo vệ các khối CDATA
  const cdataMatches: string[] = [];
  const tokenized = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (match) => {
    cdataMatches.push(match);
    return `___CDATA_TOKEN_${cdataMatches.length - 1}___`;
  });

  // 2. Chuyển đổi các dấu & không hợp lệ (không thuộc entity chuẩn) thành &amp;
  const sanitized = tokenized.replace(
    /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g,
    '&amp;'
  );

  // 3. Khôi phục lại CDATA
  return sanitized.replace(
    /___CDATA_TOKEN_(\d+)___/g,
    (_, index) => cdataMatches[Number(index)] || ''
  );
}

function cleanXmlString(raw: string): string {
  if (!raw) return '';
  let str = raw.replace(/^\uFEFF/, '').trim();
  const xmlIdx = str.indexOf('<?xml');
  const rssIdx = str.indexOf('<rss');
  const feedIdx = str.indexOf('<feed');
  const indices = [xmlIdx, rssIdx, feedIdx].filter((i) => i >= 0);
  if (indices.length > 0) {
    const startIdx = Math.min(...indices);
    if (startIdx > 0) {
      str = str.slice(startIdx);
    }
  }
  return str;
}

/**
 * Parse XML từ RSS 2.0 hoặc Atom feed thành danh sách Article
 */
function parseXmlFeed(xmlText: string, source: SourceItem, fetchedAtMs: number): Article[] {
  const parser = new DOMParser();
  const stripped = cleanXmlString(xmlText);
  const cleanXml = sanitizeXmlEntities(stripped);
  let xmlDoc: Document = parser.parseFromString(cleanXml, 'text/xml');

  // Kiểm tra lỗi parse XML
  let parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    const directItems = xmlDoc.querySelectorAll('item, entry');
    if (directItems && directItems.length > 0) {
      parseError = null;
    } else {
      // Thử fallback sang HTML parser cực kỳ khoan dung với lỗi cú pháp XML
      try {
        const htmlDoc = parser.parseFromString(cleanXml, 'text/html');
        const htmlItems = htmlDoc.querySelectorAll('item, entry');
        if (htmlItems && htmlItems.length > 0) {
          xmlDoc = htmlDoc;
          parseError = null;
        }
      } catch {
        // bỏ qua
      }
    }
  }

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
    const titleNodes = itemNode.getElementsByTagName('title');
    const rawTitle = titleNodes.length > 0 ? titleNodes[0].textContent || '' : '';
    const cleanTitle = stripHtml(rawTitle);
    if (!cleanTitle) return;

    // 2. Link & Normalize Link
    let rawLink = '';
    const linkNodes = itemNode.getElementsByTagName('link');
    if (linkNodes.length > 0) {
      const lNode = linkNodes[0];
      rawLink = lNode.getAttribute('href') || lNode.textContent || '';
    }
    const cleanLink = normalizeLink(rawLink);
    if (!cleanLink) return;

    // Dedupe trong cùng 1 feed
    const dedupeKey = normalizeTitleForDedupe(cleanTitle);
    if (seenKeys.has(cleanLink) || seenKeys.has(dedupeKey)) return;
    seenKeys.add(cleanLink);
    seenKeys.add(dedupeKey);

    // 3. Description (hỗ trợ content:encoded, summary, content)
    let rawDesc = '';
    const descNodes = itemNode.getElementsByTagName('description');
    if (descNodes.length > 0 && descNodes[0].textContent) {
      rawDesc = descNodes[0].textContent;
    }
    if (!rawDesc) {
      const encodedNodes = itemNode.getElementsByTagName('content:encoded');
      if (encodedNodes.length > 0 && encodedNodes[0].textContent) {
        rawDesc = encodedNodes[0].textContent;
      }
    }
    if (!rawDesc) {
      const summaryNodes = itemNode.getElementsByTagName('summary');
      if (summaryNodes.length > 0 && summaryNodes[0].textContent) {
        rawDesc = summaryNodes[0].textContent;
      }
    }
    if (!rawDesc) {
      const contentNodes = itemNode.getElementsByTagName('content');
      if (contentNodes.length > 0 && contentNodes[0].textContent) {
        rawDesc = contentNodes[0].textContent;
      }
    }
    const cleanDesc = stripHtml(rawDesc);

    // 4. PubDate (hỗ trợ pubDate, dc:date, published, updated)
    let rawPubDate: string | null = null;
    const pubDateNodes = itemNode.getElementsByTagName('pubDate');
    if (pubDateNodes.length > 0 && pubDateNodes[0].textContent) {
      rawPubDate = pubDateNodes[0].textContent;
    } else {
      const dcDateNodes = itemNode.getElementsByTagName('dc:date');
      if (dcDateNodes.length > 0 && dcDateNodes[0].textContent) {
        rawPubDate = dcDateNodes[0].textContent;
      } else {
        const publishedNodes = itemNode.getElementsByTagName('published');
        if (publishedNodes.length > 0 && publishedNodes[0].textContent) {
          rawPubDate = publishedNodes[0].textContent;
        } else {
          const updatedNodes = itemNode.getElementsByTagName('updated');
          if (updatedNodes.length > 0 && updatedNodes[0].textContent) {
            rawPubDate = updatedNodes[0].textContent;
          }
        }
      }
    }
    const pubDateStr = parseRssDate(rawPubDate);

    // 5. Thumbnail (thứ tự ưu tiên: enclosure -> media:thumbnail/media:content -> thẻ <img> trong desc)
    let thumbnail = '';

    // Enclosure
    const enclosures = itemNode.getElementsByTagName('enclosure');
    if (enclosures && enclosures.length > 0) {
      for (let i = 0; i < enclosures.length; i++) {
        const enc = enclosures[i];
        const encUrl = (enc.getAttribute('url') || '').trim();
        const encType = enc.getAttribute('type') || '';
        if (encUrl && (encType.includes('image') || /\.(jpe?g|png|webp|avif|gif)/i.test(encUrl))) {
          thumbnail = encUrl;
          break;
        }
      }
    }

    // Media thumbnail
    if (!thumbnail) {
      const mediaThumbnails = itemNode.getElementsByTagName('media:thumbnail');
      for (let i = 0; i < mediaThumbnails.length; i++) {
        const u = (mediaThumbnails[i].getAttribute('url') || '').trim();
        if (u) {
          thumbnail = u;
          break;
        }
      }
    }

    // Media content
    if (!thumbnail) {
      const mediaContents = itemNode.getElementsByTagName('media:content');
      for (let i = 0; i < mediaContents.length; i++) {
        const u = (mediaContents[i].getAttribute('url') || '').trim();
        const type = mediaContents[i].getAttribute('type') || '';
        const medium = mediaContents[i].getAttribute('medium') || '';
        if (u && (medium === 'image' || type.includes('image') || /\.(jpe?g|png|webp|avif|gif)/i.test(u) || !type)) {
          thumbnail = u;
          break;
        }
      }
    }

    // Thẻ img trong description hoặc rawDesc (bỏ qua src rỗng)
    if (!thumbnail) {
      const foundInDesc = extractFirstImageUrl(rawDesc);
      if (foundInDesc && foundInDesc.trim()) {
        thumbnail = foundInDesc.trim();
      }
    }

    // Fallback thumbnail nếu không tìm thấy
    if (!thumbnail) {
      thumbnail = `https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=400&auto=format&fit=crop&q=80`;
    }

    const articleId = generateArticleId(cleanLink);
    const dateStr = getVietnamDateString(pubDateStr);

    articles.push({
      id: articleId,
      title: cleanTitle,
      link: cleanLink,
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
    const rawLink = (item.link || '').trim();
    const link = normalizeLink(rawLink);
    if (!cleanTitle || !link) return;

    const dedupeKey = normalizeTitleForDedupe(cleanTitle);
    if (seenKeys.has(link) || seenKeys.has(dedupeKey)) return;
    seenKeys.add(link);
    seenKeys.add(dedupeKey);

    const cleanDesc = stripHtml(item.description || item.content || '');
    const pubDateStr = parseRssDate(item.pubDate);

    // Thumbnail: enclosure -> thumbnail -> img in description
    let thumbnail = '';
    if (item.enclosure?.link && item.enclosure?.type?.includes('image')) {
      thumbnail = item.enclosure.link;
    }
    if (!thumbnail && item.thumbnail) {
      thumbnail = item.thumbnail;
    }
    if (!thumbnail) {
      const fromDesc = extractFirstImageUrl(item.description || '') || extractFirstImageUrl(item.content || '');
      if (fromDesc && fromDesc.trim()) thumbnail = fromDesc.trim();
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
      const response = await fetchWithTimeout(proxyUrl, proxy.timeoutMs);
      if (!response.ok) {
        if (proxy.name === 'server') {
          let errJson: { error?: string; upstreamStatus?: number | null } | null = null;
          try {
            errJson = await response.json();
          } catch {
            // bỏ qua lỗi parse JSON
          }

          const upstreamStatus = errJson?.upstreamStatus;
          const serverError = errJson?.error || `Báo trả về HTTP ${upstreamStatus || response.status}`;

          proxyErrors.push({
            proxy: proxy.name,
            error: serverError,
          });

          // Nếu server trả upstreamStatus 401, 403, 404 hoặc 410 thì dừng luôn, không thử các proxy còn lại
          if ([401, 403, 404, 410].includes(upstreamStatus || 0)) {
            const latencyMs = Date.now() - startTime;
            return {
              status: 'error',
              articles: [],
              error: serverError,
              proxyUsed: null,
              latencyMs,
              fetchedAt: fetchedAtIso,
              proxyErrors,
            };
          }

          throw new Error(serverError);
        }

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
        if (text.trim().startsWith('<!DOCTYPE html') || text.trim().startsWith('<html') || text.trim().startsWith('<!doctype html')) {
          throw new Error('Máy chủ trả về trang HTML thay vì dữ liệu RSS/XML');
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
      if (!proxyErrors.some((p) => p.proxy === proxy.name)) {
        proxyErrors.push({
          proxy: proxy.name,
          error: errMsg,
        });
      }
      // Tiếp tục fallback sang proxy tiếp theo
    }
  }

  // Nếu tất cả proxy đều thất bại
  const latencyMs = Date.now() - startTime;
  let friendlyReason = '';

  const serverError = proxyErrors.find((e) => e.proxy === 'server');
  if (serverError && serverError.error) {
    // Hiển thị lý do thật từ server (bỏ tiền tố nội bộ nếu có)
    friendlyReason = serverError.error
      .replace(/^(Lỗi server|Server error|Error|Fetch error):\s*/i, '')
      .trim();
  }

  if (!friendlyReason) {
    if (proxyErrors.some((e) => e.error.includes('Hết thời gian chờ'))) {
      friendlyReason = 'Hết thời gian chờ (Timeout)';
    } else if (proxyErrors.every((e) => e.error.includes('Không phải định dạng RSS'))) {
      friendlyReason = 'Không phải định dạng RSS hợp lệ';
    } else if (proxyErrors.some((e) => e.error.includes('không có bài nào'))) {
      friendlyReason = 'Feed không có bài nào';
    } else {
      friendlyReason = 'Tất cả proxy đều thất bại';
    }
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
