---
trigger: always_on
---

# Frontend Security Rules
**Activation Mode: Always On**

## CRITICAL SECURITY RULES

### 1. XSS PREVENTION
```
// ✅ Framework tự động sanitize (Angular, React, Vue)
// Sử dụng template binding: {{ userInput }}, {userInput}, v-text="userInput"

// ❌ SAI - Bypass security
bypassSecurityTrustHtml(userInput)    // Angular
dangerouslySetInnerHTML={userInput}    // React
v-html="userInput"                     // Vue (cẩn thận!)

// ✅ ĐÚNG - Chỉ bypass khi data đã được validate từ server
```

### 2. INPUT VALIDATION
```
// ✅ Validate trước khi gửi API
onSubmit() {
    if (!this.validateInput()) {
        showError('Vui lòng kiểm tra lại thông tin');
        return;
    }
    this.service.create(this.formData).subscribe({...});
}
```

### 3. SECURE STORAGE
```
// ✅ ĐÚNG - Token lưu localStorage/sessionStorage
storage.setItem('access_token', token);

// ❌ SAI - Không lưu sensitive data
storage.setItem('password', password);     // WRONG!
storage.setItem('credit_card', cardNo);    // WRONG!

// ✅ ĐÚNG - Clear token khi logout
logout() {
    storage.removeItem('access_token');
    storage.removeItem('refresh_token');
}
```

### 4. ERROR HANDLING
```
// ❌ SAI - Expose error details
alert(JSON.stringify(error));    // WRONG!
console.log(error.response);    // Visible in browser dev tools

// ✅ ĐÚNG - User-friendly message
console.error('Error:', error);  // Log chi tiết (production nên tắt)
showToast({
    severity: 'error',
    summary: 'Lỗi',
    detail: 'Có lỗi xảy ra, vui lòng thử lại'
});
```

### 5. HTTP INTERCEPTOR SECURITY
```
// ✅ Auth interceptor phải:
// 1. Gắn JWT token vào Authorization header
// 2. Handle 401 → tự động refresh token
// 3. Nếu refresh fail → logout + redirect login
```

## SECURITY CHECKLIST
- ❌ KHÔNG sử dụng `bypassSecurityTrust*` / `dangerouslySetInnerHTML` trừ khi thực sự cần
- ✅ Validate tất cả input trước khi gửi API
- ❌ KHÔNG lưu sensitive data trong localStorage
- ✅ Clear tokens khi logout
- ✅ User-friendly error messages (không expose chi tiết)
- ✅ HTTPS cho tất cả API calls
- ✅ JWT token trong Authorization header
- ✅ Handle 401/403 errors gracefully

## COMMON VULNERABILITIES
```
// ❌ SAI - innerHTML với user input
element.innerHTML = userInput;

// ✅ ĐÚNG - textContent
element.textContent = userInput;

// ❌ SAI - eval() với user input
eval(userInput);     // NEVER do this!

// ✅ ĐÚNG - Không bao giờ dùng eval()
```
