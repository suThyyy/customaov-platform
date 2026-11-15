-- ============================================================
-- SCHEMA NGHIỆP VỤ (Demo)
-- File này chứa các bảng mẫu cho module nghiệp vụ chính.
-- Thay thế bằng schema thực tế của dự án.
-- ============================================================

-- Bảng danh mục loại (ví dụ)
create table DM_LOAI
(
    ID             NUMBER generated as identity primary key,
    MA_LOAI        VARCHAR2(50) not null,
    TEN_LOAI       VARCHAR2(200),
    MO_TA          VARCHAR2(500),
    TRANG_THAI     NUMBER(1) default 1,
    USER_CR_ID     VARCHAR2(50),
    USER_CR_DTIME  DATE,
    USER_MDF_ID    VARCHAR2(50),
    USER_MDF_DTIME DATE
);

-- Bảng dữ liệu chính (ví dụ)
create table DL_CHINH
(
    ID             NUMBER generated as identity primary key,
    MA             VARCHAR2(50) not null,
    TEN            VARCHAR2(500),
    MO_TA          CLOB,
    MA_LOAI        VARCHAR2(50),
    TRANG_THAI     NUMBER(1) default 1,
    NGAY_TAO       DATE default sysdate,
    USER_CR_ID     VARCHAR2(50),
    USER_CR_DTIME  DATE,
    USER_MDF_ID    VARCHAR2(50),
    USER_MDF_DTIME DATE
);

-- ============================================================
-- HƯỚNG DẪN:
-- 1. Thay thế file này bằng DDL thực tế
-- 2. Nếu dự án dùng single schema → gộp vào 1 file
-- 3. Nếu dự án dùng multi-schema → tạo file riêng cho mỗi schema
-- 4. Tên file: Schema_[TenSchema].sql
-- ============================================================
