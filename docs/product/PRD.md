# PRD – customAOV MVP

> Trạng thái: **BẢN ĐỀ XUẤT, chờ Owner duyệt.** Lead soạn ngày 15/11/2026.
> Nguồn: UI hiện có (`base-frontend-web/src/pages`, 8 route), mock data (`base-frontend-web/src/mocks`), logic (`src/lib/room.ts`, `src/lib/tournament.ts`), `packages/team-core`, tài liệu `docs/ui-refactor/`.
> Các thư mục `docs/dac-ta`, `docs/design-api`, `docs/nghiep-vu`, `docs/tich-hop`, `docs/hdsd`, `docs/json`, `docs/pdf` chỉ là mẫu trình bày, không phải nguồn yêu cầu.

## 1. Bài toán

Người chơi Liên Quân (AOV) tổ chức trận **custom 5v5** và **giải cộng đồng** hiện phải dùng Zalo/Discord cùng bảng tính: gom 10 người, chia đội "cho công bằng", chép kết quả, theo dõi nhánh đấu. customAOV gom những việc đó vào một web app:
- **Phòng custom:** tạo phòng, vào phòng, chia đội tự động bằng `team-core`, đổi chỗ, chat, xuất kết quả để dán sang Zalo/Discord.
- **Giải đấu:** tạo giải, đăng ký đội, bốc thăm nhánh loại trực tiếp, nhập tỉ số, xem lịch và kết quả.

Hiện frontend đã xong phần giao diện (UI refactor Phase 1–5), nhưng toàn bộ dữ liệu là mock và đăng nhập là giả lập. **MVP = thay mock bằng backend thật cho các luồng đã có giao diện**, đồng thời bật vài nút đang hiện "Tính năng đang phát triển" mà luồng chính cần.

## 2. Người dùng và vai trò

| Vai trò | Mô tả | Quyền chính |
|---|---|---|
| Khách | Chưa đăng nhập | Xem landing, `/tournaments`, `/tournaments/:slug` |
| Người dùng | Đã đăng nhập | Dashboard, tạo/vào phòng, đăng ký đội vào giải, hồ sơ |
| Chủ phòng | Người tạo phòng | Chia đội, đổi chỗ, mời ra khỏi phòng (bảng `ROOM_PERMISSIONS` hiện có) |
| Người chơi / khán giả trong phòng | Thành viên phòng / người xem | Chat, xuất kết quả (người chơi); chỉ xem (khán giả) |
| Ban tổ chức (BTC) | Người tạo giải | Sửa giải, đóng đăng ký, bốc thăm, nhập tỉ số |

Không có vai trò quản trị hệ thống trong MVP (seed dữ liệu bằng script).

## 3. Phạm vi MVP

### 3.1. Tài khoản (thay `LoginModal` giả lập)
- Đăng ký bằng tên đăng nhập + mật khẩu + tên hiển thị. Đăng nhập, đăng xuất, khôi phục phiên khi tải lại trang.
- Phiên lưu bằng cookie `httpOnly`. Mật khẩu băm bằng `node:crypto` scrypt (không thêm thư viện).
- Giữ nguyên hành vi điều hướng đang có: `RequireAuth` chuyển tới `/?login=login&next=<route>`, đăng nhập xong quay lại `next`.
- Tài khoản mẫu `suthy` có trong seed để demo và cho e2e.

### 3.2. Hồ sơ (`/profile`, `/profile/:userId`)
- Xem hồ sơ mình và người khác: tên, `@publicId`, UID, giới thiệu, huy hiệu, avatar (URL hoặc chữ cái đầu, như `Avatar` hiện có).
- **Sửa hồ sơ** (đang là "Tính năng đang phát triển"): tên hiển thị, giới thiệu, avatar URL.
- Thống kê **chỉ lấy từ dữ liệu customAOV ghi nhận**: số trận custom đã chơi, thắng/thua (chủ phòng nhập kết quả, mục 3.3), thành tích từ giải (vô địch, tham gia).
- Các phần cần dữ liệu từ game (tướng ưa thích, KDA, vai trò %, trang bị, MVP) **không có trong MVP**. Giữ khung UI và hiện empty state (`EmptyState`/`ListStatus` sẵn có).

### 3.3. Phòng custom (`/dashboard#rooms`, `/rooms/new`, `/rooms/:roomId`)
- Danh sách phòng công khai: lọc theo chế độ, tìm không dấu, phân trang (UI `ActiveRoomsCard` hiện có).
- Tạo phòng theo 4 bước hiện có (thông tin, cấu hình trận, công cụ, xem lại). Mã phòng dạng `AOV-1234`. Phòng riêng tư chỉ vào được bằng mã hoặc link.
- Vào phòng, rời phòng, xem với tư cách khán giả. Chọn lane, bấm sẵn sàng.
- **Chia đội ở server** bằng `@customaov/team-core` (`splitTeams5v5`), hai chế độ `random` và `tier` (bảng điểm mặc định `DEFAULT_TIER_SCORES`; người chơi tự khai tier trong hồ sơ phòng). Chế độ `rank` để sau MVP vì chưa có nguồn dữ liệu rank.
- Chủ phòng: đổi chỗ (kéo thả/menu, tức `moveMember`), mời ra khỏi phòng (`removeMember`), chia lại.
- **Random lane** (đang là "Tính năng đang phát triển"): đưa vào MVP vì không cần dữ liệu ngoài.
- Xuất kết quả chia đội dạng văn bản (`formatTeamsText`).
- **Realtime:** thành viên, đội, trạng thái sẵn sàng và chat cập nhật tức thì cho mọi người đang mở phòng (WebSocket).
- Chủ phòng **ghi kết quả trận** (Xanh thắng / Đỏ thắng) khi kết thúc. Kết quả này nuôi thống kê hồ sơ và "Hoạt động gần đây".
- "Mời người chơi" trong MVP = sao chép link phòng (đã có nút chia sẻ). Không có lời mời qua thông báo.

### 3.4. Giải đấu (`/tournaments`, `/tournaments/:slug`)
- Danh sách giải: lọc theo trạng thái (đang mở/đang diễn ra/đã kết thúc), tìm kiếm, phân trang.
- **Tạo giải** (đang là "Tính năng đang phát triển"): tên, mô tả, thể thức 5v5, số đội (4/8/16), hạn đăng ký, ngày bốc thăm, khoảng thời gian thi đấu, luật, giải thưởng. Ảnh bìa chọn từ bộ ảnh có sẵn.
- **Đăng ký đội** (đang là "Tính năng đang phát triển"): đội trưởng nhập tên đội và chọn 5 thành viên chính (+ tối đa 2 dự bị) theo tên người dùng. Hiện tiến độ bằng `RegistrationProgress`. BTC duyệt hoặc từ chối.
- BTC: đóng đăng ký, **bốc thăm nhánh loại trực tiếp** (BO1/BO3/BO5; bốc ngẫu nhiên; số đội lẻ thì xử lý bye), nhập tỉ số từng trận. Đội thắng tự vào vòng sau, giải tự chuyển trạng thái `open → live → finished`.
- Tab Thông tin, Danh sách đội, Bảng đấu, Lịch thi đấu, Kết quả dùng dữ liệu thật. Các phần suy ra (lịch, xếp hạng, vô địch) tính ở **backend**, theo logic đang nằm trong `src/lib/tournament.ts`.
- Vòng bảng (`groupStage`) **không có trong MVP**, chỉ loại trực tiếp.

### 3.5. Dashboard, tìm kiếm, hoạt động
- Dashboard: phòng đang mở, phòng của bạn, giải nổi bật đang mở đăng ký (promo), "Hoạt động gần đây".
- Hoạt động gần đây = sự kiện thật: vào phòng, đăng ký giải, kết quả trận. Có trang hoặc danh sách xem thêm (đang là "Tính năng đang phát triển").
- `SearchDialog`: tìm phòng, giải, người dùng ở server (không dấu).

### 3.6. Chế độ mock vẫn giữ
Frontend chạy được ở **hai chế độ**: `mock` (dữ liệu `src/mocks`, như hiện nay, dùng cho phát triển UI và bộ ảnh `baseline`) và `api` (gọi backend). Chuyển bằng biến môi trường Vite. Test đơn vị, `screenshot.mjs` và e2e hiện tại vẫn chạy ở chế độ mock. E2E mới cho chế độ api chạy song song.

## 4. Ngoài phạm vi MVP

- Đăng nhập bằng Google/Facebook/Discord/Garena. Quên mật khẩu qua email.
- Dữ liệu từ game (tướng, KDA, rank, trang bị, MVP); random tướng; hộp bí ẩn; chế độ trình chiếu.
- Chia đội theo `rank`. Chế độ 3v3/1v1 (UI tạo phòng cho chọn nhưng MVP chỉ xử lý 5v5; lựa chọn khác sẽ bị vô hiệu kèm nhãn "Sắp có").
- Vòng bảng; nhánh thắng/thua (double elimination); xếp lịch tự động theo giờ.
- Thông báo (chuông TopNav), BXH, Cộng đồng (đang là mục "Sắp có", giữ nguyên).
- Ứng dụng di động; triển khai lên hosting trả phí; tên miền; email. MVP chạy được trên máy local (một lệnh). Triển khai thật là quyết định riêng sau MVP.
- Trang quản trị; kiểm duyệt nội dung chat (chỉ giới hạn độ dài và tần suất gửi).

## 5. Yêu cầu phi chức năng

- **Bảo mật:** cookie `httpOnly` + `SameSite=Lax`, kiểm tra quyền ở server cho mọi hành động chủ phòng/BTC, validate mọi input bằng schema chung, giới hạn tần suất đăng nhập và chat, không log mật khẩu hay cookie.
- **Nhất quán:** một giải/phòng hiển thị giống nhau ở mọi trang (quy tắc AGENTS.md vẫn áp dụng cho dữ liệu thật).
- **Hiệu năng:** API p95 < 200 ms trên máy local với dữ liệu seed. Chia đội 10 người chạy đồng bộ (team-core duyệt 252 tổ hợp).
- **Giao diện:** giữ nguyên quy tắc UI ở AGENTS.md. Mọi danh sách mới có loading/error/empty qua `ListStatus`.
- **Chất lượng:** `npm run build`, `lint` (0 lỗi), `test` xanh ở gốc repo, kể cả backend. Mỗi endpoint có test.

## 6. Đề xuất stack backend

| Thành phần | Chọn | Lý do |
|---|---|---|
| Ngôn ngữ / runtime | **TypeScript trên Node.js 22** (đã cài) | Cùng ngôn ngữ với frontend. Dùng thẳng `@customaov/team-core` ở server mà không phải port thuật toán. Chung npm workspaces, chung lệnh build/lint/test ở gốc. |
| Web framework | **Fastify 5** | Nhẹ, nhanh, có `inject()` để test không cần mở cổng, hệ plugin cho cookie/websocket. Ít "phép thuật" hơn NestJS, nên agent dễ đọc và review. |
| Realtime | **`@fastify/websocket`** (WebSocket thuần, kênh theo phòng) | Đủ cho cập nhật phòng và chat. Socket.IO nặng hơn mức MVP cần. |
| Hợp đồng API | **`zod`** trong package mới `packages/contracts`, dùng chung FE/BE | Một nguồn kiểu dữ liệu cho request/response, tránh lệch giữa hai bên. Validate ở server, parse ở client. |
| CSDL | **PostgreSQL** (Docker khi chạy như production) + **PGlite** (Postgres chạy in-process) cho dev/test | Dữ liệu quan hệ rõ (người dùng–phòng–thành viên, giải–đội–trận). PGlite giúp mỗi worktree hay test có DB riêng, không cần cài Postgres hay chạy Docker, nên nhiều agent chạy song song được. |
| Truy cập DB / migration | **Drizzle ORM + drizzle-kit**; file migration đặt ở `database/migrations/` | Schema viết bằng TS, câu SQL sinh ra đọc được, hỗ trợ cả `pg` lẫn PGlite. Nhẹ hơn Prisma (không có engine nhị phân). |
| Mật khẩu / phiên | `node:crypto` scrypt; bảng `sessions` trong DB; `@fastify/cookie` | Không cần thư viện băm có native build (dễ lỗi trên Windows). |
| Test | **Vitest** (đang dùng ở frontend) + `fastify.inject` + PGlite | Một công cụ test cho cả repo. |

Vì sao không chọn Java/Spring (Java 25 và Maven có trên máy, và các rule mẫu trong `base-backend-api/.agent` nhắc tới): phải port lại `team-core` hoặc gọi chéo ngôn ngữ, có hai hệ build và hai bộ kiểu dữ liệu, trong khi MVP nhỏ và cả nhóm agent đang làm TypeScript. Khi PRD được duyệt, các rule mẫu trong `base-backend-api/.agent/rules` sẽ được viết lại theo stack này (task E2-T06).

**Thư viện mới cần duyệt cùng PRD** (đây là danh sách duy nhất được phép thêm. Ngoài danh sách thì hỏi lại theo ORCHESTRATION.md mục 8):
- Backend: `fastify`, `@fastify/cookie`, `@fastify/websocket`, `@fastify/rate-limit`, `zod`, `drizzle-orm`, `drizzle-kit` (dev), `pg`, `@electric-sql/pglite`, `tsx` (dev, chạy TS khi phát triển).
- Dùng chung: `zod` trong `packages/contracts`.
- Frontend: **không thêm**. Gọi API bằng `fetch` + hook nhỏ tự viết.

## 7. Mô hình dữ liệu (phác thảo, chốt ở E2-T01 và qua gate schema)

`users` · `sessions` · `rooms` (mã, tiêu đề, chế độ, công khai/riêng tư, sức chứa, trạng thái, cấu hình 4 bước) · `room_members` (vai trò, đội, lane, sẵn sàng, đội trưởng, tier tự khai) · `room_messages` · `room_matches` (kết quả trận custom) · `tournaments` · `tournament_teams` + `tournament_team_members` (trạng thái duyệt) · `bracket_matches` (vòng, thứ tự, đội A/B, tỉ số, BO, giờ) · `activities`.

## 8. Tiêu chí hoàn thành MVP

1. Từ trình duyệt sạch: đăng ký → tạo phòng → 9 tài khoản khác vào → chia đội (`random` và `tier`) → đổi chỗ → chat realtime → xuất kết quả → ghi kết quả trận → hồ sơ và "Hoạt động gần đây" cập nhật.
2. Tạo giải 8 đội → 8 đội đăng ký, BTC duyệt → bốc thăm → nhập tỉ số tới chung kết → giải chuyển `finished`, có nhà vô địch, thành tích hiện ở hồ sơ.
3. 8 route không cuộn ngang ở 375/768/1280/1440, ở cả chế độ mock và api. Bộ ảnh so với `baseline` không lệch ngoài thay đổi đã duyệt.
4. Build, lint, test, e2e (mock + api) đều xanh từ gốc repo. Chạy toàn bộ app local bằng một lệnh được ghi trong README.

## 9. Rủi ro và giả định

- AOV và tên tướng là tài sản của nhà phát hành. MVP không dùng ảnh hay dữ liệu game; ảnh mock hiện có chỉ là ảnh minh hoạ.
- Quota agent có hạn. ROADMAP ưu tiên model rẻ và có quy tắc leo thang.
- PGlite khác Postgres thật ở một vài tính năng mở rộng. Không dùng extension. Có một bước chạy test trên Postgres Docker trước khi đóng epic E7.
