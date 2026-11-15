---
trigger: glob
globs: src/**/*.test.ts
---
# Testing Rules (Quy chuẩn kiểm thử backend)

**Quy chuẩn viết test tự động với Vitest, Fastify inject và PGlite in-memory**

## 1. Công nghệ kiểm thử
- **Test Runner**: Vitest (đồng bộ với frontend và toàn bộ monorepo).
- **Kiểm thử API không cần mở port**: Sử dụng phương thức `app.inject()` của Fastify. Không gọi `listen()`, giúp test chạy siêu nhanh và hoàn toàn cô lập.
- **CSDL kiểm thử**: Sử dụng PGlite với URI `memory://`. Mỗi test suite hoặc test case có thể sở hữu một database instance riêng biệt trong bộ nhớ, không ảnh hưởng lẫn nhau và tự dọn sạch sau khi test kết thúc.

## 2. Ma trận kiểm thử bắt buộc cho mỗi Endpoint
Mỗi API endpoint khi hiện thực bắt buộc phải có tối thiểu 3 nhóm kiểm thử sau:
1. **Case thành công (200 / 201)**:
   - Gửi dữ liệu hợp lệ và xác thực hợp lệ.
   - Kiểm tra mã HTTP trả về đúng (200 OK hoặc 201 Created).
   - Kiểm tra cấu trúc payload phản hồi khớp hoàn toàn với schema trong `@customaov/contracts`.
2. **Case lỗi xác thực & phân quyền (401 / 403)**:
   - 401 `UNAUTHENTICATED`: Khi không có cookie `sid` hoặc session không tồn tại / hết hạn.
   - 403 `FORBIDDEN`: Khi người dùng không đủ quyền hạn (ví dụ không phải chủ phòng cố chia đội, khán giả cố gửi chat, người không phải BTC cố duyệt giải).
   - 403 `CSRF`: Với các request ghi khi thiếu header `X-CSRF-Token` hoặc token không khớp cookie `csrf`.
3. **Case lỗi kiểm tra dữ liệu đầu vào (400 `VALIDATION`)**:
   - Gửi body, query params hoặc path params sai định dạng (ví dụ username có ký tự đặc biệt, password quá ngắn, thiếu trường bắt buộc).
   - Kiểm tra mã lỗi trả về đúng chuẩn `{ error: { code: "VALIDATION", message, details } }`.

## 3. Code mẫu Test hoàn chỉnh
```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

describe("POST /api/rooms", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Khởi tạo app với cấu hình test và mock/in-memory DB
    app = buildApp({
      logger: false,
      config: {
        HOST: "127.0.0.1",
        PORT: 6174,
        LOG_LEVEL: "silent",
        NODE_ENV: "test",
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("1. Tạo phòng thành công (201 Created)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      cookies: {
        sid: "mock-valid-session-token",
        csrf: "csrf-token-123",
      },
      headers: {
        "x-csrf-token": "csrf-token-123",
      },
      payload: {
        title: "Kèo 5v5 Giao Hữu",
        mode: "normal",
        visibility: "public",
        config: {
          format: "5v5",
          pickMode: "draft",
          series: "BO1",
          tools: ["balance", "chat"],
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toHaveProperty("code");
    expect(body.title).toBe("Kèo 5v5 Giao Hữu");
    expect(body.status).toBe("waiting");
  });

  it("2. Từ chối khi chưa đăng nhập (401 UNAUTHENTICATED)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { title: "Phòng Test", mode: "normal" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: expect.any(String),
      },
    });
  });

  it("3. Từ chối khi sai CSRF token (403 CSRF)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      cookies: { sid: "valid-session", csrf: "csrf-token-123" },
      headers: { "x-csrf-token": "wrong-csrf-token" },
      payload: { title: "Phòng Test", mode: "normal" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("CSRF");
  });

  it("4. Báo lỗi dữ liệu đầu vào không hợp lệ (400 VALIDATION)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      cookies: { sid: "valid-session", csrf: "csrf-token-123" },
      headers: { "x-csrf-token": "csrf-token-123" },
      payload: {
        title: "", // Tiêu đề rỗng sai schema
        mode: "invalid-mode",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION");
  });
});
```
