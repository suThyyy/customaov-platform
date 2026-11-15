---
trigger: glob
globs: **/*Service*.java, **/*Service*.ts, **/*Service*.kt, **/*service*.go
---

# Service Pattern
**Activation Mode: Glob Pattern — Kích hoạt khi làm việc với Service files**

> ⚠️ **CHƯA CẤU HÌNH** — File này cần được cập nhật theo service layer pattern thực tế của dự án.

## HƯỚNG DẪN CHO AI AGENT

Khi nhận yêu cầu cập nhật rule này, hãy:
1. Đọc các Service files hiện có → xác định pattern
2. Đọc BaseService (nếu có) → xác định utility methods
3. Viết nội dung bao gồm **2 phần**: nguyên tắc chung (giữ nguyên) + code mẫu (từ dự án)

---

## NGUYÊN TẮC CHUNG (Áp dụng mọi dự án)

### Layered Architecture — Separation of Concerns

> **CRITICAL**: Service KHÔNG được chứa database queries!

### ✅ Service Layer — CHỈ chứa:
1. **Business Logic**: Validation, authorization, calculations
2. **Orchestration**: Gọi nhiều repositories để hoàn thành workflow
3. **Transformation**: DTO mapping, data aggregation
4. **Transaction Management**: Transaction annotations/decorators

### ❌ Service Layer — KHÔNG được chứa:
1. Database queries (SQL, ORM query builders)
2. Table/Collection references
3. Data access logic trực tiếp

### Validation Pattern:
```
1. Validate null / empty
2. Validate required fields
3. Business rules validation (e.g. check exists)
4. Set audit fields (nếu có)
5. Call repository
```

### Khi nào tạo Repository method mới?
- Nếu Service cần query dữ liệu → **TẠO method trong Repository**
- **KHÔNG** viết query logic trong Service

---

## PHẦN CẦN CẬP NHẬT (Tech-specific)

> Phần dưới đây cần AI Agent điền dựa trên source code thực tế:

### SERVICE STRUCTURE
- Code mẫu: Interface + Implementation (hoặc pattern hiện tại)
- Required annotations/decorators
- Constructor injection pattern

### BASE SERVICE UTILITIES
- Table: Method → Mô tả (lấy từ BaseService thực tế)

### TRANSACTION RULES
- Read-only annotations cho GET methods
- Write transaction config

### CRITICAL RULES (project-specific)
- Package/folder naming
- Annotations bắt buộc
- Injection pattern