# TMS OpenSpec Conventions
**Activation Mode: Conditional — Khi làm việc với openspec/ directory**

## KHI NÀO PHẢI DÙNG OPENSPEC

Bắt buộc tạo OpenSpec change khi:
- Thêm API endpoint MỚI (không phải thêm vào controller có sẵn)
- Thêm/sửa/xóa bảng database
- Feature mới cần cả Backend + Frontend
- Refactor ảnh hưởng > 5 files
- Tích hợp hệ thống bên ngoài  

KHÔNG cần OpenSpec khi:
- Bug fix đơn giản
- Thêm field vào DTO/entity có sẵn
- Performance optimization không đổi behavior
- Thêm endpoint nhỏ vào controller có sẵn → dùng `/add-api-endpoint`

## QUY TẮC VIẾT SPEC

1. Tên change: kebab-case (VD: `bulk-import-csv`, `add-report-dashboard`)
2. Delta spec dùng sections: ADDED / MODIFIED / REMOVED
3. API contract specs PHẢI có request/response JSON schema      
4. Database specs PHẢI có DDL statement
5. Cross-repo: cùng tên change ở cả BE và FE repo

## CUSTOM SCHEMAS

| Schema | Dùng khi | Artifacts | Rules bắt buộc |
|--------|---------|-----------|----------------|
| `api-change` | Thêm/sửa API endpoints | proposal, specs, design, tasks | Proposal có API Contract, Design có JOOQ mapping, Tasks có Q_FUNCTION |
| `db-migration` | Thay đổi database schema | proposal, specs, tasks | Proposal có DDL, Specs ghi rõ schema (EVNTMS/HOSO) |
| `integration` | Tích hợp hệ thống ngoài | proposal, specs, design, tasks | Proposal có sequence diagram, Design có error handling + retry |

## WORKFLOW

```
explore (optional) → propose → user review → apply → verify → archive
```

## GIT POLICY

Tất cả nội dung `openspec/` đều PHẢI commit vào git:
- `openspec/specs/` → Source of truth
- `openspec/changes/` → Active changes, review trong PR
- `openspec/changes/archive/` → Audit trail
- `openspec/config.yaml` → Project config
