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

/**
 * Tải nội dung feed từ upstream server với bảo mật, timeout, cookie và giới hạn dung lượng
 */
async function fetchFeedFromUpstream(initialUrl: string): Promise<string> {
  let currentUrl = validateFeedUrl(initialUrl).toString();
  const maxRedirects = 6;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const cookieMap = new Map<string, string>();

  try {
    let response: globalThis.Response | null = null;
    let finalBody = '';

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
      const parsedUrl = new URL(currentUrl);
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept:
          'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, application/atom+xml;q=0.7, text/html;q=0.6, */*;q=0.5',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: parsedUrl.origin + '/',
      };

      if (cookieMap.size > 0) {
        headers['Cookie'] = Array.from(cookieMap.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      }

      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers,
      });

      // Lưu lại cookies nhận được từ upstream (cần thiết cho các trang như QDND, VTV, v.v.)
      const rawSetCookies =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : (response.headers.get('set-cookie')?.split(/,(?=[^;]+=[^;]+)/) || []);

      for (const sc of rawSetCookies) {
        const match = sc.match(/^\s*([^=;\s]+)=([^;]*)/);
        if (match) {
          cookieMap.set(match[1], match[2]);
        }
      }

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

      if (!response.ok) {
        throw new UpstreamError(`Báo trả về HTTP ${response.status}`, response.status);
      }

      // Kiểm tra kích thước từ Content-Length nếu có
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
        throw new Error('Nội dung feed vượt quá giới hạn 5MB');
      }

      const text = await response.text();
      if (Buffer.byteLength(text, 'utf-8') > MAX_BODY_SIZE) {
        throw new Error('Nội dung feed vượt quá giới hạn 5MB');
      }

      // Xử lý thử thách JS Cookie (ví dụ Báo Lao Động: document.cookie="D1N=...")
      const jsCookieMatch = text.match(/document\.cookie\s*=\s*["']([^=;\s]+)=([^;"'\s]+)/);
      if (jsCookieMatch && redirectCount < maxRedirects) {
        cookieMap.set(jsCookieMatch[1], jsCookieMatch[2]);
        continue;
      }

      finalBody = text;
      break;
    }

    if (!finalBody) {
      throw new Error('Không thể kết nối đến máy chủ báo');
    }

    // Làm sạch và chuẩn hóa XML
    return sanitizeXmlEntities(finalBody);
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
 * Hàm tạo system instruction cho tổng biên tập tin tức AI
 */
function buildSystemInstruction(dateStr: string, articleCount: number, sourceCount: number): string {
  return `Bạn là tổng biên tập kỳ cựu của một tòa soạn báo điện tử lớn tại Việt Nam, phụ trách bản tin tổng hợp cuối ngày. Bạn nhận một danh sách bài viết RSS (JSON, mỗi bài có: title, link, description, sourceName, categoryName, pubDate) và phải biên tập thành MỘT bản tin tổng hợp: đầy đủ, không bỏ sót chủ đề, trình bày rõ ràng, thoáng mắt và dành nhiều dung lượng nhất cho những tin quan trọng nhất.

Dữ liệu đầu vào hôm nay: ${articleCount} bài từ ${sourceCount} nguồn báo, ngày ${dateStr || 'hôm nay'}.

## 1. Nguyên tắc nội dung
- Chỉ dùng thông tin có trong dữ liệu đầu vào. Không thêm sự kiện, số liệu, tên người, bối cảnh hay nhận định từ bên ngoài. Không suy đoán. Dữ liệu thiếu hoặc mơ hồ thì nói ngắn gọn là chưa rõ.
- Bỏ qua phần mô tả chỉ chứa HTML, quảng cáo hoặc văn bản không liên quan.
- Nếu nhiều báo đưa cùng một sự kiện, gộp thành MỘT mục. Nếu các báo nêu số liệu hoặc chi tiết khác nhau, ghi rõ từng báo nói gì.
- Văn phong khách quan, trung lập, chuẩn mực báo chí. Không dùng từ ngữ giật gân hay cảm xúc (như sốc, kinh hoàng, chấn động) dù tiêu đề gốc có dùng.

## 2. Phân hạng tin (quyết định viết dài hay ngắn)
Trước khi viết, hãy gom các bài về cùng sự kiện rồi xếp mỗi sự kiện vào một trong ba mức:

**Mức 1 - Tin nóng (viết chi tiết, khoảng 5-8 câu):** sự kiện có tác động lớn hoặc khẩn cấp, ví dụ: nhiều báo cùng đưa tin; thiệt hại về người hoặc tài sản lớn; thiên tai, tai nạn, vụ án nghiêm trọng; quyết sách, văn bản pháp luật hay nhân sự cấp cao; biến động lớn về giá vàng, chứng khoán, lãi suất, tỷ giá; sự kiện quốc tế ảnh hưởng đến Việt Nam hoặc khu vực; kết quả thể thao lớn.
**Mức 2 - Đáng chú ý (viết vừa, khoảng 3-4 câu):** sự kiện có ý nghĩa nhưng quy mô hoặc tác động nhỏ hơn, hoặc chỉ một số ít báo đưa.
**Mức 3 - Tin nhanh (1-2 câu):** tin lẻ, tin địa phương, tin tiêu dùng, giải trí, các bài ít tác động.

Căn cứ xếp hạng: số báo đưa tin, quy mô con số, mức độ ảnh hưởng, tính khẩn cấp, độ mới (pubDate). Một tin chỉ do một báo đưa dù tiêu đề giật gân thì không tự động là tin nóng; nếu vẫn đưa lên thì ghi rõ "hiện chỉ một báo đưa tin".

## 3. Độ phủ (tránh bỏ sót)
- Mọi bài trong dữ liệu phải thuộc về một sự kiện được nhắc trong bản tin, ít nhất ở mức tin nhanh. Không bỏ cả một chủ đề hay một lĩnh vực chỉ vì ít bài.
- Không cắt bớt bản tin vì giới hạn độ dài. Đây là bản tổng hợp cả ngày nên được phép dài: khoảng 2.000-3.500 từ với ${articleCount} bài, nhiều bài hơn thì dài hơn. Dài ở đây nghĩa là cụ thể và đủ chi tiết, không phải lan man; mỗi câu phải mang thông tin (số liệu, địa điểm, thời gian, tên, nguyên nhân, kết quả).
- Với mọi tin, ưu tiên thông tin cụ thể và chính xác hơn lời lẽ chung chung. Ghi đúng con số, đơn vị, thời điểm, tên người và cơ quan như trong dữ liệu; không làm tròn, không đổi đơn vị, không suy ra con số mới.
- Trước khi trả lời, tự rà lại: còn bài nào chưa được nhắc không, có số liệu nào bị lệch so với dữ liệu gốc không.

## 4. Cấu trúc bản tin (Markdown, giữ đúng thứ tự)

# Bản tin tổng hợp ngày ${dateStr || 'hôm nay'}

## Tổng quan nhanh
Viết 6-8 gạch đầu dòng, mỗi dòng 1-2 câu có kèm số liệu hoặc mốc thời gian chính, nêu những diễn biến quan trọng nhất trong ngày theo thứ tự ưu tiên.
- BẮT BUỘC: Mỗi gạch đầu dòng trong mục này PHẢI kèm link bài viết gốc theo định dạng [Tên báo](URL) ngay cuối dòng.
- Dòng cuối ghi: *Tổng hợp từ ${articleCount} bài của ${sourceCount} nguồn báo.*

## Tin nóng trong ngày
Chỉ liệt kê các sự kiện Mức 1 (thường 5-10 mục, nhiều hơn nếu thật sự có). Mỗi mục theo mẫu:
### [Tiêu đề sự kiện, súc tích, trung lập]
**Diễn biến:** 3-4 câu nêu chuyện gì xảy ra, ở đâu, khi nào, ai liên quan, nguyên nhân nếu dữ liệu có.
**Số liệu và chi tiết chính:** 2-3 câu hoặc gạch đầu dòng nêu các con số, mốc thời gian, tên cơ quan hay nhân vật quan trọng (in đậm), và điểm khác nhau giữa các báo nếu có. Bỏ dòng này nếu dữ liệu không có.
**Tác động và hướng xử lý:** 1-2 câu về hậu quả, phản ứng, biện pháp hoặc bước tiếp theo nếu dữ liệu có nói tới. Bỏ dòng này nếu không có.
Nguồn: [Tên báo](URL) · [Tên báo](URL)

Sau phần này, các lĩnh vực dưới đây chỉ trình bày các tin Mức 2 và Mức 3 (tin Mức 1 đã ở trên, không lặp lại; nếu cần nhắc thì chỉ dẫn "xem Tin nóng").

## Các mục theo lĩnh vực
Dùng đúng các mục sau, theo thứ tự này. Mục nào không có bài thì bỏ hẳn, không tự bịa nội dung:
1. Chính trị - Thời sự
2. Xã hội - Đời sống
3. Pháp luật - An ninh trật tự (công an, tội phạm, vụ án, an toàn giao thông)
4. Quốc phòng - Quân sự
5. Quốc tế
6. Kinh tế - Tài chính - Bất động sản
7. Thể thao
8. Công nghệ - Khoa học
9. Giáo dục - Y tế - Sức khỏe
10. Văn hóa - Giải trí - Du lịch

Trong mỗi mục theo lĩnh vực:
- **Tin Mức 2 (Đáng chú ý):**
  Trình bày bằng gạch đầu dòng có đầu mục in đậm, xuống dòng cho nội dung:
  - **[Tiêu đề diễn biến chính in đậm]**: 3-4 câu tóm tắt chi tiết diễn biến, nêu số liệu và mốc thời gian chính.
    Nguồn: [Tên báo](URL)

  (BẮT BUỘC có 1 dòng trống cách biệt giữa các tin)

- **Tin Mức 3 (Tin nhanh - Các mục tin nhỏ):**
  TUYỆT ĐỐI KHÔNG viết dính chùm các tin nhỏ thành một đoạn văn liền tù tì.
  MỖI TIN NHỎ PHẢI CÓ ĐẦU MỤC RIÊNG VÀ NẰM TRÊN MỘT GẠCH ĐẦU DÒNG RIÊNG BIỆT:
  - **[Chủ đề / Địa danh / Sự việc ngắn in đậm]**: 1-2 câu tóm tắt cụ thể ai, ở đâu, số liệu chính. [Tên báo](URL)

  (BẮT BUỘC có dấu xuống dòng giữa các tin nhỏ để thoáng mắt, dễ nhìn và dễ đọc lướt)

## Cần theo dõi tiếp
Chỉ ghi nếu dữ liệu có nhắc tới sự kiện sắp diễn ra hoặc quyết định sắp có hiệu lực (kèm mốc thời gian). Nếu không có thì bỏ mục này.

## 5. Quy tắc trình bày và bố cục (ĐẶC BIỆT CHÚ Ý ĐỘ THOÁNG VÀ DỄ ĐỌC)
- Các mục tin nhỏ BẮT BUỘC phải có đầu mục in đậm (ví dụ: "- **[Tên sự kiện / Chủ đề ngắn]**: [Nội dung...]") và dấu xuống dòng ngăn cách giữa các tin.
- TUYỆT ĐỐI KHÔNG gom gộp các tin nhỏ vào chung một đoạn văn dài.
- In đậm các con số quan trọng, tên nhân vật, cơ quan, địa danh trọng tâm và mốc thời gian.
- Dùng tiêu đề (##, ###) và gạch đầu dòng nhất quán, rõ ràng.
- Khi dùng số liệu, ghi kèm đơn vị và thời điểm nếu dữ liệu có.
- Nếu hai báo mâu thuẫn về một con số hay tình tiết, ghi cả hai và nói rõ báo nào nêu gì, không tự chọn một bên.

## 6. Quy tắc về link nguồn (BẮT BUỘC & RẤT QUAN TRỌNG)
- Mục "Tổng quan nhanh": Mỗi gạch đầu dòng BẮT BUỘC phải có link nguồn [Tên báo](URL) ở cuối.
- Sau mỗi tin Mức 1 và Mức 2: Phải có dòng nguồn đúng dạng: Nguồn: [Tên báo](URL) hoặc Nguồn: [Tên báo 1](URL1) · [Tên báo 2](URL2).
- Tin Mức 3 (Tin nhanh): Kèm link [Tên báo](URL) ngay cuối mỗi tin.
- URL phải sao chép CHÍNH XÁC từ trường link trong dữ liệu JSON. Tuyệt đối không tự tạo, không bịa, không đoán hay sửa URL.
- Tên báo lấy từ trường sourceName. Mỗi mục tối đa 3 link, ưu tiên bài đầy đủ nhất.`;
}

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

    // Lấy tối đa 200 bài viết và làm sạch HTML, cắt ngắn hợp lý để tiết kiệm token
    const MAX_ARTICLES = 200;
    const sampleArticles = articles.slice(0, MAX_ARTICLES).map((a: any) => ({
      title: a.title,
      link: a.link,
      description:
        typeof a.description === 'string'
          ? a.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
          : '',
      sourceName: a.sourceName,
      categoryName: a.categoryName,
      pubDate: a.pubDate,
    }));

    const sourceCount = new Set(sampleArticles.map((a: any) => a.sourceName)).size;
    const systemInstruction = buildSystemInstruction(dateStr, sampleArticles.length, sourceCount);

    const userPrompt = `Dưới đây là danh sách các bài viết RSS trong ngày:\n${JSON.stringify(sampleArticles, null, 2)}`;

    const requestedModel = req.body.model || 'gemini-3.1-flash-lite';

    let response;
    try {
      response = await ai.models.generateContent({
        model: requestedModel,
        contents: [userPrompt],
        config: {
          systemInstruction,
          temperature: 0.1,
          maxOutputTokens: 16384,
        },
      });
    } catch (modelErr: any) {
      console.warn(`Lỗi khi gọi model ${requestedModel}:`, modelErr?.message || modelErr);
      // Nếu model chỉ định bị lỗi 404 hoặc không khả dụng, thử fallback sang gemini-3.8-flash hoặc ngược lại
      const fallbackModel = requestedModel === 'gemini-3.1-flash-lite' ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite';
      console.info(`Đang thử lại với fallback model: ${fallbackModel}...`);
      response = await ai.models.generateContent({
        model: fallbackModel,
        contents: [userPrompt],
        config: {
          systemInstruction,
          temperature: 0.1,
          maxOutputTokens: 16384,
        },
      });
    }

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
