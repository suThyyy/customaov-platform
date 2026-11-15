---
trigger: glob
globs: src/db/**/*.ts, database/migrations/**/*
---
# Database & Drizzle ORM

**Quy chuẩn cơ sở dữ liệu, schema và migration trong customAOV**

## 1. Tech Stack CSDL
- **ORM / Query Builder**: Drizzle ORM kết hợp `drizzle-kit` quản lý schema và migration.
- **Production CSDL**: PostgreSQL tiêu chuẩn.
- **Dev & Test CSDL**: PGlite (`@electric-sql/pglite`) in-memory (`memory://`) hoặc file local, cho phép chạy test cô lập, nhanh và không cần cài đặt hoặc khởi động Postgres service.
- **Không dùng Extension**: Tuyệt đối **không sử dụng bất kỳ PostgreSQL extension nào** (như `uuid-ossp`, `pgcrypto`...) để bảo đảm tính tương thích 100% giữa PGlite và PostgreSQL. Mọi UUID được sinh trực tiếp bằng `crypto.randomUUID()` trong code TypeScript.

## 2. Vị trí Schema & Quy ước thiết kế
Toàn bộ bảng CSDL được định nghĩa tập trung tại `src/db/schema.ts`:
- **Khóa chính**: Luôn là `id uuid` với giá trị mặc định sinh qua `crypto.randomUUID()`.
- **Dấu thời gian**: Cột `created_at` dạng `timestamp with time zone` (`timestamptz`), mặc định `defaultNow()`.
- **Đặt tên**: Tên bảng và tên cột luôn ở định dạng `snake_case` (ví dụ: `room_members`, `user_id`, `token_hash`).
- **Tìm kiếm tiếng Việt không dấu**: Bảng có tìm kiếm văn bản (như `users`, `rooms`, `tournaments`) chứa cột `search_text`, lưu chuỗi đã chuẩn hoá bằng `normalizeVi` từ `@customaov/contracts`.

```typescript
// Ví dụ trích đoạn src/db/schema.ts
import { pgTable, text, timestamp, uuid, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  uid: text("uid").notNull().unique(), // 6 chữ số
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  level: integer("level").default(1).notNull(),
  crowned: boolean("crowned").default(false).notNull(),
  searchText: text("search_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(), // AOV-1024
  title: text("title").notNull(),
  hostId: uuid("host_id").references(() => users.id).notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull().default("waiting"),
  config: jsonb("config").notNull(),
  lastSplit: jsonb("last_split"),
  searchText: text("search_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

## 3. Quy trình Migration
- **Sinh migration**: Khi có thay đổi trong `src/db/schema.ts`, chạy lệnh:
  ```bash
  npx drizzle-kit generate
  ```
- **Thư mục lưu trữ**: Các file migration SQL tự động lưu vào `database/migrations/`.
- **Quy tắc bất biến**:
  - **CẤM sửa tay** các file migration đã merge vào nhánh `main`.
  - Mọi điều chỉnh schema mới phải tạo một migration nối tiếp mới qua `drizzle-kit generate`.

## 4. Bắt buộc ghi nhận vào DECISIONS.md
- **Quy định nghiêm ngặt**: Bất kỳ thay đổi nào liên quan tới schema CSDL (thêm bảng, sửa cột, đổi ràng buộc) **bắt buộc phải ghi nhật ký** vào `docs/orchestration/DECISIONS.md` với định dạng:
  ```markdown
  - <ngày> · <tên agent/vai trò> · Đổi schema: <mô tả chi tiết> · Lý do: <lý do nghiệp vụ/kỹ thuật>.
  ```
- Nếu PR hoặc commit có sửa schema mà không có cập nhật trong `DECISIONS.md`, reviewer sẽ từ chối nghiệm thu.

## 5. Truy vấn dữ liệu an toàn
- Sử dụng API query của Drizzle (`select()`, `insert()`, `update()`, `delete()`) tự động tham số hoá toàn bộ giá trị (parameterized queries).
- Tuyệt đối không nối chuỗi để tạo câu lệnh SQL thô nhằm ngăn chặn triệt để SQL Injection.
