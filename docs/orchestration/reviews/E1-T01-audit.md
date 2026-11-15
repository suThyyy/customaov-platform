# E1-T01 — Báo cáo Audit chỉ đọc 8 route (chế độ mock)

- **Ngày thực hiện:** 15/11/2026
- **Nhánh:** `task/E1-T01-audit` (rẽ từ `integration/mvp`)
- **Phạm vi kiểm tra:** 8 route (`/` khách, `/dashboard`, `/rooms/AOV-1024`, `/rooms/new`, `/tournaments`, `/tournaments/ngu-kiet-cup-mua-1`, `/tournaments/custom-league-3`, `/profile`) × 4 khổ (`375`, `768`, `1280`, `1440`), cộng thêm kiểm tra tương tác, trạng thái `?mock=loading|error`, tab URL và các route phụ (`AOV-1025`, `AOV-1027`, 404).
- **So sánh baseline:** Thư mục `docs/screenshots/baseline/` nằm ở checkout gốc (ngoài phạm vi worktree) nên không đọc để so pixel trực tiếp; tuy nhiên kết quả `screenshot.mjs` trên 8 route × 4 khổ đạt **32/32 ok** (0 tràn ngang, 0 lỗi console), `e2e-auth.mjs` đạt **13/13 ok**, `npm run lint` **0 lỗi** (2 cảnh báo cũ ở `AppContext.tsx`), `npm test` đạt **15/15** (`team-core`) + **25/25** (`base-frontend-web`), hai lệnh grep token/spacing lẻ đều trả về **0 kết quả**.

---

## Tóm tắt số lỗi theo route × mức

| Route | P0 | P1 | P2 | Ghi chú |
| --- | :---: | :---: | :---: | --- |
| `/` (Landing, khách) | 0 | 0 | 1 | Đạt 4 khổ; 2 nút vàng đặc ở 2 khung nhìn tách biệt (hero + CTA cuối, hợp lệ theo AGENTS.md) |
| `/dashboard` | 1 | 2 | 1 | P0: dữ liệu phòng `AOV-1025`/`AOV-1027` lệch số người với trang chi tiết phòng |
| `/rooms/:roomId` | 1 | 1 | 1 | P0: `/rooms/AOV-1025` & `/rooms/AOV-1027` hiện `9/10` dù dashboard ghi `10/10` |
| `/rooms/new` | 0 | 1 | 0 | P1: ô nhập "Tên phòng" sát/chạm bộ đếm `31/50` ở 375px |
| `/tournaments` | 0 | 0 | 1 | Đạt 4 khổ, phân trang 2 trang hoạt động đúng |
| `/tournaments/ngu-kiet-cup-mua-1` | 0 | 0 | 1 | Đạt 4 khổ và 5 tab |
| `/tournaments/custom-league-3` | 0 | 1 | 1 | P1: tab Danh sách đội ghi "Dừng ở bán kết" dù còn trận tranh hạng ba (Còn tồn #21) |
| `/profile` | 0 | 0 | 1 | Đạt 4 khổ và 4 tab |
| **Tổng (không tính trùng)** | **1** | **5** | **4** | **1 P0 · 5 P1 · 4 P2** (mục P0 `AOV-1025`/`1027` xuất hiện trên cặp `/dashboard` ↔ `/rooms/:roomId`) |

---

## Chi tiết lỗi P0

### [P0] /dashboard ↔ /rooms/:roomId @375,768,1280,1440 – Lệch số người chơi của phòng AOV-1025 và AOV-1027 giữa Dashboard và Chi tiết phòng

- **Bước tái hiện:**
  1. Đăng nhập tài khoản mẫu (`suthy`) và mở `/dashboard`.
  2. Quan sát hàng/card của phòng `#AOV-1025` ("Giao lưu cộng đồng #07") và `#AOV-1027` ("Custom giải trí – All Mid"): cả hai hiển thị `10 / 10` người chơi và trạng thái `Đang diễn ra`.
  3. Bấm nút `Theo dõi` để đi tới `/rooms/AOV-1025` (hoặc `/rooms/AOV-1027`).
  4. Quan sát thông tin phòng trên `PageHeader` và số lượng thành viên trong 2 bảng `Team Xanh` / `Team Đỏ`.
- **Kết quả thực tế:** Trên `/dashboard` hiển thị `10 / 10`, nhưng khi vào `/rooms/AOV-1025` và `/rooms/AOV-1027`, header hiển thị `9/10 người chơi` (`Team Xanh` 5 người, `Team Đỏ` 4 người + 1 ô `Còn 1 chỗ trống`), dù phòng đang ở trạng thái `live` (đang diễn ra). Nguyên nhân: hàm `partial(count, host)` loại cả `host.id` và `players.suthy.id` khỏi danh sách 10 người (`fullBlue` + `fullRed`), nên `pool` chỉ còn 8 người; cộng thêm `hostMember` chỉ được tối đa **9 người**, không đủ 10 cho `partial(10, ...)`.
- **Kết quả mong đợi:** Số người hiển thị trên `/dashboard` và số thành viên thực tế trong `/rooms/:roomId` phải khớp nhau (`10/10` với đủ 5v5 cho phòng `live`).
- **File và dòng nghi ngờ:**
  - `base-frontend-web/src/mocks/rooms.ts:28-37` (hàm `partial`), `base-frontend-web/src/mocks/rooms.ts:60-63` (`AOV-1025`), `base-frontend-web/src/mocks/rooms.ts:84-87` (`AOV-1027`).
  - `base-frontend-web/src/pages/RoomDetail.tsx:147` (`playerCount = teams.blue.length + teams.red.length`).
- **Quy tắc bị vi phạm:** `AGENTS.md` › Dữ liệu và auth: *"Một giải/phòng phải hiển thị nhất quán ở mọi trang."*

---

## Chi tiết lỗi P1

### [P1] /rooms/new @375 – Chữ trong ô "Tên phòng" chạm sát bộ đếm ký tự `31/50`

- **Bước tái hiện:**
  1. Đăng nhập và mở `/rooms/new` ở khổ `375px`.
  2. Quan sát ô nhập `Tên phòng` (mặc định: `"Kèo giao hữu – Team A vs Team B"`).
- **Kết quả thực tế:** Container flex bọc `<input>` và `<span ...>{name.length}/{NAME_MAX}</span>` không có `gap-*`, khiến phần cuối chữ nhập chạm sát vào `31/50` (`"Kèo giao hữu – Team A vs Team31/50"`).
- **Kết quả mong đợi:** Có khoảng cách rõ ràng (ví dụ `gap-2` hoặc `gap-3`) giữa vùng nhập và bộ đếm ký tự.
- **File và dòng nghi ngờ:** `base-frontend-web/src/pages/CreateRoom.tsx:261-283`.
- **Quy tắc bị vi phạm:** Thẩm mỹ / khoảng cách giữa control và nhãn phụ trên màn hẹp.

### [P1] /dashboard @375 – Nhóm chip lọc `FilterChips` cắt khuất mục `Custom 2` mà không có gợi ý cuộn

- **Bước tái hiện:**
  1. Đăng nhập và mở `/dashboard` ở khổ `375px`.
  2. Quan sát thanh lọc chế độ (`Tất cả 5`, `Căng 2`, `Vui 1`, `Custom 2`) trong card "Phòng custom đang hoạt động".
- **Kết quả thực tế:** Mục `Custom 2` nằm hoàn toàn ngoài khung nhìn bên phải; không có bóng mờ mép (fade shadow) báo hiệu thanh chip có thể cuộn ngang (khác với `Tabs.tsx` đã có bóng mờ mép từ Phase 5).
- **Kết quả mong đợi:** Có bóng mờ mép trái/phải hoặc gợi ý cuộn khi nội dung `FilterChips` vượt chiều rộng khung chứa.
- **File và dòng nghi ngờ:** `base-frontend-web/src/components/ui/FilterChips.tsx:23-24`.
- **Quy tắc bị vi phạm:** Khả năng nhận biết vùng cuộn ngang trên mobile (UI consistency với `Tabs.tsx`).

### [P1] /dashboard @375 – Liên kết "Xem tất cả →" bị xuống 2 dòng ở tiêu đề card phòng

- **Bước tái hiện:**
  1. Đăng nhập và mở `/dashboard` ở khổ `375px`.
  2. Quan sát phần đầu card "Phòng custom đang hoạt động".
- **Kết quả thực tế:** Do tiêu đề "Phòng custom đang hoạt động" dài, `SeeAllLink` ("Xem tất cả →") bị bẻ thành 2 dòng ("Xem" / "tất cả →").
- **Kết quả mong đợi:** `SeeAllLink` giữ trên 1 dòng (`whitespace-nowrap shrink-0`), tiêu đề tự xuống dòng gọn ở cột trái.
- **File và dòng nghi ngờ:** `base-frontend-web/src/components/ui/primitives.tsx:62-94` (`SeeAllLink`), `base-frontend-web/src/components/domain/RoomsTable.tsx:167-172`.
- **Quy tắc bị vi phạm:** Nhất quán bố cục action ở `SectionTitle`.

### [P1] /rooms/:roomId @375,768,1280,1440 – Chưa có phòng mẫu cho vai trò "Người chơi" (`player`)

- **Bước tái hiện:**
  1. Kiểm tra cả 5 phòng mẫu (`AOV-1024` đến `AOV-1028`) khi đăng nhập bằng `suthy`.
- **Kết quả thực tế:** `suthy` là chủ phòng (`host`) ở `AOV-1024` và là khán giả (`spectator`) ở 4 phòng còn lại. Góc nhìn `player` (người chơi thường: được chat, xuất kết quả, nhưng không được chia lại/đổi đội) có logic trong `ROOM_PERMISSIONS` nhưng chưa có phòng mẫu để kiểm chứng trên UI. *(Đã ghi nhận tại `CHANGELOG-UI.md` mục Còn tồn #20.)*
- **Kết quả mong đợi:** Có ít nhất 1 phòng mẫu mà `suthy` nằm trong đội nhưng không phải `host` (hoặc ghi chú rõ khi nối backend).
- **File và dòng nghi ngờ:** `base-frontend-web/src/mocks/rooms.ts:28-37`, `base-frontend-web/src/lib/room.ts`.
- **Quy tắc bị vi phạm:** Độ phủ trạng thái vai trò trên UI mock.

### [P1] /tournaments/custom-league-3 @375,768,1280,1440 – Tab "Danh sách đội" chưa phản ánh trận tranh hạng ba

- **Bước tái hiện:**
  1. Mở `/tournaments/custom-league-3?tab=teams`.
  2. Đối chiếu với tab `?tab=schedule` (có trận `Tranh hạng ba` ngày `22/11 18:00` giữa `Team Đỏ` và `AOV Elite`).
- **Kết quả thực tế:** Ở tab `Danh sách đội`, `Team Đỏ` và `AOV Elite` chỉ ghi `"Dừng ở bán kết"`, chưa nêu việc còn trận tranh hạng ba sắp đấu. *(Đã ghi nhận tại `CHANGELOG-UI.md` mục Còn tồn #21.)*
- **Kết quả mong đợi:** Trạng thái đội phản ánh được trận tranh hạng ba sắp tới (hoặc hạng 3/4 sau khi đấu xong).
- **File và dòng nghi ngờ:** `base-frontend-web/src/lib/tournament.ts` (`standings`), `base-frontend-web/src/pages/TournamentDetail.tsx`.
- **Quy tắc bị vi phạm:** Nhất quán thông tin giữa tab `Danh sách đội` và tab `Lịch thi đấu`.

---

## Chi tiết gợi ý P2

### [P2] Toàn ứng dụng – 12 kích thước px cố định còn lại ở điều khiển/menu/hộp thoại

- **Bước tái hiện:** Rà soát các class `w-[...px]`, `h-[...px]`, `max-w-[...px]`, `size-[...px]` trong `src/components/` và `src/pages/HomeGuest.tsx`.
- **Kết quả thực tế:** Còn 12 kích thước px cố định (không phải spacing, không phải chiều cao khối nội dung): `Brand` (`size-[46px]` / `size-[54px]`), `SearchDialog` (`max-w-[560px]`), `TopNav` (`w-[220px]` ×2, `h-[3px]`), `UserMenu` (`w-[232px]`), `Button` xl (`h-[52px]`), `Modal` (`max-w-[440px]`), `Tabs` (`h-[3px]`), toast (`w-[360px]`), nền hero landing (`h-[400px]`). *(Đã ghi nhận tại `CHANGELOG-UI.md` mục Còn tồn #23.)*
- **Kết quả mong đợi:** Có thể quy về bội số spacing Tailwind (`w-55`, `h-13`, …) nếu muốn đồng bộ tuyệt đối.
- **File và dòng nghi ngờ:** `src/components/layout/Brand.tsx`, `SearchDialog.tsx`, `TopNav.tsx`, `UserMenu.tsx`, `src/components/ui/Button.tsx`, `Modal.tsx`, `Tabs.tsx`, `src/context/AppContext.tsx`, `src/pages/HomeGuest.tsx:121`.
- **Quy tắc bị vi phạm:** Gợi ý chuẩn hóa token.

### [P2] Toàn ứng dụng – Các nút/hành động đang gắn `comingSoon`

- **Bước tái hiện:** Bấm các nút `"Xem hướng dẫn"`, `"Xem tất cả phòng"`, menu `"…"` của phòng, `"Tạo giải đấu"`, `"Tham gia phòng"`, `"Mời người chơi"`, `"Random lane"`, `"Random tướng"`, `"Hộp bí ẩn"`, `"Liên hệ ban tổ chức"`.
- **Kết quả thực tế:** Đều hiển thị toast `"Tính năng đang phát triển"`. *(Đã ghi nhận tại `CHANGELOG-UI.md` mục Còn tồn #18, #20, #21.)*
- **Kết quả mong đợi:** Nối route/API thực tế ở các phase tích hợp sau MVP mock.
- **File và dòng nghi ngờ:** `HomeUser.tsx`, `Tournaments.tsx`, `RoomDetail.tsx`, `TournamentDetail.tsx`.
- **Quy tắc bị vi phạm:** Phạm vi mock frontend (chưa có backend).

### [P2] /profile, /dashboard – `Avatar` dùng `loading="lazy"` và tái dùng ảnh thẻ tướng lớn làm avatar nhỏ

- **Bước tái hiện:**
  1. Mở `/dashboard` ở 375px hoặc `/profile` chưa cuộn xuống bảng lịch sử.
  2. Kiểm tra `img.naturalWidth` của các `Avatar` nằm trong vùng ẩn (`hidden md:block`) hoặc dưới màn hình; đồng thời xem `src/mocks/profile.ts:77,88`.
- **Kết quả thực tế:** Các `Avatar` có `loading="lazy"` nên chưa tải khi nằm trong bảng đang ẩn theo breakpoint; ngoài ra `Tel'Annas` và `Yue` dùng `champ-telannas.jpg` / `champ-yue.jpg` thay vì file avatar riêng `champ-av-*.png`.
- **Kết quả mong đợi:** Cân nhắc bỏ `loading="lazy"` cho icon/avatar 20–32px nhẹ và bổ sung asset avatar riêng cho `Tel'Annas`, `Yue` nếu cần đồng bộ.
- **File và dòng nghi ngờ:** `base-frontend-web/src/components/ui/primitives.tsx:252`, `base-frontend-web/src/mocks/profile.ts:77,88`.
- **Quy tắc bị vi phạm:** Tối ưu tải ảnh nhỏ và đồng bộ asset.

### [P2] Repo – File và biến thể `@deprecated` chưa dọn hẳn

- **Bước tái hiện:** Kiểm tra mục "File không còn được dùng" trong `docs/ui-refactor/CHANGELOG-UI.md`.
- **Kết quả thực tế:** Còn `Sidebar.tsx`, `Topbar.tsx`, biến thể `Brand` `sidebar`/`header`, `homeSlides` trong `src/mocks/home.ts`, `public/mock-assets/sidebar-art.jpg`, `FeatureCard` `size="sm"`.
- **Kết quả mong đợi:** Dọn sạch sau khi hoàn tất giai đoạn review/tích hợp.
- **File và dòng nghi ngờ:** `src/components/layout/Sidebar.tsx`, `src/components/layout/Topbar.tsx`, `src/mocks/home.ts`.
- **Quy tắc bị vi phạm:** Vệ sinh mã nguồn sau refactor.

---

## Đầu ra kiểm tra tự động

### `node scripts/screenshot.mjs E1-T01 http://localhost:5175`
```text
ok   landing             375px  scrollWidth=375
ok   landing             768px  scrollWidth=768
ok   landing            1280px  scrollWidth=1280
ok   landing            1440px  scrollWidth=1440
ok   dashboard           375px  scrollWidth=375
ok   dashboard           768px  scrollWidth=768
ok   dashboard          1280px  scrollWidth=1280
ok   dashboard          1440px  scrollWidth=1440
ok   room-detail         375px  scrollWidth=375
ok   room-detail         768px  scrollWidth=768
ok   room-detail        1280px  scrollWidth=1280
ok   room-detail        1440px  scrollWidth=1440
ok   room-new            375px  scrollWidth=375
ok   room-new            768px  scrollWidth=768
ok   room-new           1280px  scrollWidth=1280
ok   room-new           1440px  scrollWidth=1440
ok   tournaments         375px  scrollWidth=375
ok   tournaments         768px  scrollWidth=768
ok   tournaments        1280px  scrollWidth=1280
ok   tournaments        1440px  scrollWidth=1440
ok   tournament-detail   375px  scrollWidth=375
ok   tournament-detail   768px  scrollWidth=768
ok   tournament-detail  1280px  scrollWidth=1280
ok   tournament-detail  1440px  scrollWidth=1440
ok   tournament-live     375px  scrollWidth=375
ok   tournament-live     768px  scrollWidth=768
ok   tournament-live    1280px  scrollWidth=1280
ok   tournament-live    1440px  scrollWidth=1440
ok   profile             375px  scrollWidth=375
ok   profile             768px  scrollWidth=768
ok   profile            1280px  scrollWidth=1280
ok   profile            1440px  scrollWidth=1440
```

### `node scripts/e2e-auth.mjs http://localhost:5175`
```text
ok   có session, mở thẳng /dashboard → header có avatar
ok   có session, mở thẳng /profile → header có avatar
ok   có session, mở thẳng /rooms/AOV-1024 → header có avatar
ok   có session, mở thẳng /rooms/new → header có avatar
ok   khách mở /dashboard → /?login=login&next=%2Fdashboard + hộp đăng nhập
ok   khách mở /profile → /?login=login&next=%2Fprofile + hộp đăng nhập
ok   khách mở /rooms/AOV-1024 → /?login=login&next=%2Frooms%2FAOV-1024 + hộp đăng nhập
ok   đăng nhập xong quay lại /profile
ok   session được lưu vào localStorage
ok   tải lại /profile vẫn đăng nhập
ok   đăng xuất xoá session khỏi localStorage
ok   sau đăng xuất, mở /dashboard bị chặn
ok   khách mở /tournaments không bị chặn
Tất cả kiểm tra đều đạt
```
