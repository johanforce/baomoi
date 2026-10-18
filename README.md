# TinTổngHợp - Ứng Dụng Web Đọc Báo Tổng Hợp Việt Nam

Ứng dụng đọc báo tổng hợp tin tức hằng ngày từ các báo điện tử uy tín của Việt Nam (VnExpress, Tuổi Trẻ, Thanh Niên, Dân Trí, VietNamNet, CafeF, CafeBiz, Tinhte...) chạy hoàn toàn phía client (React + TypeScript + Tailwind CSS), giao diện hiện đại phong cách Báo Mới (baomoi.com).

---

## 1. Tính Năng Nổi Bật

- **Đọc tin đa chiều kết hợp**:
  1. **Theo ngày**: Xem tin theo từng ngày (Hôm nay, Hôm qua, date picker, múi giờ Việt Nam `Asia/Ho_Chi_Minh`).
  2. **Theo từng trang báo**: Lọc và bật/tắt từng đầu báo cụ thể, kèm số lượng bài và chấm trạng thái hoạt động.
  3. **Theo danh mục**: "Mới nhất", "Tin tức & Thời sự tổng hợp", "Tài chính & Kinh tế", "Thể thao", "Công nghệ & Đời sống".
- **Giao diện 3 cột phong cách Báo Mới**:
  - Cột trái: Bộ lọc ngày và danh sách nguồn báo.
  - Cột giữa: Bài nổi bật (Hero story) + Danh sách tin tức với ảnh và trích dẫn, nút "Xem thêm" phân trang.
  - Cột phải: Tin mới cập nhật (xếp hạng 01, 02... 10) và biểu đồ thống kê số bài theo từng báo.
- **Trang Quản lý nguồn RSS trực quan (Quan trọng)**:
  - Xem danh sách toàn bộ 21 nguồn RSS phân theo chuyên mục.
  - Chấm trạng thái trực quan: 🟢 Xanh lá (Hoạt động), 🔴 Đỏ (Lỗi), ⚪ Xám (Chưa kiểm tra), 🟡 Vàng (Đang tải).
  - Trực tiếp sửa URL feed, nút "Lưu & tải lại" sáng lên khi có thay đổi.
  - Xem độ trễ phản hồi (ms), tên proxy hoạt động, số bài lấy được và thời gian kiểm tra.
  - Xem chi tiết lỗi gốc của từng proxy nếu fetch thất bại để dễ dàng khắc phục.
  - Nút "Mở feed" kiểm tra XML và "Trang RSS của báo" để lấy link mới nhất từ toà soạn.
  - Thêm nguồn mới với tính năng **Kiểm tra thử trước khi lưu**.
  - Xuất & Nhập file cấu hình JSON, khôi phục mặc định.
- **Lưu trữ & Đồng bộ**:
  - Dữ liệu bài viết lưu trên IndexedDB (`idb`), giữ tối đa 30 ngày, tự dọn bài cũ.
  - Cấu hình nguồn và trạng thái lưu trên `localStorage`.
  - Tự động làm mới nền mỗi 10 phút.
  - Tìm kiếm tiếng Việt không dấu ("bong da" khớp "bóng đá").
  - Đánh dấu bài đã đọc (làm mờ tiêu đề) và lưu bài đọc sau (bookmark).
  - Chế độ Sáng / Tối (Dark / Light mode).

---

## 2. Cách Đổi Proxy hoặc Chuyển Sang Backend Tự Host

Vì ứng dụng chạy 100% phía client trên trình duyệt, các yêu cầu lấy RSS từ các trang báo Việt Nam có thể bị chặn bởi cơ chế CORS (Cross-Origin Resource Sharing). Ứng dụng hiện sử dụng cơ chế fallback tự động qua 3 proxy công cộng trong file `src/services/rssService.ts`:

1. `api.rss2json.com`
2. `api.allorigins.win`
3. `corsproxy.io`

### Cách 1: Bổ sung hoặc đổi thứ tự Proxy trong `src/services/rssService.ts`

Bạn có thể mở file `src/services/rssService.ts` và thêm các CORS proxy khác vào mảng `PROXIES`:

```typescript
const PROXIES = [
  // Cloudflare Worker tự tạo (khuyên dùng nếu tự host)
  {
    name: 'my-cf-worker',
    type: 'raw' as const,
    buildUrl: (feedUrl: string) => `https://your-worker.yourname.workers.dev/?url=${encodeURIComponent(feedUrl)}`,
  },
  // Hoặc các proxy công cộng khác:
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
```

### Cách 2: Chuyển sang Backend Node.js / Express Proxy

Nếu proxy công cộng bị giới hạn số lượng request hoặc quá tải, bạn có thể triển khai một endpoint backend rất đơn giản:

#### Code Express (`server.ts` hoặc backend riêng):

```typescript
import express from 'express';
import fetch from 'node-fetch';

const app = express();

app.get('/api/rss-proxy', async (req, res) => {
  const feedUrl = req.query.url as string;
  if (!feedUrl) return res.status(400).send('Missing url parameter');

  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TinTongHop/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 10000,
    });
    const xml = await response.text();
    res.set('Content-Type', 'text/xml; charset=utf-8');
    res.send(xml);
  } catch (error: any) {
    res.status(502).json({ error: error.message });
  }
});

app.listen(3000);
```

Sau đó trong `src/services/rssService.ts`, bạn chỉ cần đặt proxy lên vị trí số 1:

```typescript
{
  name: 'backend-proxy',
  type: 'raw' as const,
  buildUrl: (feedUrl: string) => `/api/rss-proxy?url=${encodeURIComponent(feedUrl)}`,
}
```

Backend fetch trực tiếp từ server sẽ không bao giờ bị lỗi CORS và có tốc độ phản hồi cực nhanh.

---

## 3. Bản Quyền & Trích Dẫn

Toàn bộ bài viết khi người dùng nhấp vào đều mở trực tiếp liên kết bài viết gốc tại trang báo điện tử của cơ quan báo chí chủ quản (`target="_blank" rel="noopener noreferrer"`).
