# Báo cáo refactor UI/UX customAOV (11/2026)

> Phạm vi: toàn bộ `docs/UI_UX_CHECKLIST.md` (P0 → P1 → P2 + 7 trang), Phase 1 → Phase 5, ngày 15/11/2026.
> Chi tiết từng thay đổi và cách hoàn tác: `docs/CHANGELOG-UI.md`. Quy tắc + bẫy kỹ thuật: `docs/UI_REFACTOR_RULES.md`.
> Ảnh so sánh: `docs/screenshots/before/` (gốc) ↔ `docs/screenshots/phase5/` (cuối), mỗi bộ 8 route × 375/768/1280/1440.

## 1. Tóm tắt

| Hạng mục | Trước | Sau |
| --- | --- | --- |
| Checklist | 0/57 | **57/57** mục đã tick (kèm ghi chú cách làm) |
| Cuộn ngang cấp trang (8 route × 4 khổ) | Có ở hầu hết trang (`body` min-width 1280px) | **0/32** |
| Bố cục | Sidebar 258px, nội dung tràn hết chiều ngang, banner ảnh ở mọi trang | TopNav sticky + BottomNav (< 768), container 1200px (phòng 1440px), PageHeader gọn, Footer |
| Cỡ chữ | 24 cỡ lẻ (~170 chỗ, có 10.5px/11px) | 7 bậc token, nhỏ nhất 12px |
| Bo góc | 18 kiểu | 3 token + `rounded-full` |
| Spacing lẻ (`p-[17px]`…) | 44 | **0** |
| Nút vàng đặc | 2–3 / màn ở nhiều trang | Tối đa 1 / khung nhìn trong nội dung (quy tắc chốt ở review 4a) |
| Tương phản WCAG AA | Chưa đo | Nền đặc: 0 lỗi (4 khổ). Chữ trên ảnh: 0/174 (đo điểm ảnh, 5 khổ) |
| `alt` ảnh | 15 ảnh thiếu ở dashboard | 622/622 lượt ảnh có `alt` |
| Trạng thái danh sách | Chỉ một số empty state | Empty + skeleton + lỗi (Thử lại) cho mọi danh sách |
| Mock data | Mâu thuẫn giữa các trang (Ngũ Kiệt Cup 3 trạng thái khác nhau; suthy ở cả 5 phòng) | Gom về `src/mocks/`, neo `MOCK_TODAY` = 15/11/2026, có test nhất quán |
| Test | 1 file (team-split) | 5 file, **25 test** + e2e auth (Playwright) |

## 2. Trước / sau theo từng trang

Điểm "trước" lấy từ review 15/11 (Visual / Layout / UX / Tổng). Không chấm lại điểm "sau" — thay vào đó là các phép đo cụ thể.

### Landing `/` (trước 7 / 3 / 4 / 5)
- **Trước:** nội dung dính mép trái (x ≈ 0), logo bị header cắt, bảng phòng đầy đủ, thiếu các section giới thiệu, nút không có route thật.
- **Sau:** container có lề; Hero → Tính năng → Cách hoạt động (3 bước) → Xem trước chia đội (dựng bằng component) → 3 card "Phòng đang mở" → Cộng đồng (số liệu `text-stat` + promo giải) → CTA cuối → Footer. Mọi nút là `Link` thật; "Vào phòng"/"Đăng ký" giữ `next=` để quay lại đúng trang sau đăng nhập. 2 nút vàng ở 2 khung nhìn (hero, CTA cuối). Hero và promo phủ đủ tối để đạt AA.

### Dashboard `/dashboard` (trước 7 / 3 / 4 / 4.5)
- **Trước:** bảng phòng tràn ~200px đè lên card bên phải; hero lớn; 4 ô tính năng bị cắt chữ; card hồ sơ trùng avatar header; phòng 10/10 vẫn "Vào phòng".
- **Sau:** PageHeader gọn, bảng phòng là khối đầu tiên (4 cột, không cuộn ngang ở mọi khổ ≥ 768; card list < 768), lọc chế độ + empty state, nút theo trạng thái ("Vào phòng" / "Theo dõi" / "Xem" + nhãn "Đủ người"). ≥ 1024: "Hoạt động gần đây" ở cột chính dưới bảng phòng; cột phải: Phòng bạn đang tham gia → Giải nổi bật → Công cụ nhanh. 1 nút vàng: "Đăng ký ngay".

### Danh sách giải `/tournaments` (trước 6 / 2 / 5 / 4)
- **Trước:** card ngang vỡ, cột giữa ~110px, tên giải xuống từng chữ, banner lớn.
- **Sau:** lưới card dọc 1/2/3 cột, tìm không dấu, sắp xếp, chip lọc có số lượng, bộ lọc lưu trên URL, phân trang 6/trang (8 giải mock → 2 trang), empty state nêu rõ từ khoá + nút xoá bộ lọc, skeleton/lỗi.

### Chi tiết phòng `/rooms/:roomId` (trước 7 / 3 / 5 / 5)
- **Trước:** panel Công cụ rộng ~140px chồng chữ; banner lớn; chat chỉ có ô nhập; 2 nút vàng; không phân biệt vai trò.
- **Sau:** container 1440px, PageHeader + mã phòng + badge vai trò. 2 đội + chat ở cột 1–2, công cụ cột 3 (≥ 1280). "Chia lại" (viền) + "Xuất kết quả chia đội" (vàng, sao chép văn bản 2 đội). Kéo thả đổi đội/đổi chỗ (HTML5, không thêm thư viện) + menu ⋮ thay thế cho bàn phím/cảm ứng. Quyền theo vai trò chủ phòng / người chơi / khán giả (bảng quyền ở tab Cấu hình). Chat có danh sách tin, gửi được, khán giả chỉ đọc.

### Tạo phòng `/rooms/new` (trước 7 / 4 / 7 / 6)
- **Trước:** fieldset tràn ~236px giấu lựa chọn "Khác"; bước 2–3 là placeholder; không có bước xem lại; stepper xuống dòng ở 768–1279.
- **Sau:** 4 bước — Thông tin → Cấu hình trận (số người, cấm/chọn + số lượt cấm, bản đồ theo số người, BO1/3/5) → Công cụ hỗ trợ (5 công tắc) → Xem lại (có nút "Sửa" từng nhóm). Stepper ngang < 1024 không xuống dòng, dọc ≥ 1024; bước chưa tới bị khoá. "Số khán giả tối đa" chỉ hiện khi bật. Thanh Hủy/Tiếp tục dính đáy trên mobile.

### Chi tiết giải `/tournaments/:slug` (trước 8 / 5 / 5 / 6)
- **Trước:** nhánh đấu mất cột Chung kết (tràn ~217px); tab Danh sách đội / Lịch thi đấu là placeholder; card "Thông tin giải đấu" trùng banner; tiêu đề tách "Mùa / 1".
- **Sau:** 5 tab trên URL. Thông tin = giới thiệu, lộ trình theo trạng thái, luật, giải thưởng + cột KPI/vô địch/trận sắp tới/kết quả/đơn vị tổ chức. Danh sách đội xếp theo thành tích suy từ nhánh. Bảng đấu dựng lại bằng flex (không toạ độ cứng), cuộn ngang có bóng mờ. Lịch thi đấu nhóm theo ngày (gộp tranh hạng ba). Kết quả có thẻ vô địch. Nút chính đổi theo trạng thái và mở đúng tab. Kiểm 8 giải × 5 tab × 2 khổ = 80/80 đạt.

### Hồ sơ `/profile` (trước 8 / 6 / 7 / 7)
- **Trước:** cột "Thời gian" bị ép 4 dòng; ID `#AOV-1024` trùng mã phòng; dòng trạng thái bị cắt; tab Tổng quan chứa hết chi tiết.
- **Sau:** ảnh bìa mỏng + avatar đè mép; ID `@suthy` + `UID 102394`; dòng trạng thái xuống dòng tự nhiên. Tổng quan chỉ tóm tắt; Lịch sử trận (bảng ≥ 768, Trang bị ≥ 1024, card list < 768; 0 ô thời gian xuống dòng), Tướng ưa thích, Thành tích có nội dung. `/profile/:userId` của người khác hiện đúng người (trước luôn hiện suthy).

### Chung (P0/P1/P2)
- TopNav sticky 56/64px, BottomNav 5 mục < 768, Footer có tuyên bố không liên kết Garena/Tencent, menu "Sắp có", tìm kiếm Ctrl K, `RequireAuth` cho route nội bộ, link "Bỏ qua tới nội dung chính".
- Tab có bóng mờ khi cuộn ngang và tự cuộn tới tab đang chọn.

## 3. Danh sách file đã đổi

So với `../web_backup_2026-11-15/` (lệnh: `diff -rq web_backup_2026-11-15 web -x node_modules -x dist -x screenshots`, chạy trong `base-workspace/`).

### Tạo mới (32)
| Nhóm | File |
| --- | --- |
| Layout | `components/layout/{TopNav, BottomNav, Container, Footer, PageHeader, SearchDialog, UserMenu, RequireAuth}.tsx`, `hooks.ts`, `nav.ts`, `RequireAuth.test.tsx` |
| UI dùng chung | `components/ui/{FilterChips, Pagination, ListStatus}.tsx`, `ListStatus.test.tsx`, `components/domain/RegistrationProgress.tsx` |
| Logic thuần | `lib/{room, tournament, text, mockStatus}.ts`, `lib/tournament.test.ts` |
| Mock | `mocks/{clock, home}.ts` |
| Script | `scripts/e2e-auth.mjs` |
| Tài liệu | `docs/{CHANGELOG-UI, UI_REFACTOR_RULES, UI_REFACTOR_REPORT}.md`, `docs/screenshots/*` (11 bộ) |
| Thừa (xem mục 6) | `scripts/.blank-{0,50,150,300,600,1000,1500}.png` |

### Sửa (35)
| Nhóm | File |
| --- | --- |
| Trang | `pages/{HomeGuest, HomeUser, Tournaments, TournamentDetail, RoomDetail, CreateRoom, Profile, NotFound}.tsx`, `pages/RoomDetail.test.tsx` |
| Component | `components/domain/{EmptyState, FeatureCard, PageBanner, RoomsTable, TournamentPromoCard}.tsx`, `components/ui/{Button, Modal, Tabs, primitives}.tsx`, `components/layout/{AppShell, Brand, Sidebar, Topbar}.tsx`, `components/LoginModal.tsx` |
| Khác | `App.tsx`, `index.css`, `context/AppContext.tsx` |
| Mock | `mocks/{activity, index, profile, rooms, tournaments, types}.ts` |
| Cấu hình / script | `package.json` (script `test:e2e`), `scripts/screenshot.mjs` |
| Tài liệu | `docs/UI_UX_CHECKLIST.md` |

Không đổi: `features/team-split/*`, `packages/team-core`, không thêm thư viện mới (chỉ dùng `playwright` đã có cho script đo).

## 4. Kết quả kiểm tra cuối (Phase 5)

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run build` | ✅ (JS 479.5 kB / gzip 140.8 kB) |
| `npm run lint` | ✅ 0 lỗi, 2 cảnh báo có từ trước (`react-refresh` ở `AppContext.tsx`) |
| `npm test` | ✅ 5 file, 25/25 test |
| `npm run test:e2e` | ✅ (đăng nhập, khôi phục session, đăng xuất, chặn route, `/tournaments` công khai) |
| `node scripts/screenshot.mjs phase5` | ✅ 32/32 (không cuộn ngang, không lỗi console) |
| Tương phản nền đặc (12 trang/tab × 4 khổ) | ✅ 0 lỗi |
| Tương phản chữ trên ảnh (7 trang × 5 khổ, đo điểm ảnh) | ✅ 0/174 |
| a11y (18 trang/tab × 2 khổ) | ✅ alt 622/622, mọi điều khiển có tên, không trùng id, 1 `<h1>`/trang, không chữ < 12px |
| Trạng thái danh sách (`?mock=loading/error/slow`, 6 trang) | ✅ |
| Rà soát giá trị lẻ | ✅ spacing 0 · `text-[Npx]` 0 · bo góc lẻ 0 (bỏ qua 2 file deprecated) |

Chi tiết các probe Playwright theo từng phase (4a-b, 4b, 4c, 5) ở mục "Kiểm tra" của từng phase trong CHANGELOG. Các script probe chạy tạm rồi xoá, đúng quy tắc.

## 5. Những gì còn tồn thật sự

| # | Vấn đề | Ghi chú |
| --- | --- | --- |
| 18 | "Xem tất cả phòng", menu "…" của phòng, "Xem hướng dẫn", "Tạo giải đấu", "Tham gia phòng", "Mời", "Random lane/tướng", "Hộp bí ẩn", "Theo dõi giải", "Liên hệ ban tổ chức", "Tạo phòng" (bước cuối) vẫn là giả lập (`comingSoon` / toast). | Cần route/backend. |
| 20 | Chưa có phòng mẫu mà suthy là **người chơi thường** → góc nhìn "Người chơi" có trong code và bảng quyền nhưng chưa xem được. Kéo thả HTML5 không chạy trên cảm ứng (mobile dùng menu ⋮). | Thêm phòng mẫu nếu cần demo. |
| 21 | Custom League #3: Team Đỏ / AOV Elite hiện "Dừng ở bán kết" dù còn trận tranh hạng ba (đúng theo nhánh, chưa thể hiện trận ngoài nhánh trong xếp hạng). | Cần mô hình dữ liệu cho trận ngoài nhánh. |
| 22 | Loading/lỗi chỉ xem được qua `?mock=` vì dữ liệu là mock đồng bộ. | Khi nối API: thay `useMockStatus` bằng trạng thái request. |
| 23 | 12 kích thước px cố định cho điều khiển/menu/hộp thoại/lớp trang trí (`w-[220px]` menu "Thêm", `h-[52px]` nút xl, `max-w-[440px]` modal…). Không phải spacing, không phải khối nội dung. | Tuỳ chọn: đổi sang bội số spacing. |
| — | 2 cảnh báo lint `react-refresh/only-export-components` ở `AppContext.tsx`. | Tách `useAuth`/`useToast` ra file riêng nếu muốn 0 cảnh báo. |
| — | `/profile/:userId` của người khác mới có header + empty state (mock chỉ có hồ sơ đầy đủ của suthy). | Cần dữ liệu hồ sơ công khai. |

## 6. File @deprecated / thừa có thể xoá

Đã kiểm bằng `grep`: không còn chỗ nào import/dùng các mục dưới đây (trừ chính các file deprecated dùng lẫn nhau).

| File / mục | Lý do | Cách xoá an toàn |
| --- | --- | --- |
| `src/components/layout/Sidebar.tsx` | `@deprecated` từ Phase 2, thay bằng TopNav/BottomNav. | Xoá file. |
| `src/components/layout/Topbar.tsx` | `@deprecated` từ Phase 2, thay bằng TopNav + UserMenu + SearchDialog. | Xoá file. |
| `Brand` biến thể `sidebar` / `header` | Chỉ Sidebar dùng. | Sau khi xoá Sidebar, bỏ 2 biến thể trong `Brand.tsx`. |
| `public/mock-assets/sidebar-art.jpg` | Chỉ Sidebar dùng. | Xoá sau Sidebar. |
| `homeSlides` (+ type `HomeSlide`) trong `src/mocks/home.ts`, `types.ts` | Carousel dashboard đã bỏ ở Phase 4a. | Xoá export + type (`communityStats` vẫn dùng — giữ). |
| `FeatureCard` biến thể `size="sm"` | Không còn nơi dùng từ Phase 4a. | Bỏ nhánh `sm` trong `FeatureCard.tsx`. |
| `scripts/.blank-*.png` (7 ảnh, ~1.8 MB) | Ảnh thừa của probe đo trắng trang Phase 3b, lẽ ra phải xoá ngay. | Xoá thẳng (không phải mã nguồn). |

Sau khi xoá: chạy lại build/lint/test và lệnh rà soát trong `UI_REFACTOR_RULES.md` — lúc đó có thể bỏ `grep -v "Sidebar.tsx\|Topbar.tsx"` khỏi các lệnh.
