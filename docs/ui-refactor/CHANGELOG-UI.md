# CHANGELOG – UI/UX refactor (11/2026)

## Role Foundation — 25/11/2026

- AuthContext, role utilities, route/action guards, navigation and Mock persona selector integrated; existing shell/theme retained. Room ownership still required. Community fixture controls cannot elevate platform USER. Details and file groups: `docs/product/PLATFORM_ROLE_FOUNDATION.md`.
- Validation: 49 files / 323 tests; typecheck/lint/build pass (2 existing warnings). Auth E2E pass; role browser 72 checks pass; screenshots 40/40 at 375/768/1280/1440 without overflow/console errors. Local PostgreSQL 107 checks and backend static 21 tests pass.
- Recovery: reverse only reviewed role-task changes; preserve pre-existing Community/env/README changes. No commit or deployment to revert yet.
- Còn tồn: actual account/Host approval, Production deployment and hosted HUY-28 acceptance; dynamic Permission Management remains HUY-29. API-mode authorization retains its existing backend contract.

> Thay cho lịch sử commit trong đợt refactor theo `docs/UI_UX_CHECKLIST.md`.
> **Bản sao lưu gốc:** `../web_backup_2026-11-15/` (toàn bộ `web/` trừ `node_modules`, `dist`), chụp trước khi sửa.
> **Ảnh so sánh:** `docs/screenshots/<phase>/<route>-<width>.png` (bộ `before/` = trước khi sửa).
> Lệnh chụp: `node scripts/screenshot.mjs <phase> [baseUrl] [--widths=375,1440] [route...]`. Lệnh sẽ báo `FAIL` nếu trang có cuộn ngang (`scrollWidth > innerWidth`) hoặc có lỗi console.

**Cách hoàn tác chung:** copy file tương ứng từ `../web_backup_2026-11-15/` đè lại vào `web/`. File *tạo mới* thì xoá đi (chỉ khi muốn hoàn tác).

**Xem diff so với bản gốc** (thay cho `git diff`), chạy trong `base-workspace/`:
```bash
diff -rq web_backup_2026-11-15 web -x node_modules -x dist -x screenshots   # danh sách file khác
diff -ru web_backup_2026-11-15/src web/src                                  # nội dung thay đổi
```
Đã đối chiếu lệnh trên với danh sách bên dưới: mọi file nguồn bị sửa trong Phase 1 đều có trong bảng (20/20).

---

## Phase 1 — P0: lỗi tràn layout + mock data (15/11/2026)

### Tạo mới
| File | Mô tả |
| --- | --- |
| `src/mocks/clock.ts` | `MOCK_TODAY = 2026-11-15`. Ghi rõ trạng thái chuẩn của 3 giải để mọi trang bám theo. |
| `src/mocks/home.ts` | `homeSlides` (carousel dashboard, trước đây viết cứng `SLIDES` trong `HomeUser.tsx`) + `communityStats` (dùng cho landing ở Phase 4). |
| `docs/CHANGELOG-UI.md` | File này. |
| `docs/screenshots/before/*`, `docs/screenshots/phase1/*` | Ảnh chụp 8 route × 4 khổ (375/768/1280/1440). |

### Sửa
| File | Thay đổi |
| --- | --- |
| `src/index.css` | Bỏ `min-width: 1280px` trên `body`. |
| `src/mocks/types.ts` | `Tournament` thêm `dateRange` và `registrationDeadline?`. Thêm type `TournamentDetail`, `ChatMessage`, `HomeSlide`. |
| `src/mocks/tournaments.ts` | **Đồng bộ trạng thái:** Ngũ Kiệt Cup = *mở đăng ký* (hạn 20/11, thi đấu 22–27/11, chưa có nhánh đấu); Custom League #3 = *đang diễn ra* (10–24/11, xong bán kết 15/11); Hội Làng = *đã kết thúc* (05–12/11, có kết quả chung kết). Dữ liệu chi tiết giải tra theo slug qua `getTournamentDetail(slug)` và `allMatches(d)`; thêm `TOURNAMENT_STATUS_LABEL`. Đã bỏ các export cũ `tournamentDetail`, `bracket`, `upcomingMatches`, `recentResults`. |
| `src/mocks/rooms.ts` | Thêm `roomMessages` (mock chat, sẽ dùng ở Phase 4). |
| `src/mocks/index.ts` | Export thêm `clock`, `home`. |
| `src/components/domain/TournamentPromoCard.tsx` | Thêm prop bắt buộc `tournament`; tên giải, thể thức, hạn đăng ký lấy từ mock thay vì viết cứng. |
| `src/components/domain/RoomsTable.tsx` | Bọc bảng trong `div.relative.overflow-x-auto`, bảng `min-w-[760px]`. |
| `src/components/ui/Tabs.tsx` | Thanh tab cuộn ngang được (`overflow-x-auto`); từng tab `shrink-0 whitespace-nowrap`. |
| `src/pages/HomeGuest.tsx` | Header và main có padding ngang `px-4 md:px-6 lg:px-8`; lưới tính năng 1→2→4 cột; lưới phòng/giải chỉ chia 2 cột từ `xl`. |
| `src/pages/HomeUser.tsx` | Dùng `homeSlides` và `featuredTournament`; lưới chính chỉ chia 2 cột từ `xl`; banner đổi sang `min-h`; nút được xuống dòng. |
| `src/pages/Tournaments.tsx` | Hàng card xếp dọc dưới `xl`, bỏ các độ rộng cố định 442/278/190px; bộ lọc được xuống dòng. *(Phase 4 sẽ chuyển sang lưới card dọc.)* |
| `src/pages/TournamentDetail.tsx` | Đọc dữ liệu theo slug (cả 3 giải đều có trang chi tiết); nhãn trạng thái và nút chính đổi theo `status`; nhánh đấu nằm trong vùng cuộn ngang; khi chưa có nhánh/lịch/kết quả thì hiện empty state; bỏ `truncate` ở nhãn vòng đấu. |
| `src/pages/RoomDetail.tsx` | Bỏ `h-[433px]` và lưới `[428px_433px_1fr]`, thay bằng 1 → 2 → 3 cột (panel công cụ ≥ 320px); bỏ `whitespace-nowrap` ở tiêu đề; banner và thanh chat được xuống dòng. |
| `src/pages/CreateRoom.tsx` | Bỏ `h-[654px]` và lưới `[267px_1fr]`; stepper nằm trên ở mobile; chế độ phòng chuyển sang lưới 2×2 (4 cột từ `2xl`); bỏ các độ rộng cố định 839/278/205px và `whitespace-nowrap`. |
| `src/pages/Profile.tsx` | Bọc bảng lịch sử trận trong `overflow-x-auto` (`min-w-[900px]`); lưới thống kê, tướng và vai trò co theo breakpoint; banner được xuống dòng. |
| `scripts/screenshot.mjs` | Thêm tham số phase, chụp nhiều khổ rộng, kiểm tra `scrollWidth`, chụp toàn trang. Không dùng đường dẫn tuyệt đối. |
| `docs/UI_UX_CHECKLIST.md` | Đổi `src/mock/` thành `src/mocks/`; tick các mục đã xong. |

### Ghi chú kỹ thuật
- `span.sr-only` dùng `position: absolute`. Khi nằm trong vùng `overflow-x-auto` không có `position: relative`, nó thoát ra ngoài và làm trang cuộn ngang. Vì vậy mọi wrapper cuộn đều phải có `relative`.

### Kết quả kiểm tra
- `npm run build` ✅, `npm test` ✅ (12/12), `npm run lint` ✅ (0 lỗi; 2 cảnh báo `react-refresh` có sẵn từ trước trong `AppContext.tsx`).
- Ở 1280/1440px: 8/8 route không tràn. Ở 375/768px: mọi route đăng nhập vẫn tràn ra **809px**. Nguyên nhân duy nhất là khung `Sidebar` (258px) + `Topbar` (ô tìm kiếm 513px); bên trong `<main>` không còn phần tử nào tràn. Phase 2 sẽ thay khung này. Landing đã đạt ở cả 4 khổ.

### Hoàn tác Phase 1
Copy lại từ backup các file trong bảng "Sửa"; xoá `src/mocks/clock.ts`, `src/mocks/home.ts`.

> Ghi chú quy trình: Phase 1 sửa một phần file bằng script Python tạm (`td_phase1.py`, `pages_phase1.py`, nằm ngoài repo). Để xem đúng thay đổi, dùng lệnh `diff -ru` ở đầu file. Từ Phase 2, file nguồn được sửa bằng Edit/Write.

---

## Phase 1 (bổ sung theo review) — tiến độ đăng ký + empty state nhánh đấu

| File | Thay đổi |
| --- | --- |
| `src/mocks/types.ts` | `Tournament` thêm `registeredTeams?: number` (số đội đã đăng ký) và `drawDate?` (ngày bốc thăm). Danh sách đội của `TournamentDetail` đổi tên `registeredTeams` → `teamList` để không trùng tên. |
| `src/mocks/tournaments.ts` | Thêm 3 đội (Sói Đêm, Phượng Hoàng, Bạch Hổ; dùng lại logo placeholder). Ngũ Kiệt Cup có 11/16 đội đã đăng ký, bốc thăm 21/11. Custom League #3 và Hội Làng có `teamList` 8 đội. |
| `src/components/domain/RegistrationProgress.tsx` *(mới)* | "11/16 đội đã đăng ký · Còn 5 chỗ" + thanh tiến độ (`role="progressbar"`). |
| `src/components/domain/TournamentPromoCard.tsx` | Hiện tiến độ đăng ký phía trên nút "Đăng ký ngay". |
| `src/pages/Tournaments.tsx` | Card giải đang mở đăng ký hiện tiến độ thay cho "16 đội". |
| `src/pages/TournamentDetail.tsx` | Banner hiện tiến độ (thay chip "16 đội"). Empty state nhánh đấu: tiêu đề "Nhánh đấu sẽ công bố sau khi đóng đăng ký", mô tả "Bốc thăm 21/11 · Thi đấu 22/11 – 27/11", nút "Đăng ký ngay". Nút chính trên banner khi mở đăng ký bỏ icon Play. Thêm `register()` (TODO: nối API). |

---

## Phase 2 — Khung bố cục (P1) (15/11/2026)

### Tạo mới (`src/components/layout/`)
| File | Mô tả |
| --- | --- |
| `Container.tsx` | `max-w-[1200px]` (mặc định) / `max-w-[1440px]` (`wide`), padding `px-4 md:px-6 lg:px-8`. |
| `TopNav.tsx` | Header `sticky top-0 z-[60]`, cao 56px (mobile) / 64px, nền đặc `bg-sidebar` + viền dưới. Mục active có gạch chân vàng + `aria-current="page"`. **< 768px:** logo, tìm kiếm, avatar (khách: "Đăng nhập"). **768–1535px:** 3 mục chính + menu "Thêm" gom các mục "Sắp có"; dưới 1024px nút Tạo phòng chỉ còn icon. **≥ 1280px:** nút tìm kiếm rộng có Ctrl K và tên người dùng. **≥ 1536px:** hiện đủ 5 mục. Nút "Tạo phòng" dùng viền vàng (`gold-outline`) để nút vàng đặc chỉ nằm trong nội dung trang. Có biến thể khách (Đăng nhập / Đăng ký). |
| `nav.ts` | Cấu hình menu dùng chung: `USER_NAV`, `GUEST_NAV`, `bottomNavItems()`, `loginHref()`. Mục chưa làm (BXH, Cộng đồng) không có `to`, hiện badge "Sắp có". |
| `BottomNav.tsx` | `fixed bottom-0`, chỉ hiện < 768px, 5 mục (Trang chủ · Phòng · Tạo (+) · Giải đấu · Hồ sơ). Vùng chạm 75×64px, nút "+" tròn vàng 56px nổi lên giữa, `pb-[env(safe-area-inset-bottom)]`. Với khách, nút Tạo và Hồ sơ mở hộp đăng nhập. |
| `SearchDialog.tsx` | Dùng lại `Modal`; mở bằng Ctrl/⌘ K hoặc nút, Esc đóng, focus tự vào ô nhập. Tìm không dấu trên mock (phòng, giải, người chơi). TODO: API. |
| `UserMenu.tsx` | Avatar + menu tài khoản (tách từ `Topbar` cũ). "Lịch sử hoạt động" chuyển vào đây kèm badge "Sắp có". Export thêm `SoonBadge`. |
| `PageHeader.tsx` | Props `title`, `description`, `actions`, `tabs`, `leading`, `meta`, `eyebrow`. Mô tả giới hạn `max-w-[65ch]`. |
| `Footer.tsx` | Liên kết sản phẩm, cộng đồng, icon mạng xã hội (TODO: URL thật) và dòng tuyên bố không liên kết với Garena/Tencent. |
| `hooks.ts` | `useDismiss` (đóng dropdown khi bấm ra ngoài hoặc Esc). `useRouteScroll`: có hash thì cuộn tới anchor, không có thì về đầu trang; chỉ chuyển focus vào `<main>` khi route thực sự đổi. |

### Sửa
| File | Thay đổi |
| --- | --- |
| `src/index.css` | Biến `--header-h` (56/64px) và `--bottom-nav-h` (64px). `:where([id]) { scroll-margin-top: header + 16px }` để header sticky không che anchor. Class `.pb-bottom-nav`. |
| `src/components/layout/AppShell.tsx` | Viết lại: SkipLink + TopNav + `main > Container` (`wide` cho `/rooms/:id`) + Footer + BottomNav. Export `SkipLink`. |
| `src/components/layout/Brand.tsx` | Thêm biến thể `compact` (logo 40px, tên 1 dòng, ẩn tên dưới 1024px). |
| `src/components/layout/Sidebar.tsx`, `Topbar.tsx` | Chỉ thêm dòng `// @deprecated – thay bằng TopNav (UI refactor 11/2026)`. |
| `src/components/ui/Modal.tsx` | Thêm prop `className` và `placement` (`top` cho hộp tìm kiếm). **Sửa lỗi có sẵn:** autofocus ưu tiên `[data-autofocus]`; trước đây `querySelector('[data-autofocus], button')` luôn focus nút X vì nút này nằm trước trong DOM. |
| `src/components/LoginModal.tsx` | Đăng nhập xong không gọi `onClose()` trước khi điều hướng, vì nó xoá `?next=` và làm người dùng bị đưa về `/dashboard` thay vì trang trước. |
| `src/context/AppContext.tsx` | Toast trên mobile dùng `inset-x-4` và nằm trên BottomNav (trước đây rộng cố định 360px, tràn ở khổ 375px). |
| `src/components/domain/RoomsTable.tsx` | Thêm prop `id` (anchor `#rooms`). |
| `src/pages/HomeGuest.tsx` | Dùng TopNav, Container, Footer, BottomNav chung (bỏ header riêng). Hộp đăng nhập điều khiển bằng query `?login=<intent>&next=<path>`. Bảng phòng có `id="rooms"`. Wrapper đổi `overflow-hidden` → `overflow-x-clip` để không làm hỏng `sticky`. |
| `src/pages/HomeUser.tsx` | Carousel banner → `PageHeader` "Xin chào, suthy" + 2 nút; cột phải hẹp lại còn 380px; bảng phòng `id="rooms"`. *(Đưa danh sách phòng lên đầu: Phase 4.)* |
| `src/pages/Tournaments.tsx` | Banner → `PageHeader` có nút "Tạo giải đấu". Ảnh bìa `object-bottom` để che badge in sẵn trong ảnh mock. |
| `src/pages/CreateRoom.tsx` | Banner → `PageHeader` "Tạo phòng custom". |
| `src/pages/RoomDetail.tsx` | Banner → `PageHeader` (tiêu đề + meta + mã phòng + nút). Giữ nhãn "Bắt đầu chia đội" để test không đổi (Phase 4 đổi thành "Chia lại"). |
| `src/pages/Profile.tsx` | Banner ảnh → `PageHeader` có avatar ở `leading` và tab trong `tabs`. |
| `src/pages/TournamentDetail.tsx` | Giữ banner ảnh (theo yêu cầu); chỉnh khoảng cách đầu trang. |
| `src/pages/NotFound.tsx` | Từ placeholder "NotFound" → `EmptyState` có nút về trang chủ. |
| `docs/UI_UX_CHECKLIST.md` | Tick các mục P1, mục kiểm tra 4 khổ của P0 và các mục trang đã xong. *(Sửa bằng script Python inline, không phải Edit.)* |

### Kiểm tra
- `npm run build` ✅, `npm test` ✅ 12/12 (không phải sửa test), `npm run lint` ✅ (0 lỗi; 2 cảnh báo có sẵn từ trước).
- `node scripts/screenshot.mjs phase2`: **32/32 ok**, không trang nào cuộn ngang ở 375/768/1280/1440.
- TopNav ở 768/1024/1280/1440/1536/1920, cả khách lẫn người dùng: menu 1 hàng, không đè cụm nút phải, header cao 64px (mobile 56px).
- Tương tác (Playwright):
  - Tab đầu tiên vào skip link.
  - Ctrl K / nút mở SearchDialog, focus vào ô nhập, gõ không mất focus, tìm không dấu ra kết quả, Esc đóng.
  - Đổi route thì focus chuyển vào `<main>`.
  - Anchor `#rooms` nằm dưới header (top 80px > header 64px).
  - BottomNav: 5 mục, mỗi mục ≥ 44×44px.
  - Khách bấm "Đăng nhập" ở `/tournaments`, đăng nhập xong quay lại `/tournaments`.
  - Ở `/rooms/new`, để trống tên rồi bấm Tiếp tục: không cuộn ngang ở cả 4 khổ.

### Hoàn tác Phase 2
Xoá các file mới trong `src/components/layout/` (Container, TopNav, nav, BottomNav, SearchDialog, UserMenu, PageHeader, Footer, hooks). Copy lại từ backup `AppShell.tsx`, `Brand.tsx`, `Modal.tsx`, `LoginModal.tsx`, `AppContext.tsx`, `index.css`, `NotFound.tsx` và các page. Lưu ý: backup là bản *trước Phase 1*, nên hoàn tác riêng Phase 2 cần giữ lại các thay đổi Phase 1 trong cùng file (xem bảng Phase 1).

---

## Phase 2b — Sửa lỗi session/route guard + quyết định review (15/11/2026)

### Lỗi P0: khách mở thẳng `/dashboard`, `/profile` thấy nội dung của suthy nhưng header ở trạng thái khách
**Nguyên nhân (đã tái hiện bằng Playwright):** session mock vốn đã được lưu đúng (đăng nhập → tải lại → vẫn giữ). Lỗi thật là **không có route guard**: route nội bộ render cho cả khách, mà mock luôn trả `currentUser`. localStorage trống vì trình duyệt đó chưa đăng nhập.

| File | Thay đổi |
| --- | --- |
| `src/components/layout/RequireAuth.tsx` *(mới)* | Route guard: khách vào route nội bộ bị chuyển tới `/?login=login&next=<pathname+search+hash>`. |
| `src/App.tsx` | Tách route: công khai (`/tournaments`, `/tournaments/:slug`, `*`) và nội bộ (`/dashboard`, `/rooms/new`, `/rooms/:roomId`, `/profile`, `/profile/:userId`) nằm trong `<RequireAuth>`. |
| `src/context/AppContext.tsx` | `readSession` / `writeSession` (try/catch). Đăng xuất **xoá** khoá thay vì ghi `'0'`. Đồng bộ đăng nhập/đăng xuất giữa các tab qua sự kiện `storage`. |
| `src/pages/HomeGuest.tsx` | Chấp nhận `?login=1` như `?login=login`. Đã đăng nhập thì chuyển tới `next` (không cố định `/dashboard`). |
| `src/components/layout/UserMenu.tsx` | **Sửa lỗi phát sinh khi thêm guard:** đăng xuất ở trang nội bộ bị đẩy sang `/?login=…` (hiện hộp đăng nhập). Nguyên nhân: React Router v7 điều hướng trong `startTransition`, còn `logout()` cập nhật ngay nên guard render trước trên route cũ. Đã đưa `logout` vào `startTransition`. |
| `src/components/layout/RequireAuth.test.tsx` *(mới, vitest)* | Khách bị chuyển hướng kèm `next` đúng (giữ query + hash); có session thì hiện trang. |
| `scripts/e2e-auth.mjs` *(mới)* + `package.json` (`test:e2e`) | E2E Playwright, cần dev server đang chạy. 14 kiểm tra: có session mở thẳng 4 route nội bộ → header có avatar; khách mở 3 route nội bộ → bị chuyển + hộp đăng nhập; đăng nhập → quay lại đúng route; session lưu vào localStorage; tải lại vẫn giữ; đăng xuất xoá session và route nội bộ bị chặn lại; `/tournaments` công khai. Chạy 3 lần liên tiếp đều đạt. |

### Quyết định review
| File | Thay đổi |
| --- | --- |
| `src/pages/TournamentDetail.tsx` | Nút "Đăng ký ngay" trong empty state nhánh đấu → `gold-outline`. "Đăng ký tham gia" trên banner giữ vàng đặc. |
| `src/pages/Profile.tsx` | Khôi phục ảnh bìa mỏng `h-[120px] md:h-[176px]` + gradient tối từ dưới lên. Avatar `-mt-10 md:-mt-14` đè lên mép dưới bìa, viền `ring-bg`. Tên, meta, nút "Chỉnh sửa hồ sơ" nằm dưới bìa. |
| `src/components/layout/PageHeader.tsx` | Thêm prop `flush` (bỏ khoảng đệm trên khi nằm ngay dưới ảnh bìa). |
| `docs/UI_UX_CHECKLIST.md` | Tick 7.5 kèm ghi chú (sửa bằng Edit). |

### Kiểm tra
- `npm run build` ✅, `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ), `npm test` ✅ 14/14, `npm run test:e2e` ✅.
- `node scripts/screenshot.mjs phase2b`: **32/32 ok**.

### Hoàn tác Phase 2b
Xoá `RequireAuth.tsx`, `RequireAuth.test.tsx`, `scripts/e2e-auth.mjs`; gỡ script `test:e2e` khỏi `package.json`; trong `App.tsx` đưa các route ra khỏi `<RequireAuth>`. Các file còn lại: hoàn tác theo các dòng trong bảng trên.

---

## Phase 3 — Design tokens (15/11/2026)

Toàn bộ thay đổi trong phase này dùng Edit (`replace_all` theo từng cặp file + giá trị), không dùng script.

### Token (`src/index.css` › `@theme`)
| Nhóm | Token | Ghi chú |
| --- | --- | --- |
| Chữ | `--text-*: initial` rồi định nghĩa 6 bậc: `xs` 12/16 · `sm` 14/20 · `base` 16/24 · `lg` 20/28 · `2xl` 24/32 · `4xl` clamp(32→40px)/1.2 | Xoá thang mặc định của Tailwind → `text-xl`, `text-3xl`… không còn tồn tại. |
| Chữ (bậc 7, Phase 3b) | `text-stat`: 32px / line-height 1 / weight 700 / `tabular-nums` | **Chỉ cho số KPI.** Cỡ, line-height, weight ở `@theme`; `tabular-nums` ở `.text-stat` trong `@layer utilities`. |
| Spacing | `--spacing: 0.25rem` (mặc định) | Thang 4·8·12·16·24·32·48·64px = `1·2·3·4·6·8·12·16`. Ghi quy ước gap trong comment. |
| Container | `--container-page: 1200px`, `--container-wide: 1440px` | Sinh `max-w-page` / `max-w-wide`; `Container.tsx` đã chuyển sang dùng. |
| Bo góc | `--radius-btn: 8px` (trước 10), `--radius-chip: 8px`, `--radius-card: 12px` (trước 16) | Sinh `rounded-btn` / `rounded-chip` / `rounded-card`. Badge giữ `rounded-full`. |
| Header | `--header-h` 56/64px, `--bottom-nav-h` 64px | Đã có từ Phase 2 (`:root`). |

### Bảng ánh xạ đã áp dụng
| Cũ | Mới |
| --- | --- |
| `text-[10.5/11/12/12.5px]` | `text-xs` |
| `text-[13/13.5/14/14.5px]` | `text-sm` |
| `text-[15/15.5/16/16.5/17px]` | `text-base` |
| `text-[18/19/20/22px]` | `text-lg` |
| `text-[24/25/28/30px]` | `text-2xl` |
| `text-[32/38/44px]` | `text-4xl` (PageHeader: `text-2xl sm:text-4xl`) |
| `rounded-[var(--radius-card)]`, `rounded-[14/16px]`, menu dropdown `rounded-[12px]` | `rounded-card` |
| `rounded-[5/6/8/10px]`, `rounded-md`, `rounded-lg`, control/ô con `rounded-[12px]`, `rounded-[var(--radius-btn/chip)]` | `rounded-btn` / `rounded-chip` |
| `rounded-l/r/t-[8/10/12px]` | `rounded-l/r/t-btn` |

**Ngoại lệ có chủ đích:** `Eyebrow` (chữ hoa, giãn chữ) 13px → `text-xs` thay vì `text-sm`. `SectionTitle` size `sm` 17px → `text-base`, size `md`/`lg` → `text-lg`.

**Kết quả:** trước có 24 cỡ chữ lẻ (~170 chỗ) và 18 kiểu bo góc. Sau còn 6 bậc chữ (`text-xs` 32 · `sm` 68 · `base` 42 · `lg` 16 · `2xl` 12 · `4xl` 6 lượt) và 3 token bo góc + `rounded-full`. Không còn `text-[Npx]` hay bo góc lẻ, trừ 2 file deprecated.

### File đã sửa
`src/index.css`, `components/ui/{Button,primitives,Tabs,Modal}.tsx`, `components/LoginModal.tsx`, `context/AppContext.tsx`, `components/domain/{EmptyState,FeatureCard,PageBanner,RegistrationProgress,RoomsTable,TournamentPromoCard}.tsx`, `components/layout/{AppShell,BottomNav,Brand,Container,Footer,PageHeader,SearchDialog,TopNav,UserMenu}.tsx`, `pages/{HomeGuest,HomeUser,Tournaments,TournamentDetail,CreateRoom,RoomDetail,Profile}.tsx`, `docs/UI_UX_CHECKLIST.md`.

### Sửa thêm trong phase (phát sinh do đổi thang chữ / phát hiện khi rà soát)
| File | Thay đổi |
| --- | --- |
| `components/domain/FeatureCard.tsx` | **Lỗi do Phase 3 gây ra:** tiêu đề lên 20px + `truncate` làm "Chia đội công bằ…" bị cắt ở 375px. Bỏ `truncate` ở tiêu đề, bỏ `whitespace-nowrap` ở mô tả bản lớn, đổi `h-[96/82px]` → `min-h`, giảm padding trái trên mobile. Mô tả bản nhỏ (dashboard) vẫn cắt nhưng có `title` (tooltip). |
| `pages/HomeUser.tsx` | Dòng "Hoạt động gần đây" bị cắt (có từ trước) → thêm `title`. |
| `pages/TournamentDetail.tsx` | Tên đội trong danh sách trận bị cắt ở 375px (có từ trước) → thêm `title`; bố cục làm lại ở Phase 4. |

### Kiểm tra
- `npm run build` ✅, `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ), `npm test` ✅ 14/14, `npm run test:e2e` ✅.
- `node scripts/screenshot.mjs phase3`: **32/32 ok**.
- Quét cắt chữ (`text-overflow: ellipsis` + `scrollWidth > clientWidth`) trên 8 route ở 375/1440: chỉ còn mô tả hoạt động và tên đội, cả hai đã có tooltip; không còn tiêu đề hay nhãn tab nào bị cắt.
- Đã xác nhận trên ảnh: hero landing 375px còn 32px (trước 44px, mục Còn tồn #7); "56.3%" ở hồ sơ 375px nằm gọn trong card (mục #9).

### Hoàn tác Phase 3
Trong `src/index.css`, đổi khối `@theme` về `--radius-chip: 8px; --radius-btn: 10px; --radius-card: 16px;` và xoá các khối `--text-*`, `--spacing`, `--container-*`. Với các file khác, đảo ngược bảng ánh xạ (xem diff bằng `diff -ru ../web_backup_2026-11-15/src src`; lưu ý diff này gồm cả thay đổi Phase 1–2).

---

## Phase 3b — Token `text-stat`, lỗi trắng trang sau đăng nhập, quy tắc refactor (15/11/2026)

| File | Thay đổi |
| --- | --- |
| `src/index.css` | Thêm token bậc 7 `--text-stat` (2rem, line-height 1, weight 700) trong `@theme` và rule `.text-stat { font-variant-numeric: tabular-nums }` trong `@layer utilities`. |
| `src/pages/Profile.tsx` | 4 thẻ thống kê (Tổng trận, Tỷ lệ thắng, Trận Custom, MVP): `text-2xl leading-[1.1] font-bold tabular` → `text-stat` (trước Phase 3 là 30px). Ở 375px "56.3%" (32px) lấn ra mép card nên: icon `hidden sm:block`, khối chữ `min-w-0`. Đã kiểm tra bằng Playwright: cả 7 số KPI (hồ sơ + dashboard) nằm gọn trong card ở 375/768/1280/1440. |
| `src/pages/HomeUser.tsx` | Card hồ sơ dashboard (Tổng trận, Tỷ lệ thắng, Kèo custom): `text-2xl leading-none font-bold tabular` → `text-stat`. |
| `src/components/LoginModal.tsx` | **Sửa lỗi dashboard trắng khoảng 1 giây sau khi bấm đăng nhập.** Đo bằng Playwright: 0–100ms sau khi bấm, URL đã là `/dashboard` nhưng DOM trống (không có header). Nguyên nhân: `login()` cập nhật ngay làm landing render `<Navigate>` (= null), trong khi điều hướng của React Router v7 vẫn chờ trong `startTransition`. Không phải trạng thái tải dữ liệu nên **không dùng skeleton**. Sửa: `navigate(...)` rồi `startTransition(login)`. Đo lại: landing giữ nguyên tới khi dashboard render xong rồi chuyển một lần, không còn khoảnh khắc trắng. |
| `docs/UI_REFACTOR_RULES.md` *(mới)* | Quy tắc cho các session sau, kèm mục "Ghi chú kỹ thuật": môi trường, lệnh rà soát, các bẫy đã gặp, kiến trúc layout, mock data, test, file deprecated. |
| `docs/UI_UX_CHECKLIST.md` | Thêm dòng `text-stat` vào bảng Design tokens; cập nhật ghi chú mục P2 token (sửa bằng Edit). |

**Chưa áp dụng `text-stat` cho "số liệu giải đấu":** hiện chưa có con số KPI nào ở trang giải. Các ô "Thông tin giải đấu" là chữ (vd. "Loại trực tiếp"), còn tiến độ "11/16" là nhãn nhỏ. H1 chi tiết giải (cũng đổi 30 → 24px ở Phase 3) là tiêu đề, không phải KPI, nên giữ `text-2xl sm:text-4xl`. Sẽ dùng `text-stat` khi Phase 4c thêm khối số liệu giải (số đội, số trận, giải thưởng…).

### Kiểm tra
- `npm run build` ✅, `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ), `npm test` ✅, `npm run test:e2e` ✅, `screenshot.mjs phase3b` (kết quả ở dưới).

### Hoàn tác Phase 3b
Xoá `--text-stat*` trong `@theme` và rule `.text-stat` trong `index.css`; đổi lại 2 thẻ `<dd>` trong `Profile.tsx` và `HomeUser.tsx` như cột "Thay đổi" ở trên. Trong `LoginModal.tsx`, đổi `startTransition(login)` thành `login()` gọi trước `navigate` (sẽ quay lại lỗi trắng trang).

---

## Phase 4a — /tournaments → /dashboard → / (15/11/2026)

Mọi thay đổi bằng Edit/Write. Kiểm tra tương tác bằng script Playwright tạm (`scripts/.probe-4a.mjs`, đã xoá sau khi chạy).

### Tạo mới
| File | Mô tả |
| --- | --- |
| `src/lib/text.ts` | `normalizeVi()` (bỏ dấu, `đ`→`d`, chữ thường). Tách từ `SearchDialog` để dùng chung với ô tìm giải. |
| `src/lib/room.ts` | `roomMode`, `isRoomMember`, `roomAction` (join / watch / view). Để ngoài file component để không thêm cảnh báo `react-refresh`. |
| `src/components/ui/FilterChips.tsx` | Nhóm nút lọc chọn 1 (`aria-pressed`, đếm số lượng, cuộn ngang trên màn hẹp). Mục đang chọn dùng nền vàng nhạt + viền vàng, **không** dùng vàng đặc. |
| `src/components/ui/Pagination.tsx` | Phân trang số trang, `aria-current="page"`, tự ẩn khi chỉ có 1 trang. |

### Sửa
| File | Thay đổi |
| --- | --- |
| `src/pages/Tournaments.tsx` | Viết lại. Lưới card dọc 1/2/3 cột (`md`/`lg`); ảnh 16:9 + `object-right` cắt badge in sẵn; tên giải không cắt, mô tả `line-clamp-2` có `title`; nút "Xem chi tiết" luôn ở đáy card. Thêm ô tìm kiếm (không dấu, có nút xoá), sắp xếp, chip lọc trạng thái kèm số lượng, dòng "Hiển thị x / y", phân trang 6/trang, empty state nêu rõ từ khoá + trạng thái kèm nút "Xoá bộ lọc". Trạng thái lọc lưu trên URL (`?q=&status=&sort=&page=`), Back hoạt động. Bỏ hết độ rộng/cao cứng (`xl:h-[165px]`, `w-[360px]`, `h-[42px]`…) và spacing lẻ. Chip lọc đang chọn không còn vàng đặc → trang còn 1 nút vàng ("Tạo giải đấu"). |
| `src/pages/HomeUser.tsx` | Viết lại. Danh sách phòng là khối đầu tiên; cột phụ 320px (`lg`) / 340px (`xl`). PageHeader chỉ còn "Xem hướng dẫn" (ghost): bỏ "Tạo phòng custom" vì trùng TopNav/BottomNav. Card hồ sơ → "Phòng bạn đang tham gia". 4 ô tính năng → card "Công cụ nhanh" (link, đủ chữ) ở cột phụ. "Hoạt động gần đây" xuống dòng đầy đủ thay vì cắt `…`. Nút vàng đặc duy nhất: "Đăng ký ngay" (promo giải). |
| `src/components/domain/RoomsTable.tsx` | Viết lại `ActiveRoomsCard`: bảng 4 cột (Phòng · Người chơi · Trạng thái · Thao tác); chủ phòng + chế độ + "Phòng của bạn" gộp vào dòng phụ dưới tên → bỏ `min-w-[760px]`, không còn cuộn ngang ở mọi khổ ≥ 768. Dưới 768px là card list. Bộ lọc chế độ Tất cả/Căng/Vui/Custom + empty state (nút "Xem tất cả phòng", "Tạo phòng"). Nút theo `roomAction`: "Vào phòng" (gold-outline), "Theo dõi" / "Xem" (secondary); phòng chờ đã đủ người có nhãn "Đủ người" và chữ mờ. Thêm export `RoomCard`, `RoomActionButton`. Prop mới `userId`, `onCreate`; bỏ prop `density`. |
| `src/pages/HomeGuest.tsx` | Viết lại phần nội dung. Section: Hero → Tính năng (lưới 2×2) → Cách hoạt động (3 bước, `#how-it-works`) → Xem trước chia đội (`#preview`, dựng bằng component) → Phòng đang mở (3 `RoomCard`, `#rooms`, thay bảng) → Cộng đồng (`#community`: `communityStats` dùng `text-stat` + promo giải) → CTA cuối. "Bắt đầu ngay", "Tìm hiểu thêm", ô tính năng, "Tạo tài khoản", "Đăng nhập" là `Link` thật; "Vào phòng"/"Đăng ký ngay" điều hướng tới `loginHref(…, next)`. Nút vàng đặc duy nhất: "Bắt đầu ngay"; promo và CTA cuối dùng gold-outline. Bỏ `<br>` cứng, độ rộng nút cố định và spacing lẻ; ảnh nền hero mờ đi dưới 640px để chữ dễ đọc. |
| `src/components/domain/TournamentPromoCard.tsx` | Prop `ctaVariant` (`primary` / `gold-outline`). Khối ảnh có chữ `h-[200px]/h-[162px]` → `min-h-48/min-h-40`; spacing về thang chuẩn. |
| `src/components/domain/FeatureCard.tsx` | Prop `to` (render `Link`); `onClick` thành tuỳ chọn. Kích thước icon/padding về thang chuẩn. |
| `src/components/ui/primitives.tsx` | **`Avatar` fallback (Còn tồn #12):** không có `src` hoặc ảnh lỗi → hiện chữ cái đầu trên nền màu tạo từ tên (prop mới `name`, `src` thành tuỳ chọn). Đã xác minh 10 ảnh `av-*.png` hiện có đều tải bình thường; fallback chỉ dùng khi ảnh lỗi/thiếu. |
| `src/components/layout/SearchDialog.tsx` | Dùng `normalizeVi` từ `lib/text.ts`. |
| `src/components/layout/nav.ts` | Khách: "Cộng đồng" thành mục chính trỏ `/#community` (trước là "Sắp có"); "Trang chủ" không active khi đang ở `#features`/`#community`. |
| `src/mocks/rooms.ts` | **Sửa dữ liệu mâu thuẫn:** `partial()` trước đây chỉ loại chủ phòng nên suthy có mặt ở **cả 5 phòng**. Giờ loại cả suthy → suthy chỉ ở AOV-1024. (Phòng có 10 chỗ vẫn đủ 10 người.) |
| `src/mocks/activity.ts` | Hoạt động `a2` "Đăng ký giải Ngũ Kiệt Cup" mâu thuẫn với promo vẫn mời "Đăng ký ngay" → đổi thành "Theo dõi giải Custom League #3". |
| `docs/UI_UX_CHECKLIST.md` | Tick mục 1 (4 mục), 2 (6 mục), 5 (3 mục) kèm ghi chú; ghi tiến độ mục P2 "một nút vàng". |

### Kiểm tra
- `npm run build` ✅, `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ), `npm test` ✅ 14/14, `npm run test:e2e` ✅.
- `node scripts/screenshot.mjs phase4a`: **32/32 ok**.
- Playwright (đã xoá script):
  - `/tournaments`: tìm "ngu kiet" → 1 giải; "zzz" → empty state; "Xoá bộ lọc" → 3; lọc "Đã kết thúc" → 1 và URL có `status=finished`; Back → về Tất cả; `?status=open&q=hoi` → empty state nêu từ khoá + trạng thái; 1 nút vàng; không tiêu đề nào bị cắt.
  - `/dashboard` 375/1280/1440: 1 nút vàng; bảng phòng không cuộn ngang (`scrollWidth - clientWidth = 0`); AOV-1024 hiện "Phòng của bạn" + "Vào phòng"; lọc "Vui" → 1 phòng (cả bảng lẫn card list).
  - `/`: có đủ `#features`, `#how-it-works`, `#preview`, `#rooms`, `#community`; không còn `<table>`; 3 card phòng; 1 nút vàng; "Bắt đầu ngay" `href="/?login=start"`; menu "Cộng đồng" cuộn tới `#community` (nằm ngay dưới header, top = 80px); "Vào phòng" → `/?login=login&next=%2Frooms%2FAOV-1026` + mở hộp đăng nhập.
- Lệnh rà soát: 3 trang của 4a và các component mới **không còn** giá trị `[Npx]` cho spacing/chữ/bo góc. Spacing lẻ còn 27 chỗ (CreateRoom 10, Profile 8, TournamentDetail 4, RoomDetail 3, `primitives.tsx` 2), trước là 44.

### Hoàn tác Phase 4a
Xoá 4 file mới (`lib/text.ts`, `lib/room.ts`, `ui/FilterChips.tsx`, `ui/Pagination.tsx`). Copy lại từ backup `Tournaments.tsx`, `HomeUser.tsx`, `HomeGuest.tsx`, `RoomsTable.tsx`, `TournamentPromoCard.tsx`, `FeatureCard.tsx`, `primitives.tsx`, `SearchDialog.tsx`, `nav.ts`, `rooms.ts`, `activity.ts`. Lưu ý: backup là bản *trước Phase 1*, nên cần áp lại thay đổi Phase 1–3 trong cùng file (xem các bảng ở trên; ảnh `docs/screenshots/phase3b/` là trạng thái ngay trước 4a).

---

## Phase 4a-b — Quyết định sau review 4a (15/11/2026)

Review 4a chốt các mục "Còn tồn" #14, #15, #16, #17 và đổi quy tắc nút vàng. Từ phase này chạy liền mạch 4a-b → 4b → 4c → 5.

| File | Thay đổi |
| --- | --- |
| `docs/UI_REFACTOR_RULES.md` | Quy tắc mới: "Mỗi **khung nhìn** chỉ có tối đa 1 nút vàng đặc trong nội dung trang. Điều hướng toàn cục (Tạo phòng trên TopNav, + ở BottomNav) không tính. Trang dài có thể có CTA vàng ở hero và cuối trang." Ghi chú quy trình chạy liền mạch. |
| `src/pages/HomeGuest.tsx` | (#16) CTA cuối trang "Tạo tài khoản": `gold-outline` → `primary`. Landing có 2 nút vàng ở 2 khung nhìn khác nhau (hero, cuối trang). |
| `src/pages/HomeUser.tsx` | (#14) Giữ "Đăng ký ngay" vàng đặc — không đổi. **Bố cục ≥ 1024px:** "Hoạt động gần đây" chuyển sang cột chính, dưới bảng phòng (grid 2 hàng, cột phụ `row-span-2`); cột phải còn Phòng bạn đang tham gia → Giải nổi bật → Công cụ nhanh. Dưới 1024px giữ thứ tự DOM (phòng → cột phụ → hoạt động). Dòng hoạt động: từ 640px thời gian dạt phải cùng dòng. |
| `src/components/layout/BottomNav.tsx` | (#15) Giữ "+" vàng đặc — không đổi (điều hướng toàn cục, không tính vào quy tắc). |
| `src/mocks/tournaments.ts` | (#17) Thêm 5 giải, tổng 8 (mở 3 · đang diễn ra 2 · đã kết thúc 3), khớp MOCK_TODAY: **Đại Chiến Liên Server** (mở, 4/16, hạn 30/11, tạo 15/11), **Đấu Trường Sinh Viên 2026** (mở, 5/8, hạn 25/11), **Giải Cuối Tuần #12** (đang diễn ra 14–16/11, xong bán kết, chung kết 16/11), **Kèo Đêm Thứ Sáu #7** (kết thúc 06–07/11), **Cup Mùa Thu 2026** (kết thúc 20/10–02/11). Dữ liệu chi tiết của **cả 8 giải** đi qua một hàm tạo mẫu `buildDetail(t, seed)` (mặc định tiêu đề, intro, chế độ, ảnh, luật; `upcoming`/`results` tự suy ra từ nhánh đấu nếu không khai báo). Nhánh đấu của giải mới sinh bằng `knockout()`. Ảnh bìa chọn theo trạng thái (`COVER`) để badge in sẵn trong ảnh khớp trạng thái. 3 giải cũ giữ nguyên dữ liệu (nhánh Custom League #3 / Hội Làng khai báo tường minh như trước). |

### Kiểm tra
- `npm run build` ✅, `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ), `npm test` ✅ 14/14, `npm run test:e2e` ✅.
- `node scripts/screenshot.mjs phase4a-b`: **32/32 ok**.
- Playwright (script tạm, đã xoá): `/tournaments` trang 1 = 6 giải, `?page=2` = 2 giải, chip "Tất cả 8 · Mở 3 · Đang diễn ra 2 · Đã kết thúc 3"; cả 8 link "Xem chi tiết" mở đúng trang (H1 đúng tên, không cuộn ngang). Dashboard 1024/1280/1440: "Hoạt động gần đây" cùng cột và nằm dưới `#rooms`, cột phải đúng thứ tự; 375: nằm cuối. Dashboard 1 nút vàng; landing 2 nút vàng (hero + cuối trang).

### Hoàn tác Phase 4a-b
`HomeGuest.tsx`: đổi `variant="primary"` của "Tạo tài khoản" về `gold-outline`. `HomeUser.tsx`: đưa Card "Hoạt động gần đây" vào cuối `<aside>`, bỏ các class `lg:col-start-*`/`lg:row-*`. `tournaments.ts`: xoá 5 giải mới khỏi `tournaments` và `seeds` (hàm `buildDetail` vẫn dùng được cho 3 giải cũ). Quy tắc trong `UI_REFACTOR_RULES.md`: đổi lại câu "Mỗi màn chỉ có 1 nút vàng đặc".

---

## Phase 4b — /rooms/:roomId → /rooms/new (15/11/2026)

### Sửa
| File | Thay đổi |
| --- | --- |
| `src/lib/room.ts` | Thêm vai trò + quyền: `RoomRole`, `roomRole`, `ROOM_ROLE_LABEL`, `ROOM_PERMISSIONS`, `can`. Thêm hàm sửa đội thuần: `moveMember` (chuyển / đổi chỗ / báo lỗi khi đội kia đủ), `removeMember`, `otherSide`, `sideOf`, `formatTeamsText` (văn bản xuất kết quả). |
| `src/pages/RoomDetail.tsx` | Viết lại. Tách `RoomView` (có `key={room.id}` để đổi phòng là reset state). Góc nhìn theo vai trò, badge "Bạn là chủ phòng/khán giả". PageHeader: "Chia sẻ" · "Chia lại" (outline, chỉ chủ phòng) · **"Xuất kết quả chia đội"** (vàng đặc, sao chép văn bản 2 đội) hoặc "Tham gia phòng" (khán giả, phòng còn chỗ). Kéo thả HTML5 giữa hai đội + menu ⋮ mỗi người (Chuyển sang đội kia / Mời ra khỏi phòng; không mời được chủ phòng). Card "Chat phòng" có danh sách tin (`role="log"`), gửi tin cục bộ, khán giả chỉ đọc. Bố cục ≥ 1280: 2 đội + chat ở cột 1–2, công cụ cột 3 trải 2 hàng. Tab "Cấu hình" có tóm tắt phòng + bảng quyền; "Chế độ trình chiếu" chuyển vào danh sách công cụ. Công cụ bị khoá (kèm giải thích) với người không phải chủ phòng. Vương miện theo `room.host` (trước theo `player.crowned` → suthy có vương miện ở cả phòng người khác). Bỏ hết spacing/kích thước lẻ (`p-[17px]`, `mt-[30px]`, `h-[78px]`, `h-[63px]`, `size-[54px]`, `w-[76px]`…). |
| `src/pages/RoomDetail.test.tsx` | Selector `'Bắt đầu chia đội'` → `'Chia lại'`. Test "phòng thiếu người" chuyển từ AOV-1026 (giờ là khán giả, không chia được) sang: chủ phòng mời 1 người ra → "hiện có 9". Thêm 5 test: 1 nút chính, góc nhìn khán giả, đổi đội khi đội kia đủ (báo lỗi), đổi đội khi còn chỗ, chat. Tổng 10 test (trước 5). |
| `src/mocks/rooms.ts` | Thêm `roomMessages['AOV-1025']` (2 tin). |
| `src/pages/CreateRoom.tsx` | Viết lại. 4 bước: Thông tin phòng → **Cấu hình trận** (số người, cấm/chọn + số lượt cấm, bản đồ lọc theo số người, BO1/3/5) → **Công cụ hỗ trợ** (5 công tắc, cách chia đội mặc định) → **Xem lại** (3 nhóm, nút "Sửa"). "Số khán giả tối đa" chỉ hiện khi bật khán giả. Stepper ngang < 1024 (< 640 chỉ số; 640–1023 chỉ nhãn bước đang làm), dọc ≥ 1024 — sửa Còn tồn #3. Bước chưa tới bị khoá. Thanh hành động dính đáy trên BottomNav (< 768); khung ngoài bỏ `overflow-hidden` để sticky hoạt động. Gom thẻ lựa chọn vào `OptionCards`. Công tắc bật dùng `bg-gold` (không phải gradient nút). "Tạo phòng" hiện toast giả lập. Bỏ 10 spacing lẻ + `h-[38px]`, `w-[103px]`, `w-[146px]`, `md:min-h-[600px]`… |

### Kiểm tra
- `npm run build` ✅, `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ), `npm test` ✅ **19/19** (trước 14), `npm run test:e2e` ✅.
- `node scripts/screenshot.mjs phase4b`: **32/32 ok**.
- Playwright (script tạm, đã xoá): `/rooms/new` — 1 nút vàng; tắt khán giả → ẩn ô số khán giả; tên rỗng → lỗi + ở bước 1; bước 3 bị khoá khi chưa tới; 3v3 → bản đồ "Đấu trường 3v3"; Blind → ẩn số lượt cấm; bước 4 đúng dữ liệu; "Sửa" về bước 2; "Tạo phòng" → toast; stepper 1 dòng, không tràn ở 375/768/1024/1279/1440; ở 375 nút "Tiếp tục" nằm sát trên BottomNav. `/rooms/AOV-1024` — 1 nút vàng; kéo Minz sang Team Đỏ (còn chỗ) ✅; thả Vanhh lên Rika → đổi chỗ ✅; gửi chat ✅; tab Cấu hình có bảng quyền. AOV-1025/1026: khán giả, 0 hàng kéo được, ≤ 1 nút vàng.
- Spacing lẻ còn **14** (trước 27): Profile 8, TournamentDetail 4, `primitives.tsx` 2. RoomDetail và CreateRoom sạch.

### Hoàn tác Phase 4b
Không có bản sao trung gian: backup `../web_backup_2026-11-15/` là trạng thái *trước Phase 1*. Muốn hoàn tác `RoomDetail.tsx`, `RoomDetail.test.tsx`, `CreateRoom.tsx` thì copy từ backup rồi áp lại các thay đổi Phase 1–3 ghi ở trên (ảnh `docs/screenshots/phase4a-b/` là trạng thái ngay trước 4b). `lib/room.ts`: chỉ cần xoá phần từ "Vai trò & quyền" trở xuống. `rooms.ts`: xoá khối `'AOV-1025'` trong `roomMessages`.

---

## Phase 4c — /tournaments/:slug → /profile (15/11/2026)

### Tạo mới
| File | Mô tả |
| --- | --- |
| `src/lib/tournament.ts` | Hàm thuần suy ra từ dữ liệu giải: `scheduleOf` (nhánh + trận ngoài nhánh, theo thời gian, không trùng), `groupByDate`, `winnerOf`, `podium`, `standings` (tình trạng từng đội), `matchProgress`. |
| `src/lib/tournament.test.ts` | 3 test: cả 8 giải nhất quán (mở ⇔ chưa có nhánh, `registeredTeams` = số đội trong danh sách; kết thúc ⇔ có vô địch), Hội Làng xếp hạng đúng, Custom League #3 gộp tranh hạng ba + 6/8 trận. |

### Sửa
| File | Thay đổi |
| --- | --- |
| `src/pages/TournamentDetail.tsx` | Viết lại. Tách `TournamentView` (`key={slug}`). Tab trên URL `?tab=info|teams|bracket|schedule|results`. **Thông tin:** giới thiệu, lộ trình giải theo trạng thái, luật (`max-w-[65ch]`), giải thưởng; cột phụ KPI `text-stat`, nhà vô địch, trận sắp tới/kết quả gần đây (tối đa 2), đơn vị tổ chức. Bỏ card "Thông tin giải đấu". **Danh sách đội**, **Lịch thi đấu**, **Kết quả**: có nội dung thật + empty state cho giải chưa bốc thăm. **Bảng đấu:** nhánh flex + viền CSS (bỏ `COL_X`, `QF_TOP`, `h-[404px]`, `min-w-[830px]`…), cuộn ngang trong vùng riêng, bóng mờ mép theo vị trí cuộn (`ResizeObserver`), nút xem trận nằm trong ô thay vì đè lên đường nối. Tiêu đề banner giữ từ cuối + phần tô vàng trên cùng một dòng (hết "Mùa / 1"). Nút chính: "Xem trận đang diễn ra" → tab Bảng đấu, "Xem kết quả" → tab Kết quả. Bỏ độ rộng/cao cứng của nút (`w-[170px]`, `h-[38px]`…) và 4 spacing lẻ. Tên đội xuống dòng thay vì cắt `…`. |
| `src/components/domain/PageBanner.tsx` | < 640px: ảnh phủ toàn khung + lớp tối 78% để chữ phụ đọc được (Còn tồn #5); ≥ 640 giữ như cũ. |
| `src/mocks/tournaments.ts` | `matchesOf`: nhãn "Chung kết · Chung kết" → "Chung kết". |
| `src/pages/Profile.tsx` | Viết lại. Tab trên URL `?tab=`. ID `@suthy` + `UID 102394`. Dòng trạng thái là đoạn văn xuống dòng. Tổng quan chỉ tóm tắt (KPI, top 3 tướng, top 3 vai trò, 3 trận). Lịch sử trận: bảng ≥ 768 (cột Trang bị ≥ 1024, Thời gian `nowrap`), card list < 768. Tab Tướng ưa thích + Thành tích có nội dung. `/profile/:userId` của người khác: header đúng người chơi + empty state (trước đây luôn hiện hồ sơ suthy); id không tồn tại → "Không tìm thấy người chơi". Badge "Chủ phòng" vàng đặc → viền vàng. Bỏ 8 spacing lẻ + `h-[120px]`, `h-[82px]`, `min-w-[140px]`, `w-[310px]`… |
| `src/mocks/types.ts` | `UserProfile` thêm `uid`, `achievements`; type `Achievement`. |
| `src/mocks/profile.ts` | `publicId` `#AOV-1024` → `@suthy`, `uid` `102394`. `bioExtra` → "Đang theo dõi giải Custom League #3" (khớp activity a2). Thêm 3 trận lịch sử (tổng 6) và 4 thành tích (thành tích Cup Mùa Thu khớp nhánh đấu: Bạch Hổ dừng ở tứ kết). |

### Kiểm tra
- `npm run build` ✅, `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ), `npm test` ✅ **22/22**, `npm run test:e2e` ✅.
- `node scripts/screenshot.mjs phase4c`: **32/32 ok**.
- Playwright (script tạm, đã xoá): 8 giải × 5 tab × 375/1280 = **80/80** không tràn, đúng 1 nút vàng, không tiêu đề/tab nào bị cắt, không lỗi console. Nhánh Custom League #3 ở 375: cuộn được (816 > 309px), bóng mờ phải → trái khi cuộn hết, cột Chung kết nhìn thấy; ở 1440 không cần cuộn. Bấm tab đổi URL, Back quay lại tab trước. "Xem kết quả" (Hội Làng) → `?tab=results`. `/profile` 4 tab × 4 khổ: 0 ô thời gian xuống dòng, cột Trang bị ẩn < 1024, ID đúng; "Xem lịch sử" → 6 trận; `/profile/rika` đúng người; `/profile/khongco` → không tìm thấy.
- Spacing lẻ còn **2** (chỉ `primitives.tsx`, để Phase 5).

### Hoàn tác Phase 4c
Xoá `lib/tournament.ts`, `lib/tournament.test.ts`. `TournamentDetail.tsx`, `Profile.tsx`: copy từ backup rồi áp lại Phase 1–3 (ảnh `docs/screenshots/phase4b/` là trạng thái ngay trước 4c). `PageBanner.tsx`: xoá lớp phủ `sm:hidden`, đổi ảnh về `w-[68%]`. `profile.ts`/`types.ts`: xoá `uid`, `achievements`, 3 trận h4–h6; đổi lại `publicId`, `bioExtra`.

---

## Phase 5 — P2: truy cập, tương phản, trạng thái danh sách, dọn giá trị lẻ (15/11/2026)

### Tạo mới
| File | Mô tả |
| --- | --- |
| `src/components/ui/ListStatus.tsx` | `ListStatus` (loading → skeleton + `role="status" aria-busy`, lỗi → `ErrorState` `role="alert"` + "Thử lại", ready → children), `Skeleton`, `SkeletonRows`, `SkeletonCards`, `ErrorState`. |
| `src/lib/mockStatus.ts` | `useMockStatus()`: mặc định `ready`; `?mock=loading|error|slow` để xem trạng thái; `retry` bỏ query `mock` và giữ query khác. |
| `src/components/ui/ListStatus.test.tsx` | 3 test: mặc định, loading, lỗi → Thử lại. |

### Sửa
| File | Thay đổi |
| --- | --- |
| `src/index.css` | Token `--color-team-blue-fg` (#6aa8f5), `--color-team-red-fg` (#f07a73) cho chữ màu đội trên nền `-bg` (đạt AA). |
| `src/pages/HomeGuest.tsx` | Tiêu đề Team Xanh/Đỏ ở bản xem trước dùng token mới. Ảnh hero < 1024 còn 30% (trước < 640 còn 40%). "Phòng đang mở" bọc `ListStatus` + empty state. |
| `src/components/domain/TournamentPromoCard.tsx` | Lớp phủ đậm hơn ở vùng chữ; chữ phụ `text-fg/90` → `text-fg`. |
| `src/components/domain/PageBanner.tsx` | Gradient giữ nền đậm tới ~52%; < 1024 ảnh phủ toàn khung + lớp tối 80% (trước chỉ < 640, 78%). |
| `src/components/domain/EmptyState.tsx` | Prop `as` (`p`/`h1`/`h2`) cho tiêu đề; thêm `py-8` mặc định. |
| `src/pages/NotFound.tsx`, `RoomDetail.tsx`, `TournamentDetail.tsx`, `Profile.tsx` | Trạng thái "Không tìm thấy" dùng `as="h1"` (trước trang không có `<h1>`). `NotFound` `min-h-[360px]` → `min-h-96`. |
| `src/components/ui/primitives.tsx` | `Eyebrow`, `Badge` `py-[3px]` → `py-1` (2 giá trị spacing lẻ cuối cùng). |
| `src/components/ui/Tabs.tsx` | Bọc thêm 1 lớp `relative`: bóng mờ mép trái/phải khi thanh tab cuộn ngang còn tab khuất; tab đang chọn luôn được cuộn vào khung (kể cả khi mở thẳng `?tab=` và sau khi font tải xong), không cuộn trang. |
| `src/components/domain/RoomsTable.tsx` | `ActiveRoomsCard` bọc `ListStatus`. |
| `src/pages/HomeUser.tsx` | `ListStatus` cho phòng của bạn + hoạt động; empty state cho hoạt động. |
| `src/pages/Tournaments.tsx` | Dòng đếm + lưới + phân trang bọc `ListStatus` (skeleton 6 card). |
| `src/pages/TournamentDetail.tsx`, `src/pages/Profile.tsx` | Nội dung tab bọc `ListStatus`. `HistoryList` có empty state. |
| `src/pages/RoomDetail.tsx` | Chat bọc trạng thái tải/lỗi. |
| `docs/UI_UX_CHECKLIST.md` | Tick 4 mục P2 còn lại kèm ghi chú → **57/57**. |

### Kiểm tra
- `npm run build` ✅, `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ), `npm test` ✅ **25/25**, `npm run test:e2e` ✅.
- `node scripts/screenshot.mjs phase5`: **32/32 ok**.
- Playwright (script tạm, đã xoá):
  - Tương phản chữ trên nền đặc, 12 trang/tab × 4 khổ: **0 lỗi** (trước: 2).
  - Tương phản chữ trên ảnh (đo điểm ảnh), 7 trang × 5 khổ: **0/174** (trước: 5 ở 375/1280, 4 ở 768).
  - a11y, 18 trang/tab × 2 khổ: 622 lượt ảnh đều có `alt`; mọi điều khiển có tên; không trùng `id`; đúng 1 `<h1>`; không chữ < 12px.
  - Trạng thái danh sách: 6 trang × `?mock=loading` / `?mock=error` đều hiện đúng số skeleton / khối lỗi; "Thử lại" bỏ `mock=` và hiện lại dữ liệu; `?mock=slow` skeleton rồi 6 giải.
  - Tabs ở 375: mở `?tab=results` → tab "Kết quả" nằm trọn trong khung, bóng mờ trái hiện, trang không bị cuộn; `/profile` bóng mờ phải khi còn tab khuất; phím → vẫn đổi tab.
- Rà soát giá trị lẻ (bỏ qua 2 file deprecated): spacing **0**, `text-[Npx]` 0, bo góc lẻ 0. Còn 12 kích thước px cố định cho điều khiển/menu/hộp thoại/lớp trang trí (xem báo cáo), không phải spacing và không phải chiều cao khối nội dung.

### Hoàn tác Phase 5
Xoá 3 file mới; bỏ `<ListStatus>`/`useMockStatus` ở các trang (nội dung bên trong giữ nguyên). `Tabs.tsx`: bỏ lớp bọc + 2 effect. `PageBanner`, `TournamentPromoCard`, hero landing: đổi lại gradient/opacity như cột "Thay đổi". `primitives.tsx`: `py-1` → `py-[3px]`.

---

## Còn tồn (theo dõi qua các phase)

| # | Vấn đề | Dự kiến |
| --- | --- | --- |
| ~~1~~ | ~~Nhánh đấu cuộn ngang ở 1280/1440, chưa có bóng mờ~~ | Đã xử lý ở Phase 4c (tab Bảng đấu toàn chiều rộng, bóng mờ theo vị trí cuộn). |
| ~~2~~ | ~~Bảng phòng cuộn ngang, cột Thao tác bị khuất~~ | Đã xử lý ở Phase 4a: chủ phòng/chế độ gộp vào dòng phụ ở **mọi** khổ (không chỉ dưới `xl`, vì 1280 và 1440 cùng container 1200px), card list < 768px. |
| ~~2b~~ | ~~Dashboard mobile: 4 ô tính năng đẩy danh sách phòng xuống~~ | Đã xử lý ở Phase 4a (chuyển thành "Công cụ nhanh" ở cột phụ). |
| ~~3~~ | ~~Nhãn stepper xuống dòng ở 768–1279px~~ | Đã xử lý ở Phase 4b (stepper ngang < 1024, đo cao 44px ở mọi khổ). |
| ~~4~~ | ~~Dashboard có 2 nút vàng đặc + "Tạo phòng" lặp TopNav/PageHeader~~ | Đã xử lý ở Phase 4a: bỏ "Tạo phòng custom" khỏi PageHeader; nút vàng duy nhất là "Đăng ký ngay". **Cần review** (xem #14). |
| ~~5~~ | ~~Banner chi tiết giải: tương phản + tiêu đề tách dòng~~ | Đã xử lý ở 4c (tiêu đề) + Phase 5 (đo điểm ảnh, 0 lỗi). |
| ~~6~~ | ~~Hồ sơ: cột "Thời gian" xuống 4 dòng~~ | Đã xử lý ở Phase 4c (`nowrap`, Trang bị ẩn < 1024, card list < 768). |
| 21 | Chi tiết giải: Custom League #3 còn trận tranh hạng ba nhưng tab Danh sách đội ghi Team Đỏ / AOV Elite "Dừng ở bán kết" (đúng về nhánh, chưa nói rõ còn tranh hạng ba). "Theo dõi", "Liên hệ ban tổ chức", nút xem trận vẫn là giả lập. ~~Thanh tab 375 chưa có bóng mờ~~ (xử lý ở Phase 5). | Khi có backend / mô hình dữ liệu trận ngoài nhánh. |
| 22 | Trạng thái loading/lỗi hiện chỉ xem được qua `?mock=` (dữ liệu là mock đồng bộ). Skeleton/lỗi đã dựng sẵn, chỉ cần thay `useMockStatus` bằng trạng thái request thật. | Khi nối API. |
| 23 | 12 kích thước px cố định còn lại (không phải spacing, không phải khối nội dung): `Brand` `size-[46/54px]`, `SearchDialog` `max-w-[560px]`, `TopNav` `w-[220px]` ×2 + `h-[3px]` (gạch chân), `UserMenu` `w-[232px]`, `Button` xl `h-[52px]`, `Modal` `max-w-[440px]`, `Tabs` `h-[3px]`, toast `w-[360px]`, nền hero landing `h-[400px]`. | Có thể đổi sang bội số spacing (`w-55`, `h-13`…) nếu muốn thống nhất; không ảnh hưởng hiển thị. |
| ~~7~~ | ~~Tiêu đề hero landing 44px ở 375px~~ | Đã xử lý ở Phase 3 (`text-4xl` = 32px ở 375px). |
| ~~8~~ | ~~Ảnh bìa hồ sơ~~ | Đã xử lý ở Phase 2b. |
| ~~9~~ | ~~Hồ sơ 375px: "56.3%" sát mép card~~ | Đã xử lý ở Phase 3 (`text-2xl`). |
| ~~10~~ | ~~Giá trị spacing lẻ~~ | Đã xử lý: 44 → 27 (4a) → 14 (4b) → 2 (4c) → **0** (Phase 5). |
| 20 | Trang phòng: chưa có phòng mẫu nào mà suthy là **người chơi thường** (không phải chủ) → góc nhìn "Người chơi" có trong code + bảng quyền nhưng chưa xem được trên UI. "Tham gia phòng", "Mời", "Random lane/tướng", "Hộp bí ẩn" vẫn là `comingSoon`. Kéo thả chỉ có trên chuột (HTML5 DnD không chạy trên cảm ứng) — trên mobile dùng menu ⋮. | Khi có backend / nếu cần demo thì thêm phòng mẫu. |
| ~~11~~ | ~~Cỡ chữ đổi ±1–3px khi đưa về token~~ | Đã duyệt ở review Phase 3; số KPI chuyển sang `text-stat` 32px ở Phase 3b. |
| ~~12~~ | ~~Avatar fallback~~ | Đã xử lý ở Phase 4a (`Avatar` prop `name`). Ảnh `av-*.png` của KhoaNeo/TiNè/Nanm đều tải được; nếu ở 4b/4c vẫn thấy vòng tròn trống thì do chỗ gọi truyền sai `src` (vd. avatar tướng Lauriel ở hồ sơ) → truyền thêm `name`. |
| ~~13~~ | ~~Dashboard trắng khoảng 1 giây sau khi đăng nhập~~ | Đã xử lý ở Phase 3b (không phải đang tải → không cần skeleton). |
| ~~14~~ | ~~Nút vàng đặc của dashboard~~ | Đã quyết ở review 4a: giữ "Đăng ký ngay" vàng đặc (Phase 4a-b). |
| ~~15~~ | ~~"+" BottomNav vàng + nút vàng trong trang~~ | Đã quyết: giữ "+" vàng đặc; điều hướng toàn cục không tính (quy tắc mới, Phase 4a-b). |
| ~~16~~ | ~~CTA cuối landing kém nổi~~ | Đã xử lý ở Phase 4a-b: CTA cuối dùng vàng đặc (quy tắc theo khung nhìn). |
| ~~17~~ | ~~Phân trang `/tournaments` chưa thấy~~ | Đã xử lý ở Phase 4a-b: 8 giải mock → 2 trang; chi tiết qua `buildDetail`. |
| 18 | "Xem tất cả phòng", menu "…" của từng phòng, "Xem hướng dẫn", "Tạo giải đấu" vẫn là `comingSoon` (chưa có trang). | Khi có route tương ứng. |
| ~~19~~ | ~~Tương phản hero landing + promo giải~~ | Đã xử lý ở Phase 5 (đo điểm ảnh; hero < 1024 còn 30%, promo phủ đậm hơn). |

## File không còn được dùng (cập nhật dần, chưa xoá)
| File / asset | Ghi chú |
| --- | --- |
| `src/components/layout/Sidebar.tsx` | `@deprecated`, đã thay bằng TopNav. |
| `src/components/layout/Topbar.tsx` | `@deprecated`, đã thay bằng TopNav + UserMenu + SearchDialog. |
| `Brand` biến thể `sidebar` / `header` | Chỉ còn `Sidebar.tsx` (deprecated) dùng. |
| `homeSlides` trong `src/mocks/home.ts` | Carousel dashboard đã bỏ. |
| `public/mock-assets/sidebar-art.jpg` | Chỉ còn `Sidebar.tsx` (deprecated) dùng. |
| `FeatureCard` biến thể `size="sm"` | Từ Phase 4a dashboard không dùng nữa; chỉ landing dùng `lg`. Chưa gắn `@deprecated` vì là biến thể, không phải file. |
| `scripts/.blank-*.png` (7 file) | Ảnh thừa của script đo trắng trang ở Phase 3b (04:17), lẽ ra phải xoá ngay sau khi chạy. Không phải mã nguồn; có thể xoá. |

## E1-T02 — Sửa P0 lệch số người phòng + 3 P1 @375 (15/11/2026)

### File đã sửa
- `mocks/rooms.ts`: `playerCount` suy ra từ `teams`; `partial()` thêm người thứ 10 nên phòng live đủ 5v5.
- `mocks/rooms.test.ts` (mới): nhất quán `playerCount`, phòng live 10/10, không trùng người, suthy chỉ ở AOV-1024.
- `pages/CreateRoom.tsx`: ô tên phòng có `gap-3`, bộ đếm `shrink-0`.
- `components/ui/FilterChips.tsx`: bóng mờ mép (đo bằng `scrollLeft`/`ResizeObserver`, nằm ngoài vùng cuộn) như `Tabs`.
- `components/ui/primitives.tsx`: `SeeAllLink` `shrink-0 whitespace-nowrap`; tiêu đề `SectionTitle` `min-w-0` để tự xuống dòng.

### Cách hoàn tác
`git revert` commit của task E1-T02.

### Còn tồn
- Chưa có.

---

## E3-T02 — Tầng dữ liệu frontend `src/api/` (15/11/2026)

### File đã sửa / tạo mới
- `src/api/` (mới): chọn nguồn `mock|api`, HTTP client có cookie session + CSRF, `ApiError`, toàn bộ endpoint REST trong API mục 2–6, adapter mock/http, ánh xạ contracts → kiểu UI, cache bộ nhớ và các hook `useRooms`, `useRoom`, `useTournaments`, `useTournament`, `useProfile`, `useActivities`, `useSearch`.
- `src/api/*.test.ts(x)` (mới): kiểm tra CSRF, lỗi API, ánh xạ phòng/giải và vòng đời hook loading/error/retry.
- `pages/*.tsx`, `components/domain/*`, `components/layout/SearchDialog.tsx`, `lib/room.ts`, `lib/tournament.ts`, `features/team-split/teamSplit.ts`: đọc dữ liệu/kiểu qua `src/api` thay vì import trực tiếp `src/mocks`; hành động ghi vẫn giữ state cục bộ như trước.
- `vite.config.ts`: proxy `/api`, gồm WebSocket (`ws: true`), tới `API_TARGET` hoặc `http://127.0.0.1:6174`.
- `package.json`, `package-lock.json`: thêm workspace dependency `@customaov/contracts`; `src/vite-env.d.ts` khai báo `VITE_DATA_SOURCE`.

### Cách hoàn tác
`git revert` commit của task E3-T02. Nếu hoàn tác thủ công: xoá `src/api/`, trả các import consumer về `src/mocks`, bỏ proxy Vite và dependency `@customaov/contracts`.

### Còn tồn
- Auth vẫn dùng session mock/localStorage theo đúng phạm vi; E3-T03 sẽ nối auth API.
- Các hành động ghi phòng, chat, hồ sơ và giải đấu vẫn là logic cục bộ/`comingSoon`; E4/E5 sẽ nối endpoint đã dựng sẵn.

---

## E5-T02a — Giao diện trang tạo giải `/tournaments/new` (15/11/2026)

### File đã sửa / tạo mới
- `src/pages/CreateTournament.tsx` (mới): wizard 4 bước (Thông tin · Thể thức · Lịch thi đấu · Luật & giải thưởng + Xem lại), validate bằng `CreateTournamentBodySchema` của `@customaov/contracts`, báo lỗi tại chỗ (`aria-invalid`, `aria-describedby`), focus vào ô lỗi đầu tiên, nút vàng đặc duy nhất ("Tiếp tục"/"Tạo giải").
- `src/pages/CreateTournament.test.tsx` (mới): 4 test (chuyển hướng khách tới login, điều hướng 4 bước + validate tên, lỗi thứ tự ngày ở bước 3, submit gọi `createTournament` + toast giả lập + về `/tournaments`).
- `src/App.tsx`: thêm route `/tournaments/new` trong `RequireAuth` trước `/tournaments/:slug`.
- `src/pages/Tournaments.tsx`: nút "Tạo giải đấu" trỏ tới `/tournaments/new` (khách qua `loginHref('login', '/tournaments/new')`), bỏ `comingSoon`.
- `src/api/mock.ts`, `src/api/index.ts`: thêm `createMockTournament` và `createTournament` (mock trả về slug giả).
- `scripts/screenshot.mjs`: thêm route `tournament-new` (`/tournaments/new`, loggedIn).

### Cách hoàn tác
`git revert` commit của task E5-T02a.

### Còn tồn
- Chế độ mock hiện toast "Đã tạo giải (giả lập)" và về `/tournaments`; phần nối API thật và điều hướng tới `/tournaments/:slug` làm ở task sau.

---

## E3-T03 — Nối đăng nhập/đăng ký frontend với API (15/11/2026)

### File đã sửa / tạo mới
- `src/api/client.ts`: `ApiError` lưu thêm `retryAfter` đọc từ header `retry-after` (dùng cho thông báo lỗi 429).
- `src/context/AppContext.tsx`: chế độ `api` gọi `GET /api/auth/me` khi khởi động để khôi phục phiên; `AuthState` bổ sung `user: Me | null` và `loading: boolean` (giữ nguyên `loggedIn`, không thêm export mới). Chế độ `mock` giữ nguyên hành vi cũ.
- `src/components/layout/RequireAuth.tsx`: hiện trạng thái loading (`role="status"`) khi đang kiểm tra phiên ở chế độ `api`, không chuyển hướng sớm.
- `src/components/layout/UserMenu.tsx`: hiển thị tên/avatar/cấp thật từ `user` khi có; ở chế độ `api`, đăng xuất gọi `POST /api/auth/logout` trước khi điều hướng `/` và gọi `startTransition(logout)`.
- `src/components/LoginModal.tsx`: giữ `MockLoginModal` cho chế độ `mock`; bổ sung `ApiLoginModal` cho chế độ `api` với tab Đăng nhập / Đăng ký, validate bằng `LoginBodySchema` / `RegisterBodySchema` từ `@customaov/contracts`, hiển thị lỗi 401/409/429 (`role="alert"`), trạng thái đang gửi trên nút submit và ẩn nút tài khoản mẫu.
- `src/components/LoginModal.test.tsx` (mới): kiểm tra chế độ `api` (ẩn nút tài khoản mẫu, validate schema, trạng thái đang gửi + điều hướng, lỗi 401/409/429, và `RequireAuth` loading).
- `scripts/e2e-auth-api.mjs` (mới) + `package.json` (`test:e2e:api`): kiểm tra đăng ký, đăng xuất, chặn `/dashboard`, sai mật khẩu, đăng nhập `suthy` và giữ phiên khi tải lại.

### Cách hoàn tác
`git revert` commit của task E3-T03.

### Còn tồn
- Chưa có.

---

## E3-T05 — Nối hồ sơ với API và sửa hồ sơ (15/11/2026)

### File đã sửa / tạo mới
- `src/api/http.ts`, `map.ts`, `types.ts`, `index.ts`: `/profile` lấy username từ phiên `/api/auth/me`, `/profile/:userId` gọi hồ sơ công khai; ánh xạ đầy đủ thắng/thua/tỷ lệ thắng/giải/danh hiệu/lịch sử; 404 trả về empty state; thêm mutation `PATCH /api/users/me` và giữ adapter mock không ghi dữ liệu.
- `src/pages/Profile.tsx`: nguồn API hiện sáu KPI thật, lịch sử custom và thành tích; các phần cần telemetry game (tướng, KDA, vai trò, trang bị) dùng empty state “Chưa có dữ liệu từ game – sẽ có sau MVP”; hồ sơ người khác không có nút sửa; mock giữ nguyên giao diện Phase 5.
- `src/components/domain/EditProfileDialog.tsx` (mới): sửa tên hiển thị, hai phần giới thiệu và avatar HTTPS; validate bằng `UpdateMeBodySchema`, lỗi tại chỗ, lỗi server `role="alert"`, focus modal ổn định, toast API/mock và làm mới hồ sơ sau khi lưu.
- `src/pages/Profile.test.tsx`, `src/components/domain/EditProfileDialog.test.tsx`, `src/api/map.test.ts`: kiểm tra API bằng fetch giả, số liệu + game empty state, 404, mapping lịch sử, validate 281 ký tự/URL HTTP, lưu thành công/thất bại và trả focus.

### Kiểm tra
- `npm run build` ✅; `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ ở `AppContext.tsx`); `npm test` ✅ (frontend 49/49, backend 91/91, contracts 89/89, team-core 15/15).
- `node scripts/e2e-auth.mjs http://localhost:5191` ✅.
- `node scripts/screenshot.mjs E3-T05 http://localhost:5191`: **36/36 ok**, không cuộn ngang; ảnh profile mock giữ bố cục hiện có ở 375/768/1280/1440.

### Cách hoàn tác
`git revert` commit của task E3-T05.

### Còn tồn
- Dữ liệu tướng, KDA, vai trò và trang bị phụ thuộc nguồn telemetry game nên chủ động để empty state sau MVP theo PRD 3.2.

---

## E5-T02b — Nối form /tournaments/new với API (15/11/2026)
- File: `src/pages/CreateTournament.tsx`, `src/api/client.ts` (`ApiError.details`), `src/pages/CreateTournament.api.test.tsx` (mới).
- Chế độ `api`: submit gọi `POST /api/tournaments`, thành công điều hướng `/tournaments/<slug>`; lỗi 400 map `details[].path` vào ô và quay về bước chứa ô; lỗi khác hiện `role="alert"`. Chế độ `mock` giữ nguyên toast giả lập.
- Hoàn tác: revert commit của task E5-T02b.
- Còn tồn: chưa có UI sửa giải (PATCH mới chỉ có ở API).

---

## E6-T02 — API tìm kiếm + nối `SearchDialog` (15/11/2026)

### File đã sửa / tạo mới
- Backend `src/services/search.ts` (mới): `searchAll(db, q, userId)` — trim + `normalizeVi`, < 2 ký tự → 400 `VALIDATION`; phòng/giải dùng lại `listRooms`/`listTournaments` (pageSize 5, cùng luật phòng private: chỉ public + phòng mình là thành viên); người dùng so khớp `users.search_text` (`LIKE … ESCAPE '\'`, escape `\ % _`), tối đa 5, chỉ trả `UserSummary`.
- Backend `src/routes/search.ts` (mới): `GET /api/search?q=` công khai, validate bằng `SearchQuerySchema`, rate limit 30/phút/IP (429 `RATE_LIMITED` + `retry-after`). `src/app.ts`: thêm import + 1 dòng đăng ký route.
- Backend `src/routes/search.test.ts` (mới, 13 test): "giao luu" khớp AOV-1025, có dấu/hoa = không dấu, "ngu kiet" khớp giải, khách/người ngoài không thấy phòng private, suthy thấy AOV-1024 nhưng không thấy AOV-1028, user chỉ có khoá `UserSummary`, ≤ 5/nhóm, `q` 1 ký tự / thiếu / chỉ khoảng trắng → 400, `%` `_` không khớp tất cả, rate limit 30/phút/IP.
- `src/api/hooks.ts`: `useSearch` trả thêm `pending`, `tooShort`; chế độ `api` debounce 250ms (`useDebouncedValue`, `SEARCH_DEBOUNCE_MS`), không gọi API khi < 2 ký tự (`SEARCH_MIN_LENGTH`), request cũ bị huỷ qua `AbortController` của `useResource` khi từ khoá đổi. Chế độ `mock` giữ nguyên (lọc đồng bộ, ô trống hiện gợi ý).
- `src/components/layout/SearchDialog.tsx`: mẫu combobox — ô nhập `role="combobox"` + `aria-activedescendant`, kết quả `role="listbox"` chia nhóm `role="group"` Phòng / Giải đấu / Người chơi, ↑/↓ chọn (vòng), Enter mở kết quả đang chọn rồi đóng hộp, rê chuột đổi mục chọn. Trạng thái: gợi ý "nhập ít nhất 2 ký tự" (api), loading (cả lúc chờ debounce), lỗi + "Thử lại", trống.
- `src/components/layout/SearchDialog.test.tsx` (mới, 7 test, chế độ api với `fetch` giả): < 2 ký tự không gọi API, debounce, huỷ request, hiển thị nhóm, ↑/↓ + Enter điều hướng, trống, lỗi → thử lại. `SearchDialog.mock.test.tsx` (mới, 1 test): chế độ mock không debounce, không fetch.

### Cách hoàn tác
`git revert` commit của task E6-T02.

### Còn tồn
- Kết quả phòng kèm phòng `finished` (giống `GET /api/rooms`). Nếu muốn ẩn thì lọc ở `searchAll`.
- Mục kết quả là `Link` `tabIndex=-1` (focus ở ô nhập theo mẫu combobox); bàn phím dùng ↑/↓ + Enter thay cho Tab.

---

## E5-T03 — Đăng ký đội vào giải: API + hộp thoại đăng ký + BTC duyệt/từ chối (15/11/2026)

### File đã sửa / tạo mới
- Backend (`base-backend-api`, file mới để không đụng `services/tournaments.ts`):
  - `src/services/registrations.ts`: tạo / liệt kê / duyệt / từ chối / rút đơn. Mọi thao tác ghi chạy trong transaction và khoá hàng giải bằng `SELECT … FOR UPDATE`. Chặn 409 khi giải không `open`, quá hạn, đã đủ `teamCount` đội `approved`, tên đội trùng (không phân biệt hoa thường) hoặc thành viên đã có đội active (thông báo kèm tên). Vi phạm partial unique index khi chạy song song cũng được đổi thành 409. Từ chối / rút → `active=false` cho thành viên. Mỗi thao tác sinh `activities` kind `register` cho đội trưởng và BTC.
  - `src/routes/registrations.ts`: `POST|GET /api/tournaments/:slug/registrations`, `POST …/:id/approve`, `POST …/:id/reject`, `DELETE …/:id` (204). CSRF do auth plugin kiểm.
  - `src/routes/registrations.test.ts` (mới, 17 test): tạo thành công + activity; 401; CSRF; 400; 404; 409 (người đã có đội, đủ chỗ, quá hạn, tên trùng, giải không open); 403 không phải BTC; duyệt tới đủ `teamCount` thì lần sau 409; từ chối rồi thành viên đăng ký đội khác được; rút đơn.
  - `src/app.ts`: đăng ký `registerRegistrationRoutes`.
- Frontend (`base-frontend-web`):
  - `src/api/types.ts`: `TournamentDetail` thêm `myRole?`, `myRegistration?` (chỉ chế độ api); export `Registration`.
  - `src/api/map.ts`: `mapTournamentDetail` giữ `myRole`, `myRegistration`.
  - `src/api/hooks.ts`: `HookResult.refresh()` tải lại ngầm (không về loading, không gỡ trang); thêm `useRegistrations(slug)`.
  - `src/components/domain/RegisterTeamDialog.tsx` (mới): tên đội + 5 thành viên (thành viên 1 = mình, chỉ đọc) + 2 dự bị; validate bằng `CreateRegistrationBodySchema`, lỗi tại ô (`aria-invalid`), lỗi server trong `role="alert"`; `data-autofocus` ở ô tên đội.
  - `src/components/domain/RegistrationsPanel.tsx` (mới): bảng BTC liệt kê đơn chờ duyệt với Duyệt (viền) / Từ chối (ghost, lý do tuỳ chọn); khoá Duyệt khi đủ đội; dùng `ListStatus` + empty state.
  - `src/pages/TournamentDetail.tsx`: ở chế độ api, nút "Đăng ký tham gia" / "Đăng ký đội" mở hộp thoại (khách → `loginHref`); thẻ "Đăng ký của bạn" hiện trạng thái (Chờ duyệt / Đã duyệt / Bị từ chối + lý do / Đã rút) và nút "Rút đăng ký" (hộp xác nhận); BTC thấy `RegistrationsPanel` ở tab "Danh sách đội". Sau mỗi thao tác xoá cache và `refresh()` để `RegistrationProgress` cập nhật. Chế độ mock giữ nút `comingSoon` như cũ (ảnh chụp không đổi).
  - Test mới: `RegisterTeamDialog.test.tsx` (4), `RegistrationsPanel.test.tsx` (4), `pages/TournamentDetail.test.tsx` (4, chế độ api qua `vi.mock('../api/source')`).

### Cách hoàn tác
`git revert` commit của task E5-T03.

### Còn tồn
- Index `unique(tournament_id, lower(name))` áp cho mọi trạng thái, nên đội đã bị từ chối / đã rút vẫn giữ tên: đăng ký lại phải đổi tên đội. Muốn dùng lại tên cần đổi schema (partial index), ngoài phạm vi task.
- Đội trong seed chỉ có đội trưởng (1 người) nên không khớp `RegistrationSchema` (5 thành viên); `GET …/registrations` bỏ qua các đội này. Đội seed đều `approved`, vẫn hiện qua `teamList`.
- Username không tồn tại hoặc người gửi không nằm trong `members` → 400 `VALIDATION` (API.md chưa quy định mã).
- Đội mới dùng logo mặc định `/mock-assets/logo.png` (chưa có upload logo).

---

## E4-T04 — Nối dashboard `#rooms` và wizard `/rooms/new` với API phòng (15/11/2026)

Chỉ đổi hành vi ở chế độ `api` (`VITE_DATA_SOURCE=api`). Chế độ `mock` giữ như cũ (bảng lọc tại chỗ, "Vào phòng" điều hướng thẳng, "Tạo phòng" hiện toast giả lập); e2e mock + screenshot 36/36 đạt.

### File đã sửa / tạo mới (`base-frontend-web/`)
- `src/api/client.ts`: `ApiError` giữ `details` của server và có `fieldErrors()` (`details[{path, message}]` → `{path: message}`).
- `src/api/adapter.ts`, `http.ts`, `mock.ts`, `hooks.ts`: thêm `roomsPage` / `useRoomsPage({q, mode, page, pageSize})` gọi `GET /api/rooms` với lọc chế độ, `q` và phân trang ở server (bản mock `readMockRoomsPage` lọc + cắt trang tại chỗ).
- `src/api/types.ts`: `Room` có thêm `isMember?` (chỉ chế độ api, lấy từ `RoomSummary.isMember`, vì danh sách server không kèm đội); `ROOM_MODE_SHORT_LABEL` khớp `MODE_LABELS` của server. `map.ts` ánh xạ `isMember`.
- `src/api/index.ts`: `joinRoom(code)` (`POST /api/rooms/:code/join` `{as:'player'}`; mock không gọi gì) và `createRoom(body)` (`POST /api/rooms`); cả hai xoá cache dữ liệu sau khi thành công.
- `src/components/domain/RoomsTable.tsx`:
  - `ActiveRoomsCard` nhận prop `server` (chế độ api): thêm ô tìm kiếm, chip lọc không kèm số (server chỉ trả tổng của bộ lọc đang chọn), dòng "N phòng", `Pagination`; không có `server` thì giữ lọc tại chỗ như cũ.
  - `RemoteActiveRoomsCard` (mới): tự gọi `useRoomsPage`, debounce `q` 300ms, đổi bộ lọc/từ khoá về trang 1, vẫn bọc `ListStatus`.
  - Nút hành động và nhãn "Phòng của bạn" dùng `isMember` khi có; thêm `pendingId` (nút "Đang vào…", khoá các nút "Vào phòng" khi đang gửi).
  - Empty state chế độ "Tất cả" đổi tiêu đề thành "Chưa có phòng nào đang mở" (trước đây hiện “all”).
- `src/pages/HomeUser.tsx`: chế độ api dùng `RemoteActiveRoomsCard`; "Vào phòng" gọi `joinRoom` rồi điều hướng `/rooms/<code>` (đã là thành viên thì vào thẳng); lỗi (409 phòng đầy / đang là người chơi ở phòng khác — thông báo của server có mã phòng hiện tại, 403, 429…) hiện toast "Không vào được phòng #<mã>". "Theo dõi"/"Xem" điều hướng thẳng. "Phòng bạn đang tham gia" dùng `GET /api/rooms?mine=1`; lời chào và `userId` lấy từ `useAuth().user`.
- `src/pages/CreateRoom.tsx`:
  - Chế độ api: bước cuối gửi `POST /api/rooms` `{title, mode, visibility, config:{format:'5v5', pickMode, series, tools, notes: mô tả}}`, thành công thì toast + điều hướng `/rooms/<code>`; nút "Đang tạo…" khi gửi.
  - Lỗi 400 hiện tại ô (`details[].path` → ô tương ứng, về bước chứa ô đầu tiên bị lỗi; lỗi tên phòng thì focus ô tên; thông báo "Sắp có" của server cho thể thức → ô Số người). Lỗi khác (409, 5xx, mạng) hiện `role="alert"` trên thanh hành động.
  - 3v3 / 1v1 bị vô hiệu kèm `SoonBadge` "Sắp có" (PRD mục 4) — áp cho **cả hai chế độ** vì là luật sản phẩm; chỉ ảnh hưởng bước 2, không có trong bộ screenshot.
  - Không thêm `overflow-hidden` cho khung ngoài; thanh hành động sticky giữ nguyên. Nút vàng đặc vẫn chỉ có "Tiếp tục"/"Tạo phòng".
- Test mới: `src/pages/HomeUser.api.test.tsx` (6), `src/pages/CreateRoom.api.test.tsx` (5), thêm 1 test `details` ở `src/api/client.test.ts`; `src/api/testing.ts` (fetch giả + dữ liệu theo contracts, chỉ dùng trong test).

### Kiểm tra
- `npm run build`, `npm run lint` (0 lỗi, 2 cảnh báo có sẵn), `npm test` ở gốc: đạt.
- Mock (cổng 5195): `e2e-auth.mjs` đạt hết; `screenshot.mjs E4-T04` 36/36 không cuộn ngang, không lỗi console.
- Api (API 6196 đã seed + Vite 5196): probe Playwright tạm (đã xoá) đạt: đăng nhập suthy → bảng thấy 4 phòng, `AOV-1024` có "Phòng của bạn"; lọc Căng → `mode=tournament`; tìm "giao luu" → `q` lên server, 1 kết quả; "Vào phòng" AOV-1026 → toast 409 "(AOV-1024)"; tạo phòng khi đang ở AOV-1024 → `role="alert"`; rời AOV-1024 rồi tạo phòng → `/rooms/AOV-<mới>`; user mới @375 "Vào phòng" → `POST /join` → `/rooms/AOV-1026`, không cuộn ngang.

### Cách hoàn tác
`git revert` commit của task E4-T04.

### Còn tồn
- `RoomConfig` của contracts chưa có trường cho số lượt cấm, bản đồ, khán giả và cách chia đội mặc định; wizard vẫn hiện các lựa chọn này nhưng không gửi lên server (chỉ gửi `notes` = mô tả).
- Chế độ api: `GET /api/activities` trả 404 (backend chưa có route), dashboard hiện trạng thái lỗi ở "Hoạt động gần đây" — ngoài phạm vi task này.
- Chip lọc chế độ ở chế độ api không hiện số phòng theo từng chế độ (cần 4 request hoặc API đếm theo chế độ).

---

## E6-T01 — Hoạt động: feed API + "Hoạt động gần đây" + `/activities` (15/11/2026)
- Backend: `GET /api/activities` (đăng nhập; chỉ mục có `activity_recipients.user_id = tôi`, mới nhất ở trên, phân trang `{items,total,page,pageSize}`) ở `src/services/activities.ts`, `src/routes/activities.ts` (+ test). `src/services/rooms.ts`: vào phòng với vai người chơi ghi activity `join` (người vào + chủ phòng là recipients) trong cùng transaction, mỗi cặp (người, phòng) chỉ ghi 1 lần; vào xem không ghi. `room-host.test.ts` lọc thêm `kind = 'result'` vì phòng giờ có cả activity `join`.
- Frontend: `src/api/` — `useActivities({page,pageSize})` trả trang (`ActivityPage`), `timeAgo()` (`src/api/time.ts`: "Vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", ≥ 7 ngày hiện dd/mm/yyyy giờ VN). Trang mới `src/pages/Activities.tsx` (`/activities`, trong `RequireAuth`): `PageHeader` (1 `<h1>`), `ListStatus`, `Pagination` theo `?page=`, empty state; export `ActivityList` dùng chung với dashboard. `HomeUser.tsx`: "Hoạt động gần đây" lấy 5 mục, link "Xem tất cả" → `/activities` (trước là toast `comingSoon`). Chế độ mock: dashboard như cũ, `/activities` dùng `mocks/activity.ts` (4 mục, 1 trang). `scripts/screenshot.mjs` thêm route `activities` (10 route × 4 khổ = 40).
- Test: `Activities.api.test.tsx` (dashboard 5 mục; phân trang; empty state), `Activities.test.tsx` (mock), `api/time.test.ts`.
- Hoàn tác: revert commit của task E6-T01.
- Còn tồn: activity `register`/`invite` do task khác sinh (E5-T03/E5-T04b); `timeAgo` tính lúc tải, không tự cập nhật khi để trang lâu.

---

## E4-T05 — Nối trang phòng `/rooms/:code` với API + realtime (15/11/2026)

### File đã sửa / tạo mới
- `src/pages/RoomDetail.tsx`: tách giao diện `RoomView` (dùng chung) khỏi nguồn dữ liệu. `MockRoomView` giữ nguyên hành vi Phase 4b (10 test cũ xanh). Chế độ `api` (`ApiRoomLoader`/`ApiRoomView`):
  - tải `GET /api/rooms/:code?key=` (đọc `key` từ URL); bản `restricted` chỉ hiện thông tin cơ bản + nút "Vào phòng", không có đội/chat;
  - vào phòng / vào xem / rời phòng / khán giả "Vào đội" (rời rồi vào lại vì server trả 409 khi đã là thành viên);
  - chủ phòng: chia lại (random), chia cân bằng (tier), đổi chỗ (kéo thả + menu, gửi `userId` uuid), mời ra, random lane, ghi kết quả ("Kết quả trận");
  - thành viên: khối "Vị trí của bạn" (chọn lane, Sẵn sàng/Huỷ sẵn sàng → `PATCH /me`); lane `null` hiện "—" (Chưa chọn lane);
  - xuất kết quả qua `GET /export` rồi copy; "Chia sẻ" của chủ phòng copy `shareUrl` (có mã mời);
  - chat `GET`/`POST /messages`; khán giả không có ô gửi, người ngoài thấy thông báo khoá; gộp tin theo `id` nên tin WS không trùng tin POST;
  - nút ẩn/tắt theo `myRole` + `ROOM_PERMISSIONS`; phòng `finished` khoá thao tác ghi, hiện badge kết quả;
  - lỗi 409/403… hiện toast với thông báo của server.
- `src/api/realtime.ts` (mới): `useRoomChannel(code, key, handlers)` — mở `/api/ws`, gửi `subscribe` (kèm `key`), xử lý `room.updated` (bản đầy đủ hoặc restricted), `chat.message`, `room.kicked` (toast + về `/dashboard`), `error`; tự nối lại với backoff 1s → 2s → 5s → 10s, nối lại được thì tải lại phòng + chat; unmount/đổi phòng gửi `unsubscribe` và đóng socket. Đọc tin bằng schema lỏng (`RoomDetail | RoomSummary`) vì contracts trên `main` chưa có thay đổi 9.5b của E4-T03.
- `src/api/room.ts` (mới): `useApiRoom`, `useApiRoomMessages`, `mergeMessages`, `isRoomDetail`. `src/api/index.ts` export thêm hai module trên.
- Test: `src/pages/RoomDetail.api.test.tsx` (10 test, fetch giả theo URL + WebSocket giả), `src/api/realtime.test.tsx` (6 test: subscribe, backoff, unmount, đổi phòng, phân loại tin, gộp tin), `src/test/fakeWebSocket.ts`.

### Kiểm tra
- `npm run build` ✅ sau khi sửa kiểu `RoomMember` của callback trong test; `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ ở `AppContext.tsx`); `npm test` ✅ (frontend 75/75, thêm 16 test; backend 109/109; team-core 15/15).
- `node scripts/e2e-auth.mjs http://localhost:5201` ✅; `node scripts/screenshot.mjs E4-T05 http://localhost:5201`: **36/36 ok**, trang phòng mock giữ nguyên bố cục.

### Cách hoàn tác
`git revert` commit của task E4-T05.

### Còn tồn
- Chưa kiểm thử end-to-end với backend thật + WS (E4-T03 chưa merge); giao thức theo API.md 4, 9.1, 9.5b.
- Chưa có UI chọn mức cân bằng (`balanceLevel`) và nhập tier; server coi tier thiếu = 3.

---

## E5-T05 — Nối 5 tab `/tournaments/:slug` + thao tác BTC (15/11/2026)

### File đã sửa / tạo mới
- `src/api/types.ts`: `BracketSlot.placeholder?: 'bye' | 'tbd'`; `TournamentDetail` thêm `series?`, `myRole?`, `registrationDeadlineAt?` (ISO), hằng `UNSCHEDULED_LABEL`. Mock không có các field này, nên không hiện panel BTC.
- `src/api/map.ts`: slot API `bye=true` → đội giữ chỗ "BYE", `team=null` → "Chưa xác định", đánh dấu `placeholder`; giữ `series`, `myRole`, hạn đăng ký ISO.
- `src/api/organizer.ts` (mới): `organizerActions` (close-registration, draw, score, `PATCH /matches/:id` với giờ VN `+07:00`), `seriesOf`, `WINS_NEEDED`, `organizerErrorMessage` (409 dùng thông điệp server: LOCKED / MATCH_NOT_READY). `src/api/index.ts` export.
- `src/api/hooks.ts`: `HookResult.reload()`: tải lại ngầm, giữ dữ liệu cũ và trạng thái `ready` (không nháy skeleton sau thao tác BTC).
- `src/lib/tournament.ts`: `isByeMatch`, `isReadyMatch`, `isScheduled`, `matchClock`, `readyMatches`, `hasScoredMatch`. Lịch/kết quả bỏ trận BYE và trận thiếu đội. Trận "Chưa xếp lịch" xếp cuối, gom thành nhóm riêng. Xếp hạng đội bỏ qua trận BYE. Tiến độ đếm n − 1 trận khi nhánh có BYE.
- `src/components/domain/OrganizerPanel.tsx` (mới): chỉ render khi `myRole === 'organizer'`.
  - Nút "Đóng đăng ký" và "Bốc thăm"/"Bốc lại", cả hai qua hộp xác nhận. Bốc thăm bị khoá khi còn mở đăng ký hoặc < 2 đội; bốc lại bị ẩn khi đã có tỉ số.
  - Danh sách trận đủ 2 đội có nút "Nhập tỉ số" (viền) và "Xếp lịch" (ghost, `datetime-local`).
  - Có `children` để gắn phần duyệt đăng ký (E5-T03).
- `src/components/domain/ScoreDialog.tsx` (mới): chọn tỉ số 0..N theo BO, chặn bằng `isValidSeriesScore` (cảnh báo `role="alert"`, nút Lưu bị khoá). Lỗi 409 hiện trong hộp.
- `src/pages/TournamentDetail.tsx`:
  - Panel BTC đặt giữa banner và tab.
  - Nhánh đấu: slot BYE / "Chưa xác định" có vòng tròn nét đứt, không có logo, không có nút xem trận.
  - Lịch: nhóm "Chưa xếp lịch", giờ thiếu hiện bằng chữ màu cảnh báo. `id` heading theo chỉ số.
  - Vẫn chỉ 1 nút vàng đặc (banner); hành động BTC dùng nút viền/ghost.
- Test:
  - `src/pages/TournamentDetail.api.test.tsx` (mới, 9 test, giả lập `fetch`): BYE/TBD, lịch "Chưa xếp lịch", nhà vô địch, panel chỉ cho BTC, bốc lại gọi API + tải lại, đóng đăng ký, ScoreDialog chặn sai BO, 409 hiện thông báo, xếp lịch gửi `+07:00`.
  - `src/api/map.test.ts`: thêm mapping placeholder.
  - `src/lib/tournament.test.ts`: thêm 2 test nhánh API.

### Kiểm tra
- `npm run build` ✅; `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ ở `AppContext.tsx`); `npm test` ✅ (web 71/71, api 109/109, contracts 89/89, team-core 15/15).
- `node scripts/e2e-auth.mjs http://localhost:5202` ✅.
- `node scripts/screenshot.mjs E5-T05 http://localhost:5202` (mock): **36/36 ok**.
- Kiểm tra thêm ở chế độ `api` (Vite `VITE_DATA_SOURCE=api` + Playwright `page.route` trả dữ liệu giả, script tạm đã xoá):
  - info/bracket/schedule ở 375 và 1280 đều không cuộn ngang, không lỗi console;
  - đúng 1 nút vàng đặc trong `main`.

### Cách hoàn tác
`git revert` commit của task E5-T05.

### Còn tồn
- Hộp xếp lịch chưa điền sẵn giờ hiện tại, vì API chỉ trả nhãn "dd/mm HH:mm" không có năm.
- Chưa có lệnh huỷ lịch.
- Chưa kiểm tra với backend thật: E5-T04b đang review. Mã lỗi `LOCKED`/`MATCH_NOT_READY` của engine được trả dạng `409 CONFLICT` kèm thông điệp, nên UI hiện thông điệp đó.

### Review fix 1 — dùng dữ liệu suy ra từ backend
- `src/api/map.ts`, `src/api/types.ts`: giữ `champion`, `upcoming`, `results` trong mô hình UI thay vì làm mất nhà vô địch khi ánh xạ response.
- `src/pages/TournamentDetail.tsx`: chế độ API dùng trực tiếp `upcoming` cho tab Lịch và `results`/`champion` cho tab Kết quả; chế độ mock vẫn dùng `scheduleOf`/`podium` như trước.
- `src/pages/TournamentDetail.api.test.tsx`, `src/api/map.test.ts`: thêm hồi quy với lịch, kết quả và nhà vô địch backend cố ý khác dữ liệu có thể suy từ bracket.
- Kiểm tra ở gốc: `npm run build` ✅; `npm run lint` ✅ (0 lỗi, 2 cảnh báo cũ); `npm test` ✅ (team-core 15/15, contracts 89/89, web 73/73, api 109/109).

---

## E6-T03 — Nối dashboard: promo giải đang mở, "Phòng của bạn", hoạt động (15/11/2026)

### File đã sửa
- `base-frontend-web/src/api/adapter.ts`, `base-frontend-web/src/api/http.ts`: `TournamentsParams` thêm `pageSize?: number` (mặc định `50` ở `httpAdapter.tournaments`).
- `base-frontend-web/src/pages/HomeUser.tsx`:
  - Promo chế độ `api` gọi `useTournaments({ status: 'open', sort: 'deadline', pageSize: 1 })` (`GET /api/tournaments?status=open&sort=deadline&pageSize=1`), ẩn khối khi không có giải mở đăng ký, bọc `ListStatus` riêng khi `loading`/`error` để lỗi một khối không làm hỏng cả trang; nút "Đăng ký ngay" điều hướng tới `/tournaments/:slug` ở chế độ `api`.
  - Giữ nguyên khối `#rooms` (E4-T04), "Phòng bạn đang tham gia" (`GET /api/rooms?mine=1`, `ListStatus` riêng), "Hoạt động gần đây" (E6-T01), đúng 1 nút vàng đặc và bố cục grid ≥ 1024; chế độ `mock` giữ nguyên.
- `base-frontend-web/src/pages/HomeUser.api.test.tsx`: thêm 4 test chế độ `api` (có promo + tiến độ + điều hướng; ẩn khối khi không có promo; "Phòng bạn đang tham gia" với `mine=1` + empty state; cô lập lỗi từng khối kèm "Thử lại").

### Cách hoàn tác
`git revert` commit của task E6-T03.

### Còn tồn
- Chưa kiểm thử end-to-end với backend thật cho toàn bộ dashboard (đã kiểm thử bằng `fetch` giả theo contracts).

---

## E7-T02 — Sửa lỗi từ audit E7-T01 (2 P1 + 2 P2) (15/11/2026)

### File đã sửa
- `base-backend-api/src/app.ts`, `base-backend-api/src/app.test.ts`:
  - Thêm rate limit chung cho mọi route ghi (`POST`/`PUT`/`PATCH`/`DELETE` dưới `/api`): 60 lần/phút/người (`api-write:u:<id>` hoặc `api-write:ip:<ip>`), trả `429 RATE_LIMITED` kèm `retry-after`, giữ nguyên các giới hạn riêng hiện có.
  - Đổi thông báo 404 route không tồn tại sang tiếng Việt (`"Không tìm thấy đường dẫn"`), cập nhật test khớp.
- `base-backend-api/src/services/rooms.ts`, `base-backend-api/src/routes/rooms.test.ts`, `base-backend-api/src/routes/search.test.ts`:
  - `listRooms` mặc định loại phòng `finished`, chỉ trả khi có `status=finished` hoặc `mine=1` (tìm kiếm `searchAll` cũng tự động loại phòng `finished`).
- `base-backend-api/src/routes/users.ts`, `base-backend-api/src/routes/users.test.ts`, `base-backend-api/src/routes/tournaments.ts`, `base-backend-api/src/routes/tournaments.test.ts`:
  - Validate `:username` (`UsernameSchema`) và `:slug` (`TournamentSummarySchema.shape.slug` tối đa 90 ký tự) bằng Zod ở tầng route, trả `400 VALIDATION` khi sai định dạng.
- `base-frontend-web/src/mocks/types.ts`, `base-frontend-web/src/api/map.ts`, `base-frontend-web/src/lib/room.ts`, `base-frontend-web/src/components/domain/RoomsTable.tsx`, `base-frontend-web/src/api/map.test.ts`, `base-frontend-web/src/components/domain/RoomsTable.test.tsx`:
  - Không ép phòng `finished` thành `live` ở `mapRoom`; thêm trạng thái badge `"Đã kết thúc"` (token `neutral`) và hành động `"Xem"` trong `RoomStatusBadge` / `roomAction` / `RoomsTable`.

### Kiểm tra
- `npm ci`, `npm run build`, `npm run lint` (0 lỗi, 2 cảnh báo cũ ở `AppContext.tsx`), `npm test` (team-core 15/15, contracts 89/89, web 135/135, api 170/170) ✅.
- `node scripts/screenshot.mjs E7-T02 http://localhost:5213` (mock): **40/40** ✅.

### Cách hoàn tác
`git revert` commit của task E7-T02.

### Còn tồn
- Không có.
# Quick Team (25/11/2026)

## Room Invite UX (25/11/2026)

- `JoinRoom.tsx`: success toast only after confirmed RPC, followed by Room navigation; missing discovery invitation has an actionable fallback and never redeems the sentinel.
- `PersonalQueueStatus.tsx`, `lib/personalQueue.ts`: personal waiting ordinal/size from active membership and sorted waiting snapshot, distinct selected/off-queue/closed states. Hide positions while disconnected or refetching. `SupabaseRoomView.tsx` and existing `realtime.ts` wire this state without extra channels/polling.
- Focused tests cover pending/success/failure, fallback, active-member filtering, updates and stale-response/refetch handling. Fresh validation: typecheck/build PASS; lint 0 errors, 2 existing warnings; 54 files / 345 tests PASS; whitespace check PASS. `scripts/e2e-invite.mjs`: local Mock browser fixture PASS at 390/1440, no Supabase requests.
- PO confirms UI UAT PASS and authorizes release to dev. Remaining: authenticated hosted multi-client queue/reconnect acceptance. No hosted PASS claimed. Queue size means active waiting entries; selected players are shown separately.
- Undo: revert the scoped Invite UX release commit; preserve unrelated local todo.md changes.

- Added public Quick Team workspace, core integration, exact reference Rank catalog, focused tests and browser scenario script. Navigation and Home CTAs link to the tool.
- Reuses PageHeader, Card, Button and existing navy/gold/team tokens. No Room or Community/Tournament workflow changes.
- Validation: typecheck, lint (two existing warnings), 53 test files / 336 tests and build passed. Browser results are reported separately in the task handoff.
- Rollback: remove the new Quick Team files and reverse only this task's route/navigation/Home additions; preserve earlier dirty changes.
- Remaining: PO visual UAT; hosted operational acceptance is outside this local utility milestone.
