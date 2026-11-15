-- ============================================================
-- SAMPLE DATA (Demo)
-- File này chứa dữ liệu mẫu cho development/testing.
-- Thay thế bằng data thực tế của dự án.
-- ============================================================

-- Sample Q_FUNCTION entries
INSERT INTO Q_FUNCTION (FUNCTIONID, FUNCTIONNAME, URL, ISPUBLIC, ISLOGIN, ISMENU, ENABLE)
VALUES ('MENU_DASHBOARD', 'Dashboard', '/dashboard', 0, 0, 1, 1);

INSERT INTO Q_FUNCTION (FUNCTIONID, FUNCTIONNAME, URL, ISPUBLIC, ISLOGIN, ISMENU, ENABLE)
VALUES ('API_SAMPLE_LIST', 'Lấy danh sách', '/api/sample/list', 0, 1, 0, 1);

INSERT INTO Q_FUNCTION (FUNCTIONID, FUNCTIONNAME, URL, ISPUBLIC, ISLOGIN, ISMENU, ENABLE)
VALUES ('API_SAMPLE_SAVE', 'Lưu dữ liệu', '/api/sample/save', 0, 1, 0, 1);

-- Sample Q_ROLE entries
INSERT INTO Q_ROLE (ROLEID, ROLEDESC, ENABLE)
VALUES ('ADMIN', 'Quản trị hệ thống', 1);

INSERT INTO Q_ROLE (ROLEID, ROLEDESC, ENABLE)
VALUES ('USER', 'Người dùng', 1);

-- ============================================================
-- HƯỚNG DẪN:
-- 1. Thêm data mẫu cho các bảng nghiệp vụ
-- 2. Đảm bảo relationships (FK) hợp lệ
-- 3. Dùng cho môi trường development/testing
-- ============================================================
