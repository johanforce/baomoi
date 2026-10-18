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
// Mẫu URL cho VTV, VietnamPlus, Tiền Phong, Nhân Dân, Lao Động, PLO, QĐND, Bộ Công An
const VTV = (s: string) => `https://vtv.vn/rss/${s}.rss`;
const VNP = (s: string) => `https://www.vietnamplus.vn/rss/${s}.rss`;   // slug có đuôi -ID, vd chinhtri-291
const TPO = (s: string) => `https://tienphong.vn/rss/${s}.rss`;        // slug có đuôi -ID, vd xa-hoi-2
const ND = (s: string) => `https://nhandan.vn/rss/${s}.rss`;          // slug có đuôi -ID, vd chinhtri-1171
const LD = (s: string) => `https://laodong.vn/rss/${s}.rss`;
const PLO = (s: string) => `https://plo.vn/rss/${s}.rss`;            // feed trang chủ home.rss
const QD = (s: string) => `https://www.qdnd.vn/rss/cate/${s}.rss`;
const MPS = (s: string) => `https://www.mps.gov.vn/api/rss/${s}.xml`;  // Bộ Công an: đuôi .xml, slug là số

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
const P_VTV = "https://vtv.vn/rss.htm";
const P_VNP = "https://www.vietnamplus.vn/rss.html";
const P_TPO = "https://tienphong.vn/rss.html";
const P_ND = "https://nhandan.vn/rss.html";
const P_LD = "https://laodong.vn/rss";
const P_PLO = "https://plo.vn";
const P_QD = "https://www.qdnd.vn/rss";
const P_MPS = "https://www.mps.gov.vn/rss";

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
        ["chinh-tri", "Chính trị"],
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

      // ===== [MỚI THÊM] Các báo bổ sung (nhóm Tin tức & Thời sự) =====

      // [MỚI THÊM] Báo Nhân Dân (nhóm Tin tức)
      ...feeds("Báo Nhân Dân", P_ND, ND, [
        ["home", ""],
        ["chinhtri-1171", "Chính trị"],
        ["xa-luan-1176", "Xã luận"],
        ["binh-luan-phe-phan-1180", "Bình luận - Phê phán"],
        ["xay-dung-dang-1179", "Xây dựng Đảng"],
        ["xahoi-1211", "Xã hội"],
        ["bhxh-va-cuoc-song-1222", "BHXH và cuộc sống"],
        ["nguoi-tot-viec-tot-1319", "Người tốt việc tốt"],
        ["phapluat-1287", "Pháp luật"],
        ["thegioi-1231", "Thế giới"],
        ["binh-luan-quoc-te-1236", "Thế giới - Bình luận quốc tế"],
        ["asean-704471", "Thế giới - ASEAN"],
        ["chau-phi-704476", "Thế giới - Châu Phi"],
        ["chau-my-704475", "Thế giới - Châu Mỹ"],
        ["chau-au-704474", "Thế giới - Châu Âu"],
        ["trung-dong-704473", "Thế giới - Trung Đông"],
        ["chau-a-tbd-704472", "Thế giới - Châu Á-TBD"],
        ["giaoduc-1303", "Giáo dục"],
        ["bandoc-1315", "Bạn đọc"],
        ["duong-day-nong-1316", "Bạn đọc - Đường dây nóng"],
        ["dieu-tra-qua-thu-ban-doc-1317", "Bạn đọc - Điều tra qua thư bạn đọc"],
        ["factcheck-658978", "Kiểm chứng thông tin"],
        ["tri-thuc-chuyen-sau-704477", "Tri thức chuyên sâu"],
        ["54-dan-toc-704489", "54 dân tộc Việt Nam"],
      ]),

      // [MỚI THÊM] Cổng TTĐT Bộ Công an (mps.gov.vn)
      ...feeds("Bộ Công an", P_MPS, MPS, [
        ["36", "Chỉ đạo điều hành"],
        ["35", "Hoạt động của Bộ Công an"],
        ["34", "Thông tin đối ngoại"],
      ]),

      // [MỚI THÊM] Báo Quân đội nhân dân (qdnd.vn)
      ...feeds("Báo Quân đội nhân dân", P_QD, QD, [
        ["tin-tuc-moi-nhat", ""],
      ]),

      // [MỚI THÊM] Báo Quân đội nhân dân - các chuyên mục
      ...feeds("Báo Quân đội nhân dân", P_QD, QD, [
        ["chinh-tri", "Chính trị"],
        ["quoc-phong-an-ninh", "Quốc phòng - An ninh"],
        ["xa-hoi", "Xã hội"],
        ["quoc-te", "Quốc tế"],
        ["phap-luat", "Pháp luật"],
        ["ban-doc", "Bạn đọc"],
        ["phong-su-dieu-tra", "Phóng sự - Điều tra"],
        ["giao-duc-khoa-hoc", "Giáo dục - Khoa học"],
      ]),

      // [MỚI THÊM] VTV News (Thời báo VTV)
      ...feeds("VTV News", P_VTV, VTV, [
        ["home", ""],
        ["chinh-tri", "Chính trị"],
        ["xa-hoi", "Xã hội"],
        ["phap-luat", "Pháp luật"],
        ["the-gioi", "Thế giới"],
        ["the-gioi/tin-tuc", "Thế giới - Tin tức"],
        ["the-gioi/nguoi-viet-bon-phuong", "Thế giới - Người Việt bốn phương"],
        ["giao-duc", "Giáo dục"],
        ["giao-duc/tuyen-sinh", "Giáo dục - Tuyển sinh"],
        ["van-de-hom-nay", "Vấn đề hôm nay"],
        ["alo-vtv-times", "Alo VTV Times"],
        ["alo-vtv-times/goc-phan-anh", "Alo VTV Times - Góc phản ánh"],
        ["alo-vtv-times/phong-su-dieu-tra", "Alo VTV Times - Phóng sự điều tra"],
        ["video-dac-sac", "Video đặc sắc"],
        ["podcast", "Podcast"],
        ["magazine", "V-zine"],
        ["infographic", "Infographic"],
      ]),

      // [MỚI THÊM] VietnamPlus (TTXVN)
      ...feeds("VietnamPlus", P_VNP, VNP, [
        ["home", ""],
        ["chinhtri-291", "Chính trị"],
        ["thegioi-209", "Thế giới"],
        ["thegioi/asean-356", "Thế giới - ASEAN"],
        ["thegioi/chaua-tbd-352", "Thế giới - Châu Á-TBD"],
        ["thegioi/trungdong-230", "Thế giới - Trung Đông"],
        ["thegioi/chauau-354", "Thế giới - Châu Âu"],
        ["thegioi/chaumy-355", "Thế giới - Châu Mỹ"],
        ["thegioi/chauphi-357", "Thế giới - Châu Phi"],
        ["xahoi-314", "Xã hội"],
        ["xahoi/giaoduc-316", "Xã hội - Giáo dục"],
        ["xahoi/phapluat-327", "Xã hội - Pháp luật"],
        ["xahoi/giaothong-358", "Xã hội - Giao thông"],
        ["xahoi/vietkieu-373", "Xã hội - Người Việt bốn phương"],
        ["chuyenla-329", "Chuyện lạ"],
        ["special-plus-450", "Special+"],
      ]),

      // [MỚI THÊM] Báo Tiền Phong
      ...feeds("Báo Tiền Phong", P_TPO, TPO, [
        ["home", ""],
        ["xa-hoi-2", "Xã hội"],
        ["chinh-tri-308", "Xã hội - Chính trị"],
        ["xa-hoi-tin-tuc-104", "Xã hội - Tin tức"],
        ["xa-hoi-phong-su-13", "Xã hội - Phóng sự"],
        ["the-gioi-5", "Thế giới"],
        ["the-gioi-phan-tich-binh-luan-31", "Thế giới - Phân tích bình luận"],
        ["chuyen-la-32", "Thế giới - Chuyện lạ"],
        ["phap-luat-12", "Pháp luật"],
        ["ban-tin-113-231", "Pháp luật - Bản tin 113"],
        ["phap-luat-chuyen-toa-173", "Pháp luật - Pháp đình"],
        ["giao-duc-71", "Giáo dục"],
        ["cong-truong-310", "Giáo dục - Cổng trường"],
        ["tuyen-sinh2011-163", "Giáo dục - Tuyển sinh"],
        ["gioi-tre-4", "Giới trẻ"],
        ["ban-doc-15", "Bạn đọc"],
        ["ban-doc-dieu-tra-300", "Bạn đọc - Điều tra"],
        ["hanh-trang-nguoi-linh-182", "Người lính"],
        ["nhip-song-thu-do-242", "Nhịp sống Thủ đô"],
        ["nhip-song-phuong-nam-408", "Nhịp sống phương Nam"],
        ["video-clip-115", "Video"],
      ]),

      // [MỚI THÊM] Báo Lao Động
      ...feeds("Báo Lao Động", P_LD, LD, [
        ["home", ""],
        ["thoi-su", "Thời sự"],
        ["cong-doan", "Công đoàn"],
        ["the-gioi", "Thế giới"],
        ["xa-hoi", "Xã hội"],
        ["phap-luat", "Pháp luật"],
        ["ban-doc", "Bạn đọc"],
        ["tam-long-vang", "Tấm lòng vàng"],
      ]),

      // [MỚI THÊM] Báo Pháp Luật TP.HCM
      ...feeds("Báo Pháp Luật TP.HCM", P_PLO, PLO, [
        ["home", ""],
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

      // ===== [MỚI THÊM] Các báo bổ sung (nhóm Tài chính & Kinh tế) =====
      // [MỚI THÊM] Báo Nhân Dân (nhóm Tài chính & Kinh tế)
      ...feeds("Báo Nhân Dân", P_ND, ND, [
        ["kinhte-1185", "Kinh tế"],
        ["chungkhoan-1191", "Kinh tế - Tài chính chứng khoán"],
        ["thong-tin-hang-hoa-1203", "Kinh tế - Thông tin hàng hóa"],
        ["ocop-704555", "Chương trình OCOP"],
      ]),

      // [MỚI THÊM] Báo Quân đội nhân dân (nhóm Tài chính & Kinh tế)
      ...feeds("Báo Quân đội nhân dân", P_QD, QD, [
        ["kinh-te", "Kinh tế"],
      ]),

      // VTV News
      ...feeds("VTV News", P_VTV, VTV, [
        ["kinh-te", "Kinh tế"],
        ["kinh-te/tai-chinh", "Kinh tế - Tài chính"],
        ["kinh-te/thi-truong", "Kinh tế - Thị trường"],
        ["kinh-te/goc-doanh-nghiep", "Kinh tế - Góc doanh nghiệp"],
        ["du-lieu-va-doi-song", "Dữ liệu và Đời sống"],
      ]),

      // [MỚI THÊM] VietnamPlus
      ...feeds("VietnamPlus", P_VNP, VNP, [
        ["kinhte-311", "Kinh tế"],
        ["kinhte/kinhdoanh-342", "Kinh tế - Kinh doanh"],
        ["kinhte/taichinh-343", "Kinh tế - Tài chính"],
        ["kinhte/chungkhoan-344", "Kinh tế - Chứng khoán"],
        ["kinhte/batdongsan-372", "Kinh tế - Bất động sản"],
        ["kinhte/doanhnghiep-345", "Kinh tế - Doanh nghiệp"],
        ["tinthitruong-218", "Thị trường"],
      ]),

      // [MỚI THÊM] Tiền Phong
      ...feeds("Báo Tiền Phong", P_TPO, TPO, [
        ["kinh-te-3", "Kinh tế"],
        ["kinh-te-thi-truong-24", "Kinh tế - Thị trường"],
        ["doanh-nghiep-22", "Kinh tế - Doanh nghiệp"],
        ["dau-tu-165", "Kinh tế - Đầu tư"],
        ["tai-chinh-chung-khoan-105", "Kinh tế - Tài chính chứng khoán"],
        ["dia-oc-166", "Địa ốc"],
        ["do-thi-du-an-269", "Địa ốc - Đô thị dự án"],
        ["song-xanh-441", "Sóng xanh"],
      ]),

      // [MỚI THÊM] Báo Lao Động (nhóm Tài chính & Kinh tế)
      ...feeds("Báo Lao Động", P_LD, LD, [
        ["kinh-doanh", "Kinh doanh"],
        ["bat-dong-san", "Bất động sản"],
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

      // ===== [MỚI THÊM] Các báo bổ sung (nhóm Thể thao) =====
      // [MỚI THÊM] Báo Nhân Dân (nhóm Thể thao)
      ...feeds("Báo Nhân Dân", P_ND, ND, [
        ["thethao-1224", "Thể thao"],
      ]),

      // [MỚI THÊM] Báo Quân đội nhân dân (nhóm Thể thao)
      ...feeds("Báo Quân đội nhân dân", P_QD, QD, [
        ["the-thao", "Thể thao"],
      ]),

      // VTV News
      ...feeds("VTV News", P_VTV, VTV, [
        ["the-thao", "Thể thao"],
        ["golf", "Golf"],
        ["world-cup-2026", "World Cup 2026"],
        ["world-cup-2026/tin-nhanh-world-cup", "World Cup 2026 - Tin nhanh"],
        ["sea-games-33", "SEA Games 33"],
      ]),

      // [MỚI THÊM] VietnamPlus
      ...feeds("VietnamPlus", P_VNP, VNP, [
        ["thethao-214", "Thể thao"],
        ["thethao/bongda-368", "Thể thao - Bóng đá"],
        ["thethao/quanvot-369", "Thể thao - Quần vợt"],
      ]),

      // [MỚI THÊM] Tiền Phong
      ...feeds("Báo Tiền Phong", P_TPO, TPO, [
        ["the-thao-11", "Thể thao"],
        ["the-thao-bong-da-49", "Thể thao - Bóng đá"],
        ["the-thao-hau-truong-111", "Thể thao - Hậu trường"],
        ["the-thao-golf-280", "Thể thao - Golf"],
        ["video-the-thao-425", "Thể thao - Highlights"],
      ]),

      // [MỚI THÊM] Báo Lao Động (nhóm Thể thao)
      ...feeds("Báo Lao Động", P_LD, LD, [
        ["the-thao", "Thể thao"],
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

      // ===== [MỚI THÊM] Các báo bổ sung (nhóm Công nghệ & Đời sống) =====
      // VTV News
      ...feeds("VTV News", P_VTV, VTV, [
        ["cong-nghe", "Công nghệ"],
        ["cong-nghe/tri-tue-nhan-tao", "Công nghệ - Trí tuệ nhân tạo"],
        ["cong-nghe/ban-dan", "Công nghệ - Bán dẫn"],
        ["cong-nghe/an-ninh-mang", "Công nghệ - An ninh mạng"],
        ["cong-nghe/san-pham", "Công nghệ - Sản phẩm"],
        ["cong-nghe/xe", "Công nghệ - Xe"],
        ["vuon-minh-bang-ai", "Vươn mình bằng AI"],
        ["doi-song", "Đời sống"],
        ["doi-song/du-lich", "Đời sống - Du lịch"],
        ["doi-song/lam-dep", "Đời sống - Làm đẹp"],
        ["y-te", "Y tế"],
        ["van-hoa-giai-tri", "Văn hóa - Giải trí"],
        ["van-hoa-giai-tri/dien-anh", "Văn hóa - Điện ảnh"],
        ["van-hoa-giai-tri/am-nhac", "Văn hóa - Âm nhạc"],
        ["truyen-hinh", "Truyền hình"],
      ]),

      // [MỚI THÊM] VietnamPlus
      ...feeds("VietnamPlus", P_VNP, VNP, [
        ["congnghe-212", "Công nghệ"],
        ["congnghe/sanphammoi-275", "Công nghệ - Sản phẩm mới"],
        ["khoahoc-213", "Khoa học"],
        ["otoxemay-364", "Ôtô - Xe máy"],
        ["doisong-320", "Đời sống"],
        ["doisong/suckhoe-367", "Đời sống - Sức khỏe"],
        ["doisong/amthuc-351", "Đời sống - Ẩm thực"],
        ["vanhoa-215", "Văn hóa"],
        ["vanhoa/dienanh-293", "Văn hóa - Điện ảnh"],
        ["vanhoa/amnhac-321", "Văn hóa - Âm nhạc"],
        ["dulich-237", "Du lịch"],
        ["moitruong-270", "Môi trường"],
      ]),

      // [MỚI THÊM] Tiền Phong
      ...feeds("Báo Tiền Phong", P_TPO, TPO, [
        ["suc-khoe-210", "Sức khỏe"],
        ["y-khoa-304", "Sức khỏe - Y khoa"],
        ["khoe-dep-306", "Sức khỏe - Khỏe đẹp"],
        ["xe-113", "Xe"],
        ["danh-gia-xe-277", "Xe - Đánh giá xe"],
        ["khoa-hoc-45", "Khoa học"],
        ["van-hoa-7", "Văn hóa"],
        ["giai-tri-36", "Giải trí"],
        ["phim-anh-35", "Giải trí - Phim ảnh"],
        ["am-nhac-153", "Giải trí - Âm nhạc"],
        ["hang-khong-du-lich-220", "Hàng không - Du lịch"],
        ["hoa-hau-253", "Hoa hậu"],
      ]),

      // [MỚI THÊM] Báo Lao Động (nhóm Công nghệ & Đời sống)
      ...feeds("Báo Lao Động", P_LD, LD, [
        ["van-hoa-giai-tri", "Văn hóa - Giải trí"],
        ["xe", "Xe+"],
        ["suc-khoe", "Sức khỏe"],
      ]),

      // [MỚI THÊM] Báo Nhân Dân (nhóm Công nghệ & Đời sống)
      ...feeds("Báo Nhân Dân", P_ND, ND, [
        ["vanhoa-1251", "Văn hóa"],
        ["du-lich-1257", "Du lịch"],
        ["y-te-1309", "Y tế"],
        ["goc-tu-van-1311", "Y tế - Góc tư vấn"],
        ["khoahoc-congnghe-1292", "Khoa học - Công nghệ"],
        ["phong-chong-toi-pham-cong-nghe-cao-2025-704717", "Phòng chống tội phạm công nghệ cao"],
        ["moi-truong-1296", "Môi trường"],
      ]),

      // [MỚI THÊM] Báo Quân đội nhân dân (nhóm Công nghệ & Đời sống)
      ...feeds("Báo Quân đội nhân dân", P_QD, QD, [
        ["van-hoa", "Văn hóa"],
        ["y-te", "Y tế"],
        ["du-lich", "Du lịch"],
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
  // [MỚI THÊM] Feed chính của các báo mới
  VTV("home"),
  VNP("home"),
  TPO("home"),
  ND("home"),
  LD("home"),
  QD("tin-tuc-moi-nhat"),
  // PLO("home"), // bật sau khi đã tải thử plo.vn/rss/home.rss
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