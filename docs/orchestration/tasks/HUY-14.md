# HUY-14 – Adapter Supabase cho Auth, Profile, Room snapshot và Queue (Linear HUY-14)

- Coder: Codex `gpt-5.6-sol` medium · Reviewer: Lead (khác hãng); Lead tự chạy kiểm chứng thật trên Supabase
- Nhánh `feat/huy-14-supabase-adapters` · Worktree `.worktrees/HUY-14-supabase` · rẽ từ `main` (`c27b468`)
- Cổng: web 5198, API 6198. Không dùng 5173/5174/6174.

## ⚠ Hàng rào riêng của task này
- **KHÔNG gọi mạng tới Supabase.** Không có `.env.local`, không URL/key thật trong code, test hay log. Mọi test dùng client giả (fake Supabase client).
- Supabase thật là Production. Lead sẽ tự kiểm chứng **chỉ đọc**.
- Được **đọc, không ghi** các file sau trong `D:\ProjectCustom` (commit `595a24e`, nhánh `redesign/ui-system`). Không đọc chỗ khác của thư mục đó.
  - `supabaseAuth.js`, `supabaseProfile.js`, `auth-integration.js`
  - `room-api-core.js`, `roomApi.js`, `room-controller.js`
  - `db/migrations/*.sql`, `db/verification/*.sql`
  - `db_script.sql`
- Ngoài các file trên, không đọc/ghi ngoài `D:\CustomAOV\base-workspace`.
- Không push.

## Bối cảnh
- HUY-17 đã gom nguồn dữ liệu về `src/api/`:
  - `sources.ts` chọn nguồn theo từng feature;
  - adapter có các cờ khả năng `persistsWrites`, `supportsRealtime`, `isSampleData`;
  - ESLint cấm import `api/source`, `api/endpoints` từ ngoài `src/api`.
- Xem `docs/product/FRONTEND_BOUNDARIES.md`.

Mô hình phòng của Supabase (Open Room: hàng chờ FIFO, Waiting/Selected, vòng đấu, lineup có `version`) **khác** mô hình phòng của Platform. HUY-14 **không** gộp hai mô hình. Việc của HUY-14 là:
- auth;
- profile;
- đọc snapshot phòng + hàng chờ;
- realtime;
- một khối hiển thị tối thiểu.

## Việc

### 1. Tài liệu hợp đồng: `docs/product/SUPABASE_CONTRACTS.md` (tiếng Việt)
Lấy từ migrations và JS cũ, ghi **chính xác**:
- **Bảng và cột** dùng tới: `profiles`, `game_profiles`, `rooms`, `room_members`, `room_queue_entries`, `room_current_players`.
- **RLS policy** áp lên từng bảng: ai đọc/ghi được gì.
- **Mọi RPC** liên quan Room/Profile:
  - tên, tham số + kiểu, giá trị trả về;
  - `SECURITY DEFINER` / `search_path`, role có quyền `EXECUTE`;
  - lỗi có thể ném (mã/thông điệp `raise exception`, khoá `version`, …).
- **Realtime:** channel `open-room:<roomId>` (theo `room-controller.js`): bảng nào, event nào, filter nào.
- **Cách tính Waiting/Selected và thứ tự FIFO** (`queue_seq`, trạng thái entry). Ghi tham chiếu file:dòng của migration.
- **Ánh xạ** model Supabase ↔ model UI hiện tại; chỗ nào **không có** bên Supabase.
- Failure modes phía client: chưa đăng nhập, phiên anonymous, RLS từ chối, phòng không tồn tại, mạng rớt, token hết hạn.

### 2. Cài và cấu hình
- Thêm `@supabase/supabase-js` vào `base-frontend-web` bằng `npm install --save-exact` (đã được duyệt). Ghi lý do vào ROADMAP/DECISIONS nếu repo có quy ước.
- `.gitignore` gốc đang chặn `.env*`: thêm ngoại lệ `!.env.example`.
- Tạo `base-frontend-web/.env.example` gồm:
  - `VITE_DATA_SOURCE=mock`
  - `VITE_SUPABASE_URL=`
  - `VITE_SUPABASE_ANON_KEY=`

  Để trống giá trị, kèm chú thích. **Không ghi URL thật.**
- `src/api/source.ts`: chấp nhận thêm `supabase`. `vite-env.d.ts` khai báo 2 biến mới.
- `src/api/supabase/client.ts`:
  - tạo client lười (lazy), chỉ khi nguồn là `supabase`;
  - thiếu biến môi trường thì ném lỗi rõ ràng, không in key ra;
  - không tạo client ở chế độ `mock`/`api` (bundle mock không được gọi mạng).

### 3. Nguồn theo feature (`sources.ts`)
Khi `VITE_DATA_SOURCE=supabase`:
- `auth`, `profile`, `rooms` = `supabase`;
- `chat`, `tournaments`, `registrations`, `activities`, `search` = `mock`, với `isSampleData = true`.

Nếu danh sách phòng (landing/dashboard) không có tương đương được RLS cho đọc, thì danh sách phòng giữ mock (sample) và **chỉ chi tiết phòng** dùng Supabase. Ghi rõ trong tài liệu.

Hiển thị nhãn nhỏ **"Dữ liệu mẫu"** ở các khối dùng dữ liệu sample khi nguồn tổng là `supabase`:
- dùng badge có sẵn (ví dụ kiểu `SoonBadge`);
- không làm vỡ layout 375–1440;
- không hiện nhãn ở chế độ `mock` thuần.

### 4. Auth adapter (Supabase)
- **Đăng nhập** `signInWithPassword` (email + mật khẩu). **Đăng xuất** `signOut`.
- **Khôi phục phiên:** `getSession` + `onAuthStateChange`. Đồng bộ nhiều tab do supabase-js lo.
- **Đăng ký:** `signUp`, rồi bước nhập mã OTP `verifyOtp` theo đúng cách `supabaseAuth.js` cũ làm.
- **Phiên anonymous** coi như **khách** (chưa đăng nhập), giống `room-controller.js`.
- **Map sang model `Me` của UI:**
  - username/tên hiển thị lấy từ `profiles`;
  - thiếu thì lấy phần trước `@` của email.
- **`LoginModal` ở chế độ supabase:** form email thay cho username, thêm luồng đăng ký có bước OTP.
  - Chọn component theo khả năng của adapter, không đọc `DATA_SOURCE`.
  - Giữ nguyên `MockLoginModal` và `ApiLoginModal`.
- **Lỗi auth:** sai mật khẩu, email chưa xác minh, quá nhiều lần thử… Map sang thông báo tiếng Việt. Không log email/mật khẩu/token.
- **Đăng xuất phải dọn sạch:** cache dữ liệu (`clearDataCache`), state phòng, subscription realtime.

### 5. Profile adapter
- **Đọc:** `profiles` của user hiện tại + `game_profiles`. Đọc hồ sơ người khác chỉ theo những gì RLS cho phép.
- **Map sang `UserProfile`.** Trường nào không có (KDA, thành tích…) dùng empty state sẵn có, **không bịa số**.
- **Ghi:** cập nhật hồ sơ theo đúng policy `Users Update Own Profile`; đổi game UID chỉ qua RPC `request_game_uid_change`. Viết code + unit test. Lead **không** chạy ghi thật trong HUY-14.

### 6. Room snapshot + Queue adapter
- **Đọc snapshot** theo cách `room-api-core.js` làm: dùng RPC `read_open_room_state` nếu có, nếu không thì đọc 4 bảng.
- Trả về model mới, ví dụ `OpenRoomSnapshot`:
  - room;
  - members;
  - `waiting[]` theo thứ tự FIFO;
  - `selected[]` / current players theo slot;
  - `version`;
  - quyền của người xem.

  Đặt ở `src/api/types.ts` hoặc file riêng. Đừng sửa `packages/contracts` (giữ cho Platform).
- **Route:** `/rooms/:roomId` với `roomId` là UUID, khi `rooms` = supabase thì render **`SupabaseRoomView` tối thiểu**:
  - tiêu đề phòng, trạng thái;
  - danh sách **Đang chờ** (đánh số thứ tự FIFO), **Được chọn** (theo slot);
  - chỉ báo kết nối realtime ("Đang cập nhật trực tiếp" / "Mất kết nối, đang thử lại").
  - Dùng component UI sẵn có, theo quy tắc thiết kế trong AGENTS.md (token, không vàng đặc thừa, `ListStatus` cho loading/lỗi/rỗng, `min-w-0`, `overflow-x-auto`).
- **Chưa có thao tác ghi** (join/leave/start…): thuộc HUY-15. Hiện chữ ngắn "Thao tác phòng sẽ có ở bản sau".
- **Lỗi RLS** (không phải thành viên) hoặc phòng không tồn tại: dùng trạng thái lỗi/empty phù hợp, không lộ dữ liệu.

### 7. Realtime (`supabaseAdapter.realtime`)
- Subscribe channel `open-room:<roomId>` cho các bảng phòng.
- Khi nhận event: **refetch snapshot** (nguồn sự thật = DB), có debounce. Không tự vá state từ payload.
- **Reconnect:**
  - theo dõi trạng thái channel (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`);
  - thử lại theo backoff 1s → 2s → 5s → 10s;
  - **refetch sau mỗi lần subscribe lại** (stale-state recovery).
- **Unsubscribe** (`removeChannel`) khi rời trang, đổi phòng, đăng xuất.
- **Không giữ** snapshot cũ sau khi đăng xuất hoặc đổi user. Có test cho việc này.
- Hook dạng `useOpenRoom(roomId)` trả `{ snapshot, status, connection, retry }`.

### 8. Tài liệu
- Cập nhật `FRONTEND_BOUNDARIES.md`: bảng feature → nguồn ở chế độ supabase.
- README thêm mục ngắn "Chạy với Supabase":
  - chép `.env.example` thành `.env.local`, điền URL + anon key;
  - `VITE_DATA_SOURCE=supabase`;
  - **cảnh báo:** project hiện là Production, chỉ dùng tài khoản test, không thao tác ghi khi chưa có staging.

## Test (unit, client giả)
- **Auth:** login thành công/thất bại, logout dọn cache + subscription, khôi phục phiên, phiên anonymous = khách, đăng ký → bước OTP → verify.
- **Profile:** map `profiles` + `game_profiles` → `UserProfile`; thiếu game profile.
- **Room:**
  - map snapshot → waiting FIFO đúng thứ tự `queue_seq`, selected theo slot;
  - lỗi RLS;
  - phòng không tồn tại.
- **Realtime:**
  - event → refetch (có debounce);
  - mất kết nối → backoff → resubscribe → refetch;
  - unmount → removeChannel;
  - logout → snapshot bị xoá.
- **`SupabaseRoomView`:** render waiting/selected đúng thứ tự, trạng thái kết nối.

Đặt tên test rõ là **unit**, không ghi là "integration". Theo cổng của issue: test mock hay fetch giả không phải bằng chứng tích hợp Supabase.

## Không được
- Gọi mạng tới Supabase.
- Ghi URL, key hay tài khoản thật vào bất kỳ file nào.
- Đổi hành vi chế độ `mock` và `api`. Toàn bộ test, e2e, screenshot hiện có phải giữ xanh.
- Sửa backend, `packages/contracts`, `team-core`, migration.
- Thêm thư viện khác ngoài `@supabase/supabase-js`.
- Làm yếu hay bỏ test.
- Sửa `_old_web_DO_NOT_EDIT/`, `web_backup_*/`.

## Verify (ghi output vào `docs/product/HUY-14_REPORT.md`)
1. Ở gốc:
   - `npm run build`;
   - `npm run lint`: 0 lỗi, tối đa 2 cảnh báo có sẵn;
   - `npm test`: web ≥ 136 + test mới, api 170, contracts 89, team-core 15.
2. Build chế độ supabase với biến giả: `VITE_DATA_SOURCE=supabase VITE_SUPABASE_URL=http://127.0.0.1:9 VITE_SUPABASE_ANON_KEY=dummy npm run build --workspace base-frontend-web`. Phải thành công.
3. **Chế độ mock** (cổng 5198, `npm run dev -- --port 5198 --strictPort` trong `base-frontend-web`):
   - `e2e-auth.mjs`: đạt;
   - `screenshot.mjs huy14 http://localhost:5198`: 40/40.
4. **Chế độ api:** backend `PORT=6198 ALLOWED_ORIGINS=http://localhost:5198`, khởi động lại backend trước mỗi script:
   - `e2e-auth-api`;
   - `e2e-rooms-api` 7/7;
   - `e2e-tournament-api` 14/14.
5. `grep -rnE "supabase\.co|sb_publishable|eyJ" base-frontend-web docs`: không có kết quả (không lọt key/URL thật).
6. Tắt tiến trình của mình theo đúng PID. `git status` sạch sau khi commit.

Commit theo Conventional Commits (`feat(web): …`, `docs: …`), chia commit hợp lý, rồi `orca orchestration send --type worker_done --outcome succeeded|failed`. Báo cáo gồm:
- danh sách file;
- quyết định ánh xạ;
- chỗ còn thiếu bên Supabase;
- output verify.
