---
description: Quy trình thêm migration CSDL bằng Drizzle ORM và ghi nhận DECISIONS.md
---

# Thêm Migration CSDL (Add Migration)

**Quy trình chuẩn khi thay đổi schema và tạo migration CSDL trong customAOV**

## Bước 1: Cập nhật Schema trong `src/db/schema.ts`
1. Mở file `src/db/schema.ts`.
2. Định nghĩa hoặc điều chỉnh bảng, cột, khóa ngoại, chỉ mục.
3. Rà soát các quy tắc bắt buộc:
   - Khóa chính là `id uuid` với `$defaultFn(() => crypto.randomUUID())`.
   - Cột thời gian `created_at` dạng `timestamp with time zone` (`timestamptz`), mặc định `defaultNow()`.
   - Tên bảng và tên cột đều ở định dạng `snake_case`.
   - **CẤM**: Tuyệt đối **không sử dụng extension PostgreSQL** (như `uuid-ossp`, `pgcrypto`) để tương thích hoàn toàn với PGlite.
   - Thêm cột `search_text` nếu bảng có tìm kiếm văn bản (lưu chuỗi qua `normalizeVi`).

## Bước 2: Sinh file migration tự động
Chạy lệnh tạo migration từ root của backend hoặc theo npm script:
```bash
npx drizzle-kit generate
```
Drizzle Kit sẽ so sánh `src/db/schema.ts` với snapshot hiện tại và sinh file SQL mới vào thư mục `database/migrations/`.

## Bước 3: Kiểm tra tính an toàn của file SQL
1. Mở file SQL vừa sinh trong `database/migrations/`.
2. Kiểm tra các câu lệnh DDL (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`).
3. **Quy tắc bất biến**:
   - **Tuyệt đối KHÔNG sửa tay** các file migration cũ đã merge vào `main`.
   - Nếu cần đổi ý, hãy điều chỉnh lại `schema.ts` và tạo thêm một migration nối tiếp.

## Bước 4: Kiểm thử migration với PGlite
1. Chạy bộ test backend bằng `npm test`.
2. Đảm bảo toàn bộ test case khởi tạo CSDL PGlite in-memory (`memory://`) và áp dụng migration thành công không có lỗi cú pháp.

## Bước 5: Ghi nhật ký vào DECISIONS.md (BẮT BUỘC)
Mở file `docs/orchestration/DECISIONS.md` và thêm một dòng ghi nhận quyết định thay đổi schema theo định dạng:
```markdown
- <ngày> · <tên agent/vai trò> · Đổi schema: <mô tả chi tiết các bảng/cột thay đổi> · Lý do: <lý do nghiệp vụ hoặc kỹ thuật>.
```
> ⚠️ **LƯU Ý**: Mọi commit hoặc PR có thay đổi CSDL mà thiếu dòng ghi nhận tại `DECISIONS.md` sẽ bị từ chối duyệt.
