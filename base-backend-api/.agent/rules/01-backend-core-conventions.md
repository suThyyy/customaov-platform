---
trigger: always_on
---
# Backend Core Conventions

**Quy ước cốt lõi phát triển backend customAOV**

## 1. Tech Stack chuẩn
- **Ngôn ngữ & Runtime**: TypeScript 5+ ở chế độ strict mode, Node.js 22 LTS, ECMAScript Modules (ESM: `"type": "module"` trong `package.json`).
- **Web Framework**: Fastify 5.
- **Hợp đồng dữ liệu**: `@customaov/contracts` (Zod schemas và TypeScript types tập trung).
- **Truy cập CSDL**: Drizzle ORM kết hợp PostgreSQL (production) và PGlite (dev/test).
- **Thuật toán đội hình**: `@customaov/team-core`.
- **Test Runner**: Vitest.

## 2. Kiến trúc ứng dụng & Hàm `buildApp()`
Ứng dụng tách biệt rõ ràng giữa việc xây dựng cấu hình ứng dụng (`buildApp`) và việc lắng nghe cổng mạng (`server.ts`):

- **`src/app.ts`**: Chứa hàm `buildApp(opts)`. Hàm này khởi tạo instance `FastifyInstance`, đăng ký plugins (cookie, rate-limit, websocket...), routes, hooks, error handler.
  - **CẤM**: Tuyệt đối **KHÔNG gọi `app.listen()`** bên trong `buildApp()`.
  - **Lý do**: Cho phép kiểm thử tự động cực nhanh thông qua `app.inject()` mà không cần cấp phát cổng mạng thực tế.
- **`src/server.ts`**: Điểm khởi chạy runtime thực tế của ứng dụng (production và dev server). Đọc cấu hình từ `src/config.ts`, gọi `buildApp()`, và chỉ tại đây mới gọi `await app.listen({ host, port })`.
- **`src/config.ts`**: Quản lý tập trung mọi biến môi trường (`PORT`, `HOST`, `LOG_LEVEL`, `NODE_ENV`, v.v.), có giá trị fallback an toàn và validate chặt chẽ.

```typescript
// Ví dụ src/app.ts (chuẩn của repo)
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { loadConfig, type AppConfig } from "./config.js";

export interface BuildAppOptions {
  config?: AppConfig;
  logger?: boolean;
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
  const config = opts.config ?? loadConfig();
  const app = Fastify({
    logger: opts.logger === false ? false : { level: config.LOG_LEVEL },
  });

  app.register(cookie);

  // Đăng ký routes tại src/routes/
  // app.register(roomRoutes, { prefix: "/api/rooms" });

  return app;
}
```

## 3. Hợp đồng dữ liệu (@customaov/contracts)
- **Nguồn chân lý duy nhất**: Mọi kiểu dữ liệu cho request body, query params, path params, response payloads đều phải lấy từ package `@customaov/contracts`.
- **CẤM**: Không tự ý khai báo interface hoặc Zod schema trùng lặp trong backend.
- **Quy trình thay đổi API**: Khi cần thêm hoặc thay đổi trường trong request/response:
  1. Cập nhật tài liệu thiết kế tại `docs/product/API.md`.
  2. Cập nhật Zod schema và type tương ứng trong `packages/contracts/src/`.
  3. Chạy test của contracts để đảm bảo hợp đồng hợp lệ.
  4. Import vào backend routes/services để sử dụng.

```typescript
// ✅ ĐÚNG: Sử dụng schema và types từ @customaov/contracts
import {
  CreateRoomBodySchema,
  type CreateRoomBody,
  RoomDetailSchema,
  type RoomDetail,
} from "@customaov/contracts";

// ❌ SAI: Tự khai báo interface nội bộ trùng lặp
interface CreateRoomRequest {
  title: string;
  mode: string;
}
```

## 4. Quy ước Module & Import trong ESM
- Vì dự án cấu hình ESM (`NodeNext` / `"type": "module"`), mọi import nội bộ giữa các file TypeScript phải có phần mở rộng đuôi `.js`:
  ```typescript
  // ✅ ĐÚNG
  import { loadConfig } from "./config.js";
  import { roomService } from "./services/roomService.js";

  // ❌ SAI
  import { loadConfig } from "./config";
  import { roomService } from "./services/roomService.ts";
  ```

## 5. Quy ước đặt tên
- **Thư mục & File**: `kebab-case` hoặc `camelCase` nhất quán (ví dụ: `src/routes/rooms.ts`, `src/services/roomService.ts`).
- **Hàm & Biến**: `camelCase` (ví dụ: `buildApp`, `createRoom`, `activeSessions`).
- **Types & Interfaces**: `PascalCase` (ví dụ: `AppConfig`, `RoomMemberSummary`).
- **Hằng số**: `UPPER_SNAKE_CASE` (ví dụ: `DEFAULT_PORT`, `SESSION_COOKIE`).
- **Bảng CSDL & Cột**: `snake_case` (ví dụ: `room_members`, `created_at`, `token_hash`).
