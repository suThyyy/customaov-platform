---
description: Tạo query method trong Repository/DAO
---

# Add Repository Query
**Command:** `/add-repository-query`

## Input Parameters
- Method name (VD: `findByEmail`, `searchByKeyword`)
- Query description (VD: "Tìm user theo email")
- Return type (Single/List/Optional)

## Workflow Steps
1. Detect Repository file đang mở
2. Generate query method theo pattern trong rule `02-repository-pattern`:
   - Parameterized query (KHÔNG string concatenation)
   - Comment tiếng Việt
   - Handle return type (Optional, List, Single)
3. Thêm method declaration vào Interface (nếu dùng Interface + Impl pattern)