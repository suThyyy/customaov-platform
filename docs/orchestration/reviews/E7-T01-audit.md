# E7-T01 – Audit toàn MVP (Mock & API)

- **Ngày audit:** 15/11/2026
- **Nhánh:** `task/E7-T01-audit` (từ `main` @ `809af7e`)
- **Phạm vi:** Bảo mật backend (`base-backend-api/src/**`), nhất quán dữ liệu, UX theo `AGENTS.md` ở 375/768/1280/1440 (cả `mock` và `api`), và luồng chính chế độ `api`.

## Bảng tổng hợp theo khu vực × mức

| Khu vực | P0 | P1 | P2 | Tổng |
|---|---:|---:|---:|---:|
| Bảo mật backend | 0 | 1 | 1 | 2 |
| Nhất quán dữ liệu | 0 | 1 | 0 | 1 |
| UX theo AGENTS.md | 0 | 0 | 1 | 1 |
| Luồng chính chế độ API (E2E) | 0 | 0 | 0 | 0 |
| **Tổng** | **0** | **2** | **2** | **4** |

---

## Chi tiết lỗi

### [P1] Bảo mật backend – Thiếu rate limit 60 lần/phút/người dùng cho phần lớn route ghi

- **Bước tái hiện:**
  1. Đăng nhập vào hệ thống lấy cookie `sid` và `csrf`.
  2. Gửi liên tiếp > 60 request ghi trong 1 phút tới bất kỳ route ghi nào ngoài `login`, `register`, `join`, `messages`, `PATCH /api/users/me`, `POST /api/tournaments` (ví dụ `POST /api/rooms`, `POST /api/rooms/:code/split`, `POST /api/tournaments/:slug/registrations`, `POST /api/tournaments/:slug/draw`, `PATCH /api/tournaments/:slug`).
- **Thực tế / Mong đợi:**
  - **Thực tế:** `app.ts` đăng ký `@fastify/rate-limit` với `global: false` và không có hook rate limit chung cho request ghi. Chỉ có `auth/routes.ts` (`login`, `register`), `routes/rooms.ts` (`join`, `messages`), `routes/users.ts` (`PATCH /api/users/me`), `routes/tournaments.ts` (`POST /api/tournaments`), và `routes/search.ts` (`GET /api/search`) gắn rate limit riêng. Các route ghi còn lại không bị giới hạn tần suất và đều trả `200`/`201`/`204` dù vượt 60 lần/phút.
  - **Mong đợi:** Mọi request ghi khác phải bị giới hạn tối đa **60 lần / phút / người dùng** và trả HTTP `429 RATE_LIMITED` kèm thông báo tiếng Việt.
- **File:dòng:**
  - `base-backend-api/src/app.ts:115-124`
  - `base-backend-api/src/routes/rooms.ts:101-221`
  - `base-backend-api/src/routes/tournaments.ts:91-98`
  - `base-backend-api/src/routes/tournament-bracket.ts:50-90`
  - `base-backend-api/src/routes/registrations.ts:40-88`
  - `base-backend-api/src/auth/routes.ts:186-191`
- **Quy tắc bị vi phạm:** `base-backend-api/.agent/rules/04-security-rules.md` mục 3 ("Các request ghi khác: Tối đa 60 lần / phút / người dùng") và `docs/product/API.md` mục 2.

---

### [P1] Nhất quán dữ liệu – Phòng đã kết thúc (`finished`) bị ánh xạ thành "Đang diễn ra" (`live`) ở danh sách phòng chế độ `api`

- **Bước tái hiện:**
  1. Chạy hệ thống ở chế độ `api`.
  2. Tạo phòng đủ 10 người, chủ phòng ghi nhận kết quả (`POST /api/rooms/:code/result`) để phòng chuyển sang `status: "finished"`, hoặc tất cả thành viên rời phòng.
  3. Mở `/dashboard` hoặc hộp tìm kiếm (`Ctrl+K`) tìm phòng đó, sau đó bấm vào xem trang chi tiết `/rooms/:code`.
- **Thực tế / Mong đợi:**
  - **Thực tế:** Hàm `mapRoom` ép `room.status === 'finished' ? 'live' : room.status`. Do đó trên `/dashboard` (`RoomsTable`) và tìm kiếm, phòng đã kết thúc hiển thị badge **"Đang diễn ra"** và nút **"Theo dõi"**, trong khi trang chi tiết `/rooms/:code` lại hiển thị **"Phòng đã kết thúc"**.
  - **Mong đợi:** Phòng có `status === 'finished'` phải hiển thị nhất quán là **"Đã kết thúc"** ở cả danh sách phòng, tìm kiếm và trang chi tiết (và nút hành động phù hợp là "Xem").
- **File:dòng:**
  - `base-frontend-web/src/api/map.ts:69`
  - `base-frontend-web/src/components/domain/RoomsTable.tsx:23-25`
  - `base-frontend-web/src/lib/room.ts:18-23`
- **Quy tắc bị vi phạm:** Yêu cầu nhất quán dữ liệu giữa các màn hình ("cùng một phòng/giải hiển thị giống nhau ở dashboard, trang chi tiết, tìm kiếm, hồ sơ").

---

### [P2] Bảo mật backend – Tham số đường dẫn `:username` và `:slug` chưa được validate bằng Zod schema ở tầng route

- **Bước tái hiện:**
  1. Gửi `GET /api/users/<chuỗi_bất_kỳ>` hoặc `GET/PATCH /api/tournaments/<chuỗi_bất_kỳ>` với giá trị quá dài hoặc chứa ký tự không hợp lệ.
- **Thực tế / Mong đợi:**
  - **Thực tế:** `routes/users.ts` và `routes/tournaments.ts` đọc trực tiếp `request.params.username` / `request.params.slug` mà không parse qua Zod schema (khác với `rooms.ts`, `registrations.ts`, `tournament-bracket.ts` đều có `ParamsSchema`). (Không bị SQL injection do Drizzle dùng parameterized query.)
  - **Mong đợi:** Validate `Params` bằng Zod schema để trả `400 VALIDATION` sớm cho input sai định dạng/độ dài.
- **File:dòng:**
  - `base-backend-api/src/routes/users.ts:38-43`
  - `base-backend-api/src/routes/tournaments.ts:60-78,91-98`
- **Quy tắc bị vi phạm:** Quy ước validate input đầu vào bằng Zod (`docs/product/API.md` mục 1).

---

### [P2] UX / Nhãn tiếng Việt – Thông báo `404` route không tồn tại ở backend trả về tiếng Anh

- **Bước tái hiện:**
  1. Gửi request tới một endpoint không tồn tại, ví dụ `GET /api/khong-ton-tai`.
- **Thực tế / Mong đợi:**
  - **Thực tế:** Server trả `404` với `{"error":{"code":"NOT_FOUND","message":"Route not found"}}`.
  - **Mong đợi:** Theo `API.md` mục 1, `message` dùng tiếng Việt cho người dùng (vd. `"Không tìm thấy đường dẫn"`).
- **File:dòng:**
  - `base-backend-api/src/app.ts:160-167`
- **Quy tắc bị vi phạm:** `docs/product/API.md` mục 1 (`message`: tiếng Việt cho người dùng).

---

## Kết quả kiểm tra đã chạy

1. **Build, Lint & Unit Tests (`npm run build`, `npm run lint`, `npm test`):**
   - `build`: đạt cả 4 workspace (`team-core`, `contracts`, `api`, `base-frontend-web`).
   - `lint`: 0 lỗi (2 cảnh báo có sẵn ở `AppContext.tsx` đúng như `AGENTS.md`).
   - `test`: `@customaov/team-core` (6/6), `@customaov/contracts` (đạt), `base-frontend-web` (27 file, 132/132 test đạt), `@customaov/api` (16 file, 165/165 test đạt).
2. **Bảo mật backend (đọc code `base-backend-api/src/**`):**
   - CSRF: `auth/plugin.ts` kiểm `validateCsrf` (header == cookie + HMAC gắn `sessionHash ?? 'anon'`) cho mọi `POST/PUT/PATCH/DELETE` dưới `/api/`, cấp lại CSRF khi login/register/logout. Đạt.
   - IDOR & phân quyền: mọi thao tác phòng/giải/đăng ký đều kiểm `hostId` / `organizerId` / `captainId` / `active` membership trong transaction `FOR UPDATE`. Đạt.
   - Phòng private: `GET /api/rooms/:code` trả `restricted: true` (ẩn `teams`, `spectators`, `config`, `lastSplit`, chat) nếu không phải thành viên và không có `key`; `GET/POST /messages` chỉ cho thành viên; `WS /api/ws` kiểm `Origin` (production bắt buộc có trong `ALLOWED_ORIGINS`), giới hạn 5 kết nối khách/IP, 20 phòng/kết nối, kiểm quyền phòng private khi `subscribe`, và không gửi `chat.message` cho người xem bằng `key`. Đạt.
   - Log redaction & lỗi 500: redact `cookie`, `authorization`, `x-csrf-token`, `set-cookie`, `*.password`, `*.token`, `*.csrf`, `*.csrfToken`; custom `req` serializer không log body; lỗi 500 production trả `"Internal Server Error"`, không lộ stack. Đạt.
3. **UX theo `AGENTS.md` ở 375/768/1280/1440 (cả `mock` @ 5211 và `api` @ 5212):**
   - 12 route × 4 khổ × 2 chế độ (96 lượt kiểm tra): `0` tràn ngang (`scrollWidth <= innerWidth`), `0` lỗi console/pageerror, mỗi trang đúng `1` `<h1>`, không có tiêu đề/tab bị cắt `…`, tối đa 1 nút vàng đặc mỗi khung nhìn, nhãn tiếng Việt.
   - Bàn phím & focus (mock): `Tab` đầu tiên vào SkipLink, `Ctrl+K` mở và focus ô tìm kiếm, `Esc` đóng dialog.
   - `ListStatus` (mock): `?mock=loading` hiện skeleton/busy, `?mock=error` hiện nút "Thử lại".
4. **Luồng chính chế độ API (khởi động lại API + seed mới trước mỗi script, `ALLOWED_ORIGINS=http://localhost:5212`):**
   - `node scripts/e2e-auth.mjs http://localhost:5211` (mock): đạt toàn bộ (13/13 kiểm tra).
   - `node scripts/e2e-auth-api.mjs http://localhost:5212`: đạt toàn bộ (5/5 kiểm tra).
   - `node scripts/e2e-rooms-api.mjs http://localhost:5212`: đạt toàn bộ (7/7 bước, gồm WS realtime, chia lại, chat, kick, đổi đội, xuất clipboard, ghi nhận kết quả, cộng `customMatches`).
   - `node scripts/e2e-tournament-api.mjs http://localhost:5212`: đạt toàn bộ (tạo giải 8 đội BO3, đăng ký 8 đội, từ chối đội 9 `409`, duyệt, đóng đăng ký, bốc thăm, nhập tỉ số 7 trận, vô địch, cộng `titles`).
