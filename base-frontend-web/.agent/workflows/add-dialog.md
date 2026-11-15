---
description: Tạo dialog/modal form cho Create/Edit
---

# Add Dialog Form
**Command:** `/add-dialog`

## Input Parameters
- Form fields (VD: `name:text, description:textarea, priority:dropdown`)
- Mode (create-only / edit-only / both)

## Workflow Steps
1. Thêm biến state:
   - `displayDialog` (boolean)
   - `dialogMode` ('create' | 'edit')
   - `formData` (DTO/Model instance)

2. Generate dialog/modal HTML theo UI library đang dùng

3. Generate form fields theo UI library components

4. Generate methods:
   - `openCreateDialog()` — reset form + show dialog
   - `openEditDialog(item)` — clone item + show dialog
   - `saveData()` — call API (create/update) + handle response
   - `cancelDialog()` — hide dialog
