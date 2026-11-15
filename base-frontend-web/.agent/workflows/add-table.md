---
description: Generate data table với columns và actions
---

# Add Data Table
**Command:** `/add-table`

## Input Parameters
- Columns (VD: `code, name, status, createdAt`)
- Actions (view/edit/delete)
- Enable pagination (yes/no)

## Workflow Steps
1. Generate table HTML theo UI library đang dùng
2. Header template với sortable columns
3. Body template với data binding
4. Action buttons column (nếu cần)
5. Empty state template
6. Thêm biến `filteredData` vào component
