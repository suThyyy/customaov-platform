# Frontend Web — Project Context

> ⚠️ **CHƯA CẤU HÌNH** — File này là template. AI Agent cần đọc source code và tự generate nội dung.

---

## HƯỚNG DẪN CHO AI AGENT

Khi được yêu cầu tạo `AGENTS.md`, hãy thực hiện các bước sau:

### Bước 1: Scan Project
1. Đọc `package.json` → xác định **framework**, **UI library**, **dependencies**
2. Đọc config files (`angular.json`, `vite.config.ts`, `next.config.js`...) → xác định **build tool** và **settings**
3. Quét cấu trúc thư mục `src/` → xác định **project structure**
4. Đọc routing config → xác định **page/feature structure**
5. Đọc interceptors/middleware → xác định **auth flow**
6. Đọc API config → xác định **API integration pattern**

### Bước 2: Viết nội dung AGENTS.md

Fill các sections sau dựa trên kết quả scan:

---

## Sections bắt buộc

### 1. Tổng Quan Dự Án
- Mô tả ngắn gọn dự án
- Repo, team info

### 2. Tech Stack
- Table: Framework, UI Library, CSS, State Management, HTTP Client, Language, Build Tool, Linting, Auth, Deploy...

### 3. Kiến Trúc Tổng Quan
- Diagram tổng quan (Browser → Interceptors → Backend APIs)
- URL configuration pattern (runtime config, environment variables...)

### 4. Cấu Trúc Thư Mục
- Cây thư mục chi tiết với mô tả
- Đánh dấu ★ cho folders/files quan trọng

### 5. Nghiệp Vụ Chính
- Luồng xử lý chính (workflow diagram)
- Mô hình dữ liệu quan trọng (entities/models)
- Flags quan trọng từ API

### 6. API Architecture
- Base URL pattern
- API groups table (prefix, mô tả)
- Response format chuẩn
- Upload/Download patterns

### 7. Authentication
- Login flows
- Auth interceptor logic
- Route guards
- Token management

### 8. Conventions & Patterns
- Naming conventions (file/folder, class, variable, UI fields)
- Service pattern
- Component pattern (thứ tự sections trong component)
- Error handling pattern

### 9. Build & Run
- Dev/Prod commands
- Docker build
- CI/CD overview

### 10. Tích Hợp Hệ Thống Ngoài
- Table: hệ thống, mô tả, API prefix

### 11. Files Quan Trọng Cần Biết
- Table: file, vai trò, khi nào đọc

### 12. Lưu Ý Cho Agent
- Danh sách bullet points các lưu ý quan trọng khi làm việc với codebase

---

## Quy tắc viết

- **Ngôn ngữ:** Tiếng Việt, thuật ngữ kỹ thuật giữ tiếng Anh
- **Code examples:** Lấy từ source code thực tế của dự án
- **Diagrams:** Sử dụng ASCII art hoặc Mermaid
- **Tables:** Ưu tiên format table cho dữ liệu có cấu trúc
- **Icons:** Dùng ✅ ❌ để đánh dấu DO/DON'T
