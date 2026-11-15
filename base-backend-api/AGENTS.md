# Hướng dẫn Agent cho Backend (customAOV)

> **Quy tắc tối cao**: Đọc và tuân thủ tuyệt đối [../AGENTS.md](../AGENTS.md) (hàng rào cứng không vượt qua, không sửa `_old_web_DO_NOT_EDIT/` hay `web_backup_*/`, tài liệu mẫu tham khảo, quy trình Orca).

## 1. Tech Stack thực tế
- **Runtime**: Node.js 22 LTS, TypeScript strict mode, ESM (`"type": "module"`).
- **Web Framework**: Fastify 5 (`buildApp()` cấu hình plugin/routes, không gọi `listen`).
- **Hợp đồng dữ liệu**: `@customaov/contracts` (Zod schemas, types dùng chung Frontend/Backend).
- **Cơ sở dữ liệu & ORM**: PostgreSQL (production) / PGlite in-memory (dev/test), Drizzle ORM + drizzle-kit migration (`database/migrations/`).
- **Thuật toán chia đội**: `@customaov/team-core` (chia đội 5v5 ngẫu nhiên và xếp theo tier).
- **Bảo mật**: Cookie phiên `sid` (httpOnly + SameSite=Lax), CSRF double-submit token (`X-CSRF-Token`), scrypt băm mật khẩu, `@fastify/rate-limit`, logger redaction.
- **Testing**: Vitest + `app.inject` + PGlite `memory://`.

## 2. Quy tắc cốt lõi bắt buộc
1. **Hợp đồng API**: Mọi request params/query/body và response phải được validate bằng schema trong `@customaov/contracts`. Không tự định nghĩa lại interface/type trùng lặp. Muốn đổi API phải cập nhật [docs/product/API.md](../docs/product/API.md) trước.
2. **Cấu trúc source**: `src/{app,server,config}.ts`, `src/routes/<nhóm>.ts`, `src/services/`, `src/db/`, `src/auth/`. Hàm `buildApp()` không được gọi `listen()`.
3. **Route & Lỗi**: Lỗi trả về luôn theo định dạng chuẩn `{ error: { code, message, details? } }` (danh sách mã lỗi ở `API.md` mục 1). Phân trang luôn trả về `{ items, total, page, pageSize }`. Kiểm tra quyền (chủ phòng / BTC) nghiêm ngặt tại server.
4. **Service Layer**: Logic nghiệp vụ thuần, nhận `db` instance làm tham số. Mọi thao tác ghi trên nhiều bảng bắt buộc phải bọc trong transaction (`db.transaction()`). Dùng `@customaov/team-core` cho chia đội; cấm tự viết lại thuật toán.
5. **Cơ sở dữ liệu (Drizzle)**: Schema tập trung tại `src/db/schema.ts`. Migration sinh tự động bằng `drizzle-kit generate` vào `database/migrations/`. Không bao giờ sửa tay migration đã merge. Không dùng Postgres extension. **Mọi thay đổi schema phải ghi nhật ký vào `docs/orchestration/DECISIONS.md`**.
6. **Bảo mật**:
   - Cookie `sid` httpOnly, SameSite=Lax (thêm Secure ở production). DB chỉ lưu SHA-256 của session token.
   - CSRF double-submit: mọi request ghi (POST/PUT/PATCH/DELETE) phải có header `X-CSRF-Token` khớp cookie `csrf` (so sánh bằng `timingSafeEqual`).
   - Rate limit theo IP và tài khoản đối với đăng nhập, đăng ký và tin nhắn chat.
   - Mật khẩu băm bằng `scrypt` kèm salt ngẫu nhiên.
   - Logger cấu hình redact các trường nhạy cảm (`cookie`, `authorization`, `x-csrf-token`, `password`, `token`). Cấm log body của các route `/api/auth/*`.
   - WebSocket chỉ đẩy dữ liệu server → client, bắt buộc kiểm tra header `Origin`.
7. **Testing**: Mỗi endpoint phải có bộ test Vitest qua `app.inject()` với CSDL PGlite `memory://`, bao gồm: case thành công, 401/403 (chưa đăng nhập / sai quyền / sai CSRF), và 400 (dữ liệu sai schema).

## 3. Danh mục quy tắc chi tiết (.agent/rules/)
- [01-backend-core-conventions.md](.agent/rules/01-backend-core-conventions.md): Quy ước TypeScript, Fastify 5, ESM, cấu trúc code, code style.
- [02-contracts-and-api.md](.agent/rules/02-contracts-and-api.md): Hợp đồng `@customaov/contracts`, chuẩn lỗi, phân trang, kiểm quyền.
- [03-service-pattern.md](.agent/rules/03-service-pattern.md): Service layer thuần, transaction, tích hợp `@customaov/team-core`.
- [04-security-rules.md](.agent/rules/04-security-rules.md): Quy tắc bảo mật (cookie sid, CSRF double-submit, scrypt, redact log, rate limit, WebSocket).
- [05-database-drizzle.md](.agent/rules/05-database-drizzle.md): Drizzle ORM, schema, migration, PGlite, quy định DECISIONS.md.
- [06-testing-rules.md](.agent/rules/06-testing-rules.md): Testing với Vitest, `app.inject()`, PGlite in-memory, ma trận test bắt buộc.
- [09-project-structure.md](.agent/rules/09-project-structure.md): Chi tiết cây thư mục `src/` và luồng xử lý request.

## 4. Danh mục quy trình công việc (.agent/workflows/)
- [add-api-endpoint.md](.agent/workflows/add-api-endpoint.md): Quy trình 4 bước thêm API endpoint mới (contracts → route → service → test).
- [add-migration.md](.agent/workflows/add-migration.md): Quy trình thêm migration CSDL bằng drizzle-kit và ghi DECISIONS.md.
- [code-review.md](.agent/workflows/code-review.md): Checklist review code và bảo mật trước khi commit.
