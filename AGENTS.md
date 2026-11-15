# Quy tắc UI refactor customAOV (11/2026)

## Tài liệu
- Tài liệu gốc: docs/ui-refactor/UI_UX_CHECKLIST.md.
- Nhật ký: docs/ui-refactor/CHANGELOG-UI.md. Đọc mục "Còn tồn" và phase gần nhất trước khi làm.
- Ảnh chụp: base-frontend-web/docs/screenshots/<phase>/<route>-<width>.png. So với bộ của phase trước.

## Quy trình
- Mỗi lần chỉ làm một phase (hoặc một đợt của Phase 4). Trước khi sửa, tóm tắt kế hoạch 3–5 dòng. Xong thì DỪNG chờ review.
  - Từ sau Phase 4a (duyệt 15/11): chạy liền mạch 4a-b → 4b → 4c → 5, không dừng giữa các phase. Chỉ dừng khi kiểm tra cuối phase fail mà không tự sửa được sau 2 lần thử, hoặc gặp quyết định làm thay đổi phạm vi. Xong Phase 5 thì viết `docs/ui-refactor/UI_REFACTOR_REPORT.md` rồi dừng.
- Lộ trình Phase 4:
  - 4a: /tournaments → /dashboard → /
  - 4b: /rooms/:roomId → /rooms/new
  - 4c: /tournaments/:slug → /profile
  - Sau đó là Phase 5 (P2).
- Quy tắc git: mỗi task làm trên một nhánh riêng, không commit thẳng vào `main`. File không còn dùng thì gắn `// @deprecated – <lý do>` và ghi vào CHANGELOG.
- Mọi thay đổi, kể cả tick checklist và cập nhật CHANGELOG, đều sửa trực tiếp bằng Edit/Write. Không dùng script tạm hay Python inline.
- Không dùng đường dẫn tuyệt đối (code sẽ được chuyển sang base-frontend-web).
- Không thêm thư viện mới khi chưa được duyệt.

## Thiết kế
- Giữ màu và font hiện có (nền navy, nhấn vàng gold).
- Token nằm trong `@theme` của src/index.css (Tailwind v4, không có tailwind.config).
  - Chữ, chỉ 7 bậc: text-xs 12 · text-sm 14 · text-base 16 · text-lg 20 · text-2xl 24 · text-4xl 32–40 · text-stat 32 (chỉ cho số KPI, tabular-nums).
  - Spacing theo thang 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64px. Không dùng giá trị lẻ kiểu pt-[9px].
  - Bo góc: rounded-btn 8px, rounded-card 12px, rounded-full cho badge.
  - Container: max-w-page 1200px; max-w-wide 1440px (chỉ dùng cho trang phòng).
  - Không viết text-[Npx] hay rounded-[Npx].
- Mỗi khung nhìn chỉ có tối đa 1 nút vàng đặc trong nội dung trang. Điều hướng toàn cục (Tạo phòng trên TopNav, + ở BottomNav) không tính. Trang dài có thể có CTA vàng ở hero và cuối trang. Các hành động còn lại dùng nút viền hoặc nút ghost.
- Banner ảnh lớn chỉ có ở landing và chi tiết giải. Trang nội bộ dùng PageHeader. Hồ sơ dùng ảnh bìa mỏng.
- Bảng và nhánh đấu đặt trong vùng overflow-x-auto. Con của flex/grid có min-w-0. Không dùng chiều cao cứng (h-[Npx]) cho khối chứa nội dung.
- Tiêu đề và nhãn tab không được bị cắt `…`. Chỉ được cắt ở mô tả dài, và phải có tooltip.

## Dữ liệu và auth
- Mock data chỉ đặt trong src/mocks/. "Hôm nay" = MOCK_TODAY (15/11/2026). Một giải/phòng phải hiển thị nhất quán ở mọi trang.
- Route nội bộ (/dashboard, /rooms/*, /profile*) đi qua RequireAuth. Khách bị chuyển tới /?login=login&next=<route>. /tournaments là route công khai.
- Khi kiểm tra giao diện, dùng trạng thái đã đăng nhập (tài khoản mẫu suthy), trừ landing.

## Kết thúc mỗi phase
1. Chạy `npm run build`, `npm run lint` (0 lỗi), `npm test`.
2. Chạy `npm run test:e2e` (cần dev server đang chạy).
3. Chạy `node scripts/screenshot.mjs <phase>` ở 375/768/1280/1440. Cả 8 route phải không có cuộn ngang ở cấp trang.
4. Tick checklist, cập nhật CHANGELOG-UI.md (file đã sửa, mô tả, cách hoàn tác, "Còn tồn").
5. Tóm tắt ngắn những gì đã làm và những điểm cần tôi quyết.

## Ghi chú kỹ thuật
(Claude Code bổ sung tại đây những điều cần nhớ giữa các session.)

### Môi trường
- Thư mục ứng dụng: `base-frontend-web` trong monorepo (không phải gốc `CustomAOV`).
- **Dev server của người dùng thường đã chạy sẵn ở cổng 5173** (`strictPort`). Đừng khởi động server thứ hai (sẽ lỗi cổng); kiểm tra bằng `curl http://localhost:5173` rồi dùng luôn. Dev server của repo này chạy ở cổng 5174; mọi script (`screenshot.mjs`, `e2e-auth.mjs`) mặc định trỏ `http://localhost:5174`.
- Windows + Git Bash: tham số bắt đầu bằng `/` bị đổi thành đường dẫn Windows (vd. `/dashboard` → `D:/Git/dashboard`). Khi truyền route cho script node, đặt `MSYS_NO_PATHCONV=1` trước lệnh.
- Playwright đã cài (`playwright` trong devDependencies). Không có `@playwright/test`; các kiểm tra e2e là script node thuần.
- `npm run lint` hiện có **2 cảnh báo có sẵn từ trước** (`react-refresh/only-export-components` ở `AppContext.tsx`, do export `useAuth`/`useToast`). Đó là mức chấp nhận được (0 lỗi). Đừng export thêm hằng/hàm từ `AppContext.tsx`, nếu không sẽ thêm cảnh báo.
- Script kiểm tra tạm (thăm dò bằng Playwright) đặt ở thư mục scratchpad của session; nếu cần chạy trong repo để resolve `playwright` thì copy vào `scripts/.ten-tam.mjs` và **xoá ngay sau khi chạy**. Đây là công cụ đo, không phải công cụ sửa file.

### Lệnh rà soát nhanh
```bash
# Giá trị lẻ còn sót (bỏ qua 2 file deprecated)
grep -rnE "text-\[[0-9.]+px\]|rounded(-[tblr])?-\[[^]]+\]|rounded-(sm|md|lg|2xl)\b" src | grep -v "Sidebar.tsx\|Topbar.tsx"
# Spacing lẻ (= 0 từ Phase 5; lệnh này phải trả về rỗng)
grep -rnE "\b-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y)-\[[0-9.]+px\]" src | grep -v "Sidebar.tsx\|Topbar.tsx"
# Xem diff so với bản gốc (thay git diff), chạy trong base-workspace/
diff -ru web_backup_2026-11-15/src base-frontend-web/src
```

## Cấu trúc repo

- `base-frontend-web/`: ứng dụng React + Vite + TypeScript + Tailwind.
- `base-backend-api/`: khung backend API và hướng dẫn agent; hiện chưa có package.json.
- `database/`: schema, dữ liệu mock và SQL scripts.
- `packages/`: các package dùng chung, hiện có `team-core`.
- `docs/`: tài liệu nghiệp vụ, tích hợp, API, hướng dẫn và tài liệu UI refactor.
- Không bao giờ sửa `_old_web_DO_NOT_EDIT/` hay `web_backup_*/`.

### Các bẫy đã gặp (đừng lặp lại)
- **React Router v7 điều hướng bên trong `startTransition`.** Mọi cập nhật state làm đổi cây route (đăng nhập, đăng xuất) phải nằm **cùng transition** với `navigate()`: gọi `navigate(...)` rồi `startTransition(login|logout)`. Nếu gọi đồng bộ:
  - Đăng nhập: landing render `<Navigate>` (= null) trong lúc chờ, gây trang trắng.
  - Đăng xuất: `RequireAuth` render trước trên route cũ và đẩy sang `/?login=…`.
- **`LoginModal` không gọi `onClose()` trước khi điều hướng.** `onClose` của landing xoá query `?next=`, làm người dùng mất trang cần quay lại.
- **`span.sr-only` (position: absolute) trong vùng `overflow-x-auto`** sẽ thoát ra ngoài và tạo cuộn ngang cấp trang nếu wrapper không có `relative`. Mọi wrapper cuộn phải là `relative overflow-x-auto`.
- **`overflow-hidden` trên tổ tiên làm hỏng `position: sticky`** của TopNav. Muốn chặn tràn ngang ở wrapper trang thì dùng `overflow-x-clip`.
- **`hidden` + `inline-flex`/`grid` trên cùng phần tử** (vd. `ButtonLink` có sẵn `inline-flex`): thứ tự CSS quyết định, `hidden` có thể thua. Muốn ẩn/hiện theo breakpoint thì bọc trong `<div className="hidden md:block">`.
- **`Modal`:**
  - Prop `onClose` phải ổn định (`useCallback`). Effect quản lý focus phụ thuộc `onClose`; nếu hàm đổi mỗi lần render thì gõ phím sẽ bị mất focus.
  - Autofocus ưu tiên `[data-autofocus]`, sau đó mới tới `button`. Đừng gộp thành `querySelector('[data-autofocus], button')`, vì cách đó trả về phần tử đầu tiên theo DOM, tức nút X.
- **`useRouteScroll`** chỉ chuyển focus vào `<main>` khi route *thực sự đổi* (so sánh với key trước đó). Không được focus ở lần tải đầu, vì Tab đầu tiên phải vào link "Bỏ qua tới nội dung chính". Cờ `firstRun` không dùng được do StrictMode chạy effect 2 lần.
- **`Avatar`** đặt `width/height` bằng inline style. Muốn đổi cỡ theo breakpoint bằng class thì phải dùng `!` (vd. `size-16! md:size-24!`).
- **Token `text-stat`:** cỡ, line-height và weight nằm trong `@theme`, còn `tabular-nums` là rule `.text-stat` ở `@layer utilities` (token chữ của Tailwind v4 không mang `font-variant-numeric`). Không dùng `text-stat` cho tiêu đề.
- **Ảnh mock `tour-*.jpg`** có sẵn badge trạng thái "in" ở mép trên (cắt từ mock). Dùng `object-bottom` để che, nếu không sẽ thấy 2 badge.
- **Screenshot `fullPage`**: BottomNav (`position: fixed`) hiện lơ lửng giữa ảnh ở khổ 375. Đó là đặc điểm của ảnh chụp, không phải lỗi.

### Kiến trúc layout (Phase 2)
- `src/components/layout/`: `Container` (`wide`), `TopNav`, `BottomNav`, `PageHeader` (`title`, `description`, `actions`, `tabs`, `leading`, `meta`, `eyebrow`, `flush`), `Footer`, `SearchDialog`, `UserMenu` (+ `SoonBadge`), `RequireAuth`, `hooks.ts` (`useDismiss`, `useRouteScroll`), `nav.ts` (cấu hình menu, `loginHref()`).
- `AppShell` tự chọn `Container wide` cho `/rooms/:id` (trừ `/rooms/new`). Trang con **không** tự bọc `Container`.
- Landing (`HomeGuest`) nằm ngoài `AppShell` nhưng dùng chung `TopNav`, `Container`, `Footer`, `BottomNav`, `SkipLink`. Hộp đăng nhập được điều khiển **chỉ** bằng query `?login=<login|register|start|1>&next=<path>`; mọi nơi khác tạo link bằng `loginHref(intent, next)`.
- Menu: mục "Sắp có" (BXH, Cộng đồng) không có `to`, hiện dạng `aria-disabled` kèm badge. Từ 768 đến 1535px chúng gom vào menu "Thêm"; từ 1536px hiện đủ. Mục "Phòng" trỏ `/dashboard#rooms` và active ở `/rooms/:id`, nên dùng `Link` + `isActive(pathname, hash)` thay cho `NavLink`.
- Nút "Tạo phòng" trên TopNav **cố ý** dùng `gold-outline`, để nút vàng đặc duy nhất của màn nằm trong nội dung trang.
- Anchor: `:where([id]) { scroll-margin-top: var(--header-h) + 16px }`. Thêm `id` cho section là đủ, không cần JS. Bảng phòng có `id="rooms"` ở cả landing và dashboard.
- Trang có BottomNav dùng class `pb-bottom-nav` trên khung ngoài (không đặt trên `main`), để cả Footer cũng không bị che.

### Mock data
- `getTournamentDetail(slug)` trả về dữ liệu chi tiết của cả **8 giải**, đều qua hàm tạo mẫu `buildDetail(t, seed)` (`seeds` theo slug; nhánh đấu giải mới sinh bằng `knockout()`). Thêm giải = thêm 1 phần tử `tournaments` + 1 `seed`. Trạng thái chuẩn:
  - Ngũ Kiệt Cup đang mở đăng ký: 11/16 đội, hạn 20/11 23:59, bốc thăm 21/11, thi đấu 22–27/11, chưa có nhánh.
  - Custom League #3 đang diễn ra: 10–24/11, đã xong bán kết 15/11.
  - Hội Làng đã kết thúc: 05–12/11, Ngũ Hổ vô địch.
  - (4a-b) Đại Chiến Liên Server mở 4/16 (hạn 30/11) · Đấu Trường Sinh Viên 2026 mở 5/8 (hạn 25/11) · Giải Cuối Tuần #12 đang diễn ra 14–16/11 (chung kết 16/11) · Kèo Đêm Thứ Sáu #7 kết thúc 06–07/11 · Cup Mùa Thu 2026 kết thúc 20/10–02/11 (Team Alpha vô địch).
  - Ảnh bìa `tour-1/2/3.jpg` chọn theo trạng thái (`COVER`) vì ảnh có badge in sẵn.
- Tên field dễ nhầm: `Tournament.registeredTeams` là **số** đội đã đăng ký (chỉ khi `open`); `TournamentDetail.teamList` là **danh sách** đội. `teamCount` là tổng số chỗ.
- `TOURNAMENT_STATUS_LABEL` là nguồn duy nhất cho nhãn trạng thái giải. `RegistrationProgress` dùng chung cho cả 3 nơi hiển thị tiến độ đăng ký.
- `roomMessages` (chat) và `homeSlides` đã có trong mock. `homeSlides` hiện **không dùng** (carousel dashboard đã bỏ).
- `Avatar` có fallback chữ cái đầu khi thiếu/lỗi ảnh (Phase 4a). Truyền `name` để chữ cái đúng.
- **suthy chỉ là thành viên của AOV-1024** (từ Phase 4a; trước đó `partial()` vô tình cho suthy vào cả 5 phòng). Nhãn "Phòng của bạn" và nút "Vào phòng"/"Xem" dựa vào `isRoomMember`/`roomAction` trong `src/lib/room.ts`.

### Thành phần dùng chung (Phase 4a)
- `ui/FilterChips` (chip lọc, active = vàng nhạt, không vàng đặc), `ui/Pagination` (tự ẩn khi 1 trang), `lib/text.ts` `normalizeVi` (tìm không dấu).
- `domain/RoomsTable`: `ActiveRoomsCard` (bảng ≥ 768 / card list < 768, lọc chế độ), `RoomCard`, `RoomActionButton`. `TournamentPromoCard` có `ctaVariant`. `FeatureCard` có `to`.
- Nút vàng đặc hiện tại: landing = "Bắt đầu ngay" (hero) + "Tạo tài khoản" (CTA cuối); dashboard = "Đăng ký ngay" (promo); /tournaments = "Tạo giải đấu". Đếm nhanh bằng Playwright: `main .bg-gold-gradient:is(button,a)` (lưu ý badge/ô điểm cũng có thể dùng `bg-gold-gradient` nhưng là `span`).
- Dashboard ≥ 1024: grid 2 hàng — `#rooms` (hàng 1) + "Hoạt động gần đây" (hàng 2) ở cột chính, `<aside>` `row-span-2`. Dưới 1024 theo thứ tự DOM.
- Khi viết probe Playwright: chờ ~250ms sau `fill`/click trước khi đếm phần tử, và ~800ms sau khi bấm anchor (cuộn mượt), nếu không sẽ báo FAIL giả.

### Trang phòng (Phase 4b)
- Vai trò/quyền ở `lib/room.ts` (`roomRole`, `ROOM_PERMISSIONS`, `can`). Sửa đội bằng `moveMember`/`removeMember` (hàm thuần, dễ test). Kéo thả dùng `dataTransfer` type `text/x-customaov-player`; hàng người chơi có `data-player-id` (Playwright `dragTo` dùng được).
- `RoomDetail` render `<RoomView key={room.id}>` để đổi phòng là reset state.
- `/rooms/new`: khung ngoài **không** được có `overflow-hidden` (thanh hành động sticky). Stepper: nhãn ẩn/hiện theo breakpoint, đừng bỏ `whitespace-nowrap`.
- Công tắc (`role="switch"`) dùng `bg-gold`, không dùng `bg-gold-gradient` (để không bị đếm là nút vàng).

### Chi tiết giải & hồ sơ (Phase 4c)
- Tab lưu trên URL `?tab=` ở cả `/tournaments/:slug` và `/profile` (Playwright mở thẳng tab bằng URL).
- Dữ liệu suy ra (lịch, xếp hạng đội, vô địch, số trận) ở `lib/tournament.ts`; đừng tính lại trong component.
- Nhánh đấu: flex + viền CSS, **không** dùng toạ độ px. Bóng mờ mép nằm *ngoài* vùng cuộn, đo bằng `scrollLeft`/`ResizeObserver`.
- `cn()` chỉ nối chuỗi (không tailwind-merge): đừng truyền class xung đột (vd. `w-full` đè `w-[68%]`) qua prop `className` — sửa ở component gốc.
- `/profile/:userId` của người khác hiện header + empty state; hồ sơ đầy đủ chỉ có cho suthy.

### Truy cập & trạng thái (Phase 5)
- Danh sách mới phải bọc `<ListStatus status onRetry label skeleton>` (`components/ui/ListStatus.tsx`) và tự có empty state. Trạng thái lấy từ `useMockStatus()`; xem bằng `?mock=loading|error|slow`.
- Trang "không tìm thấy" dùng `EmptyState as="h1"` (mỗi trang đúng 1 `<h1>`).
- Chữ màu đội trên nền `team-*-bg` dùng `text-team-blue-fg` / `text-team-red-fg`, không dùng `text-team-blue/red`.
- Chữ đặt trên ảnh: phải có lớp phủ; kiểm bằng cách ẩn chữ, chụp, đo điểm ảnh sau từng dòng (`Range.getClientRects`), lấy 5% điểm tệ nhất ≥ 4.5 (chữ thường) / 3 (chữ lớn). Đo theo khung phần tử sẽ báo sai.
- `Tabs` đã có lớp bọc `relative` + bóng mờ mép; `className` truyền vào áp cho `tablist` bên trong.

### Test
- `src/components/ui/ListStatus.test.tsx`: 3 trạng thái + "Thử lại" giữ query khác.
- `src/lib/tournament.test.ts`: kiểm tra nhất quán của cả 8 giải mock — thêm/sửa giải phải giữ test này xanh.
- `src/pages/RoomDetail.test.tsx` (10 test) tìm theo: nút **"Chia lại"**, **"Xuất kết quả chia đội"**, `/Chia đội cân bằng/`, nút **"Tuỳ chọn cho <tên>"** + menuitem `/Mời ra khỏi phòng/`, `/Chuyển sang Team Đỏ/`, region **"Team Xanh"** / **"Team Đỏ"**, `role="log"` "Tin nhắn trong phòng", ô "Nhập tin nhắn", chữ "Bạn là chủ phòng/khán giả", và các toast. Đổi nhãn thì **chỉ sửa selector/kỳ vọng cho khớp, không bỏ test**.
- `src/components/layout/RequireAuth.test.tsx`: guard và khôi phục session.
- `scripts/e2e-auth.mjs` (`npm run test:e2e`): khoá session là `customaov.mockLoggedIn` = `'1'`; đăng xuất thì xoá khoá. Script tìm avatar qua `header button[aria-label^="Tài khoản"]` và nút đăng nhập qua `[role=dialog] button:has-text("tài khoản mẫu")`. Đổi các nhãn này thì phải sửa script.
- `scripts/screenshot.mjs <phase> [baseUrl] [--widths=…] [--viewport-only] [route…]`: 8 route (`landing`, `dashboard`, `room-detail`, `room-new`, `tournaments`, `tournament-detail` = Ngũ Kiệt Cup, `tournament-live` = Custom League #3, `profile`). Báo `FAIL` khi có cuộn ngang hoặc lỗi console.

### File deprecated / không dùng (chưa xoá)
- `layout/Sidebar.tsx`, `layout/Topbar.tsx` (`@deprecated`; vẫn còn cỡ chữ/bo góc lẻ, được loại khỏi các lệnh rà soát).
- Biến thể `Brand` `sidebar`/`header` (chỉ Sidebar dùng). `homeSlides`. Asset `sidebar-art.jpg` (chỉ Sidebar dùng).
- Danh sách đầy đủ, cập nhật dần: mục "File không còn được dùng" trong CHANGELOG-UI.md.
- `scripts/.blank-*.png` (7 ảnh): ảnh thừa của probe Phase 3b, đã xoá trong commit dọn file.
