-- ============================================================
-- SCHEMA QUẢN TRỊ HỆ THỐNG (Demo)
-- File này chứa các bảng mẫu cho module quản trị.
-- Thay thế bằng schema thực tế của dự án.
-- ============================================================

-- Bảng phân quyền API
-- Mỗi API endpoint cần được khai báo ở đây
create table Q_FUNCTION
(
    FUNCTIONID    VARCHAR2(50) not null primary key,
    FUNCTIONNAME  VARCHAR2(100),
    URL           VARCHAR2(255),
    ISPUBLIC      NUMBER(1),        -- 1: Public, 0: Cần token
    ISLOGIN       NUMBER(1),        -- 1: Check phân quyền, 0: Không check
    ISMENU        NUMBER(1),        -- 1: Menu item, 0: API only
    ENABLE        NUMBER(1),
    USER_CR_ID    VARCHAR2(50),
    USER_CR_DTIME DATE
);

-- Bảng người dùng
create table Q_USER
(
    USERID         VARCHAR2(200) not null primary key,
    USERNAME       VARCHAR2(200) not null,
    PASSWORD       VARCHAR2(200),
    EMAIL          VARCHAR2(200),
    ENABLE         NUMBER(1),
    ORGID          VARCHAR2(50),
    USER_CR_ID     VARCHAR2(50),
    USER_CR_DTIME  DATE,
    USER_MDF_ID    VARCHAR2(50),
    USER_MDF_DTIME DATE
);

-- Bảng vai trò
create table Q_ROLE
(
    ROLEID   VARCHAR2(50) not null primary key,
    ROLEDESC VARCHAR2(100),
    ENABLE   NUMBER(1)
);

-- Bảng gán vai trò cho user
create table Q_USER_ROLE
(
    USERID VARCHAR2(50) not null references Q_USER,
    ROLEID VARCHAR2(50) not null references Q_ROLE,
    ENABLE NUMBER(1) default 1,
    primary key (USERID, ROLEID)
);

-- Bảng tổ chức
create table S_ORGANIZATION
(
    ORGID          VARCHAR2(50) not null primary key,
    ORGDESC        VARCHAR2(500),
    ORGCODE        VARCHAR2(50),
    ACTIVE         NUMBER(1),
    ORGID_PARENT   VARCHAR2(50),
    USER_CR_ID     VARCHAR2(50),
    USER_CR_DTIME  DATE,
    USER_MDF_ID    VARCHAR2(50),
    USER_MDF_DTIME DATE
);

-- ============================================================
-- HƯỚNG DẪN:
-- 1. Thay thế file này bằng DDL thực tế của dự án
-- 2. Giữ format CREATE TABLE cho AI Agent dễ đọc
-- 3. Thêm COMMENT ON ... nếu cần giải thích column
-- 4. Đặt tên file theo schema: Schema_[TenSchema].sql
-- ============================================================
