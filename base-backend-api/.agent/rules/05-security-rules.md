---
trigger: always_on
---
# Security Rules (ATTT)

> **TEMPLATE – stack chưa chốt, sẽ quyết trong PRD** (`docs/product/PRD.md`). Ví dụ Java/Spring/jOOQ… trong file này chỉ là mẫu, KHÔNG phải stack đã chọn của customAOV.
**Activation Mode: Always On**

## CRITICAL SECURITY RULES (BẮT BUỘC)

> **Vi phạm các quy tắc sau sẽ gây lỗ hổng bảo mật nghiêm trọng!**

### 1. SQL INJECTION PREVENTION

```
// ❌ SAI - String concatenation
String sql = "SELECT * FROM users WHERE id = '" + userId + "'";

// ✅ ĐÚNG - Parameterized queries (ORM hoặc prepared statements)
// Luôn sử dụng parameter binding của ORM/framework
```

**Áp dụng cho mọi công nghệ:**
- JOOQ: `.where(TABLE.COLUMN.eq(value))`
- JPA: `@Query("SELECT u FROM User u WHERE u.id = :id")`
- MyBatis: `#{value}` (không dùng `${value}`)
- Prisma: Tự động parameterized
- Raw SQL: Prepared statements với `?` placeholder

### 2. INPUT VALIDATION

```
// ✅ Validate ở 2 tầng:
// 1. Controller level — Annotations/decorators (@Valid, @NotBlank, class-validator...)
// 2. Service level — Business rules validation
```

### 3. SENSITIVE DATA HANDLING

```
// ❌ SAI - Hardcode secrets
password = "admin123"
apiKey = "sk-1234567890"
dbPassword = "oracle_pwd"

// ✅ ĐÚNG - Environment variables / Application config
// Sử dụng @Value, process.env, os.Getenv() ...
// KHÔNG commit secrets vào git
```

### 4. ERROR HANDLING — KHÔNG EXPOSE STACK TRACE

```
// ❌ SAI - Expose internal details
return error(exception.toString())        // Stack trace lộ ra client!
return error(exception.getStackTrace())   // WRONG!

// ✅ ĐÚNG - User-friendly message + Internal logging
log.error("Error processing request", exception)  // Log chi tiết
return error("Có lỗi xảy ra trong hệ thống")     // Generic message cho user
```

### 5. AUTHENTICATION & AUTHORIZATION

- ✅ Protected APIs phải có authentication (JWT, session, API key...)
- ✅ Check user permissions trước khi thực hiện operations
- ✅ Mỗi API mới phải được khai báo trong hệ thống phân quyền

### 6. LOGGING BEST PRACTICES

```
// ✅ ĐÚNG - Log business info, không log sensitive data
log("User {} created resource with id: {}", userId, resourceId)

// ❌ SAI - Log sensitive data
log("Login: username={}, password={}", username, password)
log("Payment: cardNumber={}", cardNumber)
```

## SECURITY CHECKLIST

### Backend:
- ❌ KHÔNG hardcode secrets, passwords, API keys
- ✅ HTTPS only
- ❌ KHÔNG expose stack trace
- ✅ Parameterized queries — KHÔNG string concatenation SQL
- ✅ Input validation ở cả Controller + Service
- ✅ JWT/Session required cho protected APIs
- ❌ KHÔNG log password, tokens, PII
- ✅ Khai báo API trong hệ thống phân quyền

### Common Vulnerabilities to Avoid:

#### Mass Assignment
```
// ❌ SAI - User có thể set bất kỳ field nào (isAdmin, role...)
update(requestBody)

// ✅ ĐÚNG - Dùng DTO riêng chỉ chứa fields được phép update
update(updateDTO)  // DTO chỉ có name, email — không có isAdmin
```

#### Path Traversal
```
// ❌ SAI
file = new File("/uploads/" + filename)  // User dùng "../etc/passwd"

// ✅ ĐÚNG - Validate filename
if (filename.contains("..") || filename.contains("/")) { reject; }
```

#### IDOR (Insecure Direct Object Reference)
```
// ❌ SAI - Không check ownership
delete(resourceId)  // Bất kỳ user nào cũng xóa được!

// ✅ ĐÚNG - Check user có quyền với resource
if (!canDelete(resourceId, currentUserId)) { reject; }
```

### Audit Trail:
```
// ✅ Luôn set audit fields khi create/update
// CREATE: set createdBy, createdAt
// UPDATE: set modifiedBy, modifiedAt
```
