---
description: Scan file TypeScript/HTML tìm lỗi bảo mật
---

### 12. Security Scan Frontend (Kiểm tra bảo mật frontend)
**Command:** `/frontend-security-scan`
**Mô tả:** Scan file TypeScript/HTML tìm lỗi bảo mật

**Workflow steps:**
1. Check `bypassSecurityTrust*` usage
2. Check `innerHTML` with user input
3. Check hardcoded API URLs
4. Check sensitive data in localStorage
5. Check missing input validation
6. Report findings

**Expected output:**
```
⚠️  SECURITY ISSUES FOUND:

Line 34: Using bypassSecurityTrustHtml
  → Avoid unless absolutely necessary

Line 67: Hardcoded API URL
  → Use config/api/url-api.ts instead

Line 89: Storing password in localStorage
  → Never store sensitive data in localStorage
```
