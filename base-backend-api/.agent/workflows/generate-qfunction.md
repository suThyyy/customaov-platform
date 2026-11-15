---
description: Generate SQL INSERT cho bảng phân quyền API
---

# Generate API Authorization Entry
**Command:** `/generate-qfunction`

> ⚠️ **CHƯA CẤU HÌNH** — Workflow này cần được cập nhật theo bảng phân quyền thực tế của dự án.

## Input Parameters
- API URL (VD: `/api/products/list`)
- Function description (VD: "API lấy danh sách sản phẩm")

## Workflow Steps
1. Đọc schema bảng phân quyền (Q_FUNCTION hoặc tương đương)
2. Generate SQL INSERT với các fields cần thiết
3. Output SQL statement

## Lưu ý
- File này cần AI Agent cập nhật sau khi biết cấu trúc bảng phân quyền của dự án
- Nếu dự án không dùng bảng phân quyền, có thể xóa workflow này