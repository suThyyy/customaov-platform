---
description: Generate SQL INSERT cho bảng phân quyền API
---

# Generate API Authorization Entry
**Command:** `/generate-qfunction`

> ⚠️ **CHƯA CẤU HÌNH** — Cần cập nhật theo bảng phân quyền thực tế.

## Input Parameters
- API URL (VD: `/api/products/list`)
- Function description

## Workflow Steps
1. Đọc schema bảng phân quyền
2. Generate SQL INSERT
3. Output SQL statement

## Lưu ý
- Nếu dự án không dùng bảng phân quyền, có thể xóa workflow này
