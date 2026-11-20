# HUY-13 – Cách ly frontend React và kiểm kê phụ thuộc backend (Linear HUY-13)

- Coder: Codex `gpt-5.6-sol` medium · Reviewer: Lead (khác hãng)
- Nhánh `refactor/huy-13-frontend-isolation` · Worktree `.worktrees/HUY-13-frontend-isolation` · rẽ từ `main` (`00e416d`)
- Cổng dev: web 5195 (mock). Không dùng 5173/5174 (của người dùng).

## Bối cảnh
Nhóm sẽ chuyển backend sang Supabase (issue sau: HUY-14). Issue này **chỉ** làm 3 việc:
- frontend chạy và build độc lập, không cần Fastify hay PGlite;
- kiểm kê mọi chỗ frontend phụ thuộc backend Platform;
- tách bạch mock (dùng khi dev) với kiểm thử backend.

**KHÔNG xoá** `base-backend-api/`, `database/`, `packages/contracts/`, `packages/team-core/`.

## Việc

### 1. Build/dev độc lập
`packages/team-core` và `packages/contracts` export từ `dist/`, mà `dist/` bị gitignore. Kiểm thật trên một bản clone sạch: `git clone` bản worktree vào thư mục tạm **trong** `.worktrees/` (ví dụ `.worktrees/HUY-13-clean`, xoá khi xong), rồi `npm ci`. Sau đó xem mỗi lệnh sau có chạy được không khi chưa build gì:
- `npm run dev:web`
- `npm run build --workspace base-frontend-web`
- `npm test --workspace base-frontend-web`

Nếu lệnh nào lỗi, sửa theo cách **ít xâm lấn nhất**:
- **Ưu tiên:** script `predev`, `prebuild`, `pretest` trong `base-frontend-web/package.json` để build 2 package trước.
- **Chỉ khi cách trên không ổn:** alias `@customaov/*` sang `packages/*/src` cho Vite, Vitest và tsconfig.
- **Không** chép 2 package vào `src/`.

Ghi lại cách đã chọn và lý do.

### 2. Kiểm kê: viết `docs/product/FRONTEND_BOUNDARIES.md` (tiếng Việt)

a. **Bảng REST.** Mỗi endpoint mà `src/api/endpoints.ts` và `client.ts` gọi, có các cột:
   - method + path;
   - hàm FE gọi tới;
   - các file/trang dùng hàm đó;
   - hành vi ở chế độ mock;
   - **ranh giới thay thế đề xuất**: Supabase Auth / bảng + RLS / RPC / Edge Function / bỏ.

b. **Auth và session:**
   - cookie `sid` và CSRF (`X-CSRF-Token`);
   - `AppContext.tsx`;
   - khoá `localStorage` của mock;
   - đề xuất thay bằng Supabase Auth.

c. **WebSocket `/api/ws`:**
   - các message nhận và gửi (theo `src/api/realtime.ts` và `packages/contracts`);
   - nơi dùng;
   - đề xuất thay bằng Supabase Realtime channel.

d. **Công tắc `DATA_SOURCE`.** Liệt kê **mọi** chỗ kiểm `DATA_SOURCE` ngoài `source.ts`. Hiện có khoảng 59 chỗ trong 13 file, đếm lại cho chính xác. Mỗi dòng ghi file:dòng và việc nó làm.
   - Kết luận ranh giới đúng cho một adapter thứ ba (`supabase`) cạnh `mock`/`api`.
   - Đề xuất cách gom các nhánh này về sau interface ở `src/api/adapter.ts`.
   - **Chỉ đề xuất, không refactor trong issue này.**

e. **Shared packages:**
   - `team-core`: giữ, vì chia đội chạy phía client;
   - `contracts`: liệt kê schema/kiểu FE đang dùng, và nêu 2 phương án (giữ zod làm domain model, hoặc thay bằng type Supabase sinh ra) kèm ưu/nhược. Để Owner quyết.

f. **Dev proxy** `/api` → 6174 trong `vite.config.ts`, và biến `API_TARGET`.

g. **Kế hoạch lưu trữ backend** (chỉ viết, không làm):
   - tag hoặc nhánh `archive/platform-backend` trước khi xoá;
   - danh sách thư mục và script ở gốc sẽ phải gỡ (`dev:all`, `dev:api`, `e2e-*-api.mjs`, CI…);
   - điều kiện được xoá (HUY-14 thay xong và có e2e trên Supabase).

### 3. Tách bạch mock và kiểm backend
- `dev:web` vẫn mặc định mock.
- Trong `base-frontend-web/package.json`:
  - các script e2e cần backend (`test:e2e:api`, `test:e2e:tournament`, `test:e2e:rooms`) giữ nguyên tên;
  - thêm `test:e2e:mock` làm alias của `test:e2e` hiện tại. **Không đổi tên script cũ**, vì README, CONTRIBUTING và AGENTS.md đang trỏ tới.
- README gốc thêm mục ngắn "Chỉ chạy frontend": `npm ci && npm run dev:web`, nói rõ đây là mock. Ghi chú: `e2e-*-api` là kiểm backend và cần `dev:all`.
- CI giữ nguyên (không chạy e2e).

## Không được
- Xoá hay đổi hành vi code backend, migration hay package.
- Refactor 59 chỗ `DATA_SOURCE`, hay đổi hành vi UI.
- Thêm thư viện.
- Sửa `_old_web_DO_NOT_EDIT/`, `web_backup_*/`.
- Đọc/ghi ngoài `D:\CustomAOV\base-workspace`.
- Push.
- Làm yếu hay bỏ test.

## Verify (ghi output vào báo cáo)
1. Clone sạch → `npm ci` → 3 lệnh ở mục 1 đều chạy được, không build tay gì trước. Với `dev:web`: `curl` được trang trên cổng 5195 rồi tắt **đúng PID của mình**.
2. Ở gốc worktree:
   - `npm run build`;
   - `npm run lint` (0 lỗi; 2 cảnh báo có sẵn là chấp nhận được);
   - `npm test` (web ≥ 135, api 170, contracts 89, team-core 15).
3. Dev server mock ở cổng 5195, rồi chạy:
   - `npm run test:e2e:mock` với `BASE_URL`/tham số trỏ 5195 (xem cách script đọc URL);
   - `node scripts/screenshot.mjs huy13 http://localhost:5195`: 40/40 đạt.
4. Xoá clone tạm. `git status` sạch sau khi commit.

Commit (Conventional Commits, `refactor(web): …` / `docs: …`), rồi `orca orchestration send --type worker_done --outcome succeeded|failed`. Báo cáo gồm:
- cách đã chọn ở mục 1;
- số chỗ `DATA_SOURCE` đếm được;
- danh sách file đã sửa;
- output verify.
