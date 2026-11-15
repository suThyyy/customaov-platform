---
trigger: glob
globs: **/*.component.ts, **/*.tsx, **/*.vue
---

# Frontend Filter Pattern
**Activation Mode: Glob Pattern — Kích hoạt khi làm việc với component files**

> ⚠️ **CHƯA CẤU HÌNH** — File này cần được cập nhật theo UI library thực tế (PrimeNG, Ant Design, MUI...).

## HƯỚNG DẪN CHO AI AGENT

Khi nhận yêu cầu cập nhật rule này, hãy:
1. Đọc `package.json` → xác định UI library
2. Đọc các component có filter → xác định filter patterns đang dùng
3. Viết nội dung bao gồm các sections sau

### Sections bắt buộc:

#### FILTER TYPES & IMPLEMENTATION
Cho mỗi loại filter, viết code mẫu:

1. **SINGLE-SELECT FILTER** (Radio/Chip)
   - State variable
   - Options definition
   - Toggle method
   - HTML template

2. **MULTI-SELECT FILTER** (Checkbox)
   - State variable (Array)
   - Options definition
   - Binding pattern
   - HTML template

3. **CLIENT-SIDE FILTER FUNCTION** (BẮT BUỘC)
   - Code mẫu `applyClientSideFilters()` method
   - Pattern: clone array → chain filters → update display list

4. **TREE SELECT FILTER** (nếu có)
   - Build tree from data
   - Node select handler

5. **DATE RANGE FILTER**
   - Date picker component pattern
   - Range filter logic

#### CRITICAL RULES
- ✅ Single-select: `null` để clear, toggle với `===`
- ✅ Multi-select: array `[]`, binding
- ✅ Filter function: clone `[...allData]` trước khi filter
- ✅ Gọi filter function sau MỌI thay đổi
- ❌ KHÔNG mutate source data array trực tiếp
- ✅ Sử dụng optional chaining `?.` và nullish coalescing `??`