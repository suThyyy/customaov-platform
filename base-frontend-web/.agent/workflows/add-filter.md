---
description: Thêm bộ lọc (filter) vào component hiện tại
---

# Add Filter
**Command:** `/add-filter`

## Input Parameters
- Filter type: `single-select` / `multi-select` / `tree-select` / `date-range`
- Filter name (VD: `priority`, `status`, `handler`)
- Options (nếu cần)

## Workflow Steps
1. Thêm biến state vào component:
   - Single: `selected[Name]: type | null = null;`
   - Multi: `selected[Names]: type[] = [];`

2. Thêm options array (nếu cần)

3. Thêm method select/toggle

4. Thêm filter logic vào `applyClientSideFilters()` theo pattern trong rule `11-frontend-filter-pattern`

5. Generate HTML code cho filter section theo UI library đang dùng

## Lưu ý
- Luôn clone data trước khi filter: `[...allData]`
- Single-select: `null` để clear, toggle với `===`
- Multi-select: array `[]`, binding
