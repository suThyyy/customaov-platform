---
description: Checklist review code backend và bảo mật trước khi tạo commit hoặc mở PR
---

# Code Review Checklist (Backend customAOV)

**Danh sách kiểm tra bắt buộc khi tự review hoặc review chéo mã nguồn backend**

## 1. Hợp đồng & Định dạng Dữ liệu
- [ ] **Nguồn chân lý**: Toàn bộ dữ liệu vào (params, query, body) và dữ liệu ra đều sử dụng schema Zod và types từ `@customaov/contracts`. Không có interface trùng lặp tự chế.
- [ ] **Định dạng lỗi**: Toàn bộ phản hồi lỗi tuân theo cấu trúc `{ error: { code, message, details? } }` với mã `code` thuộc danh mục chuẩn trong `docs/product/API.md` (`VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `CSRF`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`).
- [ ] **Phân trang**: Trả về đúng 4 trường `{ items, total, page, pageSize }`.

## 2. Bảo mật (Checklist Owner & Lead phê duyệt - API.md Mục 2 & 9)
- [ ] **CSRF Token Ký và Gắn Phiên**:
  - Token có cấu trúc `nonce + '.' + HMAC_SHA256(CSRF_SECRET, nonce + ':' + (sessionIdHash ?? 'anon'))`.
  - Mọi request ghi (`POST`, `PUT`, `PATCH`, `DELETE`) đều kiểm tra:
    1. Header `X-CSRF-Token` khớp cookie `csrf` qua `timingSafeEqual()`.
    2. Chữ ký HMAC hợp lệ và khớp với phiên hiện tại (`sessionIdHash ?? 'anon'`) qua `timingSafeEqual()`.
  - Cấp cookie `csrf` mới khi login/logout. Thêm cờ `Secure` khi chạy production.
  - `GET /api/auth/me` tự động đặt cookie `csrf` nếu chưa có.
- [ ] **Phiên làm việc**: Cookie `sid` có cờ `HttpOnly; SameSite=Lax` (và `Secure` trên production). CSDL chỉ lưu chuỗi băm SHA-256 của token.
- [ ] **Mật khẩu**: Băm bằng `scrypt` kèm salt ngẫu nhiên 16 byte. So sánh hash bằng `crypto.timingSafeEqual()`.
- [ ] **Rate Limiting**:
  - Login: 5 lần/phút theo IP **và** 10 lần/15 phút theo cặp IP+username.
  - Register: 5 lần/giờ theo IP.
  - Chat phòng: 10 tin/10 giây/người dùng.
  - Join phòng: 10 lần/phút/người dùng.
  - Request ghi khác: 60 lần/phút/người dùng.
- [ ] **Log Redaction**:
  - Logger đã cấu hình tự động ẩn `cookie`, `set-cookie`, `authorization`, `x-csrf-token`, `password`, `token`.
  - Tuyệt đối **không log request body** của các route `/api/auth/*`.
  - Không để lộ stack trace ra ngoài ở môi trường production.
- [ ] **WebSocket an toàn**:
  - Route `/api/ws` chỉ đẩy server → client. Mọi thao tác ghi qua HTTP REST.
  - Production: bắt buộc từ chối kết nối nếu thiếu header `Origin` hoặc Origin không nằm trong `ALLOWED_ORIGINS`.
  - Giới hạn: tối đa 5 kết nối/IP cho khách; tối đa 20 phòng subscribe/kết nối.
  - Subscribe phòng private: áp đúng luật xem (phải là thành viên hoặc có key đúng, nếu không server gửi lỗi `FORBIDDEN`). Khán giả có key không nhận tin chat.

## 3. Kiến trúc Service & Cơ sở dữ liệu
- [ ] **Hàm `buildApp()`**: Không gọi `app.listen()` trong `src/app.ts`. Chỉ gọi `listen()` tại `src/server.ts`.
- [ ] **Tầng Service**: Logic nghiệp vụ thuần, nhận tham số `db`.
- [ ] **Transaction & Khóa dòng**:
  - Mọi thao tác đồng thời thay đổi phòng hoặc giải đấu (`join`, `leave`, `move`, `kick`, `split`, `result`, `registrations`, `draw`, `score`) bắt buộc nằm trong transaction và khóa dòng bằng `SELECT ... FOR UPDATE` (Drizzle: `.for('update')`).
- [ ] **Chặn theo trạng thái & Ràng buộc**:
  - Cấm kick chính mình (400, phải dùng leave).
  - Cấm mọi thao tác ghi trên phòng đã `finished` (409).
  - Kết quả trận đấu (`result`): chỉ khi đủ 10 người và chưa có kết quả (409 nếu gọi lại).
  - Duyệt đội: chỉ khi giải `open` và chưa đủ `teamCount` (409).
  - Nhập tỉ số cho trận chưa đủ đội (TBD) → 409.
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
