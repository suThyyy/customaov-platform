---
trigger: always_on
---
# Security Rules (Bảo mật backend)

**Quy chuẩn an toàn thông tin bắt buộc đã được Owner và Lead phê duyệt (API.md Mục 2 & Mục 9)**

## 1. Phiên làm việc & Cookie `sid`
- **Tạo token phiên**: Token phiên là chuỗi 32 byte ngẫu nhiên an toàn mã hoá sinh từ `crypto.randomBytes(32).toString("base64url")`.
- **Lưu trữ CSDL**: Bảng `sessions` trong CSDL chỉ lưu chuỗi băm **SHA-256** của token (`crypto.createHash("sha256").update(token).digest("hex")`), tuyệt đối không lưu token gốc.
- **Thuộc tính Cookie**:
  - Tên cookie: `sid`.
  - Cấu hình: `HttpOnly; SameSite=Lax; Path=/`.
  - Thuộc tính `Secure`: Bắt buộc bật khi `NODE_ENV === "production"`.
  - Thời hạn: 30 ngày, cơ chế trượt (sliding window): tự động gia hạn khi thời gian còn lại dưới 15 ngày.

## 2. Phòng chống CSRF (Token KÝ và GẮN PHIÊN)
Theo quy định tại Mục 9.5 `API.md`:
- **Định dạng Token CSRF**:
  - Giá trị token: `nonce + '.' + hmacSha256(CSRF_SECRET, nonce + ':' + (sessionIdHash ?? 'anon'))`.
  - `nonce`: Chuỗi ngẫu nhiên 16 byte (`crypto.randomBytes(16).toString("base64url")`).
  - `CSRF_SECRET`: Lấy từ biến môi trường (bắt buộc cấu hình ở production; dev sinh ngẫu nhiên khi khởi động).
  - Gắn phiên: Nếu người dùng đã đăng nhập, liên kết với `sessionIdHash` (chuỗi SHA-256 của `sid`); nếu là khách chưa đăng nhập, sử dụng định danh `'anon'`.
- **Thuộc tính Cookie `csrf`**:
  - `SameSite=Lax; Path=/`.
  - `Secure`: Bắt buộc bật khi `NODE_ENV === "production"`.
  - **KHÔNG đặt `HttpOnly`** để client JS (frontend) có thể đọc và gửi kèm trong header `X-CSRF-Token`.
- **Cơ chế cấp và làm mới token**:
  - Đăng nhập (`POST /api/auth/login`) hoặc Đăng ký (`POST /api/auth/register`): Bắt buộc cấp cookie `csrf` mới gắn với session vừa tạo.
  - Đăng xuất (`POST /api/auth/logout`): Xoá session và cấp lại cookie `csrf` mới gắn với `'anon'`.
  - `GET /api/auth/me`: Tự động đặt cookie `csrf` mới nếu request chưa có cookie `csrf`.
  - `GET /api/auth/csrf`: Endpoint lấy token và đặt cookie `csrf`.
- **Quy tắc kiểm tra (Verification)**:
  - Áp dụng cho **mọi request ghi** (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Máy chủ kiểm tra 2 điều kiện:
    1. Header `X-CSRF-Token` phải bằng đúng Cookie `csrf` (so sánh bằng `crypto.timingSafeEqual`).
    2. Tách `nonce` và `signature` từ token, tính toán lại HMAC với phiên hiện tại (`sessionIdHash ?? 'anon'`) và so sánh bằng `crypto.timingSafeEqual`.
  - Nếu thiếu, không khớp hoặc sai chữ ký → trả về HTTP 403 `CSRF`.

```typescript
import crypto from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Sinh CSRF token ký gắn phiên
 */
export function generateCsrfToken(secret: string, sessionIdHash?: string | null): string {
  const nonce = crypto.randomBytes(16).toString("base64url");
  const bindId = sessionIdHash ?? "anon";
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(`${nonce}:${bindId}`)
    .digest("base64url");
  return `${nonce}.${hmac}`;
}

/**
 * Kiểm tra tính hợp lệ của CSRF token trên request ghi
 */
export function verifyCsrf(
  request: FastifyRequest,
  reply: FastifyReply,
  secret: string,
  currentSessionIdHash?: string | null
): boolean {
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

  // 1. So sánh header token và cookie token bằng timingSafeEqual
  const bufCookie = Buffer.from(cookieToken);
  const bufHeader = Buffer.from(headerToken);
  if (bufCookie.length !== bufHeader.length || !crypto.timingSafeEqual(bufCookie, bufHeader)) {
    reply.status(403).send({
      error: { code: "CSRF", message: "CSRF token trong header không khớp cookie" },
    });
    return false;
  }

  // 2. Kiểm tra chữ ký HMAC gắn với phiên hiện tại
  const [nonce, signature] = cookieToken.split(".");
  if (!nonce || !signature) {
    reply.status(403).send({
      error: { code: "CSRF", message: "Định dạng CSRF token không hợp lệ" },
    });
    return false;
  }

  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(`${nonce}:${currentSessionIdHash ?? "anon"}`)
    .digest("base64url");

  const bufSig = Buffer.from(signature);
  const bufExpected = Buffer.from(expectedHmac);
  if (bufSig.length !== bufExpected.length || !crypto.timingSafeEqual(bufSig, bufExpected)) {
    reply.status(403).send({
      error: { code: "CSRF", message: "Chữ ký CSRF token không hợp lệ hoặc không đúng phiên" },
    });
    return false;
  }

  return true;
}
```

## 3. Giới hạn tần suất (Rate Limiting)
Sử dụng plugin `@fastify/rate-limit` với các ngưỡng chặt chẽ theo Mục 9.5 `API.md`:
- **Đăng nhập (`POST /api/auth/login`)**:
  - Tối đa **5 lần / phút** theo địa chỉ IP.
  - Tối đa **10 lần / 15 phút** theo cặp (IP + username).
- **Đăng ký (`POST /api/auth/register`)**:
  - Tối đa **5 lần / giờ** theo địa chỉ IP.
- **Gửi tin nhắn phòng (`POST /api/rooms/:code/messages`)**:
  - Tối đa **10 tin / 10 giây / người dùng**.
- **Vào phòng (`POST /api/rooms/:code/join`)**:
  - Tối đa **10 lần / phút / người dùng**.
- **Các request ghi khác**: Tối đa **60 lần / phút / người dùng**.
- Khi vượt ngưỡng: Phản hồi HTTP 429 `RATE_LIMITED` kèm thông báo tiếng Việt.

## 4. Băm mật khẩu (scrypt)
- **Thuật toán**: Sử dụng `node:crypto` `scrypt` với tham số chuẩn:
  - `N = 32768` (2^15), `r = 8`, `p = 1`, `keylen = 64`.
  - Salt ngẫu nhiên 16 byte (`crypto.randomBytes(16)`).
- **Định dạng lưu trữ**: `scrypt$32768$8$1$<salt_hex>$<hash_hex>`.
- **Kiểm tra mật khẩu**: Băm mật khẩu nhập vào với cùng salt và tham số, sau đó so sánh bằng `crypto.timingSafeEqual()`. Thông báo lỗi chung, không tiết lộ mật khẩu hay tài khoản sai.

## 5. Che giấu nhật ký (Log Redaction)
- **Trường nhạy cảm tự động che**: Bộ logger của Fastify cấu hình redact các trường:
  - Headers: `req.headers.cookie`, `req.headers.authorization`, `req.headers["x-csrf-token"]`.
  - Response headers: `res.headers["set-cookie"]`.
  - Body & Objects: Mọi trường `password`, `token`, `csrf`.
- **CẤM**: Tuyệt đối **không log request body** của toàn bộ các route `/api/auth/*` (login, register, me...).
- **Môi trường Production**: Không gửi error stack trace về client. Chỉ trả về thông điệp chung với mã `INTERNAL`.

## 6. Realtime WebSocket an toàn (`/api/ws`)
Theo Mục 9.1 và 9.5 `API.md`:
- **Chỉ Server → Client**: WebSocket chỉ dùng để đẩy sự kiện thời gian thực từ máy chủ xuống client (cập nhật phòng, tin chat mới). Mọi thao tác ghi phải gửi qua HTTP REST để đi qua đầy đủ xác thực, phân quyền và kiểm tra CSRF.
- **Kiểm tra Origin**:
  - Môi trường production: Bắt buộc **từ chối kết nối nếu thiếu header `Origin`** hoặc `Origin` không nằm trong danh sách `ALLOWED_ORIGINS`.
- **Giới hạn kết nối (Connection & Subscription Limits)**:
  - Khách chưa đăng nhập: Tối đa **5 kết nối / IP**.
  - Mỗi kết nối WebSocket: Tối đa **20 phòng subscribe / kết nối**.
- **Luật Subscribe phòng riêng tư (`private`)**:
  - Subscribe áp dụng đúng luật như xem phòng qua REST API (`API.md` Mục 9.1).
  - Client gửi `{"type":"subscribe","room":code,"key"?}`.
  - Nếu phòng là `private`, người gửi không phải là thành viên trong phòng và không cung cấp `key` khớp với `join_key`:
    - Server gửi thông điệp lỗi: `{"type":"error","code":"FORBIDDEN","room":code}`.
    - Server **không đăng ký** client vào kênh của phòng đó.
  - Người xem phòng private bằng `key` chỉ nhận sự kiện thông tin phòng và đội hình; không được nhận tin nhắn chat riêng tư của phòng (chat chỉ dành cho thành viên).
