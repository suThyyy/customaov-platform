-- =====================================================================
-- Script: Lấy cây tổ chức của phòng ban mà user đang làm việc
-- Mô tả: Tổng hợp từ hàm getUserOrganization trong QTHTService.java
-- Logic:
--   1. Lấy role của user từ Q_USER_ROLE
--   2. Tìm role cha (cấp quản lý) từ Q_ROLE.ROLEID_PARENT
--   3. Build tree từ role cha xuống bao gồm tất cả nhân sự
-- =====================================================================

-- Tham số đầu vào (thay giá trị thực tế)
DEFINE p_user_id = 'USER_ID_CAN_TRA_CUU';

-- =====================================================================
-- BƯỚC 1: Lấy danh sách ROLE của user
-- =====================================================================
WITH ds_role_user AS (
    SELECT DISTINCT ur.ROLEID
    FROM Q_USER_ROLE ur
    WHERE ur.USERID = '&p_user_id'
      AND ur.ENABLE = 1
),

-- =====================================================================
-- BƯỚC 2: Tìm ROLE CHA (cấp quản lý) của mỗi role
-- =====================================================================
ds_role_root AS (
    SELECT 
        r.ROLEID AS USER_ROLEID,
        -- Nếu có role cha thì lấy role cha, không thì lấy chính role đó
        COALESCE(NULLIF(r.ROLEID_PARENT, ''), r.ROLEID) AS ROOT_ROLEID
    FROM Q_ROLE r
    WHERE r.ROLEID IN (SELECT ROLEID FROM ds_role_user)
),

-- =====================================================================
-- BƯỚC 3: Lấy tất cả role trong cây (từ root xuống - đệ quy)
-- =====================================================================
ds_all_roles_in_tree AS (
    SELECT 
        ROLEID,
        ROLEDESC,
        ROLEID_PARENT,
        LEVEL AS TREE_LEVEL
    FROM Q_ROLE
    START WITH ROLEID IN (SELECT DISTINCT ROOT_ROLEID FROM ds_role_root)
    CONNECT BY PRIOR ROLEID = ROLEID_PARENT
),

-- =====================================================================
-- BƯỚC 4: Lấy thông tin nhân viên của mỗi role
-- =====================================================================
ds_employees AS (
    SELECT 
        ur.ROLEID,
        u.USERID,
        u.USERNAME,
        cv.MA_CHUC_VU,
        cv.TEN_CHUC_VU,
        cv.CAP_BAC
    FROM Q_USER_ROLE ur
    JOIN Q_USER u ON ur.USERID = u.USERID AND u.ENABLE = 1
    LEFT JOIN (
        SELECT 
            ur2.USERID,
            ur2.ROLEID,
            ur2.MA_CHUC_VU,
            chucvu.TEN_CHUC_VU,
            chucvu.CAP_BAC
        FROM Q_USER_ROLE ur2
        JOIN Q_CHUC_VU chucvu ON ur2.MA_CHUC_VU = chucvu.MA_CHUC_VU
        WHERE ur2.ENABLE = 1
    ) cv ON ur.USERID = cv.USERID AND ur.ROLEID = cv.ROLEID
    WHERE ur.ENABLE = 1
      AND ur.ROLEID IN (SELECT ROLEID FROM ds_all_roles_in_tree)
),

-- =====================================================================
-- BƯỚC 5: Lấy nghiệp vụ của từng nhân viên
-- =====================================================================
ds_nghiep_vu AS (
    SELECT 
        e.USERID,
        e.ROLEID,
        LISTAGG(nv.TEN_NGHIEP_VU, ', ') WITHIN GROUP (ORDER BY nv.MA_NGHIEP_VU) AS DANH_SACH_NGHIEP_VU
    FROM ds_employees e
    LEFT JOIN Q_NGHIEP_VU nv ON e.MA_CHUC_VU = nv.MA_CHUC_VU
    GROUP BY e.USERID, e.ROLEID
)

-- =====================================================================
-- QUERY CHÍNH: Lấy cây tổ chức với thông tin đầy đủ
-- =====================================================================
SELECT 
    -- Thông tin phòng ban / role
    t.TREE_LEVEL AS CAP_BAC,
    LPAD(' ', (t.TREE_LEVEL - 1) * 4) || t.ROLEID AS ROLEID_INDENT,
    t.ROLEID,
    t.ROLEDESC AS TEN_PHONG_BAN,
    t.ROLEID_PARENT AS ROLEID_CHA,
    
    -- Thông tin nhân viên
    e.USERID,
    e.USERNAME AS HO_TEN,
    e.MA_CHUC_VU,
    e.TEN_CHUC_VU,
    e.CAP_BAC AS CAP_BAC_CHUC_VU,
    
    -- Nghiệp vụ
    nv.DANH_SACH_NGHIEP_VU,
    
    -- Đánh dấu user được truyền vào
    CASE WHEN e.USERID = '&p_user_id' THEN 'X' ELSE '' END AS LA_USER_HIEN_TAI

FROM ds_all_roles_in_tree t
LEFT JOIN ds_employees e ON t.ROLEID = e.ROLEID
LEFT JOIN ds_nghiep_vu nv ON e.USERID = nv.USERID AND e.ROLEID = nv.ROLEID

ORDER BY 
    t.TREE_LEVEL,
    t.ROLEID,
    e.CAP_BAC NULLS LAST,
    e.USERNAME;

-- =====================================================================
-- QUERY PHỤ 1: Chỉ lấy danh sách phòng ban (không có nhân sự)
-- =====================================================================
/*
SELECT 
    TREE_LEVEL AS CAP_BAC,
    LPAD(' ', (TREE_LEVEL - 1) * 4) || ROLEID AS ROLEID_HIERARCHY,
    ROLEID,
    ROLEDESC AS TEN_PHONG_BAN,
    ROLEID_PARENT AS ROLEID_CHA
FROM ds_all_roles_in_tree
ORDER BY TREE_LEVEL, ROLEID;
*/

-- =====================================================================
-- QUERY PHỤ 2: Lấy role gốc (cấp quản lý) của user
-- =====================================================================
/*
SELECT 
    '&p_user_id' AS USERID,
    USER_ROLEID AS ROLE_CUA_USER,
    ROOT_ROLEID AS ROLE_CAP_QUAN_LY,
    r_user.ROLEDESC AS TEN_PHONG_USER,
    r_root.ROLEDESC AS TEN_PHONG_QUAN_LY
FROM ds_role_root
JOIN Q_ROLE r_user ON USER_ROLEID = r_user.ROLEID
JOIN Q_ROLE r_root ON ROOT_ROLEID = r_root.ROLEID;
*/
