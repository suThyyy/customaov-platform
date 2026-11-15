---
trigger: glob
globs: **/*Controller*.java, **/*Controller*.ts, **/*controller*.go, **/*Handler*.kt
---

# REST API Controller Pattern
**Activation Mode: Glob Pattern — Kích hoạt khi làm việc với Controller files**

> ⚠️ **PHẦN CODE MẪU CHƯA CẤU HÌNH** — Nguyên tắc REST chung đã sẵn sàng, code mẫu cần cập nhật theo dự án.

---

## NGUYÊN TẮC CHUNG (Áp dụng mọi dự án)

### REST API Conventions:

#### URL Pattern:
| Method | Pattern | Ví dụ |
|--------|---------|-------|
| GET All | `/api/{module}/{resource}` | `GET /api/catalog/products` |
| GET By ID | `/api/{module}/{resource}/{id}` | `GET /api/catalog/products/123` |
| POST | `/api/{module}/{resource}` | `POST /api/catalog/products` |
| PUT | `/api/{module}/{resource}` | `PUT /api/catalog/products` |
| DELETE | `/api/{module}/{resource}/{id}` | `DELETE /api/catalog/products/123` |

#### Naming Rules:
- ✅ URL: lowercase, noun (không verb)
- ✅ Plural nouns cho collections
- ✅ Consistent naming across endpoints

#### HTTP Status Codes:
| Status | Khi nào dùng |
|--------|-------------|
| **200 OK** | GET/PUT/DELETE thành công |
| **201 Created** | POST thành công |
| **400 Bad Request** | Validation lỗi, dữ liệu invalid |
| **401 Unauthorized** | Chưa đăng nhập |
| **403 Forbidden** | Không có quyền |
| **404 Not Found** | Resource không tồn tại |
| **500 Internal Server Error** | Lỗi server |

### Error Handling Pattern:
```
try {
    // 1. Call service
    // 2. Check result (null → 404, false → 400)
    // 3. Return success response
} catch (BusinessException) {
    // Log warning + return business error message
} catch (Exception) {
    // Log error detail + return generic error message (KHÔNG expose stack trace)
}
```

### CRITICAL RULES (chung):
- ✅ Input validation (annotations hoặc manual check)
- ✅ API documentation (Swagger/OpenAPI annotations)
- ❌ KHÔNG xử lý business logic trong controller
- ❌ KHÔNG gọi repository trực tiếp từ controller
- ✅ Log errors nhưng KHÔNG expose stack trace cho client
- ✅ Consistent response wrapper

---

## PHẦN CẦN CẬP NHẬT (Tech-specific)

> AI Agent cần điền dựa trên source code:

### CONTROLLER STRUCTURE
- Code mẫu hoàn chỉnh (annotations, constructor injection, methods)
- Response wrapper class/pattern
- API documentation annotations

### RESPONSE DATA PATTERN
- Success/Error response format (JSON structure)

### INPUT VALIDATION
- Validation annotations/decorators đang dùng