# customAOV

Monorepo cho hệ thống customAOV (tạo phòng, chia đội 5v5, tổ chức giải đấu Liên Quân Mobile).

## Cấu trúc repo

- `base-frontend-web/`: Ứng dụng web React 19 + Vite + Tailwind CSS v4 (`web`).
- `base-backend-api/`: Backend API Fastify + TypeScript (`@customaov/api`).
- `packages/team-core/`: Thư viện thuật toán chia đội 5v5 (`@customaov/team-core`).
- `packages/contracts/`: Zod schemas và API contracts dùng chung giữa frontend và backend (`@customaov/contracts`).
- `database/`: Migration scripts cho cơ sở dữ liệu.
- `docs/`: Tài liệu nghiệp vụ, đặc tả kỹ thuật và orchestration.

## Yêu cầu môi trường

- **Node.js**: >= 22 (khuyến nghị Node 22 LTS).
- **npm**: Đi kèm với Node.js 22.
- **Docker** *(tuỳ chọn)*: Cần khi chạy hoặc kiểm thử với PostgreSQL 17 qua `docker-compose.yml`.

## Chạy nhanh

Cài đặt dependencies và khởi chạy cả backend API (PGlite file tại `base-backend-api/.data/pglite`, tự động migrate và seed nếu CSDL trống) lẫn frontend web (chế độ `VITE_DATA_SOURCE=api`) bằng một lệnh từ thư mục gốc:

```sh
npm ci && npm run dev:all
```

- Frontend Web: `http://localhost:5174`
- Backend API: `http://127.0.0.1:6174` (Vite proxy `/api` tới `API_TARGET`)
- Bấm `Ctrl+C` để tắt cả hai tiến trình.

### Chỉ chạy frontend

Frontend có thể cài đặt và chạy độc lập, không cần khởi động Fastify hay PGlite:

```sh
npm ci && npm run dev:web
```

Lệnh này mặc định dùng dữ liệu mock. Các script `e2e-*-api.mjs` là kiểm thử backend thật và cần chạy `npm run dev:all`.

### Tài khoản demo

Dữ liệu mẫu sau khi seed bao gồm tài khoản demo:

- **Tên đăng nhập**: `suthy`
- **Mật khẩu**: `customaov123`

## Các lệnh chính (Scripts)

Chạy từ thư mục gốc:

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev:all` | Khởi chạy đồng thời backend API (PGlite, tự seed nếu DB trống) và frontend web ở chế độ API. |
| `npm run dev:api` | Khởi chạy riêng dev server của backend API (Fastify với `tsx watch`). |
| `npm run dev:web` | Khởi chạy riêng dev server của frontend (Vite, mặc định dữ liệu mock). |
| `npm run build` | Build tất cả package theo thứ tự: `@customaov/team-core` → `@customaov/contracts` → `@customaov/api` → `base-frontend-web`. |
| `npm run lint` | Chạy ESLint cho frontend và typecheck (`tsc --noEmit`) cho `team-core`, `contracts`, `api`. |
| `npm test` | Chạy unit test của cả 4 package (`team-core`, `contracts`, frontend, `api`). |
| `npm run test:e2e` | Chạy bộ kiểm thử E2E xác thực (mock mode) cho frontend. |
| `npm run test:e2e:mock --workspace base-frontend-web` | Alias tường minh của `test:e2e`; chỉ cần dev server frontend mock. |

## Chạy test và E2E

### Unit & integration test

```sh
npm run build && npm run lint && npm test
```

### E2E với backend API thật

Bộ E2E API nằm trong `base-frontend-web/scripts/`:
- `npm run test:e2e:api --workspace base-frontend-web`
- `npm run test:e2e:tournament --workspace base-frontend-web`
- `npm run test:e2e:rooms --workspace base-frontend-web`

> **Lưu ý:** Rate limit của backend lưu trong bộ nhớ (`@fastify/rate-limit`), nên **mỗi script E2E API cần chạy trên một backend vừa khởi động** (khởi động lại backend hoặc dùng instance mới giữa các script để tránh dính giới hạn tần suất).

## Chạy với Postgres

Repo cung cấp sẵn `docker-compose.yml` chạy PostgreSQL 17 ở cổng `54329`:

```sh
# 1. Khởi động Postgres
docker compose up -d

# 2. Chạy migration và seed dữ liệu mẫu lên Postgres
DATABASE_URL=postgres://customaov:customaov@127.0.0.1:54329/customaov npm run db:migrate --workspace @customaov/api
DATABASE_URL=postgres://customaov:customaov@127.0.0.1:54329/customaov npm run db:seed --workspace @customaov/api

# 3. Chạy app dùng Postgres
DATABASE_URL=postgres://customaov:customaov@127.0.0.1:54329/customaov npm run dev:all

# 4. Chạy toàn bộ test backend trên Postgres thật
TEST_DATABASE_URL=postgres://customaov:customaov@127.0.0.1:54329/customaov npm test --workspace @customaov/api

# 5. Dừng Postgres khi xong
docker compose down
```

*(Trên Windows PowerShell, đặt biến môi trường bằng `$env:DATABASE_URL="..."` hoặc `$env:TEST_DATABASE_URL="..."` trước lệnh.)*

> **Lưu ý:** Chưa chạy kiểm chứng trên Postgres ở lần này do Docker daemon chưa bật trong môi trường thực thi.

## Biến môi trường

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `DATABASE_URL` | `./.data/pglite` (`memory://` khi `NODE_ENV=test`) | Chuỗi kết nối PostgreSQL (`postgres://...`) hoặc đường dẫn PGlite. |
| `CSRF_SECRET` | Ngẫu nhiên mỗi lần khởi động ở dev/test | Khoá bí mật ký HMAC cho CSRF token (**bắt buộc** trong production, tối thiểu 16 ký tự). |
| `ALLOWED_ORIGINS` | `http://localhost:5174,http://localhost:5173` | Danh sách origin được phép kết nối WebSocket `/api/ws` (phân tách bằng dấu phẩy). |
| `NODE_ENV` | `development` | Môi trường chạy (`development`, `test`, `production`). Ở `production`, server không tự chạy migration khi khởi động và từ chối chạy `db:seed`. |
| `TEST_DATABASE_URL` | *(không đặt → dùng PGlite `memory://`)* | Khi đặt, bộ test backend chạy trên PostgreSQL thay vì PGlite (truncate toàn bộ bảng trước mỗi test case). |

## Đóng góp

Xem hướng dẫn quy trình nhánh, quy tắc code và kiểm tra trước khi mở PR tại [CONTRIBUTING.md](CONTRIBUTING.md).
