---
description: Scaffold complete feature với Component, Service, Model
---

# Generate Feature Component
**Command:** `/generate-feature`

> ⚠️ **CHƯA CẤU HÌNH** — Workflow này cần AI Agent đọc rules và source code để generate đúng pattern.

## Input Parameters
- Feature name (VD: `product-list`, `user-management`)
- CRUD operations needed (Create/Read/Update/Delete)

## Workflow Steps
1. **Tạo Model/Interface** trong folder models
   - Theo pattern trong rule `06-frontend-core-conventions`

2. **Tạo Service** trong folder services
   - Theo pattern trong rule `07-frontend-service-pattern`
   - CRUD methods

3. **Tạo Component** trong folder features/apps
   - Theo structure trong rule `06-frontend-core-conventions`
   - Template file (HTML)
   - Routing configuration

4. **Update API config** (centralized API endpoints)

## Expected Output
```
✅ Created: [feature].model.ts
✅ Created: [feature].service.ts
✅ Created: [feature].component.ts
✅ Created: [feature].component.html
✅ Updated: routing config
✅ Updated: API config
```
