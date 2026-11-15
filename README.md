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

## Cài đặt

Chạy lệnh cài đặt toàn bộ dependencies cho tất cả workspaces từ thư mục gốc:

```sh
npm ci
```

## Các lệnh chính (Scripts)

Chạy từ thư mục gốc:

| Lệnh | Mô tả |
| --- | --- |
| `npm run build` | Build tất cả package theo thứ tự: `@customaov/team-core` → `@customaov/contracts` → `@customaov/api` → `base-frontend-web`. |
| `npm run lint` | Chạy ESLint cho frontend và typecheck (`tsc --noEmit`) cho `team-core`, `contracts`, `api`. |
| `npm test` | Chạy unit test của cả 4 package (`team-core`, `contracts`, frontend, `api`). |
| `npm run test:e2e` | Chạy bộ kiểm thử E2E xác thực cho frontend. |
| `npm run dev:api` | Khởi chạy dev server của backend API (Fastify với `tsx watch`). |
| `npm run dev:web` | Khởi chạy dev server của frontend (Vite). |

## Hướng dẫn chạy 2 server ở 2 terminal

Để phát triển đầy đủ cả frontend và backend, mở 2 terminal độc lập tại thư mục gốc của repository:

### Terminal 1: Backend API
```sh
npm run dev:api
```
Backend API sẽ lắng nghe tại `http://localhost:6174` (hoặc cổng được cấu hình qua biến môi trường `PORT`).

### Terminal 2: Frontend Web
```sh
npm run dev:web
```
Frontend Vite dev server sẽ khởi chạy tại `http://localhost:5174` (hoặc cổng cấu hình).
