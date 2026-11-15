---
description: Quy trình thêm một API endpoint mới chuẩn 4 bước (contracts → route → service → test)
---

# Thêm API Endpoint mới (Add API Endpoint)

**Quy trình 4 bước chuẩn để bổ sung hoặc cập nhật API endpoint trong `base-backend-api`**

## Bước 1: Kiểm tra & cập nhật Hợp đồng (@customaov/contracts)
1. Đối chiếu với thiết kế API tại `docs/product/API.md`.
2. Kiểm tra schema Zod trong `packages/contracts/src/` (query, params, body, response).
3. Nếu cần tạo mới hoặc cập nhật schema:
   - Sửa schema Zod và export type tương ứng.
   - Chạy `npm test` trong `packages/contracts` để đảm bảo hợp đồng hợp lệ.
   - Build contracts: `npm run build` (hoặc `npm run typecheck`).

## Bước 2: Hiện thực Logic Nghiệp vụ tại Service (src/services/)
1. Mở hoặc tạo file service tương ứng trong `src/services/` (ví dụ `roomService.ts`, `tournamentService.ts`).
2. Viết hàm nghiệp vụ nhận tham số đầu tiên là `db: DatabaseInstance`.
3. Tuân thủ các nguyên tắc:
   - Thao tác nhiều bảng bắt buộc nằm trong `db.transaction(async (tx) => { ... })`.
   - Với chia đội phòng custom: Gọi hàm `splitTeams5v5` từ `@customaov/team-core`. Tuyệt đối không tự viết lại logic chia đội.
   - Báo lỗi rõ ràng bằng cách ném ngoại lệ hoặc trả về status code / error code phù hợp.

## Bước 3: Đăng ký Route Handler tại Route (src/routes/)
1. Mở hoặc tạo file route tương ứng trong `src/routes/` (ví dụ `rooms.ts`).
2. Đăng ký endpoint với Fastify (`app.get`, `app.post`, `app.patch`, v.v.).
3. Thực hiện tuần tự các bước trong handler:
   - **Xác thực**: Kiểm tra `request.currentUser` nếu endpoint yêu cầu đăng nhập (401 `UNAUTHENTICATED`).
   - **Validate Input**: Sử dụng schema Zod từ `@customaov/contracts` để parse request params, query hoặc body. Nếu lỗi, trả về HTTP 400 `VALIDATION`.
   - **Phân quyền Server**: Kiểm tra quyền chủ phòng hoặc BTC giải nếu thao tác đặc quyền (403 `FORBIDDEN`).
   - **Gọi Service**: Gọi hàm service đã tạo ở Bước 2.
   - **Trả kết quả**: Trả về đúng mã HTTP (200 OK, 201 Created, 204 No Content) kèm payload đúng schema.

## Bước 4: Viết Test tự động với Vitest (src/**/*.test.ts)
1. Mở file test tương ứng hoặc tạo mới (ví dụ `src/routes/rooms.test.ts`).
2. Sử dụng `buildApp()` và gọi `app.inject()` để kiểm thử.
3. Bắt buộc hoàn thành ma trận 3 nhóm kiểm thử:
   - **Thành công**: Mã 200/201, payload trả về khớp schema.
   - **Xác thực / Phân quyền**: 401 khi chưa đăng nhập, 403 khi sai quyền, 403 khi thiếu/sai `X-CSRF-Token` trên request ghi.
   - **Validation**: 400 `VALIDATION` khi gửi payload sai định dạng.
4. Chạy kiểm tra:
   ```bash
   npm test
   ```
