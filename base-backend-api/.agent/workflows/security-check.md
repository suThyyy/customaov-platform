---
description: Scan file hiện tại tìm lỗi bảo mật
---

### 5. Security Check (Kiểm tra bảo mật)
**Command:** `/security-check`
**Mô tả:** Scan file hiện tại tìm lỗi bảo mật

**Workflow steps:**
1. Check SQL injection risks (string concatenation)
2. Check hardcoded secrets/passwords
3. Check missing input validation
4. Check exposed stack traces in error handling
5. Report findings với line numbers

**Expected output:**
```
⚠️  SECURITY ISSUES FOUND:

Line 45: Potential SQL injection - using string concatenation
  → Use JOOQ parameterized query instead

Line 78: Hardcoded password detected
  → Move to environment variables

Line 102: Stack trace exposed to client
  → Use user-friendly error message
```
