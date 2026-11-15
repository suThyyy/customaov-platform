---
description: Thêm audit fields (created/modified tracking) vào Service method
---

# Add Audit Tracking
**Command:** `/add-audit-tracking`

## Workflow Steps
1. Detect Service create/update method đang mở
2. Thêm code set audit fields:
   - **Create**: set createdBy (current user), createdAt (current timestamp)
   - **Update**: set modifiedBy (current user), modifiedAt (current timestamp)
3. Import date/time utilities nếu chưa có
