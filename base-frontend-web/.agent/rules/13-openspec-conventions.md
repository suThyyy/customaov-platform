---
trigger: manual
---

# OpenSpec Conventions
**Activation Mode: Manual** (Khi làm việc với OpenSpec changes)

## NGUYÊN TẮC CHÍNH

### 1. Phân luồng quyết định
- Task nhỏ (dialog, filter, fix bug) → Dùng `.agent/workflows/` trực tiếp
- Task lớn (feature mới, API mới, refactor, schema change) → Dùng OpenSpec flow

### 2. Quan hệ giữa OpenSpec và .agent/
- `openspec/specs/` = **What to build** (specifications)
- `.agent/rules/` = **How to code** (conventions)
- `.agent/workflows/` = **How to scaffold** (templates)
- Khi apply OpenSpec change, VẪN PHẢI tuân thủ `.agent/rules/`

### 3. Cross-repo coordination
- Cùng `change-name` cho cả BE và FE
- `proposal.md` phải có section "Related Changes"
- Tasks phải chia rõ [Backend] và [Frontend]

### 4. Delta specs
- Chỉ mô tả phần THAY ĐỔI (ADDED / MODIFIED / REMOVED)
- Không rewrite toàn bộ spec
- Archive sẽ merge delta vào specs/ chính

### 5. Khi dùng /opsx:apply
- **PHẢI** tuân thủ `.agent/rules/` hiện có (06-12)
- **CÓ THỂ** dùng `.agent/workflows/` cho subtasks:
  - Cần scaffold full feature? → Dùng `/generate-feature` với specs từ proposal
  - Cần tạo dialog? → Dùng pattern từ `/add-dialog`
  - Cần tạo table? → Dùng pattern từ `/add-table`
  - Cần tạo filter? → Dùng pattern từ `/add-filter`
  - Cần tạo transform? → Dùng pattern từ `/add-transform`

## CRITICAL RULES
- ❌ KHÔNG code feature mới lớn mà không có OpenSpec proposal
- ❌ KHÔNG thay đổi database schema mà không có spec
- ❌ KHÔNG tạo API mới mà không có spec
- ✅ Bug fix nhỏ, null check, log → code trực tiếp
- ✅ Review proposal trước khi apply
- ✅ Archive sau khi verify

## DECISION MATRIX

| Loại thay đổi | Dùng gì | Ví dụ |
|---|---|---|
| Bug fix nhỏ | `/quick-fix` | Sửa lỗi validate form |
| Thêm dialog CRUD | `/add-dialog` | Dialog thêm danh mục |
| Thêm bảng dữ liệu | `/add-table` | Bảng danh sách |
| Thêm bộ lọc | `/add-filter` | Lọc theo trạng thái |
| Chưa rõ scope | `/opsx:explore` → propose | Investigate trước |
| Feature mới lớn | `/opsx:propose` → apply → archive | Bulk import, báo cáo động |
| API mới | `/opsx:propose` | Cần spec contract trước |
| Thay đổi DB schema | `/opsx:propose` | Cần review spec trước |
| Refactor lớn | `/opsx:propose` | Tách module, đổi architecture |
