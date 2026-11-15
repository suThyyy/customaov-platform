# Thiết Kế API

Thư mục này chứa tài liệu design API (trước khi implement).

## Cách tổ chức
- Mỗi API module một file
- Đặt tên: `[module]-api.md`
- Nội dung: endpoints, request/response schema, error codes

## Ví dụ nội dung

```markdown
## POST /api/products

### Request Body
| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| name  | string | ✅ | Tên sản phẩm |
| price | number | ✅ | Giá (VNĐ) |

### Response
| Status | Body | Mô tả |
|--------|------|-------|
| 201 | `{ success: true, data: {...} }` | Tạo thành công |
| 400 | `{ success: false, message: "..." }` | Validation error |
```
