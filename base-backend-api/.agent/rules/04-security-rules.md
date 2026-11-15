---
trigger: always_on
---
# Security Rules (Bảo mật backend)

**Quy chuẩn bảo mật bắt buộc đã được Owner phê duyệt cho customAOV**

## 1. Phiên làm việc & Cookie `sid`
- **Tạo token phiên**: Token phiên là chuỗi 32 byte ngẫu nhiên an toàn mã hoá sinh từ `crypto.randomBytes(32).toString("base64url")`.
- **Lưu trữ CSDL**: Bảng `sessions` trong CSDL chỉ lưu **SHA-256** của token (`crypto.createHash("sha256").update(token).digest("hex")`), tuyệt đối không lưu token gốc.
- **Thuộc tính Cookie**:
  - Tên cookie: `sid`.
  - Cấu hình: `HttpOnly; SameSite=Lax; Path=/`.
  - Thuộc tính `Secure`: Bắt buộc bật khi `NODE_ENV === "production"`.
  - Thời hạn: 30 ngày, cơ chế trượt (sliding window): tự động gia hạn khi thời gian còn lại dưới 15 ngày.

## 2. Phòng chống CSRF (Double-Submit Token)
- **Cơ chế**: Sử dụng mô hình Double-Submit Token đã duyệt:
  - Máy chủ cấp cookie `csrf`: Chuỗi ngẫu nhiên 32 byte, `SameSite=Lax; Path=/`, **KHÔNG đặt `HttpOnly`** để client JS (frontend) có thể đọc được.
  - Client gửi header `X-CSRF-Token`: Giá trị phải bằng chính xác cookie `csrf`.
- **Mọi request ghi**: Bắt buộc áp dụng cho mọi phương thức thay đổi trạng thái (`POST`, `PUT`, `PATCH`, `DELETE`).
- **So sánh an toàn thời gian**: Kiểm tra bằng `crypto.timingSafeEqual()` để tránh tấn công timing attack.
- Nếu thiếu hoặc sai token: Lập tức từ chối với HTTP 403 `CSRF`.
- Client lấy token qua `GET /api/auth/csrf` trước khi thực hiện login/register.

```typescript
import crypto from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

export function verifyCsrf(request: FastifyRequest, reply: FastifyReply): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return true;
  }
  const cookieToken = request.cookies.csrf;
  const headerToken = request.headers["x-csrf-token"];

  if (!cookieToken || typeof headerToken !== "string") {
    reply.status(403).send({
      error: { code: "CSRF", message: "Thiếu CSRF token hợp lệ" },
    });
    return false;
  }

  const bufA = Buffer.from(cookieToken);
  const bufB = Buffer.from(headerToken);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    reply.status(403).send({
      error: { code: "CSRF", message: "CSRF token không khớp" },
    });
    return false;
  }

  return true;
}
```

## 3. Băm mật khẩu (scrypt)
- **Thuật toán**: Sử dụng `node:crypto` `scrypt` với tham số chuẩn:
  - `N = 32768` (2^15), `r = 8`, `p = 1`, `keylen = 64`.
  - Salt ngẫu nhiên 16 byte (`crypto.randomBytes(16)`).
- **Định dạng lưu trữ**: `scrypt$32768$8$1$<salt_hex>$<hash_hex>`.
- **Kiểm tra mật khẩu**: Băm mật khẩu nhập vào với cùng salt và tham số, sau đó so sánh bằng `crypto.timingSafeEqual()`.

## 4. Giới hạn tần suất (Rate Limiting)
Sử dụng plugin `@fastify/rate-limit` với ngưỡng nghiêm ngặt:
- **Đăng nhập / Đăng ký (`/api/auth/login`, `/api/auth/register`)**:
  - Tối đa 5 lần / phút theo địa chỉ IP.
  - Tối đa 10 lần / 15 phút theo tên tài khoản `username`.
- **Gửi tin nhắn phòng (`POST /api/rooms/:code/messages`)**: Tối đa 10 tin / 10 giây / người dùng.
- **Các request ghi khác**: Tối đa 60 lần / phút / người dùng.
- Vượt ngưỡng: Trả về HTTP 429 `RATE_LIMITED`.

## 5. Che giấu nhật ký (Log Redaction)
- **Trường nhạy cảm tự động che**: Bộ logger của Fastify cấu hình redact các trường:
  - Headers: `req.headers.cookie`, `req.headers.authorization`, `req.headers["x-csrf-token"]`.
  - Response headers: `res.headers["set-cookie"]`.
  - Body & Objects: Mọi trường `password`, `token`, `csrf`.
- **CẤM**: Tuyệt đối **không log request body** của toàn bộ các route `/api/auth/*` (login, register, reset).
- **Môi trường Production**: Không gửi error stack trace về client. Chỉ trả về thông điệp chung với mã `INTERNAL`.

## 6. Realtime WebSocket an toàn (`/api/ws`)
- **Một chiều (Server → Client)**: WebSocket chỉ dùng để đẩy sự kiện thời gian thực từ máy chủ xuống client (cập nhật phòng, tin chat mới). Mọi thao tác ghi phải gửi qua HTTP REST để đi qua đầy đủ xác thực, phân quyền và kiểm tra CSRF.
- **Kiểm tra Origin**: Khi nhận yêu cầu nâng cấp kết nối (HTTP Upgrade), bắt buộc kiểm tra header `Origin` nằm trong danh sách `ALLOWED_ORIGINS` đã cấu hình.
- **Kiểm tra phiên**: Xác thực cookie `sid` hợp lệ khi kết nối.
