---
trigger: manual
---
# Project Structure Guide (Cấu trúc dự án Backend)

**Sơ đồ cấu trúc thư mục và quy tắc tổ chức mã nguồn của `base-backend-api`**

## 1. Cây thư mục chi tiết

```
base-backend-api/
├── .agent/
│   ├── rules/                       # Quy tắc chuẩn cho AI agent
│   │   ├── 01-backend-core-conventions.md
│   │   ├── 02-contracts-and-api.md
│   │   ├── 03-service-pattern.md
│   │   ├── 04-security-rules.md
│   │   ├── 05-database-drizzle.md
│   │   ├── 06-testing-rules.md
│   │   └── 09-project-structure.md
│   └── workflows/                   # Các quy trình công việc chuẩn
│       ├── add-api-endpoint.md
│       ├── add-migration.md
│       └── code-review.md
├── src/
│   ├── app.ts                       # Hàm buildApp(): cấu hình plugins, routes, hooks, errorHandler
│   ├── server.ts                    # Điểm vào runtime: nạp config và gọi app.listen()
│   ├── config.ts                    # Nạp và kiểm tra biến môi trường (AppConfig)
│   ├── auth/                        # Tiện ích xác thực, phiên và bảo mật
│   │   ├── session.ts               # Quản lý token phiên sid, mã hoá SHA-256
│   │   ├── csrf.ts                  # Tiện ích tạo và kiểm tra double-submit CSRF
│   │   └── password.ts              # Băm và kiểm tra mật khẩu bằng scrypt
│   ├── db/                          # Tầng cơ sở dữ liệu
│   │   ├── index.ts                 # Khởi tạo kết nối Drizzle (PostgreSQL / PGlite)
│   │   └── schema.ts                # Định nghĩa toàn bộ schema các bảng
│   ├── routes/                      # Các route handler (Fastify plugins)
│   │   ├── auth.ts                  # /api/auth/* (csrf, register, login, logout, me)
│   │   ├── rooms.ts                 # /api/rooms/* (danh sách, tạo, chi tiết, chia đội, chat...)
│   │   ├── tournaments.ts           # /api/tournaments/* (danh sách, tạo, đăng ký, bốc thăm...)
│   │   └── users.ts                 # /api/users/* (hồ sơ người dùng)
│   └── services/                    # Tầng nghiệp vụ thuần túy (nhận db, pure logic)
│       ├── authService.ts           # Logic xác thực và phiên
│       ├── roomService.ts           # Logic phòng đấu, tích hợp @customaov/team-core
│       ├── tournamentService.ts     # Logic giải đấu, nhánh đấu, xếp hạng
│       └── userService.ts           # Logic hồ sơ và thống kê
├── package.json
└── tsconfig.json
```

## 2. Vai trò của từng thành phần
- **`src/app.ts`**: Nơi duy nhất khởi tạo và kết nối mọi plugin Fastify (cookie, rate-limit, websocket, routes, global error handler, 404 handler). **CẤM** gọi `app.listen()` trong file này.
- **`src/server.ts`**: Chịu trách nhiệm khởi động HTTP server thực tế bằng cách gọi `buildApp()` và `app.listen({ port, host })`.
- **`src/config.ts`**: Cung cấp hàm `loadConfig()` trả về object cấu hình có kiểu rõ ràng.
- **`src/auth/`**: Tập trung logic mật mã và an toàn thông tin: sinh token ngẫu nhiên, SHA-256, scrypt hashing, so sánh bằng `timingSafeEqual`.
- **`src/db/`**: Tập trung schema Drizzle trong `schema.ts`. Mọi migration sinh ra nằm ở `database/migrations/`.
- **`src/routes/`**: Tầng nhận request từ client, kiểm tra hợp đồng qua schema Zod của `@customaov/contracts`, kiểm tra quyền hạn và chuyển tiếp dữ liệu cho tầng Service.
- **`src/services/`**: Tầng xử lý nghiệp vụ thuần túy. Hàm service nhận tham số `db`, chạy transaction khi thao tác nhiều bảng, và dùng `@customaov/team-core` khi chia đội.

## 3. Vòng đời xử lý một Request (Request Lifecycle)
```
1. Client gửi HTTP Request (kèm Cookie sid và header X-CSRF-Token nếu là method ghi)
   │
2. Fastify Global Hooks (src/app.ts):
   ├── Logger (tự động redact cookie, token, password)
   ├── CSRF Hook (chặn 403 nếu request ghi không khớp X-CSRF-Token)
   └── Auth Hook (đọc cookie sid, tìm session trong DB, gán request.currentUser)
   │
3. Route Plugin (src/routes/<nhóm>.ts):
   ├── Parse & Validate params/query/body qua schema @customaov/contracts (lỗi -> 400 VALIDATION)
   ├── Kiểm tra quyền tại chỗ: chủ phòng hoặc BTC (sai -> 403 FORBIDDEN)
   │
4. Service Layer (src/services/<nhóm>Service.ts):
   ├── Thực thi business rules
   ├── Gọi @customaov/team-core (nếu chia đội)
   └── Đọc / Ghi CSDL qua Drizzle ORM (bọc trong db.transaction nếu ghi nhiều bảng)
   │
5. Phản hồi JSON:
   ├── Thành công: 200/201 với payload đúng hợp đồng
   └── Lỗi: { error: { code, message, details? } }
```
