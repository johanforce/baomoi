import { CategoryGroup, SourceItem } from '../types';
import { generateHash } from '../utils/hash';

type RawSource = CategoryGroup['sources'][number];

/**
 * true  = bật sẵn tất cả feed (kể cả kênh chi tiết)
 * false = chỉ bật nhóm feed chính trong DEFAULT_ENABLED_FEEDS, các kênh còn lại có sẵn nhưng tắt
 */
const ENABLE_ALL = false;

/** Tạo danh sách nguồn từ mẫu URL + danh sách [slug, tên kênh]. Tên rỗng = feed chính (chỉ hiện tên báo). */
function feeds(
  outlet: string,
  rssPage: string,
  urlOf: (slug: string) => string,
  items: [string, string][]
): RawSource[] {
  return items.map(([slug, name]) => ({
    title: name ? `${outlet} - ${name}` : outlet,
    rss_page: rssPage,
    feed_url: urlOf(slug),
  }));
}

// ---------- Mẫu URL ----------
const VNE = (s: string) => `https://vnexpress.net/rss/${s}.rss`;
const TT = (s: string) => `https://tuoitre.vn/${s}.rss`;            // KHÔNG có /rss/ ở giữa
const TN = (s: string) => `https://thanhnien.vn/rss/${s}.rss`;      // kênh con: kinh-te/ngan-hang
const DT = (s: string) => `https://dantri.com.vn/rss/${s}.rss`;
const VNN = (s: string) => `https://vietnamnet.vn/rss/${s}.rss`;
const INFO = (s: string) => `https://infonet.vietnamnet.vn/rss/${s}.rss`;
const NLD = (s: string) => `https://tuoitre.vn/nld/rss/${s}.rss`;   // kênh con: nld/{chuyên-mục}/{kênh-con}
const TTVH = (s: string) => `https://thethaovanhoa.vn/rss/${s}.rss`;
const SOHA = (s: string) => `https://soha.vn/rss/${s}.rss`;

// ---------- Trang RSS ----------
const P_VNE = "https://vnexpress.net/rss";
const P_TT = "https://tuoitre.vn/rss.htm";
const P_TN = "https://thanhnien.vn/rss.html";
const P_DT = "https://dantri.com.vn/rss.htm";
const P_VNN = "https://vietnamnet.vn";           // https://vietnamnet.vn/rss trả về 404
const P_INFO = "https://infonet.vietnamnet.vn/rss/";
const P_NLD = "https://tuoitre.vn/nld/rss.htm";
const P_24H = "https://www.24h.com.vn/guest/RSS/";
const P_TTVH = "https://thethaovanhoa.vn/rss.htm";
const P_SOHA = "https://soha.vn/rss.htm";

export const DEFAULT_RAW_CATEGORIES: CategoryGroup[] = [
  // =====================================================================
  {
    name: "Tin tức & Thời sự tổng hợp",
    sources: [
      // VnExpress
      ...feeds("VnExpress", P_VNE, VNE, [
        ["tin-moi-nhat", ""],
        ["tin-noi-bat", "Tin nổi bật"],
        ["tin-xem-nhieu", "Tin xem nhiều"],
        ["thoi-su", "Thời sự"],
        ["the-gioi", "Thế giới"],
        ["phap-luat", "Pháp luật"],
        ["giao-duc", "Giáo dục"],
        ["goc-nhin", "Góc nhìn"],
        ["y-kien", "Ý kiến"],
        ["tam-su", "Tâm sự"],
        ["spotlight", "Spotlight"],
      ]),

      // Tuổi Trẻ (pubDate kiểu Mỹ MM/DD/YYYY hh:mm:ss A, coi là giờ VN; ttl 50 phút)
      ...feeds("Báo Tuổi Trẻ", P_TT, TT, [
        ["home", ""],
        ["thoi-su", "Thời sự"],
        ["the-gioi", "Thế giới"],
        ["phap-luat", "Pháp luật"],
        ["giao-duc", "Giáo dục"],
        ["ban-doc", "Bạn đọc"],
        ["video", "Video"],
      ]),

      // Thanh Niên
      ...feeds("Báo Thanh Niên", P_TN, TN, [
        ["home", ""],
        ["thoi-su", "Thời sự"],
        ["chinh-tri", "Chính trị"],
        ["the-gioi", "Thế giới"],
        ["chao-ngay-moi", "Chào ngày mới"],
        ["giao-duc", "Giáo dục"],
        ["ban-doc", "Bạn đọc"],
        ["dien-dan", "Diễn đàn"],
        ["ban-can-biet", "Bạn cần biết"],
        ["tin-24h", "Tin 24h"],
        ["tin-nhanh-360", "Tin nhanh 360"],
        ["tno", "TNO"],
        ["video", "Video"],
        ["podcast", "Podcast"],
        ["magazine", "Magazine"],
        // Thời sự (kênh con)
        ["thoi-su/phap-luat", "Thời sự - Pháp luật"],
        ["thoi-su/dan-sinh", "Thời sự - Dân sinh"],
        ["thoi-su/lao-dong-viec-lam", "Thời sự - Lao động việc làm"],
        ["thoi-su/quyen-duoc-biet", "Thời sự - Quyền được biết"],
        ["thoi-su/quoc-phong", "Thời sự - Quốc phòng"],
        ["thoi-su/chong-tin-gia", "Thời sự - Chống tin giả"],
      ]),

      // Dân Trí
      ...feeds("Báo Dân Trí", P_DT, DT, [
        ["home", ""],
        ["su-kien", "Sự kiện"],
        ["thoi-su", "Thời sự"],
        ["the-gioi", "Thế giới"],
        ["lao-dong-viec-lam", "Lao động - Việc làm"],
        ["giao-duc", "Giáo dục"],
        ["phap-luat", "Pháp luật"],
        ["noi-vu", "Nội vụ"],
        ["ban-doc", "Bạn đọc"],
        ["tam-diem", "Tâm điểm"],
        ["tam-long-nhan-ai", "Tấm lòng nhân ái"],
        ["toa-dam-truc-tuyen", "Tọa đàm trực tuyến"],
        ["dnews", "DNews"],
        ["dt360", "DT360"],
        ["thoi-tiet", "Thời tiết"],
        ["photo-news", "Photo news"],
        ["photo-story", "Photo story"],
        ["infographic", "Infographic"],
        ["interactive", "Interactive"],
        ["dmagazine", "DMagazine"],
      ]),

      // VietNamNet (chỉ thoi-su đã xác nhận chạy tốt; các kênh còn lại lấy từ trang tổng hợp bên thứ ba, chưa kiểm tra)
      ...feeds("Báo VietNamNet", P_VNN, VNN, [
        ["thoi-su", "Thời sự"],
        ["thoi-su-chinh-tri", "Thời sự - Chính trị"],
        ["the-gioi", "Thế giới"],
        ["giao-duc", "Giáo dục"],
        ["phap-luat", "Pháp luật"],
        ["talkshow", "Talkshow"],
      ]),

      // Infonet (báo em của VietNamNet). CHƯA KIỂM TRA: mẫu URL suy đoán theo trang https://infonet.vietnamnet.vn/rss/
      ...feeds("Infonet", P_INFO, INFO, [
        ["home", "Trang chủ"],
        ["quan-su", "Quân sự"],
        ["chuyen-la", "Chuyện lạ"],
      ]),

      // Người Lao Động (đã chuyển sang tuoitre.vn/nld/).
      // CẢNH BÁO: bản tải được có thể bị kẹt cache (bài mới nhất 30/6/2026), lẫn quảng cáo, Content-Type là text/html
      ...feeds("Báo Người Lao Động", P_NLD, NLD, [
        ["home", ""],
        ["thoi-su", "Thời sự"],
        ["quoc-te", "Quốc tế"],
        ["lao-dong", "Lao động"],
        ["ban-doc", "Bạn đọc"],
        ["giao-duc-khoa-hoc", "Giáo dục - Khoa học"],
        ["phap-luat", "Pháp luật"],
        ["moi-truong", "Môi trường"],
        ["goc-nhin", "Góc nhìn"],
        ["noi-thang", "Nói thẳng"],
        ["doc-quyen", "Độc quyền"],
        ["vung-mien", "Vùng miền"],
        ["net-zero", "Net Zero"],
        ["video", "Video"],
        ["podcast", "Podcast"],
      ]),

      // VOV: tạm bỏ vì chưa tìm được feed còn hoạt động (https://vov.vn/rss chỉ có 3 bài cũ từ 5/2025).
      // Khi tìm được URL mới ở chân trang https://vov.vn thì thêm lại:
      // { title: "Báo VOV (Đài Tiếng nói Việt Nam)", rss_page: "https://vov.vn", feed_url: "<URL mới>" },

      // 24h: ttl 60 phút, bài mới nhất có thể cũ; mô tả chứa <img> với src rỗng
      {
        title: "Tin tức 24h",
        rss_page: P_24H,
        feed_url: "https://cdn.24h.com.vn/upload/rss/trangchu24h.rss"
      },

      // Thể Thao & Văn Hóa - tin tức 24h
      ...feeds("Báo Thể Thao & Văn Hóa", P_TTVH, TTVH, [
        ["tin-tuc-24h", "Tin tức 24h"],
      ]),

      // Soha
      ...feeds("Soha", P_SOHA, SOHA, [
        ["thoi-su-xa-hoi", "Thời sự - Xã hội"],
        ["quoc-te", "Quốc tế"],
        ["the-gioi", "Thế giới"],
        ["phap-luat", "Pháp luật"],
        ["viet-nam-vuon-minh", "Việt Nam vươn mình"],
        ["anh", "Ảnh"],
        ["infographic", "Infographic"],
        ["soha-shorts", "Soha Shorts"],
      ]),
    ]
  },

  // =====================================================================
  {
    name: "Tài chính & Kinh tế",
    sources: [
      // CafeF: feed trang chủ, ttl 15 phút, ngày giờ không chuẩn (năm 2 chữ số, múi giờ +07)
      { title: "CafeF", rss_page: "https://cafef.vn", feed_url: "https://cafef.vn/home.rss" },

      // CafeBiz: ~60 bài, ttl 15 phút, ảnh trong <img> của description, lastBuildDate dạng ISO
      { title: "CafeBiz", rss_page: "https://cafebiz.vn/index.rss", feed_url: "https://cafebiz.vn/rss/home.rss" },

      // VnEconomy: chưa kiểm tra; chỉ là chuyên mục chứng khoán
      { title: "VnEconomy - Chứng khoán", rss_page: "https://vneconomy.vn/rss.html", feed_url: "https://vneconomy.vn/chung-khoan.rss" },

      // VnBusiness: link bài có dấu // thừa, cần chuẩn hóa trước khi hash
      { title: "VnBusiness (Tạp chí Kinh Doanh)", rss_page: "https://vnbusiness.vn/rss", feed_url: "https://vnbusiness.vn/rss/feed.rss" },

      ...feeds("VnExpress", P_VNE, VNE, [
        ["kinh-doanh", "Kinh doanh"],
        ["bat-dong-san", "Bất động sản"],
      ]),

      ...feeds("Báo Tuổi Trẻ", P_TT, TT, [
        ["kinh-doanh", "Kinh doanh"],
      ]),

      ...feeds("Báo Thanh Niên", P_TN, TN, [
        ["kinh-te", "Kinh tế"],
        ["thi-truong", "Thị trường"],
        ["tieu-dung-thong-minh", "Tiêu dùng thông minh"],
        ["viec-lam", "Việc làm"],
        ["kinh-te/kinh-te-xanh", "Kinh tế - Kinh tế xanh"],
        ["kinh-te/chinh-sach-phat-trien", "Kinh tế - Chính sách phát triển"],
        ["kinh-te/ngan-hang", "Kinh tế - Ngân hàng"],
        ["kinh-te/chung-khoan", "Kinh tế - Chứng khoán"],
        ["kinh-te/doanh-nghiep", "Kinh tế - Doanh nghiệp"],
        ["kinh-te/doanh-nhan", "Kinh tế - Doanh nhân"],
        ["kinh-te/lam-giau", "Kinh tế - Làm giàu"],
        ["kinh-te/dia-oc", "Kinh tế - Địa ốc"],
      ]),

      ...feeds("Báo Dân Trí", P_DT, DT, [
        ["kinh-doanh", "Kinh doanh"],
        ["gia-vang", "Giá vàng"],
        ["bat-dong-san", "Bất động sản"],
      ]),

      ...feeds("Báo VietNamNet", P_VNN, VNN, [
        ["kinh-doanh", "Kinh doanh"],   // chưa kiểm tra
      ]),

      ...feeds("Infonet", P_INFO, INFO, [
        ["thi-truong", "Thị trường"],   // chưa kiểm tra
      ]),

      ...feeds("Báo Người Lao Động", P_NLD, NLD, [
        ["kinh-te", "Kinh tế"],
        ["thi-truong", "Thị trường"],
        ["dong-tien-thong-minh", "Dòng tiền thông minh"],
        ["dia-oc", "Địa ốc"],
      ]),

      ...feeds("Soha", P_SOHA, SOHA, [
        ["kinh-doanh", "Kinh doanh"],
        ["kinh-doanh/chung-khoan", "Kinh doanh - Chứng khoán"],
        ["kinh-doanh/thi-truong", "Kinh doanh - Thị trường"],
        ["sang-kien-esg", "Sáng kiến ESG"],
      ]),
    ]
  },

  // =====================================================================
  {
    name: "Thể thao",
    sources: [
      // Thể Thao & Văn Hóa (12 kênh chính thức; mới xác nhận URL, chưa tải nội dung)
      ...feeds("Báo Thể Thao & Văn Hóa", P_TTVH, TTVH, [
        ["trang-chu", ""],
        ["the-thao", "Thể thao"],
        ["bong-da-viet-nam", "Bóng đá Việt Nam"],
        ["bong-da-anh", "Bóng đá Anh"],
        ["bong-da-tay-ban-nha", "Bóng đá Tây Ban Nha"],
        ["cac-cup-chau-au", "Các cúp châu Âu"],
        ["du-doan-bong-da", "Dự đoán bóng đá"],
      ]),

      ...feeds("VnExpress", P_VNE, VNE, [
        ["the-thao", "Thể thao"],
      ]),

      ...feeds("Báo Tuổi Trẻ", P_TT, TT, [
        ["the-thao", "Thể thao"],
      ]),

      ...feeds("Báo Thanh Niên", P_TN, TN, [
        ["the-thao", "Thể thao"],
        ["the-thao/bong-da-viet-nam", "Thể thao - Bóng đá Việt Nam"],
        ["the-thao/bong-da-quoc-te", "Thể thao - Bóng đá quốc tế"],
        ["the-thao/bong-da-thanh-nien-sinh-vien", "Thể thao - Bóng đá Thanh niên sinh viên"],
        ["the-thao/the-thao-cong-dong", "Thể thao - Thể thao cộng đồng"],
        ["the-thao/cac-mon-khac", "Thể thao - Các môn khác"],
      ]),

      ...feeds("Báo Dân Trí", P_DT, DT, [
        ["the-thao", "Thể thao"],
      ]),

      ...feeds("Báo VietNamNet", P_VNN, VNN, [
        ["the-thao", "Thể thao"],       // chưa kiểm tra
      ]),

      ...feeds("Báo Người Lao Động", P_NLD, NLD, [
        ["the-thao", "Thể thao"],
        ["world-cup-2026", "World Cup 2026"],
      ]),

      // 24h: chưa kiểm tra thethao.rss
      {
        title: "Tin tức 24h - Thể thao",
        rss_page: P_24H,
        feed_url: "https://cdn.24h.com.vn/upload/rss/thethao.rss"
      },

      ...feeds("Soha", P_SOHA, SOHA, [
        ["the-thao", "Thể thao"],
        ["the-thao/viet-nam", "Thể thao - Việt Nam"],
        ["the-thao/anh", "Thể thao - Anh"],
      ]),
    ]
  },

  // =====================================================================
  {
    name: "Công nghệ & Đời sống",
    sources: [
      // Tinh Tế: trang chặn bot, chưa kiểm tra được
      { title: "Tinh Tế", rss_page: "https://tinhte.vn/rss/", feed_url: "https://tinhte.vn/rss/" },
      // Chưa kiểm tra
      { title: "Trải Nghiệm Số", rss_page: "https://trainghiemso.vn", feed_url: "https://trainghiemso.vn/feed/" },
      { title: "GameK", rss_page: "https://gamek.vn", feed_url: "https://gamek.vn/home.rss" },

      // Soha
      ...feeds("Soha News", P_SOHA, SOHA, [
        ["home", ""],
      ]),
      ...feeds("Soha", P_SOHA, SOHA, [
        ["cong-nghe", "Công nghệ"],
        ["cong-nghe/xu-huong-so", "Công nghệ - Xu hướng số"],
        ["xe", "Xe"],
        ["nhip-song-moi", "Nhịp sống mới"],
        ["giai-tri", "Giải trí"],
        ["song-khoe", "Sống khỏe"],
        ["doi-song", "Đời sống"],
        ["kien-tao-hanh-phuc", "Kiến tạo hạnh phúc"],
        ["40-plus", "40 Plus"],
      ]),

      // VnExpress
      ...feeds("VnExpress", P_VNE, VNE, [
        ["khoa-hoc-cong-nghe", "Khoa học công nghệ"],
        ["oto-xe-may", "Ô tô - Xe máy"],
        ["gia-dinh", "Đời sống"],
        ["suc-khoe", "Sức khỏe"],
        ["du-lich", "Du lịch"],
        ["giai-tri", "Giải trí"],
        ["thu-gian", "Thư giãn"],
        ["vne-go", "VnE-GO"],
      ]),

      // Tuổi Trẻ
      ...feeds("Báo Tuổi Trẻ", P_TT, TT, [
        ["nhip-song-so", "Công nghệ (Nhịp sống số)"],
        ["xe", "Xe"],
        ["khoa-hoc", "Khoa học"],
        ["nhip-song-tre", "Nhịp sống trẻ"],
        ["van-hoa", "Văn hóa"],
        ["giai-tri", "Giải trí"],
        ["suc-khoe", "Sức khỏe"],
        ["gia-that", "Gia thất"],
        ["thu-gian", "Thư giãn"],
        ["du-lich", "Du lịch"],
      ]),

      // Thanh Niên
      ...feeds("Báo Thanh Niên", P_TN, TN, [
        ["cong-nghe", "Công nghệ"],
        ["cong-nghe/tin-tuc-cong-nghe", "Công nghệ - Tin tức công nghệ"],
        ["cong-nghe/blockchain", "Công nghệ - Blockchain"],
        ["cong-nghe/san-pham", "Công nghệ - Sản phẩm"],
        ["cong-nghe/xu-huong-chuyen-doi-so", "Công nghệ - Xu hướng chuyển đổi số"],
        ["cong-nghe/thu-thuat", "Công nghệ - Thủ thuật"],
        ["cong-nghe/game", "Công nghệ - Game"],
        ["xe", "Xe"],
        ["doi-song", "Đời sống"],
        ["suc-khoe", "Sức khỏe"],
        ["gioi-tre", "Giới trẻ"],
        ["du-lich", "Du lịch"],
        ["van-hoa", "Văn hóa"],
        ["giai-tri", "Giải trí"],
        ["thoi-trang-tre", "Thời trang trẻ"],
      ]),

      // Dân Trí
      ...feeds("Báo Dân Trí", P_DT, DT, [
        ["cong-nghe", "Công nghệ"],
        ["o-to-xe-may", "Ô tô - Xe máy"],
        ["khoa-hoc", "Khoa học"],
        ["doi-song", "Đời sống"],
        ["suc-khoe", "Sức khỏe"],
        ["giai-tri", "Giải trí"],
        ["du-lich", "Du lịch"],
        ["tinh-yeu-gioi-tinh", "Tình yêu - Giới tính"],
        ["d-buzz", "D-Buzz"],
      ]),

      // VietNamNet (chưa kiểm tra)
      ...feeds("Báo VietNamNet", P_VNN, VNN, [
        ["cong-nghe", "Công nghệ"],
        ["doi-song", "Đời sống"],
        ["giai-tri", "Giải trí"],
      ]),

      // Infonet (chưa kiểm tra, URL suy đoán)
      ...feeds("Infonet", P_INFO, INFO, [
        ["doi-song", "Đời sống"],
        ["gia-dinh", "Gia đình"],
        ["gioi-tre", "Giới trẻ"],
        ["khoe-dep", "Khỏe đẹp"],
        ["van-hoa", "Văn hóa"],
      ]),

      // Người Lao Động
      ...feeds("Báo Người Lao Động", P_NLD, NLD, [
        ["ai-365", "AI 365"],
        ["khoa-hoc", "Khoa học"],
        ["doi-song", "Đời sống"],
        ["suc-khoe", "Sức khỏe"],
        ["gia-dinh", "Gia đình"],
        ["chuyen-trang-phu-nu", "Chuyên trang phụ nữ"],
        ["van-hoa-van-nghe", "Văn hóa - Văn nghệ"],
        ["giai-tri", "Giải trí"],
        ["du-lich-xanh", "Du lịch xanh"],
      ]),

      // Thể Thao & Văn Hóa
      ...feeds("Báo Thể Thao & Văn Hóa", P_TTVH, TTVH, [
        ["the-gioi-sao", "Thế giới sao"],
        ["van-hoa", "Văn hóa"],
        ["giai-tri", "Giải trí"],
        ["kbiz", "KBiz"],
      ]),
    ]
  }
];

/**
 * Các feed bật sẵn khi cài mới (nhóm feed chính).
 * Các kênh chi tiết vẫn có trong danh sách nhưng tắt, người dùng tự bật trong phần cài đặt.
 */
const DEFAULT_ENABLED_FEEDS = new Set<string>([
  VNE("tin-moi-nhat"),
  TT("home"),
  TN("home"),
  DT("home"),
  VNN("thoi-su"),
  NLD("home"),
  "https://cdn.24h.com.vn/upload/rss/trangchu24h.rss",
  "https://cafef.vn/home.rss",
  "https://cafebiz.vn/rss/home.rss",
  "https://vneconomy.vn/chung-khoan.rss",
  "https://vnbusiness.vn/rss/feed.rss",
  VNE("kinh-doanh"),
  TTVH("trang-chu"),
  VNE("the-thao"),
  TT("the-thao"),
  TN("the-thao"),
  "https://cdn.24h.com.vn/upload/rss/thethao.rss",
  "https://tinhte.vn/rss/",
  "https://trainghiemso.vn/feed/",
  "https://gamek.vn/home.rss",
  SOHA("home"),
]);

/**
 * Tạo danh sách nguồn mặc định phẳng kèm ID ổn định theo feed_url
 */
export function buildDefaultSources(): SourceItem[] {
  const list: SourceItem[] = [];
  const seen = new Set<string>();

  DEFAULT_RAW_CATEGORIES.forEach((cat) => {
    cat.sources.forEach((s) => {
      if (seen.has(s.feed_url)) return; // tránh trùng feed giữa các danh mục
      seen.add(s.feed_url);

      const stableId = generateHash(s.feed_url);
      list.push({
        id: stableId,
        title: s.title,
        rss_page: s.rss_page,
        feed_url: s.feed_url,
        categoryName: cat.name,
        enabled: ENABLE_ALL || DEFAULT_ENABLED_FEEDS.has(s.feed_url),
        isCustom: false,
        defaultFeedUrl: s.feed_url,
        defaultTitle: s.title,
        defaultRssPage: s.rss_page,
      });
    });
  });

  return list;
}