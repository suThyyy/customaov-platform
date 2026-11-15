# Hướng dẫn đóng góp

## Cấu trúc repo

Xem tổng quan cấu trúc thư mục và cách chạy dự án tại [README.md](README.md).

## Quy trình nhánh & Pull Request

- Nhánh `main` được bảo vệ, không push trực tiếp.
- Mỗi đầu việc tạo một nhánh riêng từ `main` theo quy ước `feat/<tên>` hoặc `fix/<tên>`.
- Mở Pull Request vào `main`. Cần tối thiểu **1 review** duyệt và **CI xanh** mới được merge.

## Kiểm tra trước khi mở PR

Chạy ở thư mục gốc:

```sh
npm run build && npm run lint && npm test
```

Nếu thay đổi giao diện (UI), chạy thêm kiểm thử E2E và chụp screenshot kiểm tra theo hướng dẫn trong [README.md](README.md).

## Quy tắc code & dữ liệu

- **UI / Frontend:** tuân thủ quy tắc thiết kế trong [AGENTS.md](AGENTS.md) (token màu/chữ/spacing, tối đa 1 nút vàng đặc mỗi khung nhìn, không dùng giá trị lẻ…).
- **Backend API:** xem quy tắc tại [base-backend-api/AGENTS.md](base-backend-api/AGENTS.md).
- **Hợp đồng API:** cập nhật `docs/product/API.md` và `packages/contracts` trước, rồi mới sửa code FE/BE.
- **Migration DB:** sinh bằng `drizzle-kit generate`; không sửa tay file migration đã merge.
- **Bảo mật:** không commit file `.env`, khoá bí mật hay thông tin nhạy cảm.

## Lưu ý về tài liệu

- Các thư mục `docs/dac-ta`, `docs/design-api`, `docs/nghiep-vu`, `docs/tich-hop`, `docs/hdsd`, `docs/json`, `docs/pdf` và `HUONG-DAN-AP-DUNG.md` chỉ là **mẫu trình bày** tham khảo, không phải yêu cầu chức năng của customAOV.
- Các file `AGENTS.md`, `CLAUDE.md` và thư mục `docs/orchestration/` dành cho AI agent điều phối; lập trình viên có thể bỏ qua.
