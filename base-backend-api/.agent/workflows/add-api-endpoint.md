---
description: Thêm một REST endpoint mới vào Controller hiện tại
---

# Add API Endpoint
**Command:** `/add-api-endpoint`

## Input Parameters
- HTTP method (GET/POST/PUT/DELETE)
- Endpoint path (VD: `/products/search`, `/orders/export`)
- Description (VD: "Tìm kiếm sản phẩm theo điều kiện")

## Workflow Steps
1. Detect Controller file đang mở
2. Thêm method theo pattern trong rule `04-rest-api-controller`:
   - API documentation annotations
   - Request/Response mapping
   - Error handling (try-catch)
   - Response wrapper
3. Suggest tạo Service method tương ứng
4. Nhắc nhở khai báo API trong hệ thống phân quyền (nếu có)