# customAOV – Checklist sửa UI/UX

> Nguồn: review UI/UX ngày 15/11/2026, đo ở khổ 1440×900, 768 và 375px.
> Stack: React + Vite + TypeScript + Tailwind. Routes trong `src/App.tsx`:
> `/`, `/dashboard`, `/rooms/new`, `/rooms/:roomId`, `/tournaments`, `/tournaments/:slug`, `/profile`, `/profile/:userId`, `*`.

**Kết luận:** Chuyển customAOV sang bố cục **centered max-width container + sticky top nav** (giống TFT Academy). Làm theo thứ tự: sửa lỗi tràn layout (P0) trước, đổi khung bố cục (P1) sau, rồi mới sửa từng trang.

---

## 0. Bối cảnh: bố cục mục tiêu

| Thông số | TFT Academy (tham chiếu) | customAOV hiện tại | customAOV mục tiêu |
| --- | --- | --- | --- |
| Điều hướng chính | Top nav, 7 mục | Sidebar trái 258px, 6 mục | Top nav sticky |
| Header | Sticky, cao 63px | Sticky + thanh tìm kiếm | Sticky, cao 64px (mobile 56px), nền đặc + viền dưới |
| Chiều rộng nội dung | Tối đa 1160–1280px, căn giữa | Tràn hết phần còn lại | `max-w-[1200px] mx-auto`; trang phòng dùng `1440px` |
| Lề ngang | 16–64px | Landing = 0px | `px-4 md:px-6 lg:px-8` |
| Đầu trang nội bộ | Tiêu đề + tab + bộ lọc, không có banner | Banner ảnh lớn ở mọi trang | `<PageHeader>` gọn |
| Footer | Có | Không có | Có |
| `body` min-width | Không đặt | 1280px | Không đặt |

**Quy cách layout:**

- **Header:** logo bên trái; menu gồm Trang chủ, Phòng, Giải đấu, Bảng xếp hạng, Cộng đồng. Bên phải: nút tìm kiếm (mở dialog bằng Ctrl K), chuông thông báo, avatar, nút "Tạo phòng".
- **Mobile (< 768px):** header rút gọn còn logo, tìm kiếm, avatar. Thêm **bottom nav** 5 mục: Trang chủ, Phòng, Tạo (+), Giải đấu, Hồ sơ.
- **Banner ảnh lớn:** chỉ dùng ở landing và trang chi tiết giải đấu.
- **Trang chi tiết phòng:** dùng container `wide` (1440px), vì đây là công cụ làm việc chứ không phải trang đọc.

---

## P0 — Lỗi chặn (làm trước)

- [x] Bỏ `min-width: 1280px` trên `body` (tìm trong `index.css` / `App.css` / `tailwind` base).
- [x] Thêm `min-w-0` cho mọi con của flex/grid chứa bảng, card hoặc chữ dài.
  - Với grid: dùng `grid-cols-[minmax(0,1fr)_340px]` thay cho `1fr`.
- [x] Bọc mọi `<table>` và bracket trong `<div className="overflow-x-auto">`.
- [x] Kiểm tra mỗi trang ở 375 / 768 / 1280 / 1440px. Trong console, `document.documentElement.scrollWidth <= innerWidth` phải trả về `true`.
- [x] Đồng bộ dữ liệu mock giữa các trang, gom về một chỗ (`src/mocks/`).
  - Ví dụ lỗi: Ngũ Kiệt Cup đang đồng thời là "Đang mở đăng ký" (danh sách), "Đang diễn ra" (chi tiết) và đã có trận từ 20/11 trong khi "Đăng ký đến 20/11" (dashboard).

## P1 — Khung bố cục

- [x] Tạo `<Container>` (max 1200px, padding ngang theo breakpoint) và biến thể `wide` (1440px).
- [x] Thay sidebar bằng `<TopNav>` sticky, cao 64px. Dùng `NavLink` với trạng thái active rõ ràng.
  - Ghi chú: dùng `Link` + hàm `isActive(pathname, hash)` thay cho `NavLink`, vì mục "Phòng" trỏ tới `/dashboard#rooms` và cũng phải active ở `/rooms/:id`. Vẫn có `aria-current="page"`.
- [x] Thêm `<BottomNav>` cho màn < 768px. Thêm `pb-16` cho `main` trên mobile để bottom nav không che nội dung.
  - Ghi chú: khoảng chừa đáy (`.pb-bottom-nav` = 64px + safe-area) đặt ở khung ngoài để cả Footer cũng không bị che.
- [x] Tạo `<PageHeader title description actions tabs>` để thay banner ở các trang nội bộ.
- [x] Thêm `<Footer>`: liên kết, mạng xã hội, dòng tuyên bố không liên kết với Garena/Tencent.
- [x] Mục chưa làm (Bảng xếp hạng, Cộng đồng, Lịch sử): ẩn đi hoặc gắn badge "Sắp có". Mục còn lại phải là `<Link>`, không dùng `<button>`.

## P2 — Đồng bộ và truy cập

- [x] Áp dụng design tokens ở mục cuối. Hiện mỗi trang dùng 10–14 cỡ chữ; cần đưa về 6 bậc.
  - Ghi chú: token nằm trong `@theme` của `src/index.css` (Tailwind v4, không có `tailwind.config`). Thang chữ mặc định của Tailwind bị xoá (`--text-*: initial`), chỉ còn `text-xs/sm/base/lg/2xl/4xl` + `text-stat` (bậc 7, chỉ cho số KPI, thêm ở Phase 3b). Bo góc dùng `rounded-btn` (8px) / `rounded-card` (12px) / `rounded-full`. Code không còn `text-[Npx]` hay bo góc lẻ (trừ `Sidebar.tsx`, `Topbar.tsx` đã deprecated). Còn 44 giá trị spacing lẻ (`pt-[9px]`, `gap-[22px]`…), sẽ thay khi làm từng trang ở Phase 4.
- [x] Chữ phụ không nhỏ hơn 12px. Kiểm tra độ tương phản WCAG AA (4.5:1 cho chữ thường).
  - Tiến độ: phần cỡ chữ đã xong ở Phase 3 (bậc nhỏ nhất là `text-xs` = 12px; trước đây có 10.5px và 11px).
  - Ghi chú (Phase 5): đo bằng Playwright ở 375/768/1280/1440. (1) Chữ trên nền đặc: trộn màu chữ (kể cả opacity) với chồng nền tổ tiên → **0 lỗi** (sửa 2 chỗ: tiêu đề Team Xanh/Đỏ ở landing 4.46 và 3.9:1 → token `team-blue-fg`/`team-red-fg` ≈ 6.1 và 5.4:1). (2) Chữ trên ảnh: ẩn chữ, chụp màn hình, đo 5% điểm ảnh tệ nhất sau từng dòng chữ → **0/174 lỗi** sau khi phủ đậm promo giải, banner chi tiết giải (< 1024 phủ 80%), ảnh hero landing (< 1024 còn 30%). Chữ/nút gradient vàng tính tay: chữ `gold-ink` trên `gold-500` ≈ 8.6:1, chữ `gold-500` trên nền ≈ 9:1. Không còn chữ < 12px (quét toàn trang).
- [x] Thêm `alt` cho mọi `<img>`. Dashboard hiện còn 15 ảnh thiếu `alt`; ảnh trang trí dùng `alt=""`.
  - Ghi chú (Phase 5): quét 622 lượt ảnh trên 18 trang/tab × 2 khổ: 0 ảnh thiếu `alt`. Đồng thời: mọi nút/link/ô nhập/tab/switch/menuitem đều có tên truy cập (không có ô chỉ dựa vào placeholder), không trùng `id`, mỗi trang đúng 1 `<h1>` (sửa trang 404 và các trang "Không tìm thấy" — `EmptyState as="h1"`).
- [x] Mỗi màn hình chỉ có **một** nút chính màu vàng.
  - Ghi chú (Phase 5): đạt trên cả 8 route theo quy tắc chốt ở 4a-b (tối đa 1 nút vàng đặc mỗi khung nhìn trong nội dung; landing có 2 ở 2 khung nhìn; hồ sơ 0).
  - Tiến độ (4a): đạt ở `/`, `/dashboard`, `/tournaments` (đo bằng Playwright, đếm nút/link `bg-gold-gradient` trong `main`). Chip lọc đang chọn và "Vào phòng" không còn dùng vàng đặc. Còn lại các trang 4b/4c.
  - Tiến độ (4c): đạt ở `/tournaments/:slug` (8 giải × 5 tab × 375/1280 đều đúng 1 nút vàng) và `/profile` (0 nút vàng; badge "Chủ phòng" đổi từ vàng đặc sang viền vàng).
  - Tiến độ (4b): đạt ở `/rooms/:id` ("Xuất kết quả chia đội" hoặc "Tham gia phòng") và `/rooms/new` ("Tiếp tục"/"Tạo phòng"; công tắc dùng `bg-gold` thay vì gradient).
  - Quy tắc chốt ở review 4a (Phase 4a-b): tối đa 1 nút vàng đặc **mỗi khung nhìn** trong nội dung trang; điều hướng toàn cục (Tạo phòng TopNav, "+" BottomNav) không tính; trang dài được có CTA vàng ở hero và cuối trang (landing: "Bắt đầu ngay" + "Tạo tài khoản").
- [x] Mọi danh sách đều có empty state, loading skeleton và trạng thái lỗi.
  - Ghi chú (Phase 5): `ui/ListStatus.tsx` (`ListStatus`, `Skeleton`, `SkeletonRows`, `SkeletonCards`, `ErrorState` có "Thử lại") + `lib/mockStatus.ts` (`useMockStatus`). Áp dụng cho: phòng đang mở (landing), danh sách phòng + phòng của bạn + hoạt động (dashboard), lưới giải, nội dung tab chi tiết giải, nội dung tab hồ sơ, chat phòng. Empty state bổ sung: hoạt động, lịch sử trận, phòng đang mở. Mock đồng bộ nên mặc định là `ready`; xem trạng thái bằng `?mock=loading|error|slow`. Khi nối API thay `useMockStatus` bằng trạng thái request.

---

## Checklist theo từng trang

Điểm hiện tại (Visual / Layout / UX / Tổng). Trang điểm thấp sửa trước.

| Trang | Route | Visual | Layout | UX | Tổng |
| --- | --- | --- | --- | --- | --- |
| Danh sách giải | `/tournaments` | 6 | 2 | 5 | 4 |
| Dashboard | `/dashboard` | 7 | 3 | 4 | 4.5 |
| Landing | `/` | 7 | 3 | 4 | 5 |
| Chi tiết phòng | `/rooms/:roomId` | 7 | 3 | 5 | 5 |
| Tạo phòng | `/rooms/new` | 7 | 4 | 7 | 6 |
| Chi tiết giải | `/tournaments/:slug` | 8 | 5 | 5 | 6 |
| Hồ sơ | `/profile` | 8 | 6 | 7 | 7 |

### 1. Landing `/`
- [x] Thêm padding ngang. Nội dung hiện dính sát mép trái (x ≈ 0).
- [x] Sửa logo bị header cắt ở cạnh trên.
- [x] Thêm các section còn thiếu:
  - Cách hoạt động (3 bước)
  - Con số cộng đồng
  - Ảnh chụp tính năng
  - CTA cuối trang
  - Footer
  - Ghi chú (4a): "Ảnh chụp tính năng" là bản xem trước màn chia đội dựng bằng component + mock (`#preview`), không phải ảnh tĩnh. Footer đã có từ Phase 2.
- [x] Bỏ bảng phòng đầy đủ, chỉ giữ 3 card "Phòng đang mở" làm bằng chứng cộng đồng đang hoạt động.
- [x] Menu "Tính năng" và "Cộng đồng" dùng anchor để cuộn tới section tương ứng.
  - Ghi chú: "Cộng đồng" (khách) thành mục chính trỏ `/#community`; "Tìm hiểu thêm" trỏ `/#how-it-works`.
- [x] Gắn route thật cho "Bắt đầu ngay", "Đăng ký", "Đăng nhập", "Vào phòng".
  - Ghi chú: đều là `<Link>`/điều hướng tới `loginHref(intent, next)`; "Vào phòng" giữ `next=/rooms/:id`.

### 2. Dashboard `/dashboard`
- [x] Sửa bảng phòng tràn ~200px, đang đè lên card "Hoạt động gần đây" và che nút Vào phòng / Theo dõi.
- [x] Thay hero bằng `PageHeader` gọn và đưa danh sách phòng lên vị trí đầu tiên.
- [x] Xử lý 4 ô tính năng (đang bị cắt chữ và trùng với menu): bỏ đi, hoặc chuyển thành lưới 2×2 hiện đủ chữ.
  - Ghi chú: bỏ khỏi đầu trang; chuyển thành card "Công cụ nhanh" (danh sách link, hiện đủ chữ) ở cột phụ, nên trên mobile nằm sau danh sách phòng.
- [x] Thay card hồ sơ bên phải (trùng với avatar trên header) bằng "Phòng bạn đang tham gia" hoặc "Trận sắp tới".
- [x] Phòng 10/10: đổi nút thành "Xem" hoặc "Xếp hàng chờ", và hiển thị khác với phòng còn chỗ.
  - Ghi chú: phòng chờ đã đủ người → nút "Xem" (secondary) + nhãn "Đủ người", hàng chữ mờ. Ngoại lệ: phòng mình đang ở vẫn là "Vào phòng" (nhãn "Phòng của bạn").
- [x] Thêm bộ lọc chế độ (Căng / Vui / Custom) và empty state.
- [x] Trên mobile, hiển thị bảng phòng dạng card list.

### 3. Tạo phòng `/rooms/new`
- [x] Sửa ô "Chế độ phòng" (fieldset) tràn ~236px khiến lựa chọn "Khác" bị giấu: chuyển sang lưới 2×2.
- [x] Sửa lỗi khi validate: card bị cuộn ngang làm stepper trôi ra ngoài. Lỗi này hết khi sửa xong lỗi tràn ở trên.
- [x] Bỏ banner, dùng `PageHeader` "Tạo phòng custom".
- [x] Chỉ hiện "Số khán giả tối đa" khi toggle "Cho phép khán giả" đang bật.
- [x] Thiết kế bước 2 "Cấu hình trận" (số người, luật cấm/chọn, map) và bước 3 "Công cụ hỗ trợ" (hiện là placeholder).
  - Ghi chú (4b): bước 2 = số người (5v5/3v3/1v1) · cấm/chọn (Draft kèm số lượt cấm / Blind / Ngẫu nhiên) · bản đồ (lọc theo số người) · thể thức BO1/3/5. Bước 3 = bật/tắt 5 công cụ, "Chia đội" có lựa chọn ngẫu nhiên / theo Tier. "Tự động cân bằng đội" ở bước 1 cũ gộp vào đây.
- [x] Thêm bước xem lại (review) trước khi tạo phòng.
  - Ghi chú: bước 4 "Xem lại" tóm tắt theo 3 nhóm, mỗi nhóm có nút "Sửa" quay về bước tương ứng. Stepper chỉ mở các bước đã tới.
- [x] Trên mobile, thanh Hủy / Tiếp tục dính ở đáy màn hình.
  - Ghi chú: `sticky` ngay trên BottomNav (< 768); khung ngoài bỏ `overflow-hidden` để sticky hoạt động.

### 4. Chi tiết phòng `/rooms/:roomId`
- [x] Sửa panel "Công cụ" bị vỡ: panel rộng ~140px, tab và tiêu đề chồng chữ lên nhau. Cho rộng tối thiểu 300px, hoặc chuyển xuống dưới hai đội.
- [x] Dùng container `wide` (1440px).
- [x] Thêm vùng hiển thị tin nhắn cho chat (hiện chỉ có ô nhập).
  - Ghi chú (4b): card "Chat phòng" (`role="log"`, cuộn trong khung `max-h-80`), tin của mình căn phải; gửi được tin (state cục bộ). Khán giả: ô nhập bị khoá.
- [x] Giữ một nút chính duy nhất:
  - "Bắt đầu chia đội" đổi thành "Chia lại" (nút phụ).
  - "Xuất kết quả chia đội" giữ làm nút chính.
  - Ghi chú: cả hai lên PageHeader. "Xuất kết quả" sao chép danh sách 2 đội (theo lane) vào clipboard. Khán giả ở phòng còn chỗ thấy "Tham gia phòng" là nút chính thay thế.
- [x] Thêm kéo thả để đổi chỗ người chơi giữa hai đội.
  - Ghi chú: HTML5 drag & drop (không thêm thư viện). Thả vào đội còn chỗ → chuyển; thả lên một người → đổi chỗ; đội đủ người mà không chỉ định người → báo lỗi. Thay thế cho bàn phím / cảm ứng: menu ⋮ ở mỗi người ("Chuyển sang Team …", "Mời ra khỏi phòng").
- [x] Phân biệt góc nhìn chủ phòng và người chơi: ai được random, kick, đổi đội.
  - Ghi chú: `lib/room.ts` › `roomRole` + `ROOM_PERMISSIONS` (chủ phòng / người chơi / khán giả). Badge "Bạn là …" cạnh mã phòng; bảng quyền ở tab "Cấu hình". Mock: suthy là chủ AOV-1024, khán giả ở các phòng còn lại (chưa có phòng mẫu nào suthy là người chơi thường).
- [x] Bỏ banner ảnh lớn, chỉ giữ tiêu đề, meta và mã phòng.

### 5. Danh sách giải `/tournaments`
- [x] Sửa card giải bị vỡ: cột giữa bị ép còn ~110px, tên giải xuống dòng từng chữ và tràn đè lên card bên dưới.
- [x] Chuyển sang lưới card dọc (ảnh trên, thông tin dưới): 3 cột desktop, 2 cột tablet, 1 cột mobile.
  - Ghi chú: 1 cột < 768, 2 cột 768–1023, 3 cột ≥ 1024. Ảnh khung 16:9 + `object-right` để cắt badge in sẵn trong ảnh mock.
- [x] Bỏ banner, dùng `PageHeader` với nút "Tạo giải đấu".
- [x] Thêm ô tìm kiếm giải, phân trang và empty state khi lọc ra 0 kết quả.
  - Ghi chú: tìm không dấu; bộ lọc lưu trên URL (`?q=&status=&sort=&page=`); phân trang 6 giải/trang, tự ẩn khi chỉ có 1 trang. Từ Phase 4a-b mock có 8 giải → 2 trang.

### 6. Chi tiết giải `/tournaments/:slug`
- [x] Sửa nhánh đấu bị cắt mất cột Chung kết (tràn ~217px): cho cuộn ngang, kèm bóng mờ ở mép để gợi ý cuộn.
  - Ghi chú (4c): nhánh dựng lại bằng flex + viền CSS (bỏ toạ độ px cứng). Vùng cuộn riêng (`role="region"`, focus được bằng Tab), bóng mờ trái/phải chỉ hiện khi còn nội dung phía đó, kèm dòng gợi ý. Ở 1440 không cần cuộn; ở 375 cuộn tới được cột Chung kết.
- [x] Tab "Thông tin" chứa luật, giải thưởng và đơn vị tổ chức. Chuyển nhánh đấu sang tab "Bảng đấu".
  - Ghi chú: Thông tin = Giới thiệu · Lộ trình giải (theo trạng thái) · Luật · Giải thưởng; cột phụ = KPI (`text-stat`: Đội, Trận đã đấu, Hạng có thưởng) · Vô địch (nếu đã kết thúc) · Trận sắp tới · Kết quả gần đây · Đơn vị tổ chức. Tab lưu trên URL `?tab=`.
- [x] Hoàn thiện tab "Danh sách đội" và "Lịch thi đấu" (hiện là placeholder).
  - Ghi chú: Danh sách đội xếp theo thành tích suy ra từ nhánh (Vô địch / Á quân / Vào chung kết / Dừng ở …), giải đang mở có ô "Còn N chỗ trống". Lịch thi đấu nhóm theo ngày, gộp trận ngoài nhánh (tranh hạng ba). Tab Kết quả cũng làm xong (thẻ nhà vô địch + danh sách trận). Giải chưa bốc thăm: empty state nêu ngày bốc thăm.
- [x] Nút chính thay đổi theo trạng thái giải: Đăng ký / Xem trận đang diễn ra / Xem kết quả.
  - Ghi chú (4c): "Xem trận đang diễn ra" → tab Bảng đấu; "Xem kết quả" → tab Kết quả.
- [x] Bỏ card "Thông tin giải đấu" vì trùng với các chip meta trên banner.

### 7. Hồ sơ `/profile`
- [x] Sửa cột "Thời gian" bị ép ("18 phút trước" xuống 4 dòng): đặt `whitespace-nowrap`, và ẩn cột Trang bị trên màn nhỏ.
  - Ghi chú (4c): cột Trang bị chỉ hiện từ 1024px; dưới 768px bảng thành card list. Bỏ `min-w-[900px]` và các độ rộng cột cố định. Đo bằng Playwright: 0 ô thời gian xuống dòng ở 375/768/1280/1440.
- [x] Đổi ID người dùng: hiện là `#AOV-1024`, trùng với mã phòng. Dùng `@suthy` hoặc `UID 102394`.
  - Ghi chú: hiện cả hai (`@suthy` có nút sao chép, `UID 102394`).
- [x] Sửa dòng trạng thái bị cắt cụt.
  - Ghi chú: là đoạn văn xuống dòng tự nhiên (`max-w-[65ch]`). Nội dung đổi thành "Đang theo dõi giải Custom League #3" cho khớp mock (trước ghi "Tham gia giải Ngũ Kiệt Cup" trong khi suthy chưa đăng ký).
- [x] Tab "Tổng quan" chỉ hiện tóm tắt, phần chi tiết để ở các tab còn lại.
  - Ghi chú: Tổng quan = 4 KPI · top 3 tướng · top 3 vai trò · 3 trận gần nhất, mỗi khối có link sang tab chi tiết. Lịch sử trận (6 trận), Tướng ưa thích (thẻ ảnh + đủ 5 vai trò), Thành tích (4 mục) đã có nội dung. Tab lưu trên URL.
- [x] Thêm gradient tối dưới phần chữ ở header hồ sơ để đảm bảo độ tương phản.
  - Ghi chú: ảnh bìa mỏng (120px mobile / 176px desktop) có gradient tối từ dưới lên; avatar đè lên mép dưới bìa; tên và nút đặt dưới bìa, không có chữ nằm trên ảnh.

---

## Design tokens đề xuất

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| `text-xs` | 12px / 16px | Nhãn phụ, thời gian, mã phòng |
| `text-sm` | 14px / 20px | Nội dung bảng, mô tả card |
| `text-base` | 16px / 24px | Văn bản chính, nút |
| `text-lg` | 20px / 28px | Tiêu đề card, section |
| `text-2xl` | 24px / 32px | Tiêu đề khối lớn |
| `text-4xl` | 32–40px | Tiêu đề trang (H1) |
| `text-stat` | 32px / line-height 1, đậm 700, `tabular-nums` | **Chỉ cho số KPI**: thẻ thống kê hồ sơ, card hồ sơ dashboard, số liệu giải đấu |
| Spacing | 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64px | Gap trong card 12–16px; giữa card 24px; giữa section 48px |
| Container | 1200px (mặc định) · 1440px (wide) | Padding 16 / 24 / 32px theo breakpoint |
| Breakpoint | 640 · 768 · 1024 · 1280px | Mặc định Tailwind |
| Header | 64px desktop · 56px mobile | |
| Bo góc | 8px (nút, input) · 12px (card) · 999px (badge) | Không dùng giá trị lẻ (10px, 14px) |

Văn bản dài (luật giải, mô tả) giới hạn `max-w-[65ch]`.

---

## Tiêu chí hoàn thành (Definition of Done)

1. Ở cả 4 khổ 375 / 768 / 1280 / 1440px, không trang nào có thanh cuộn ngang ở cấp trang.
2. Không còn chữ bị cắt `…` ở tiêu đề, nhãn tab hay tên giải. Chữ bị cắt chỉ chấp nhận ở mô tả dài, và phải có tooltip.
3. Không phần tử nào tràn đè lên phần tử khác.
4. `npm run build` và `npm run lint` (nếu có) đều chạy không lỗi.

## Nguồn tham khảo

- TFT Academy: https://tftacademy.com/ · https://tftacademy.com/tierlist/comps
- NN/g – Sticky Headers: https://www.nngroup.com/articles/sticky-headers/
- Smashing – Sticky Menus UX Guidelines: https://shop.smashingmagazine.com/2023/05/sticky-menus-ux-guidelines/
- UX Movement – Top vs Left Navigation: https://uxmovement.com/navigation/top-navigation-vs-left-navigation-which-works-better/
- Material 3 Navigation bar / rail: https://www.sap.com/design-system/fiori-design-android/v26-4/components/m3-standard-components/navigation-bar/usage
- CreativePro – Optimum line length: https://creativepro.com/?p=122949
