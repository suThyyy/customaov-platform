---
trigger: model_decision
description: User hỏi về database queries, đang viết code có chứa database operations, đang implement Repository/DAO methods
---

# Database & ORM Rules

> **TEMPLATE – stack chưa chốt, sẽ quyết trong PRD** (`docs/product/PRD.md`). Ví dụ Java/Spring/jOOQ… trong file này chỉ là mẫu, KHÔNG phải stack đã chọn của customAOV.
**Activation Mode: Model Decision** (AI quyết định khi có database queries)

> ⚠️ **CHƯA CẤU HÌNH** — File này cần được cập nhật theo ORM/database thực tế của dự án.

## HƯỚNG DẪN CHO AI AGENT

Khi nhận yêu cầu cập nhật rule này, hãy:
1. Đọc database config → xác định database type (Oracle, PostgreSQL, MySQL, MongoDB...)
2. Đọc ORM config → xác định ORM (JOOQ, JPA/Hibernate, MyBatis, Prisma, TypeORM...)
3. Đọc các Repository hiện có → xác định query patterns
4. Viết nội dung bao gồm các sections sau

### Sections bắt buộc:

#### DATABASE TECH STACK
- Database + version
- ORM/Data access library + version

#### QUERY PATTERNS
- SELECT (single, multiple, JOIN, conditions)
- INSERT (single, batch)
- UPDATE
- DELETE (hard delete vs soft delete)

#### SQL INJECTION PREVENTION
- ❌ SAI pattern (string concatenation)
- ✅ ĐÚNG pattern (parameterized queries)

#### TRANSACTION HANDLING
- Declarative transactions (annotations)
- Programmatic transactions (nếu cần)

#### COMMON PATTERNS
- Exists check
- Count
- Pagination
- Dynamic conditions / Search filters

#### CRITICAL RULES
- ✅ Parameterized queries — KHÔNG string concatenation
- ✅ Set audit fields khi create/update
- ✅ Soft delete (recommend) thay vì hard delete
- ✅ Sử dụng transactions cho multiple operations
- ❌ KHÔNG expose raw SQL trong logs