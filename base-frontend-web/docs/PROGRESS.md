# PROGRESS — customAOV web MVP (UI mock)

> Phiên sau: đọc file này + `docs/SCREENS.md` rồi làm tiếp, không dựng lại từ đầu.

## Trạng thái

| Màn (ảnh) | Route | Trạng thái |
|-----------|-------|-----------|
| `trang-chu-guest.png` | `/` | ✅ Xong |
| `trang-chu-user.png` | `/dashboard` | ✅ Xong |
| `trang-phong-custom.png` | `/rooms/:roomId` (mẫu `/rooms/AOV-1024`) | ✅ Xong |
| `trang-giai-dau.png` | `/tournaments` | ✅ Xong |
| `chi-tiet-giai-dau.png` | `/tournaments/:slug` (mẫu `/tournaments/ngu-kiet-cup-mua-1`) | ✅ Xong |
| `ho-so-user.png` | `/profile` (alias `/profile/:userId`) | ✅ Xong |
| `cau-hinh-room.png` | `/rooms/new` | ✅ Xong |

**Đang làm:** không có. Đã xong 7 màn, đang chờ duyệt.

## Kiểm tra đã chạy
- `npm run build` pass (tsc strict + vite), không lỗi TypeScript. ESLint: 0 lỗi, 2 cảnh báo `react-refresh/only-export-components` ở `AppContext.tsx` (vô hại).
- `node scripts/screenshot.mjs` → 7/7 route không có lỗi console; ảnh ở `docs/screenshots/` (1672×941).
- Kịch bản tương tác Playwright (29 bước: login giả lập, điều hướng, toast, tab + phím mũi tên, lọc/sắp xếp, form validate, toggle/radio, logout) → pass, 0 lỗi console.

## Cấu trúc
- Tokens (nguồn duy nhất): `src/index.css` → `@theme` (màu, font, bo góc, bóng). Màu lấy mẫu pixel; giá trị ước lượng có ghi `(~)`.
- Component chung: `src/components/ui/` (Button, IconButton, ButtonLink, Card, Badge, LevelPill, Chip, Avatar, Eyebrow, SectionTitle, SeeAllLink, Tabs, Modal), `src/components/layout/` (AppShell, Sidebar, Topbar, Brand), `src/components/domain/` (PageBanner, FeatureCard, ActiveRoomsCard, TournamentPromoCard, EmptyState), `src/components/LoginModal.tsx`.
- Mock có kiểu: `src/mocks/` (`types.ts`, players, rooms, tournaments, profile, activity).
- Ảnh placeholder: `public/mock-assets/` — **cắt từ ảnh UI-Mock** (ảnh gốc không bị sửa).

## GIẢ ĐỊNH
1. **Font:** ảnh không ghi font. Tiêu đề lớn dùng **Be Vietnam Pro** (bo tròn, khớp chiều rộng H1 ~4%); chữ UI dùng **Inter** vì chữ nhỏ trong mock hẹp hơn Be Vietnam Pro ~15% (dùng BVP làm thẻ/bảng bị xuống dòng). Tải từ Google Fonts.
2. **Icon:** dùng `lucide-react` — chọn icon gần nhất (lane MID=Feather, JG=PawPrint, AD=Crosshair, SP=ShieldPlus, TOP=Shield; random=Box…). Icon trong mock là vẽ tay/AI nên không trùng 100%.
3. **Ảnh nhân vật, avatar, logo đội, trang bị, logo app:** cắt trực tiếp từ ảnh mock làm placeholder. Cần thay bằng asset thật (có bản quyền).
4. **Khung:** chỉ desktop, `body` min-width 1280px. Trang khách căn giữa container 1418px (mock lệch phải ~40px, coi là sai số thiết kế).
5. **Sidebar active:** mock "Giải đấu" và "Chi tiết giải đấu" tô sáng "Trang chủ" → coi là lỗi, tô "Giải đấu mini". Màn "Hồ sơ" không tô mục nào (giống mock). "Phòng custom" trỏ tới `/rooms/AOV-1024` vì chưa có màn danh sách phòng.
6. **Đồng bộ dữ liệu giữa các màn (mock không thống nhất):**
   - Tên phòng #AOV-1024: mock phòng ghi "Kèo giao hữu – Đêm hội custom", trang chủ ghi "Team A vs B", form tạo phòng ghi "Team A vs Team B" → thống nhất **"Kèo giao hữu – Team A vs B"**.
   - #AOV-1024 trang chủ ghi 8/10 nhưng màn phòng có đủ 10 người → dùng **10/10** ở cả hai nơi.
   - #AOV-1025: guest ghi "Giải clan cộng đồng #07", user ghi "Giao lưu cộng đồng #07" → dùng **"Giao lưu cộng đồng #07"**.
   - Huy hiệu "Customer" ở thẻ hồ sơ trang chủ đổi thành **"Chủ phòng"** cho khớp với "Chủ phòng (Host)" ở màn hồ sơ.
   - Chi tiết giải: mock ghi "Bán kết · Trận 6" là trận *sắp tới* trong khi nhánh đấu đã có tỉ số 0–2 → sắp tới = **Tranh hạng ba (Team Đỏ vs AOV Elite) + Chung kết**; kết quả gần đây = **2 trận bán kết**.
7. **Carousel trang chủ user:** mock có 3 chấm nhưng chỉ vẽ 1 slide. Slide 2–3 dùng nội dung suy ra từ tính năng sẵn có; không tự chạy (tránh phải có nút dừng).
8. **Thanh "Vai trò ưa thích":** mock vẽ 38% ≈ 60% thanh → dùng tỉ lệ ×1.55 (thanh đầy ≈ 64%) để giống ảnh; giá trị `aria-valuenow` vẫn là % thật.
9. **Đăng nhập giả lập:** Đăng nhập / Đăng ký / Bắt đầu ngay mở modal "đang phát triển" + nút "Vào bằng tài khoản mẫu". Trạng thái lưu localStorage; vào `/` khi đã đăng nhập thì chuyển sang `/dashboard`; Đăng xuất trong menu avatar. Các route user không chặn khách (mock).
10. **Bước 2–3 của form tạo phòng, tab phụ** (Cấu hình/Ghi chú ở phòng; Danh sách đội/Bảng đấu/Lịch/Kết quả ở giải; Lịch sử trận/Tướng/Thành tích ở hồ sơ): chưa có thiết kế → hiển thị empty state "đang phát triển".
11. **Phòng chưa đủ người** (AOV-1026, 1028…): hiển thị ô "Chỗ trống" + nút "Mời" (mock không có trạng thái này).
12. **Chi tiết giải khác** (`custom-league-3`, `hoi-lang-keo-vui`): mock chỉ có dữ liệu Ngũ Kiệt Cup → empty state có link quay lại.

## Khác biệt còn lại so với ảnh
- Vị trí dọc lệch vài px (≤10px) ở trang khách và một số khối; trang khách căn giữa thay vì lệch phải ~40px.
- Nền trang khách: mock có tranh lâu đài mờ ở nửa dưới; bản dựng dùng gradient ánh vàng (không có asset riêng).
- Banner chi tiết giải cao hơn mock một chút (244 vs ~240px) để nút không sát mép → trang dài hơn 941px khoảng 1–5px (cuộn nhẹ).
- Nhánh đấu thu hẹp cột (240/232/240px thay vì ~250px) vì sidebar thống nhất 258px (mock màn này dùng sidebar ~225px).
- Ảnh crop độ phân giải thấp (avatar, trang bị) → hơi mờ khi phóng.
- Ở màn hồ sơ, ID người dùng "#AOV-1024" trùng mã phòng — giữ nguyên theo ảnh, cần xác nhận.
- **Câu hỏi cần duyệt:** Ngũ Kiệt Cup đang "mở đăng ký đến 20/11" (trang chủ, danh sách giải) nhưng "đang diễn ra 20/11–25/11" (chi tiết giải). Hiện giữ đúng từng ảnh; cần chốt mốc thời gian chung.

## Skill đã dùng
- **UI/UX Pro Max** — skill `ui-ux-pro-max` (`SKILL.md`)
  - Mọi màn: focus ring vàng `:focus-visible`, `aria-label` cho mọi icon button, skip-link, chuyển focus về `<main>` khi đổi route, `prefers-reduced-motion`, chữ phụ ≥12px, độ tương phản `fg-muted` ≈ 8:1 trên surface.
  - Trạng thái: hover/active (nhấn lún 1px), disabled (select khán giả khi tắt toggle), empty state (tab chưa có, phòng không tồn tại, lọc giải rỗng), lỗi form (tên phòng rỗng → `role=alert` + `aria-invalid` + focus vào ô), toast `aria-live=polite` tự ẩn ~3.8s.
  - Điều hướng bàn phím: Tabs theo mẫu WAI-ARIA (←/→/Home/End), modal đóng bằng Esc + trả focus, Ctrl+K vào ô tìm kiếm, radio/switch semantics ở form tạo phòng, bảng dùng `<table>`/`<caption>`/`scope`.
  - Tổ chức tokens ngữ nghĩa (bg/surface/fg/gold/success/warning/danger/team) trong 1 chỗ.
- **Taste (design-taste-frontend)** — skill `design-taste-frontend` (`SKILL.md`)
  - Tự review từng màn qua screenshot và sửa: chữ xuống dòng ở thẻ tính năng/bảng, eyebrow bị kéo full-width, nút outline trên ảnh thiếu nền (thêm nền tối + blur), nhánh đấu tràn, ảnh cúp lộ viền (mask), nút CTA không bị xuống dòng.
  - Chuyển động nhẹ chỉ dùng transform/opacity (hover nâng thẻ 2px, phóng ảnh 3%, toast/modal pop-in).
  - Khóa bo góc theo quy tắc: card 16px, nút 10px, chip 8px; nút pill chỉ ở nơi ảnh vẽ pill.

## Đề xuất từ skill (chưa áp dụng vì trái ảnh hoặc ngoài phạm vi)
- Taste: cấm dấu gạch ngang dài (– / —) → **giữ** vì ảnh dùng "Kèo giao hữu – Team A vs B", "Ngũ Kiệt Cup – Mùa 1".
- Taste: hạn chế eyebrow (≤1 / 3 section) → **giữ** eyebrow "CUSTOM AOV COMMUNITY" trên mọi banner như ảnh.
- Taste: tránh Inter làm mặc định, tránh chấm trạng thái trang trí, tránh thanh tiến độ có track nền → **giữ** theo ảnh (Inter chọn vì khớp độ rộng chữ; chấm xanh "Đang diễn ra" mang nghĩa trạng thái thật).
- Taste/UI-UX: hỗ trợ cả light mode → **chưa làm**, ảnh chỉ có dark (đen–vàng).
- UI/UX Pro Max: icon set mặc định Phosphor → **dùng lucide** theo stack prompt cho phép.
- UI/UX Pro Max: mobile-first / responsive → ngoài phạm vi lượt này (chỉ desktop).
- UI/UX Pro Max: skeleton loading → chưa có dữ liệu bất đồng bộ (mock tĩnh) nên chưa cần.
- UI/UX Pro Max: bảng có thể sắp xếp (`aria-sort`) → ảnh không có điều khiển sort ở bảng phòng/lịch sử.

## Tích hợp `@customaov/team-core` (chia đội 5v5)
- Dependency local: `"@customaov/team-core": "file:../packages/team-core"` (symlink; core đã build sẵn `dist/`).
- Lớp tích hợp: `src/features/team-split/teamSplit.ts` (`splitRoomMembers`, map `TeamCoreError.code` → tiếng Việt). Không có thuật toán trong `web`.
- UI `/rooms/:roomId`: "Bắt đầu chia đội" → mode `random`; công cụ "Chia đội cân bằng" → mode `tier` (DEFAULT_TIER_SCORES, DEFAULT_BALANCE_LEVEL). teamA → Team Xanh, teamB → Team Đỏ. Kết quả/cảnh báo/lỗi qua toast hiện có.
- Test: `npm test` (vitest + jsdom + Testing Library), `npm run typecheck`.
- **Giới hạn / cần chốt:**
  - Mock `Player` chưa có `tier` / `rankTier` → mode `tier` hiện luôn báo "Thiếu dữ liệu Tier/Rank". Không tự gán.
  - Mode `rank` đã hỗ trợ ở lớp tích hợp nhưng chưa có nút UI vì frontend chưa có bảng điểm Rank.
  - Chưa có UI chọn mode / mức cân bằng (50-50, 60-40, 70-30).
  - Lane, đội trưởng, ready của từng người được giữ nguyên khi đổi đội (chưa port gán lane) → một đội có thể trùng lane hoặc có 0/2 đội trưởng.
  - Kết quả chỉ nằm trong state trang (mất khi tải lại); "Xuất kết quả chia đội" vẫn "đang phát triển".
