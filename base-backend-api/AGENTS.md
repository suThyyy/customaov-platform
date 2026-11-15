# Hướng dẫn Agent cho Backend (customAOV)

> **Quy tắc tối cao**: Đọc và tuân thủ tuyệt đối [../AGENTS.md](../AGENTS.md) (hàng rào cứng không vượt qua, không sửa `_old_web_DO_NOT_EDIT/` hay `web_backup_*/`, tài liệu mẫu tham khảo, quy trình Orca).

## 1. Tech Stack thực tế
- **Runtime**: Node.js 22 LTS, TypeScript strict mode, ESM (`"type": "module"`).
- **Web Framework**: Fastify 5 (`buildApp()` cấu hình plugin/routes, không gọi `listen`).
- **Hợp đồng dữ liệu**: `@customaov/contracts` (Zod schemas, types dùng chung Frontend/Backend).
- **Cơ sở dữ liệu & ORM**: PostgreSQL (production) / PGlite in-memory (dev/test), Drizzle ORM + drizzle-kit migration (`database/migrations/`).
- **Thuật toán chia đội**: `@customaov/team-core` (chia đội 5v5 ngẫu nhiên và xếp theo tier).
- **Bảo mật**: Cookie phiên `sid` (httpOnly + SameSite=Lax), CSRF token ký gắn phiên (`X-CSRF-Token`), scrypt băm mật khẩu, `@fastify/rate-limit`, logger redaction.
- **Testing**: Vitest + `app.inject` + PGlite `memory://`.

## 2. Quy tắc cốt lõi bắt buộc
1. **Hợp đồng API**: Mọi request params/query/body và response phải được validate bằng schema trong `@customaov/contracts`. Không tự định nghĩa lại interface/type trùng lặp. Muốn đổi API phải cập nhật [docs/product/API.md](../docs/product/API.md) trước.
2. **Cấu trúc source**: `src/{app,server,config}.ts`, `src/routes/<nhóm>.ts`, `src/services/`, `src/db/`, `src/auth/`. Hàm `buildApp()` không được gọi `listen()`.
3. **Route & Lỗi**: Lỗi trả về luôn theo định dạng chuẩn `{ error: { code, message, details? } }` (danh sách mã lỗi ở `API.md` mục 1). Phân trang luôn trả về `{ items, total, page, pageSize }`. Kiểm tra quyền (chủ phòng / BTC) nghiêm ngặt tại server.
4. **Service Layer & Giao dịch**:
   - Logic nghiệp vụ thuần, nhận `db` instance làm tham số.
   - Các thao tác đồng thời thay đổi phòng/giải đấu (`join`, `leave`, `move`, `kick`, `split`, `result`, `registrations`, `draw`, `score`) bắt buộc chạy trong **transaction** và khóa hàng phòng/giải bằng `SELECT ... FOR UPDATE` (trên PostgreSQL; PGlite chạy tuần tự).
   - Chặn thao tác theo trạng thái: cấm thao tác ghi trên phòng đã `finished` (409), cấm kick chính mình (400), `result` chỉ khi đủ 10 người và chưa có kết quả (409 nếu gọi lần 2), duyệt đội chỉ khi giải `open` và chưa đủ chỗ (409), nhập tỉ số trận thiếu đội → 409.
   - Dùng `@customaov/team-core` cho chia đội 5v5; cấm tự viết lại thuật toán.
5. **Cơ sở dữ liệu (Drizzle)**: Schema tập trung tại `src/db/schema.ts`. Migration sinh tự động bằng `drizzle-kit generate` vào `database/migrations/`. Không bao giờ sửa tay migration đã merge. Không dùng Postgres extension. **Mọi thay đổi schema phải ghi nhật ký vào `docs/orchestration/DECISIONS.md`**.
6. **Bảo mật (Owner chốt & Mục 9 API.md)**:
   - **Cookie `sid`**: `HttpOnly; SameSite=Lax; Path=/` (thêm `Secure` ở production). CSDL chỉ lưu chuỗi băm SHA-256 của session token. Hạn 30 ngày, trượt khi còn dưới 15 ngày.
   - **CSRF KÝ và GẮN PHIÊN**:
     - Token dạng `nonce + '.' + HMAC_SHA256(CSRF_SECRET, nonce + ':' + (sessionIdHash ?? 'anon'))`.
     - Cookie `csrf`: `SameSite=Lax; Path=/` (thêm `Secure` ở production, không HttpOnly để JS đọc).
     - Mọi request ghi bắt buộc gửi header `X-CSRF-Token`. Server kiểm `header == cookie` VÀ chữ ký HMAC đúng với phiên hiện tại.
     - Cấp cookie `csrf` mới khi login/logout. `GET /api/auth/me` tự đặt cookie `csrf` nếu chưa có.
   - **Rate Limiting**:
     - Login: 5 lần/phút theo IP **và** 10 lần/15 phút theo cặp IP + username.
     - Register: 5 lần/giờ theo IP.
     - Gửi chat: 10 tin/10 giây/người.
     - Join phòng: 10 lần/phút/người.
     - Các request ghi khác: 60 lần/phút/người.
   - **Mật khẩu**: Băm bằng `scrypt` kèm salt 16 byte ngẫu nhiên. So sánh bằng `timingSafeEqual`.
   - **Logger Redaction**: Tự động ẩn các trường nhạy cảm (`cookie`, `authorization`, `x-csrf-token`, `password`, `token`). Cấm log body của các route `/api/auth/*`. Không lộ stack trace ở production.
   - **WebSocket Realtime (`/api/ws`)**:
     - Chỉ đẩy dữ liệu server → client. Mọi thao tác ghi phải qua HTTP REST.
     - Production: bắt buộc từ chối kết nối nếu thiếu header `Origin` hoặc Origin không nằm trong `ALLOWED_ORIGINS`.
     - Giới hạn tần suất kết nối: tối đa 5 kết nối/IP cho khách chưa đăng nhập, tối đa 20 phòng subscribe/kết nối.
     - Khi subscribe phòng `private`: áp dụng cùng luật xem (phải là thành viên hoặc có `key` hợp lệ, nếu không server gửi lỗi `FORBIDDEN` và không đăng ký).
7. **Testing**: Mỗi endpoint phải có bộ test Vitest qua `app.inject()` với CSDL PGlite `memory://`, bao gồm: case thành công, 401/403 (chưa đăng nhập / sai quyền / sai CSRF), và 400 (dữ liệu sai schema).

## 3. Danh mục quy tắc chi tiết (.agent/rules/)
- [01-backend-core-conventions.md](.agent/rules/01-backend-core-conventions.md): Quy ước TypeScript, Fastify 5, ESM, cấu trúc code, code style.
- [02-contracts-and-api.md](.agent/rules/02-contracts-and-api.md): Hợp đồng `@customaov/contracts`, chuẩn lỗi, phân trang, kiểm quyền.
- [03-service-pattern.md](.agent/rules/03-service-pattern.md): Service layer thuần, transaction + FOR UPDATE, chặn theo trạng thái, `@customaov/team-core`.
- [04-security-rules.md](.agent/rules/04-security-rules.md): Quy tắc bảo mật (CSRF ký gắn phiên, cookie sid, scrypt, redact log, rate limit, WebSocket).
- [05-database-drizzle.md](.agent/rules/05-database-drizzle.md): Drizzle ORM, schema, migration, PGlite, quy định DECISIONS.md.
- [06-testing-rules.md](.agent/rules/06-testing-rules.md): Testing với Vitest, `app.inject()`, PGlite in-memory, ma trận test bắt buộc.
- [09-project-structure.md](.agent/rules/09-project-structure.md): Chi tiết cây thư mục `src/` và luồng xử lý request.

## 4. Danh mục quy trình công việc (.agent/workflows/)
- [add-api-endpoint.md](.agent/workflows/add-api-endpoint.md): Quy trình 4 bước thêm API endpoint mới (contracts → route → service → test).
- [add-migration.md](.agent/workflows/add-migration.md): Quy trình thêm migration CSDL bằng drizzle-kit và ghi DECISIONS.md.
- [code-review.md](.agent/workflows/code-review.md): Checklist review code và bảo mật trước khi commit.
