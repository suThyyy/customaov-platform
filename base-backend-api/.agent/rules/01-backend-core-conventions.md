---
trigger: always_on
---
# Backend Core Conventions

> **TEMPLATE – stack chưa chốt, sẽ quyết trong PRD** (`docs/product/PRD.md`). Ví dụ Java/Spring/jOOQ… trong file này chỉ là mẫu, KHÔNG phải stack đã chọn của customAOV.
**Activation Mode: Always On**

> ⚠️ **CHƯA CẤU HÌNH** — File này cần được cập nhật theo tech stack thực tế của dự án.

## HƯỚNG DẪN CHO AI AGENT

Khi nhận yêu cầu cập nhật rule này, hãy:
1. Đọc file build config (`pom.xml`, `build.gradle`, `package.json`) → xác định tech stack
2. Đọc cấu trúc thư mục `src/` → xác định project structure
3. Đọc các file DTO/Model hiện có → xác định DTO pattern
4. Viết nội dung rule bao gồm các sections sau

### Sections bắt buộc:

#### TECH STACK
- Language + version
- Framework + version
- Database + version
- ORM/Data access library

#### PROJECT STRUCTURE
- Cây thư mục source code (ASCII)
- Mô tả từng package/folder

#### DTO PATTERN (nếu có)
- Cấu trúc DTO class mẫu (với annotations thực tế)
- Quy tắc field naming
- Serialization annotations (@JsonProperty, @SerializedName...)
- Inheritance pattern (BaseDTO...)

#### NAMING CONVENTION
- Table: Loại → Convention → Ví dụ
- Bao gồm: DTO Class, DTO Field, API properties, Repository, Service, Controller

#### SCHEMA MAPPING (nếu multi-schema)
- Table: Schema → Package → Mô tả

#### AUDIT FIELDS (nếu có)
- Các audit columns standard
- Cách set trong code

---

## Quy tắc viết rule:
- Code examples phải lấy từ source code thực tế
- Dùng ✅ ❌ để đánh dấu ĐÚNG/SAI
- Comment giải thích bằng tiếng Việt, thuật ngữ kỹ thuật giữ tiếng Anh
