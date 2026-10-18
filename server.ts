import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
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
    return res.status(502).json({
      error: msg,
      upstreamStatus: null,
    });
  }
});

import { GoogleGenAI } from '@google/genai';

let runtimeApiKey = '';

app.post('/api/set-api-key', (req: Request, res: Response) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'API key không hợp lệ' });
  }
  runtimeApiKey = apiKey.trim();
  return res.json({ success: true, message: 'Đã lưu API Key thành công' });
});

app.get('/api/check-api-key', (_req: Request, res: Response) => {
  const hasKey = Boolean(runtimeApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY);
  return res.json({ configured: hasKey });
});

/**
 * Route POST /api/ai-summary
 * Nhận danh sách bài viết và gọi Gemini AI để tạo bản tin tổng hợp chi tiết
 */
app.post('/api/ai-summary', async (req: Request, res: Response) => {
  try {
    const { articles, dateStr } = req.body;
    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'Danh sách bài viết trống' });
    }

    const apiKey = runtimeApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key của khách qua phần cài đặt ở modal bản tin AI.' 
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Lấy tối đa 70 bài viết để phân tích sâu
    const sampleArticles = articles.slice(0, 70).map((a: any) => ({
      title: a.title,
      link: a.link,
      description: a.description,
      sourceName: a.sourceName,
      categoryName: a.categoryName,
      pubDate: a.pubDate,
    }));

    const systemInstruction = `Bạn là tổng biên tập kỳ cựu của một tòa soạn báo điện tử lớn tại Việt Nam, phụ trách bản tin tổng hợp cuối ngày. Nhiệm vụ của bạn là phân tích sâu danh sách các bài viết RSS trong ngày, tổng hợp thành MỘT bản tin cực kỳ chất lượng, chi tiết, chuyên nghiệp, làm nổi bật các tiêu đề sự kiện, các con số quan trọng, mốc thời gian và nhân vật liên quan.

## Nguyên tắc nội dung & Chi tiết
1. Chỉ dùng thông tin có trong dữ liệu đầu vào. Không thêm sự kiện, số liệu, tên người, bối cảnh hay nhận định từ bên ngoài. Không suy đoán. Nếu dữ liệu thiếu hoặc mơ hồ thì nói ngắn gọn.
2. Gộp các bài của nhiều báo cùng nói về một sự kiện thành MỘT mục lớn. Nếu các báo nêu số liệu hoặc chi tiết khác nhau, hãy làm rõ sự khác biệt giữa các báo.
3. Chọn lọc: ưu tiên sự kiện quan trọng, ảnh hưởng rộng, tác động lớn đến xã hội hoặc được nhiều báo cùng đưa tin.
4. Trình bày chi tiết, chuyên nghiệp: Mỗi mục gồm **Tiêu đề sự kiện nổi bật**, phần phân tích tóm tắt chi tiết từ 3-5 câu nêu rõ nguyên nhân, diễn biến, số liệu mấu chốt, và kết luận/hướng xử lý.
5. Văn phong: Khách quan, trung lập, chuẩn mực báo chí Việt Nam, ngôn từ súc tích, mạch lạc.
6. Định dạng Markdown: Sử dụng in đậm (**bold**) cho các con số quan trọng, tên nhân vật, cơ quan, mốc thời gian để người đọc dễ nắm bắt điểm mấu chốt ngay lập tức.

## Quy tắc về link nguồn (CỰC KỲ QUAN TRỌNG)
- Sau MỖI mục tóm tắt phải có dòng nguồn theo đúng định dạng Markdown link chính xác: \`Nguồn: [Tên báo](URL)\` hoặc \`Nguồn: [Tên báo 1](URL1) · [Tên báo 2](URL2)\`.
- URL phải được sao chép CHÍNH XÁC từ trường "link" trong dữ liệu đầu vào. Tuyệt đối không tự tạo, đoán hay sửa URL.
- Mỗi mục tối đa 3 link, ưu tiên bài đầy đủ chi tiết nhất. Tên báo lấy từ trường "sourceName".

## Cấu trúc bản tin (Markdown)
# Bản tin tổng hợp ngày ${dateStr || 'hôm nay'}

**Điểm tin nổi bật trong ngày**
- (Gạch đầu dòng 1 nêu sự kiện trọng tâm nổi bật nhất)
- (Gạch đầu dòng 2...)
- (Gạch đầu dòng 3...)

## 1. Thời sự & Chính trị - Xã hội
### **{Tiêu đề sự kiện 1}**
{Nội dung tóm tắt chi tiết 3-5 câu, làm nổi bật **các số liệu**, thời gian, diễn biến chính}
Nguồn: [Tên báo](URL)

### **{Tiêu đề sự kiện 2}**
...

## 2. Kinh tế & Tài chính - Thị trường
## 3. Thể thao & Giải trí
## 4. Công nghệ & Đời sống

- Mỗi nhóm có 2-4 mục chi tiết tùy lượng tin. Tổng độ dài khoảng 800-1200 từ, đảm bảo mang lại góc nhìn tổng quan sâu sắc cho độc giả bận rộn đọc trong 3-5 phút.`;

    const userPrompt = `Dưới đây là danh sách các bài viết RSS trong ngày:\n${JSON.stringify(sampleArticles, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [userPrompt],
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const summaryText = response.text || 'Không thể tạo bản tin tổng hợp.';
    return res.json({ success: true, summary: summaryText });
  } catch (err: any) {
    console.error('Lỗi API AI Summary:', err);
    return res.status(500).json({ error: err?.message || 'Lỗi khi tạo bản tin AI' });
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
