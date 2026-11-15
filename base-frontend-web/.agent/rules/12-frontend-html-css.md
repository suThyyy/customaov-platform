---
trigger: glob
globs: **/*.html, **/*.component.ts, **/*.tsx, **/*.vue
---

# Frontend HTML & CSS Pattern
**Activation Mode: Glob Pattern — Kích hoạt khi làm việc với template/component files**

> ⚠️ **CHƯA CẤU HÌNH** — File này cần được cập nhật theo UI library và CSS framework thực tế.

## HƯỚNG DẪN CHO AI AGENT

Khi nhận yêu cầu cập nhật rule này, hãy:
1. Đọc `package.json` → xác định UI library (PrimeNG, MUI, Ant Design, Vuetify...)
2. Đọc CSS config → xác định CSS framework (TailwindCSS, SCSS, CSS Modules...)
3. Đọc các template/component hiện có → xác định HTML patterns
4. Viết nội dung bao gồm các sections sau

### Sections bắt buộc:

#### HTML TEMPLATE STRUCTURE
- Section comments pattern (BẮT BUỘC comments đánh dấu)
- Layout structure (page container, grid, sidebar...)

#### UI COMPONENT PATTERNS
Cho mỗi component type thường dùng, viết code mẫu:
- **Table** (data table, pagination, sorting, empty state)
- **Dialog/Modal** (form dialog, footer buttons)
- **Form** (fields, labels, validation messages)
- **Tree Select** (nếu có)
- **Date Picker** (single, range)

#### CSS STYLES PATTERN
- Component styles placement (inline, external, modules...)
- Common CSS classes (layout, cards, badges, filters...)
- Responsive breakpoints

#### CSS FRAMEWORK UTILITIES (nếu dùng TailwindCSS/Bootstrap...)
- Spacing, Flexbox, Grid, Text, Colors, Borders, Sizing

#### CRITICAL RULES
- ✅ LUÔN có section comments trong HTML
- ✅ CSS framework utilities trước, custom CSS sau
- ✅ Class naming: kebab-case
- ✅ Responsive: Mobile-first approach
- ❌ KHÔNG dùng inline styles trừ khi dynamic
- ✅ Status badges: Dynamic class binding