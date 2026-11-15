---
trigger: glob
globs: **/*Repository*.java, **/*Repository*.ts, **/*Repository*.kt, **/*Repo*.go
---

# Repository Pattern
**Activation Mode: Glob Pattern — Kích hoạt khi làm việc với Repository files**

> ⚠️ **CHƯA CẤU HÌNH** — File này cần được cập nhật theo data access pattern thực tế của dự án.

## HƯỚNG DẪN CHO AI AGENT

Khi nhận yêu cầu cập nhật rule này, hãy:
1. Đọc các Repository files hiện có → xác định pattern đang dùng
2. Đọc ORM/data access config → xác định công nghệ (JOOQ, JPA, MyBatis, Prisma, TypeORM...)
3. Đọc BaseRepository (nếu có) → xác định base methods
4. Viết nội dung rule bao gồm các sections sau

### Sections bắt buộc:

#### REPOSITORY STRUCTURE
- Code mẫu hoàn chỉnh: Interface + Implementation
- Annotations bắt buộc
- Constructor injection pattern

#### BASE REPOSITORY METHODS
- Table: Method → Mô tả → Return Type

#### DATA SOURCE / CONTEXT CONFIGURATION
- Cách inject data source (Qualifier, configuration...)
- Multi-schema handling (nếu có)

#### COMMON QUERY PATTERNS
- SELECT (single record, multiple records, with JOIN, with conditions)
- INSERT (single, batch)
- UPDATE
- DELETE
- Exists check
- Count
- Pagination

#### CRITICAL RULES
- Checklist các quy tắc BẮT BUỘC (✅) và KHÔNG ĐƯỢC (❌)
- Ví dụ: parameterized queries, return DTO not Entity, etc.