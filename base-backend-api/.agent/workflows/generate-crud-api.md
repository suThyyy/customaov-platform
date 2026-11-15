---
description: Tạo đầy đủ layers cho một entity/resource mới (CRUD API hoàn chỉnh)
---

# Generate CRUD API
**Command:** `/generate-crud-api`

> ⚠️ **CHƯA CẤU HÌNH** — Workflow này cần AI Agent đọc rules và source code để biết cách generate đúng pattern.

## Input Parameters
- Entity/Resource name (VD: `Product`, `User`, `Order`)
- Module/Schema name (nếu có multi-schema)
- Table/Collection name (database table tương ứng)

## Workflow Steps

1. **Tạo DTO/Model** trong package/folder tương ứng
   - Theo pattern trong rule `01-backend-core-conventions`
   - Map tất cả fields từ database table
   - Thêm audit fields (nếu có)

2. **Tạo Repository/DAO** trong package/folder tương ứng
   - Theo pattern trong rule `02-repository-pattern`
   - Basic CRUD methods (getAll, getById, save, update, delete)

3. **Tạo Service** trong package/folder tương ứng
   - Theo pattern trong rule `03-service-pattern`
   - Business logic layer + validation
   - Transaction annotations

4. **Tạo Controller** trong package/folder tương ứng
   - Theo pattern trong rule `04-rest-api-controller`
   - REST endpoints: GET, POST, PUT, DELETE
   - Response wrapper + Error handling
   - API documentation annotations

5. **Nhắc nhở** khai báo API trong hệ thống phân quyền (nếu có)

## Expected Output
```
✅ Created: [Entity]DTO / [Entity]Model
✅ Created: [Entity]Repository
✅ Created: [Entity]Service
✅ Created: [Entity]Controller
⚠️  Remember to register API in authorization system!
```
