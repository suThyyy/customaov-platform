# Backend API — Project Context

> ⚠️ **CHƯA CẤU HÌNH** — File này là template. AI Agent cần đọc source code và tự generate nội dung.

---

## HƯỚNG DẪN CHO AI AGENT

Khi được yêu cầu tạo `AGENTS.md`, hãy thực hiện các bước sau:

### Bước 1: Scan Project
1. Đọc file build config (`pom.xml`, `build.gradle`, `package.json`...) → xác định **tech stack** và **dependencies**
2. Quét cấu trúc thư mục `src/` → xác định **project structure**
3. Đọc file config (application.yml/properties, DataSource configs) → xác định **database** và **external services**
4. Đọc file security config → xác định **authentication/authorization flow**
5. Đọc existing code patterns (Controller, Service, Repository) → xác định **coding conventions**

### Bước 2: Viết nội dung AGENTS.md

Fill các sections sau dựa trên kết quả scan:

---

## Sections bắt buộc

### 1. Tổng Quan Kiến Trúc
- Bối cảnh hệ thống (system context diagram dạng ASCII)
- Tech stack table (Language, Framework, ORM, Database, Security, Build tool, API docs...)
- External services/integrations

### 2. Cấu Trúc Project
- Cây thư mục chi tiết với mô tả từng package/folder
- Đánh dấu file/folder quan trọng

### 3. Core Modules & Nghiệp Vụ
- Liệt kê các module chính của hệ thống
- Mô tả nghiệp vụ cốt lõi
- Các bảng database quan trọng (grouped by module)
- Relationships giữa các entities

### 4. Database
- Schema architecture (single/dual/multi schema)
- ORM config (DSLContext, EntityManager, DataSource qualifiers...)
- Code generation (nếu có — JOOQ, MyBatis Generator...)
- Audit fields pattern

### 5. Coding Patterns (Tóm Tắt)
- Layered architecture diagram
- Nguyên tắc separation of concerns
- Interface + Implementation pattern
- DTO pattern (annotations, naming)
- Response wrapper pattern
- Naming conventions table

### 6. Controllers Overview
- Table liệt kê tất cả controllers: tên, base path, nghiệp vụ chính

### 7. Key Services
- Table liệt kê các service files lớn/quan trọng: tên, size, mô tả

### 8. Security
- Authentication/Authorization flow diagram
- Filter chain / Interceptor pipeline
- Security rules checklist

### 9. Build & Deploy
- Build commands (local dev, compile, test)
- CI/CD pipeline overview
- Deploy notes

### 10. Agent Communication
- Handoff protocol giữa BE ↔ FE Agent (tham chiếu `docs/handoff.md`)
- Agent slash commands overview

### 11. Quick Reference
- Checklist tạo API mới (step-by-step)
- File quan trọng cần đọc trước (table)

---

## Quy tắc viết

- **Ngôn ngữ:** Tiếng Việt, thuật ngữ kỹ thuật giữ tiếng Anh
- **Code examples:** Lấy từ source code thực tế của dự án
- **Diagrams:** Sử dụng ASCII art hoặc Mermaid
- **Tables:** Ưu tiên format table cho dữ liệu có cấu trúc
- **Icons:** Dùng ✅ ❌ để đánh dấu DO/DON'T
