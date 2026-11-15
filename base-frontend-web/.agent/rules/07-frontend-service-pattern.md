---
trigger: glob
globs: **/*.service.ts, **/*Service*.ts, **/*api*.ts, **/*service*.tsx
---

# Frontend Service Pattern
**Activation Mode: Glob Pattern — Kích hoạt khi làm việc với service files**

> ⚠️ **CHƯA CẤU HÌNH** — File này cần được cập nhật theo service pattern thực tế.

## HƯỚNG DẪN CHO AI AGENT

Khi nhận yêu cầu cập nhật rule này, hãy:
1. Đọc các service files hiện có → xác định pattern (Angular Injectable, React hooks, Vue composables...)
2. Đọc API config files → xác định URL construction pattern
3. Viết nội dung bao gồm các sections sau

### Sections bắt buộc:

#### SERVICE STRUCTURE
- Code mẫu hoàn chỉnh (decorator/annotation, constructor, methods)
- HTTP client injection pattern
- Base URL construction

#### API URL CONFIGURATION
- Cách define API endpoints (centralized config)
- URL building pattern

#### CRITICAL RULES
- ✅ Centralized API URL config — KHÔNG hardcode URLs
- ✅ HTTP client injection
- ✅ Comment tiếng Việt cho methods
- ✅ Return Observable/Promise
- ❌ KHÔNG xử lý error trong service (để component xử lý)

#### NAMING CONVENTION
- Method name: camelCase
- Service name: PascalCase + "Service"
- File name: kebab-case + ".service.ts"
- Location: chỉ định folder chứa services