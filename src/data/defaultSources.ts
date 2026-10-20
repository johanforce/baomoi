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
const TT = (s: string) => `https://tuoitre.vn/${s}.rss`;
const TN = (s: string) => `https://thanhnien.vn/rss/${s}.rss`;
const DT = (s: string) => `https://dantri.com.vn/rss/${s}.rss`;
const VNN = (s: string) => `https://vietnamnet.vn/rss/${s}.rss`;
const INFO = (s: string) => `https://infonet.vietnamnet.vn/rss/${s}.rss`;
const NLD = (s: string) => `https://tuoitre.vn/nld/rss/${s}.rss`;
const TTVH = (s: string) => `https://thethaovanhoa.vn/rss/${s}.rss`;
const SOHA = (s: string) => `https://soha.vn/rss/${s}.rss`;
const VTV = (s: string) => `https://vtv.vn/rss/${s}.rss`;
const VNP = (s: string) => `https://www.vietnamplus.vn/rss/${s}.rss`;
const TPO = (s: string) => `https://tienphong.vn/rss/${s}.rss`;
const ND = (s: string) => `https://nhandan.vn/rss/${s}.rss`;
const LD = (s: string) => `https://laodong.vn/rss/${s}.rss`;
const PLO = (s: string) => `https://plo.vn/rss/${s}.rss`;
const QD = (s: string) => `https://www.qdnd.vn/rss/cate/${s}.rss`;
const MPS = (s: string) => `https://www.mps.gov.vn/api/rss/${s}.xml`;

// ---------- Trang RSS ----------
const P_VNE = 'https://vnexpress.net/rss';
const P_TT = 'https://tuoitre.vn/rss.htm';
const P_TN = 'https://thanhnien.vn/rss.html';
const P_DT = 'https://dantri.com.vn/rss.htm';
const P_VNN = 'https://vietnamnet.vn';
const P_INFO = 'https://infonet.vietnamnet.vn/rss/';
const P_NLD = 'https://tuoitre.vn/nld/rss.htm';
const P_24H = 'https://www.24h.com.vn/guest/RSS/';
const P_TTVH = 'https://thethaovanhoa.vn/rss.htm';
const P_SOHA = 'https://soha.vn/rss.htm';
const P_VTV = 'https://vtv.vn/rss.htm';
const P_VNP = 'https://www.vietnamplus.vn/rss.html';
const P_TPO = 'https://tienphong.vn/rss.html';
const P_ND = 'https://nhandan.vn/rss.html';
const P_LD = 'https://laodong.vn/rss';
const P_PLO = 'https://plo.vn';
const P_QD = 'https://www.qdnd.vn/rss';
const P_MPS = 'https://www.mps.gov.vn/rss';

/**
 * Danh sách chuyên mục chuẩn hóa:
 * 1. Thời sự
 * 2. Thế giới
 * 3. Kinh doanh
 * 4. Công nghệ
 * 5. Thể thao
 * 6. Giải trí
 * 7. Đời sống
 * 8. Sức khỏe
 * 9. Pháp luật
 * 10. Xe
 */
export const DEFAULT_RAW_CATEGORIES: CategoryGroup[] = [
  // =====================================================================
  // 1. THỜI SỰ
  // =====================================================================
  {
    name: 'Thời sự',
    sources: [
      ...feeds('VnExpress', P_VNE, VNE, [
        ['tin-moi-nhat', 'Tin mới nhất'],
        ['thoi-su', 'Thời sự'],
        ['goc-nhin', 'Góc nhìn'],
        ['giao-duc', 'Giáo dục'],
        ['y-kien', 'Ý kiến'],
      ]),
      ...feeds('Báo Tuổi Trẻ', P_TT, TT, [
        ['home', 'Trang chủ'],
        ['thoi-su', 'Thời sự'],
        ['giao-duc', 'Giáo dục'],
        ['ban-doc', 'Bạn đọc'],
      ]),
      ...feeds('Báo Thanh Niên', P_TN, TN, [
        ['home', 'Trang chủ'],
        ['thoi-su', 'Thời sự'],
        ['chinh-tri', 'Chính trị'],
        ['giao-duc', 'Giáo dục'],
        ['thoi-su/dan-sinh', 'Dân sinh'],
        ['thoi-su/quoc-phong', 'Quốc phòng'],
      ]),
      ...feeds('Báo Dân Trí', P_DT, DT, [
        ['home', 'Trang chủ'],
        ['thoi-su', 'Thời sự'],
        ['su-kien', 'Sự kiện'],
        ['giao-duc', 'Giáo dục'],
        ['noi-vu', 'Nội vụ'],
        ['lao-dong-viec-lam', 'Lao động việc làm'],
      ]),
      ...feeds('Báo VietNamNet', P_VNN, VNN, [
        ['thoi-su', 'Thời sự'],
        ['chinh-tri', 'Chính trị'],
        ['giao-duc', 'Giáo dục'],
      ]),
      ...feeds('Báo Lao Động', P_LD, LD, [
        ['home', 'Trang chủ'],
        ['thoi-su', 'Thời sự'],
        ['cong-doan', 'Công đoàn'],
      ]),
      ...feeds('Báo Tiền Phong', P_TPO, TPO, [
        ['home', 'Trang chủ'],
        ['xa-hoi-2', 'Xã hội'],
      ]),
      ...feeds('Báo VTV', P_VTV, VTV, [
        ['home', 'Trang chủ'],
        ['trong-nuoc', 'Trong nước'],
        ['xa-hoi', 'Xã hội'],
      ]),
      ...feeds('Báo Nhân Dân', P_ND, ND, [
        ['home', 'Trang chủ'],
        ['chinhtri', 'Chính trị'],
        ['xahoi', 'Xã hội'],
        ['chungkhoan', 'Kinh doanh'],
      ]),
      ...feeds('Báo Quân đội nhân dân', P_QD, QD, [
        ['tin-tuc-moi-nhat', 'Tin mới nhất'],
        ['quoc-phong', 'Quốc phòng'],
      ]),
      {
        title: 'Báo 24h - Tin tức trong ngày',
        rss_page: P_24H,
        feed_url: 'https://cdn.24h.com.vn/upload/rss/tintuctrongngay.rss',
      },
    ],
  },

  // =====================================================================
  // 2. THẾ GIỚI
  // =====================================================================
  {
    name: 'Thế giới',
    sources: [
      ...feeds('VnExpress', P_VNE, VNE, [
        ['the-gioi', 'Thế giới'],
      ]),
      ...feeds('Báo Tuổi Trẻ', P_TT, TT, [
        ['the-gioi', 'Thế giới'],
      ]),
      ...feeds('Báo Thanh Niên', P_TN, TN, [
        ['the-gioi', 'Thế giới'],
        ['the-gioi/quan-su', 'Quân sự thế giới'],
      ]),
      ...feeds('Báo Dân Trí', P_DT, DT, [
        ['the-gioi', 'Thế giới']
      ]),
      ...feeds('Báo VietNamNet', P_VNN, VNN, [
        ['the-gioi', 'Thế giới'],
        ['the-gioi/quan-su', 'Quân sự'],
      ]),
      ...feeds('VietnamPlus', P_VNP, VNP, [
        ['home', 'Trang chủ'],
        ['thegioi-292', 'Thế giới'],
      ]),
      ...feeds('Báo Tiền Phong', P_TPO, TPO, [
        ['the-gioi-5', 'Thế giới'],
      ]),
      ...feeds('Báo Lao Động', P_LD, LD, [
        ['the-gioi', 'Thế giới'],
      ]),
      ...feeds('Báo VTV', P_VTV, VTV, [
        ['the-gioi', 'Thế giới'],
      ]),
      ...feeds('Báo Nhân Dân', P_ND, ND, [
        ['thegioi', 'Thế giới'],
      ]),
      ...feeds('Báo Quân đội nhân dân', P_QD, QD, [
        ['quoc-te', 'Quốc tế'],
      ]),
    ],
  },

  // =====================================================================
  // 3. KINH DOANH
  // =====================================================================
  {
    name: 'Kinh doanh',
    sources: [
      ...feeds('VnExpress', P_VNE, VNE, [
        ['kinh-doanh', 'Kinh doanh'],
        ['bat-dong-san', 'Bất động sản']
      ]),
      ...feeds('Báo Tuổi Trẻ', P_TT, TT, [
        ['kinh-doanh', 'Kinh doanh'],
      ]),
      ...feeds('Báo Thanh Niên', P_TN, TN, [
        ['kinh-te', 'Kinh tế'],
        ['tieu-dung-thong-minh', 'Tiêu dùng thông minh'],
      ]),
      ...feeds('Báo Dân Trí', P_DT, DT, [
        ['kinh-doanh', 'Kinh doanh'],
        ['bat-dong-san', 'Bất động sản'],
        ['gia-vang', 'Giá vàng'],
      ]),
      ...feeds('Báo VietNamNet', P_VNN, VNN, [
        ['kinh-doanh', 'Kinh doanh'],
        ['bat-dong-san', 'Bất động sản'],
      ]),
      {
        title: 'CafeF - Tin nóng tài chính',
        rss_page: 'https://cafef.vn',
        feed_url: 'https://cafef.vn/home.rss',
      },
      {
        title: 'CafeF - Chứng khoán',
        rss_page: 'https://cafef.vn',
        feed_url: 'https://cafef.vn/thi-truong-chung-khoan.rss',
      },
      {
        title: 'CafeF - Bất động sản',
        rss_page: 'https://cafef.vn',
        feed_url: 'https://cafef.vn/bat-dong-san.rss',
      },
      {
        title: 'CafeBiz - Trang chủ kinh doanh',
        rss_page: 'https://cafebiz.vn',
        feed_url: 'https://cafebiz.vn/rss/home.rss',
      },
      {
        title: 'VnEconomy - Chứng khoán & Kinh tế',
        rss_page: 'https://vneconomy.vn',
        feed_url: 'https://vneconomy.vn/chung-khoan.rss',
      },
      {
        title: 'VnBusiness - Tin doanh nghiệp',
        rss_page: 'https://vnbusiness.vn',
        feed_url: 'https://vnbusiness.vn/rss/feed.rss',
      },
      ...feeds('Báo Tiền Phong', P_TPO, TPO, [
        ['kinh-te-3', 'Kinh tế'],
        ['dia-oc-166', 'Địa ốc'],
      ]),
      ...feeds('Báo Lao Động', P_LD, LD, [
        ['kinh-doanh', 'Kinh doanh'],
        ['bat-dong-san', 'Bất động sản'],
      ]),
      ...feeds('Báo VTV', P_VTV, VTV, [
        ['kinh-te', 'Kinh tế'],
      ]),
      ...feeds('Báo Nhân Dân', P_ND, ND, [
        ['kinhte', 'Kinh tế'],
      ]),
    ],
  },

  // =====================================================================
  // 4. CÔNG NGHỆ
  // =====================================================================
  {
    name: 'Công nghệ',
    sources: [
      ...feeds('VnExpress', P_VNE, VNE, [
        ['so-hoa', 'Số hóa & Công nghệ'],
        ['khoa-hoc', 'Khoa học'],
      ]),
      ...feeds('Báo Tuổi Trẻ', P_TT, TT, [
        ['nhip-song-so', 'Nhịp sống số'],
        ['khoa-hoc', 'Khoa học'],
      ]),
      ...feeds('Báo Thanh Niên', P_TN, TN, [
        ['cong-nghe', 'Công nghệ'],
      ]),
      ...feeds('Báo Dân Trí', P_DT, DT, [
        ['suc-manh-so', 'Sức mạnh số'],
        ['khoa-hoc', 'Khoa học'],
      ]),
      ...feeds('Báo VietNamNet', P_VNN, VNN, [
        ['thong-tin-truyen-thong', 'Công nghệ số'],
      ]),
      {
        title: 'Tinh Tế - Diễn đàn công nghệ',
        rss_page: 'https://tinhte.vn',
        feed_url: 'https://tinhte.vn/rss/',
      },
      {
        title: 'Trải Nghiệm Số',
        rss_page: 'https://trainghiemso.vn',
        feed_url: 'https://trainghiemso.vn/feed/',
      },
      {
        title: 'GameK - Tin game & công nghệ',
        rss_page: 'https://gamek.vn',
        feed_url: 'https://gamek.vn/home.rss',
      },
      ...feeds('Báo Tiền Phong', P_TPO, TPO, [
        ['cong-nghe-45', 'Công nghệ'],
        ['khoa-hoc-168', 'Khoa học'],
      ]),
      ...feeds('Báo Lao Động', P_LD, LD, [
        ['cong-nghe', 'Công nghệ'],
      ]),
      ...feeds('Báo VTV', P_VTV, VTV, [
        ['cong-nghe', 'Công nghệ'],
      ]),
      ...feeds('Báo Nhân Dân', P_ND, ND, [
        ['khoahoc-congnghe', 'Khoa học - Công nghệ'],
      ]),
    ],
  },

  // =====================================================================
  // 5. THỂ THAO
  // =====================================================================
  {
    name: 'Thể thao',
    sources: [
      ...feeds('VnExpress', P_VNE, VNE, [
        ['the-thao', 'Thể thao'],
        ['bong-da', 'Bóng đá'],
      ]),
      ...feeds('Báo Tuổi Trẻ', P_TT, TT, [
        ['the-thao', 'Thể thao'],
      ]),
      ...feeds('Báo Thanh Niên', P_TN, TN, [
        ['the-thao', 'Thể thao'],
        ['the-thao/bong-da-viet-nam', 'Bóng đá Việt Nam'],
        ['the-thao/bong-da-quoc-te', 'Bóng đá quốc tế'],
      ]),
      ...feeds('Báo Dân Trí', P_DT, DT, [
        ['the-thao', 'Thể thao'],
      ]),
      ...feeds('Báo VietNamNet', P_VNN, VNN, [
        ['the-thao', 'Thể thao'],
        ['the-thao/bong-da-viet-nam', 'Bóng đá Việt Nam'],
        ['the-thao/bong-da-quoc-te', 'Bóng đá quốc tế'],
      ]),
      ...feeds('Thể thao & Văn hóa', P_TTVH, TTVH, [
        ['trang-chu', 'Trang chủ'],
        ['the-thao', 'Thể thao'],
        ['bong-da-viet-nam', 'Bóng đá Việt Nam'],
      ]),
      {
        title: 'Báo 24h - Thể thao',
        rss_page: P_24H,
        feed_url: 'https://cdn.24h.com.vn/upload/rss/thethao.rss',
      },
      ...feeds('Báo Tiền Phong', P_TPO, TPO, [
        ['the-thao-11', 'Thể thao'],
      ]),
      ...feeds('Báo Lao Động', P_LD, LD, [
        ['the-thao', 'Thể thao'],
      ]),
      ...feeds('Báo VTV', P_VTV, VTV, [
        ['the-thao', 'Thể thao'],
      ]),
    ],
  },

  // =====================================================================
  // 6. GIẢI TRÍ
  // =====================================================================
  {
    name: 'Giải trí',
    sources: [
      ...feeds('VnExpress', P_VNE, VNE, [
        ['giai-tri', 'Giải trí'],
      ]),
      ...feeds('Báo Tuổi Trẻ', P_TT, TT, [
        ['giai-tri', 'Giải trí'],
      ]),
      ...feeds('Báo Thanh Niên', P_TN, TN, [
        ['giai-tri', 'Giải trí'],
        ['giai-tri/sao', 'Ngôi sao'],
        ['giai-tri/phim', 'Điện ảnh'],
      ]),
      ...feeds('Báo Dân Trí', P_DT, DT, [
        ['giai-tri', 'Giải trí'],
      ]),
      ...feeds('Báo VietNamNet', P_VNN, VNN, [
        ['giai-tri', 'Giải trí'],
      ]),
      ...feeds('Soha', P_SOHA, SOHA, [
        ['giai-tri', 'Giải trí'],
      ]),
      {
        title: 'Báo 24h - Ca nhạc & Phim',
        rss_page: P_24H,
        feed_url: 'https://cdn.24h.com.vn/upload/rss/canhacmtv.rss',
      },
      ...feeds('Báo Tiền Phong', P_TPO, TPO, [
        ['giai-tri-4', 'Giải trí'],
        ['hoa-hau-235', 'Hoa hậu'],
      ]),
      ...feeds('Báo Lao Động', P_LD, LD, [
        ['giai-tri', 'Giải trí'],
      ]),
      ...feeds('Báo VTV', P_VTV, VTV, [
        ['truyen-hinh', 'Truyền hình & Giải trí'],
      ]),
    ],
  },

  // =====================================================================
  // 7. ĐỜI SỐNG
  // =====================================================================
  {
    name: 'Đời sống',
    sources: [
      ...feeds('VnExpress', P_VNE, VNE, [
        ['doi-song', 'Đời sống'],
        ['du-lich', 'Du lịch'],
        ['tam-su', 'Tâm sự'],
      ]),
      ...feeds('Báo Tuổi Trẻ', P_TT, TT, [
        ['van-hoa', 'Văn hóa & Đời sống'],
        ['du-lich', 'Du lịch'],
      ]),
      ...feeds('Báo Thanh Niên', P_TN, TN, [
        ['doi-song', 'Đời sống'],
        ['du-lich', 'Du lịch'],
        ['gioi-tre', 'Giới trẻ'],
      ]),
      ...feeds('Báo Dân Trí', P_DT, DT, [
        ['doi-song', 'Đời sống'],
        ['du-lich', 'Du lịch'],
        ['nhip-song-tre', 'Nhịp sống trẻ'],
      ]),
      ...feeds('Báo VietNamNet', P_VNN, VNN, [
        ['doi-song', 'Đời sống'],
        ['du-lich', 'Du lịch'],
      ]),
      {
        title: 'Báo 24h - Đời sống & Du lịch',
        rss_page: P_24H,
        feed_url: 'https://cdn.24h.com.vn/upload/rss/dulich24h.rss',
      },
      ...feeds('Báo Tiền Phong', P_TPO, TPO, [
        ['gioi-tre-215', 'Giới trẻ'],
        ['du-lich-253', 'Du lịch'],
      ]),
      ...feeds('Báo Nhân Dân', P_ND, ND, [
        ['vanhoa', 'Văn hóa'],
        ['du-lich', 'Du lịch'],
      ]),
    ],
  },

  // =====================================================================
  // 8. SỨC KHỎE
  // =====================================================================
  {
    name: 'Sức khỏe',
    sources: [
      ...feeds('VnExpress', P_VNE, VNE, [
        ['suc-khoe', 'Sức khỏe'],
      ]),
      ...feeds('Báo Tuổi Trẻ', P_TT, TT, [
        ['suc-khoe', 'Sức khỏe'],
      ]),
      ...feeds('Báo Thanh Niên', P_TN, TN, [
        ['suc-khoe', 'Sức khỏe']
      ]),
      ...feeds('Báo Dân Trí', P_DT, DT, [
        ['suc-khoe', 'Sức khỏe']
      ]),
      ...feeds('Báo VietNamNet', P_VNN, VNN, [
        ['suc-khoe', 'Sức khỏe'],
      ]),
      {
        title: 'Báo 24h - Sức khỏe đời sống',
        rss_page: P_24H,
        feed_url: 'https://cdn.24h.com.vn/upload/rss/suckhoedoisong.rss',
      },
      ...feeds('Báo Tiền Phong', P_TPO, TPO, [
        ['suc-khoe-12', 'Sức khỏe'],
      ]),
      ...feeds('Báo Lao Động', P_LD, LD, [
        ['y-te', 'Y tế & Sức khỏe'],
      ]),
      ...feeds('Báo VTV', P_VTV, VTV, [
        ['y-te', 'Y tế'],
      ]),
      ...feeds('Báo Nhân Dân', P_ND, ND, [
        ['y-te', 'Y tế'],
      ]),
    ],
  },

  // =====================================================================
  // 9. PHÁP LUẬT
  // =====================================================================
  {
    name: 'Pháp luật',
    sources: [
      ...feeds('VnExpress', P_VNE, VNE, [
        ['phap-luat', 'Pháp luật'],
        ['ho-so-pha-an', 'Hồ sơ phá án'],
      ]),
      ...feeds('Báo Tuổi Trẻ', P_TT, TT, [
        ['phap-luat', 'Pháp luật'],
      ]),
      ...feeds('Báo Thanh Niên', P_TN, TN, [
        ['thoi-su/phap-luat', 'Pháp luật'],
      ]),
      ...feeds('Báo Dân Trí', P_DT, DT, [
        ['phap-luat', 'Pháp luật'],
      ]),
      ...feeds('Báo VietNamNet', P_VNN, VNN, [
        ['phap-luat', 'Pháp luật'],
      ]),
      ...feeds('Báo Tiền Phong', P_TPO, TPO, [
        ['phap-luat-12', 'Pháp luật'],
      ]),
      ...feeds('Báo Lao Động', P_LD, LD, [
        ['phap-luat', 'Pháp luật'],
      ]),
      ...feeds('Báo Pháp Luật TP.HCM', P_PLO, PLO, [
        ['home', 'Trang chủ'],
        ['phap-luat', 'Pháp luật'],
      ]),
      ...feeds('Bộ Công An', P_MPS, MPS, [
        ['36', 'Chỉ đạo điều hành'],  ['35', 'Hoạt động bộ công anh'],  ['34', 'Thông tin đối ngoại'],
      ]),
    ],
  },

  // =====================================================================
  // 10. XE
  // =====================================================================
  {
    name: 'Xe',
    sources: [
      ...feeds('VnExpress', P_VNE, VNE, [
        ['oto-xe-may', 'Ô tô - Xe máy'],
        ['danh-gia', 'Đánh giá xe'],
      ]),
      ...feeds('Báo Tuổi Trẻ', P_TT, TT, [
        ['xe', 'Xe'],
      ]),
      ...feeds('Báo Thanh Niên', P_TN, TN, [
        ['xe', 'Xe']
      ]),
      ...feeds('Báo Dân Trí', P_DT, DT, [
        ['o-to-xe-may', 'Ô tô - Xe máy']
      ]),
      ...feeds('Báo VietNamNet', P_VNN, VNN, [
        ['oto-xe-may', 'Ô tô xe máy'],
      ]),
      {
        title: 'Báo 24h - Ô tô & Xe máy',
        rss_page: P_24H,
        feed_url: 'https://cdn.24h.com.vn/upload/rss/oto.rss',
      },
      ...feeds('Báo Tiền Phong', P_TPO, TPO, [
        ['xe-113', 'Xe'],
      ]),
    ],
  },
];

/**
 * Các feed bật sẵn khi cài mới.
 * Đảm bảo mỗi chuyên mục trong 10 chuyên mục đều có ít nhất 2-3 feed uy tín bật sẵn.
 */
const DEFAULT_ENABLED_FEEDS = new Set<string>([
  // Thời sự & Mới nhất
  VNE('tin-moi-nhat'),
  TT('home'),
  TN('home'),
  DT('home'),
  VNN('thoi-su'),
  VNE('thoi-su'),
  TT('thoi-su'),
  TN('thoi-su'),
  DT('thoi-su'),
  VTV('home'),
  LD('home'),
  'https://cdn.24h.com.vn/upload/rss/tintuctrongngay.rss',

  // Thế giới
  VNE('the-gioi'),
  TT('the-gioi'),
  TN('the-gioi'),
  DT('the-gioi'),
  VNP('home'),

  // Kinh doanh
  VNE('kinh-doanh'),
  TT('kinh-doanh'),
  TN('kinh-te'),
  DT('kinh-doanh'),
  'https://cafef.vn/home.rss',
  'https://cafebiz.vn/rss/home.rss',
  'https://vneconomy.vn/chung-khoan.rss',

  // Công nghệ
  VNE('so-hoa'),
  TT('nhip-song-so'),
  TN('cong-nghe-game'),
  DT('suc-manh-so'),
  'https://tinhte.vn/rss/',
  'https://gamek.vn/home.rss',

  // Thể thao
  VNE('the-thao'),
  TT('the-thao'),
  TN('the-thao'),
  DT('the-thao'),
  TTVH('trang-chu'),
  'https://cdn.24h.com.vn/upload/rss/thethao.rss',

  // Giải trí
  VNE('giai-tri'),
  TT('giai-tri'),
  TN('giai-tri'),
  DT('giai-tri'),
  SOHA('giai-tri'),

  // Đời sống
  VNE('doi-song'),
  TT('van-hoa'),
  TN('doi-song'),
  DT('doi-song'),
  VNE('du-lich'),

  // Sức khỏe
  VNE('suc-khoe'),
  TT('suc-khoe'),
  TN('suc-khoe'),
  DT('suc-khoe'),

  // Pháp luật
  VNE('phap-luat'),
  TT('phap-luat'),
  TN('thoi-su/phap-luat'),
  DT('phap-luat'),

  // Xe
  VNE('oto-xe-may'),
  TT('xe'),
  TN('xe'),
  DT('o-to-xe-may'),
  'https://cdn.24h.com.vn/upload/rss/oto.rss',
]);

/**
 * Tạo danh sách nguồn mặc định phẳng kèm ID ổn định theo feed_url
 */
export function buildDefaultSources(): SourceItem[] {
  const list: SourceItem[] = [];
  const seen = new Set<string>();

  DEFAULT_RAW_CATEGORIES.forEach((cat) => {
    cat.sources.forEach((s) => {
      if (seen.has(s.feed_url)) return;
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