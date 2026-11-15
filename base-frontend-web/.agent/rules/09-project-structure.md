---
trigger: manual
---

# Project Structure Guide
**Activation Mode: Manual** (Sử dụng khi tạo file/folder mới)

> ⚠️ **CHƯA CẤU HÌNH** — File này cần được cập nhật theo cấu trúc thực tế của dự án.

## HƯỚNG DẪN CHO AI AGENT

Khi nhận yêu cầu cập nhật rule này, hãy:
1. Quét cấu trúc thư mục `src/` của cả Backend và Frontend
2. Xác định naming conventions đang dùng
3. Viết nội dung bao gồm các sections sau

### Sections bắt buộc:

#### BACKEND STRUCTURE
- Cây thư mục chi tiết (ASCII tree)
- Quy tắc đặt tên package/folder
- Schema mapping (nếu multi-schema)

#### FRONTEND STRUCTURE
- Cây thư mục chi tiết (ASCII tree)
- Quy tắc đặt tên file/folder

#### KHI TẠO FEATURE MỚI

**Backend checklist:**
1. Xác định module/schema
2. Tạo DTO/Model
3. Tạo Repository
4. Tạo Service
5. Tạo Controller
6. Khai báo phân quyền (nếu có)

**Frontend checklist:**
1. Tạo Model/Interface
2. Tạo Service
3. Tạo Component
4. Cập nhật routing
5. Cập nhật API config

#### CRITICAL RULES
- ✅ Follow đúng structure hierarchy
- ✅ Đặt tên file/folder theo convention
- ✅ Tạo đủ các layer theo architecture
- ❌ KHÔNG tạo folder/package tùy ý ngoài structure