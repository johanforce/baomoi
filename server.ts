import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
const FETCH_TIMEOUT_MS = 15 * 1000; // 15 giây
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB

interface CacheEntry {
  content: string;
  timestamp: number;
}

// In-memory cache theo URL
const cache = new Map<string, CacheEntry>();

// Gộp các request trùng nhau đang chạy (in-flight)
const inFlightRequests = new Map<string, Promise<string>>();

class UpstreamError extends Error {
  upstreamStatus: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'UpstreamError';
    this.upstreamStatus = status;
  }
}

/**
 * Kiểm tra hostname có thuộc dải mạng nội bộ hoặc nguy hiểm không (SSRF protection)
 */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0' || h.endsWith('.local')) {
    return true;
  }

  // Kiểm tra IPv4 dạng a.b.c.d
  const parts = h.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255)) {
    const [a, b, c, d] = parts.map(Number);
    if (a === 0 && b === 0 && c === 0 && d === 0) return true; // 0.0.0.0
    if (a === 127) return true; // 127.x.x.x
    if (a === 10) return true; // 10.x.x.x
    if (a === 192 && b === 168) return true; // 192.168.x.x
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0 - 172.31.255.255
    if (a === 169 && b === 254) return true; // 169.254.x.x
  }

  return false;
}

/**
 * Xác thực và phân tích URL an toàn
 */
function validateFeedUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('URL không hợp lệ');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Giao thức URL không hợp lệ (chỉ hỗ trợ http và https)');
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new Error('Địa chỉ máy chủ không được phép truy cập');
  }

  return parsed;
}

/**
 * Tải nội dung feed từ upstream server với bảo mật, timeout và giới hạn dung lượng
 */
async function fetchFeedFromUpstream(initialUrl: string): Promise<string> {
  let currentUrl = validateFeedUrl(initialUrl).toString();
  const maxRedirects = 5;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response: globalThis.Response | null = null;

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, application/atom+xml;q=0.7, */*;q=0.5',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.5',
        },
      });

      // Xử lý chuyển hướng (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new UpstreamError(`Báo trả về HTTP ${response.status} không có header Location`, response.status);
        }

        const nextUrl = new URL(location, currentUrl).toString();
        // Kiểm tra lại host sau redirect (chặn SSRF)
        validateFeedUrl(nextUrl);
        currentUrl = nextUrl;
        continue;
      }

      break;
    }

    if (!response) {
      throw new Error('Không thể kết nối đến máy chủ báo');
    }

    if (!response.ok) {
      throw new UpstreamError(`Báo trả về HTTP ${response.status}`, response.status);
    }

    // Kiểm tra kích thước từ Content-Length nếu có
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      throw new Error('Nội dung feed vượt quá giới hạn 5MB');
    }

    // Đọc body dạng stream để kiểm soát dung lượng tối đa 5MB
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf-8') > MAX_BODY_SIZE) {
        throw new Error('Nội dung feed vượt quá giới hạn 5MB');
      }
      return text;
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        receivedBytes += value.byteLength;
        if (receivedBytes > MAX_BODY_SIZE) {
          try {
            await reader.cancel();
          } catch {
            // bỏ qua
          }
          throw new Error('Nội dung feed vượt quá giới hạn 5MB');
        }
        chunks.push(value);
      }
    }

/**
 * Chuẩn hóa XML: sửa các ký tự & trần chưa được escape thành &amp; (lỗi rất phổ biến ở các báo VN)
 */
function sanitizeXmlEntities(xml: string): string {
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

    const buffer = Buffer.concat(chunks);
    const decoder = new TextDecoder('utf-8');
    const rawXml = decoder.decode(buffer);
    return sanitizeXmlEntities(rawXml);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Route GET /api/feed?url=<feed_url>
 */
app.get('/api/feed', async (req: Request, res: Response) => {
  const feedUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';

  if (!feedUrl) {
    return res.status(400).json({
      error: 'Thiếu tham số url',
      upstreamStatus: null,
    });
  }

  // 1. Kiểm tra cache còn hạn (< 5 phút)
  const cached = cache.get(feedUrl);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.send(cached.content);
  }

  // 2. Kiểm tra xem có request cùng URL đang chạy (in-flight) hay không
  let fetchPromise = inFlightRequests.get(feedUrl);

  if (!fetchPromise) {
    fetchPromise = fetchFeedFromUpstream(feedUrl)
      .then((content) => {
        // Lưu cache khi thành công
        cache.set(feedUrl, {
          content,
          timestamp: Date.now(),
        });
        return content;
      })
      .finally(() => {
        inFlightRequests.delete(feedUrl);
      });

    inFlightRequests.set(feedUrl, fetchPromise);
  }

  try {
    const xmlContent = await fetchPromise;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.send(xmlContent);
  } catch (err: unknown) {
    // Nếu tải lỗi mà còn bản cache cũ (kể cả đã hết hạn) thì vẫn trả bản cũ
    if (cached) {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.send(cached.content);
    }

    // Xử lý các loại lỗi
    if ((err as Error)?.name === 'AbortError') {
      return res.status(504).json({
        error: 'Báo phản hồi quá chậm (>15s)',
        upstreamStatus: 504,
      });
    }

    if (err instanceof UpstreamError) {
      return res.status(502).json({
        error: err.message,
        upstreamStatus: err.upstreamStatus,
      });
    }

    const msg = (err as Error)?.message || 'Lỗi không xác định khi tải feed';
    if (msg.includes('không hợp lệ') || msg.includes('không được phép')) {
      return res.status(400).json({
        error: msg,
        upstreamStatus: null,
      });
    }

    if (msg.includes('vượt quá giới hạn 5MB')) {
      return res.status(502).json({
        error: msg,
        upstreamStatus: null,
      });
    }

    return res.status(502).json({
      error: msg,
      upstreamStatus: null,
    });
  }
});

// Phục vụ frontend
async function setupFrontend() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server Lều Báo đang lắng nghe tại http://${HOST}:${PORT}`);
  });
}

setupFrontend().catch((err) => {
  console.error('Lỗi khởi động frontend:', err);
  process.exit(1);
});
