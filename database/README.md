# Database (customAOV)

Tầng lưu trữ PostgreSQL dùng **Drizzle ORM**, chạy trên **PGlite** (dev/test không cần cài DB ngoài) hoặc **PostgreSQL 17** (tuỳ chọn qua `docker-compose.yml`).

## Cấu trúc

- `migrations/`: Các file SQL migration sinh bởi `drizzle-kit generate` từ `base-backend-api/src/db/schema.ts`.
- `scripts/migration-template.sql`: Mẫu tham khảo khi cần viết script thủ công.

## Lệnh thường dùng

Chạy từ thư mục gốc workspace:

```bash
# Sinh migration mới sau khi sửa schema.ts
npm run db:generate --workspace @customaov/api

# Chạy migration (mặc định PGlite tại ./.data/pglite)
npm run db:migrate --workspace @customaov/api

# Nạp dữ liệu mẫu (chỉ chạy khi NODE_ENV !== production)
npm run db:seed --workspace @customaov/api
```

## Chuyển sang PostgreSQL 17 (tuỳ chọn)

```bash
docker compose up -d postgres
DATABASE_URL=postgres://customaov:customaov@127.0.0.1:54329/customaov npm run db:migrate --workspace @customaov/api
DATABASE_URL=postgres://customaov:customaov@127.0.0.1:54329/customaov npm run db:seed --workspace @customaov/api
```

## Ghi chú schema

- Schema gồm đúng 12 bảng theo `docs/product/API.md` mục 7 và bổ sung mục 9, không sử dụng Postgres extension (`id` sinh bằng `crypto.randomUUID()` trong ứng dụng).
- Ràng buộc duy nhất không phân biệt hoa/thường cho tên đội trong giải (`tournament_teams(tournament_id, lower(name))`) được khai báo bằng unique index trên biểu thức `lower("name")`.
- Ràng buộc đồng thời (mục 9.2): `room_members` và `tournament_team_members` dùng cột `active` kèm partial unique index (`WHERE role = 'player' AND active` và `WHERE active`); `bracket_matches` có cột `is_bye` (mục 9.3).
