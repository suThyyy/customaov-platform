---
trigger: glob
globs: **/*.ts, **/*.tsx, **/*.vue, **/*.jsx, **/*.component.ts
---

# Frontend Core Conventions
**Activation Mode: Glob Pattern — Kích hoạt khi làm việc với frontend source files**

> ⚠️ **CHƯA CẤU HÌNH** — File này cần được cập nhật theo tech stack frontend thực tế.

## HƯỚNG DẪN CHO AI AGENT

Khi nhận yêu cầu cập nhật rule này, hãy:
1. Đọc `package.json` → xác định framework (Angular, React, Vue, Next.js...)
2. Đọc các component hiện có → xác định component pattern
3. Đọc UI library config → xác định UI components
4. Viết nội dung bao gồm các sections sau

### Sections bắt buộc:

#### TECH STACK
- Framework + version
- UI Library + version
- CSS solution (TailwindCSS, SCSS, CSS Modules...)
- Language (TypeScript, JavaScript)

#### NAMING CONVENTIONS
- File/Folder naming (kebab-case, camelCase...)
- Class/Component naming
- Variable/Function naming
- UI fields suffix convention (nếu có)
- Constants naming
- Comment language

#### COMPONENT STRUCTURE (Thứ tự bắt buộc)
- Thứ tự các sections trong component code
- Ví dụ: Services → Variables → Lifecycle → Methods → Handlers

#### DATA TRANSFORM PATTERN
- Cách transform data từ API response sang UI model
- UI fields mapping pattern

#### ERROR HANDLING
- Standard error handling pattern trong components
- Toast/notification pattern

#### CRITICAL RULES
- Checklist ✅ ❌ cho frontend conventions