---
description: Generate transform method để add UI fields
---

### 10. Transform Data with UI Fields (Thêm transform logic)
**Command:** `/add-transform`
**Mô tả:** Generate transform method để add UI fields

**Input parameters:**
- UI fields needed (VD: `TRANG_THAI_UI, UU_TIEN_UI`)

**Workflow steps:**
1. Generate `transformData()` method
2. Generate mapping helper methods
3. Update `loadData()` để call transform
