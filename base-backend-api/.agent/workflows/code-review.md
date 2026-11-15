---
description: Checklist review code backend và bảo mật trước khi tạo commit hoặc mở PR
---

# Code Review Checklist (Backend customAOV)

**Danh sách kiểm tra bắt buộc khi tự review hoặc review chéo mã nguồn backend**

## 1. Hợp đồng & Định dạng Dữ liệu
- [ ] **Nguồn chân lý**: Toàn bộ dữ liệu vào (params, query, body) và dữ liệu ra đều sử dụng schema Zod và types từ `@customaov/contracts`. Không có interface trùng lặp tự chế.
- [ ] **Định dạng lỗi**: Toàn bộ phản hồi lỗi tuân theo cấu trúc `{ error: { code, message, details? } }` với mã `code` thuộc danh mục chuẩn trong `docs/product/API.md` (`VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `CSRF`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`).
- [ ] **Phân trang**: Trả về đúng 4 trường `{ items, total, page, pageSize }`.

## 2. Bảo mật (Checklist Owner phê duyệt)
- [ ] **CSRF Token**: Mọi request ghi (`POST`, `PUT`, `PATCH`, `DELETE`) đều kiểm tra header `X-CSRF-Token` khớp với cookie `csrf` thông qua `crypto.timingSafeEqual()`.
- [ ] **Phiên làm việc**: Cookie `sid` có cờ `HttpOnly; SameSite=Lax` (và `Secure` trên production). CSDL chỉ lưu chuỗi băm SHA-256 của token.
- [ ] **Mật khẩu**: Băm bằng `scrypt` kèm salt ngẫu nhiên 16 byte. So sánh hash bằng `crypto.timingSafeEqual()`.
- [ ] **Rate Limiting**: Đã gắn rate limit cho đăng nhập, đăng ký và gửi tin nhắn chat trong phòng.
- [ ] **Log Redaction**:
  - Logger đã cấu hình tự động ẩn `cookie`, `set-cookie`, `authorization`, `x-csrf-token`, `password`, `token`.
  - Tuyệt đối **không log request body** của các route `/api/auth/*`.
  - Không để lộ stack trace ra ngoài ở môi trường production.
- [ ] **WebSocket an toàn**: Route `/api/ws` chỉ đẩy server → client, có kiểm tra header `Origin` thuộc danh sách `ALLOWED_ORIGINS` và kiểm tra cookie `sid`.

## 3. Kiến trúc Service & Cơ sở dữ liệu
- [ ] **Hàm `buildApp()`**: Không gọi `app.listen()` trong `src/app.ts`. Chỉ gọi `listen()` tại `src/server.ts`.
- [ ] **Tầng Service**: Logic nghiệp vụ thuần, nhận tham số `db`.
- [ ] **Transaction**: Mọi thao tác ghi dữ liệu từ 2 bảng trở lên đều được bao bọc trong `db.transaction(async (tx) => { ... })`.
- [ ] **Chia đội phòng**: Bắt buộc sử dụng hàm `splitTeams5v5` từ `@customaov/team-core`, không tự viết lại thuật toán.
- [ ] **Schema CSDL**: Bảng và cột đặt tên `snake_case`, khóa chính `id uuid`, thời gian `created_at timestamptz`. Không sử dụng extension PostgreSQL.
- [ ] **Ghi nhận DECISIONS.md**: Nếu có migration hoặc thay đổi schema, đã ghi nhật ký vào `docs/orchestration/DECISIONS.md`.

## 4. Kiểm thử tự động (Testing)
- [ ] **Phương thức test**: Sử dụng Vitest kết hợp `app.inject()`. Không mở port mạng trong test.
- [ ] **CSDL Test**: Sử dụng PGlite `memory://` để đảm bảo test chạy độc lập và không phụ thuộc dịch vụ ngoài.
- [ ] **Ma trận test**: Mỗi endpoint đều có tối thiểu 3 nhóm test:
  1. Thành công (200 / 201).
  2. Lỗi xác thực / phân quyền (401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 403 `CSRF`).
  3. Lỗi validation (400 `VALIDATION`).
- [ ] Lệnh kiểm tra chạy qua:
  ```bash
  npm run typecheck
  npm test
  ```
