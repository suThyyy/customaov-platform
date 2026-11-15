-- =====================================================================
-- Script: Lấy danh sách công việc theo phân quyền user
-- Mô tả: Tổng hợp từ hàm getCongViecByUser trong CongViecService.java
-- Logic phân quyền:
--   1. CUA_TOI: Công việc mà USERID = :p_user_id
--   2. PHONG_TOI: Công việc của phòng ban user (ROLEID trực tiếp + CAP_BAC)
--   3. GIAM_SAT: Công việc của các role con (theo cây tổ chức)
-- =====================================================================

-- Tham số đầu vào (thay giá trị thực tế)
DEFINE p_user_id = 'USER_ID_CAN_TRA_CUU';

-- =====================================================================
-- BƯỚC 1: Lấy danh sách ROLE trực tiếp của user (ENABLE = 1)
-- =====================================================================
-- Query trong Java: qUserRoleRepository.findByUserId(userId)
WITH ds_role_truc_tiep AS (
    SELECT ROLEID
    FROM Q_USER_ROLE
    WHERE USERID = '&p_user_id'
      AND ENABLE = 1
),

-- =====================================================================
-- BƯỚC 2: Lấy danh sách ROLE CON theo đệ quy (cho GIAM_SAT)
-- =====================================================================
-- Query trong Java: qRoleRepository.findChildRolesRecursive(dsRoleTrucTiep)
ds_role_con AS (
    SELECT ROLEID
    FROM Q_ROLE
    WHERE ROLEID IN (
        -- Dùng CONNECT BY để tìm tất cả role con
        SELECT ROLEID
        FROM Q_ROLE
        START WITH ROLEID_PARENT IN (SELECT ROLEID FROM ds_role_truc_tiep)
        CONNECT BY PRIOR ROLEID = ROLEID_PARENT
    )
    -- Loại trừ các role trực tiếp
    AND ROLEID NOT IN (SELECT ROLEID FROM ds_role_truc_tiep)
),

-- =====================================================================
-- BƯỚC 3: Lấy Map<RoleId, CapBac> của user
-- =====================================================================
-- Query trong Java: qUserRoleRepository.findChucVuWithCapBacByUserId(userId)
ds_chuc_vu_user AS (
    SELECT 
        ur.ROLEID,
        MIN(cv.CAP_BAC) AS CAP_BAC  -- Lấy cấp cao nhất (số nhỏ nhất)
    FROM Q_USER_ROLE ur
    JOIN Q_CHUC_VU cv ON ur.MA_CHUC_VU = cv.MA_CHUC_VU
    WHERE ur.USERID = '&p_user_id'
      AND ur.ENABLE = 1
    GROUP BY ur.ROLEID
),

-- =====================================================================
-- BƯỚC 4: Lấy ID công việc CỦA TÔI
-- =====================================================================
-- Query: HS_CONG_VIEC.USERID = :p_user_id
ds_congviec_cua_toi AS (
    SELECT DISTINCT ID
    FROM HS_CONG_VIEC
    WHERE USERID = '&p_user_id'
),

-- =====================================================================
-- BƯỚC 5: Lấy ID công việc PHÒNG TÔI
-- =====================================================================
-- Logic:
--   - CAP_BAC = 1: Xem TẤT CẢ công việc của phòng (trừ công việc của mình)
--   - CAP_BAC > 1: Chỉ xem công việc của người có CAP_BAC lớn hơn (cấp thấp hơn)
ds_congviec_phong_toi AS (
    SELECT DISTINCT cv.ID
    FROM HS_CONG_VIEC cv
    JOIN ds_role_truc_tiep rt ON cv.ROLEID = rt.ROLEID
    LEFT JOIN ds_chuc_vu_user cu ON rt.ROLEID = cu.ROLEID
    LEFT JOIN (
        -- Lấy CAP_BAC của người đang xử lý công việc trong cùng role
        SELECT 
            ur.USERID,
            ur.ROLEID,
            MIN(chucvu.CAP_BAC) AS CAP_BAC_NGUOI_XU_LY
        FROM Q_USER_ROLE ur
        JOIN Q_CHUC_VU chucvu ON ur.MA_CHUC_VU = chucvu.MA_CHUC_VU
        WHERE ur.ENABLE = 1
        GROUP BY ur.USERID, ur.ROLEID
    ) nguoi_xuly ON cv.USERID = nguoi_xuly.USERID AND cv.ROLEID = nguoi_xuly.ROLEID
    WHERE 
        -- Loại trừ công việc đã là CỦA TÔI
        cv.ID NOT IN (SELECT ID FROM ds_congviec_cua_toi)
        -- Loại trừ công việc của chính mình
        AND (cv.USERID IS NULL OR cv.USERID != '&p_user_id')
        -- Điều kiện phân quyền theo CAP_BAC
        AND (
            -- Trường hợp 1: User là CAP_BAC = 1 -> xem được TẤT CẢ
            NVL(cu.CAP_BAC, 999) = 1
            OR
            -- Trường hợp 2: User có CAP_BAC > 1 -> chỉ xem được công việc của người cấp thấp hơn
            (NVL(cu.CAP_BAC, 999) < NVL(nguoi_xuly.CAP_BAC_NGUOI_XU_LY, 0))
        )
),

-- =====================================================================
-- BƯỚC 6: Lấy ID công việc GIÁM SÁT
-- =====================================================================
-- Query: HS_CONG_VIEC.ROLEID IN ds_role_con
-- Loại trừ các công việc đã có trong CUA_TOI và PHONG_TOI
ds_congviec_giam_sat AS (
    SELECT DISTINCT ID
    FROM HS_CONG_VIEC
    WHERE ROLEID IN (SELECT ROLEID FROM ds_role_con)
      AND ID NOT IN (SELECT ID FROM ds_congviec_cua_toi)
      AND ID NOT IN (SELECT ID FROM ds_congviec_phong_toi)
),

-- =====================================================================
-- BƯỚC 7: Gộp tất cả ID công việc có quyền truy cập
-- =====================================================================
tat_ca_id_co_quyen AS (
    SELECT ID, 'CUA_TOI' AS LOAI_HIEN_THI FROM ds_congviec_cua_toi
    UNION ALL
    SELECT ID, 'PHONG_TOI' AS LOAI_HIEN_THI FROM ds_congviec_phong_toi
    UNION ALL
    SELECT ID, 'GIAM_SAT' AS LOAI_HIEN_THI FROM ds_congviec_giam_sat
)

-- =====================================================================
-- QUERY CHÍNH: Lấy chi tiết công việc với đầy đủ thông tin
-- =====================================================================
SELECT 
    -- Từ HS_CONG_VIEC
    cv.ID,
    cv.ORGID,
    cv.MA_YCAU,
    cv.MA_CVIEC,
    cv.MA_CVIEC_CHA,
    cv.TEN_CVIEC,
    cv.SO_NGAY_LVIEC,
    cv.NGAY_BD,
    cv.NGAY_KT,
    cv.GHI_CHU,
    cv.TRANG_THAI,
    cv.USERID,
    cv.ROLEID,
    
    -- Từ HS_YEU_CAU  
    yc.SO_YCAU,
    yc.TIEU_DE,
    yc.UU_TIEN,
    yc.MA_DTUONG,
    yc.TEN_DTUONG,
    yc.MA_CVIEC_HTAI,
    
    -- Từ A_QTRINH
    qt.MA_QT,
    qt.TEN_QT,
    
    -- Từ A_QTRINH_NHOM
    nhom.MA_NHOM_QT,
    nhom.TEN_NHOM_QT,
    
    -- Từ A_QTRINH_CVIEC (để tính HAN_XLY)
    qtcv.THOI_GIAN_XU_LY,
    qtcv.DVI_TG,
    
    -- Phân loại công việc (CUA_TOI > PHONG_TOI > GIAM_SAT)
    (SELECT LOAI_HIEN_THI 
     FROM tat_ca_id_co_quyen pq 
     WHERE pq.ID = cv.ID 
     AND ROWNUM = 1) AS LOAI_HIEN_THI,
    
    -- Tính HAN_XLY (deadline)
    CASE 
        WHEN qtcv.DVI_TG = 'THANG' THEN 
            ADD_MONTHS(cv.NGAY_BD, NVL(qtcv.THOI_GIAN_XU_LY, 0))
        ELSE 
            cv.NGAY_BD + NVL(qtcv.THOI_GIAN_XU_LY, 0)
    END AS HAN_XLY,
    
    -- Kiểm tra QUÁ HẠN
    CASE 
        WHEN cv.NGAY_BD IS NOT NULL AND qtcv.THOI_GIAN_XU_LY IS NOT NULL THEN
            CASE 
                WHEN qtcv.DVI_TG = 'THANG' AND SYSDATE > ADD_MONTHS(cv.NGAY_BD, qtcv.THOI_GIAN_XU_LY) THEN 1
                WHEN (qtcv.DVI_TG IS NULL OR qtcv.DVI_TG = 'NGAY') AND SYSDATE > cv.NGAY_BD + qtcv.THOI_GIAN_XU_LY THEN 1
                ELSE 0
            END
        ELSE 0
    END AS QUA_HAN

FROM HS_CONG_VIEC cv
JOIN HS_YEU_CAU yc ON cv.MA_YCAU = yc.MA_YCAU
JOIN A_QTRINH qt ON yc.MA_QT = qt.MA_QT
JOIN A_QTRINH_NHOM nhom ON qt.MA_NHOM_QT = nhom.MA_NHOM_QT
LEFT JOIN A_QTRINH_CVIEC qtcv ON cv.MA_CVIEC = qtcv.MA_CVIEC AND yc.MA_QT = qtcv.MA_QT

-- Điều kiện phân quyền
WHERE cv.ID IN (SELECT ID FROM tat_ca_id_co_quyen)

-- =====================================================================
-- CÁC BỘ LỌC TÙY CHỌN (uncomment và điền giá trị khi cần)
-- =====================================================================
-- AND nhom.MA_NHOM_QT IN ('NHOM_QT_1', 'NHOM_QT_2')           -- Lọc theo nhóm quy trình
-- AND qt.MA_QT IN ('QT_1', 'QT_2')                             -- Lọc theo quy trình
-- AND cv.TRANG_THAI IN ('DANG_XU_LY', 'CHO_DUYET')            -- Lọc theo trạng thái
-- AND cv.MA_CVIEC IN ('CV_1', 'CV_2')                          -- Lọc theo mã công việc
-- AND (UPPER(yc.TIEU_DE) LIKE '%KEYWORD%'                      -- Tìm kiếm text
--      OR UPPER(yc.SO_YCAU) LIKE '%KEYWORD%' 
--      OR UPPER(cv.TEN_CVIEC) LIKE '%KEYWORD%')
-- AND cv.NGAY_BD >= TO_DATE('2024-01-01', 'YYYY-MM-DD')       -- Lọc từ ngày
-- AND cv.NGAY_BD <= TO_DATE('2024-12-31', 'YYYY-MM-DD')       -- Lọc đến ngày

-- Sắp xếp kết quả
ORDER BY cv.USER_CR_DTIME DESC;

-- =====================================================================
-- QUERY PHỤ: Lấy tổng hợp số lượng công việc theo loại
-- =====================================================================
/*
SELECT 
    'CUA_TOI' AS LOAI, COUNT(*) AS SO_LUONG FROM ds_congviec_cua_toi
UNION ALL
SELECT 'PHONG_TOI', COUNT(*) FROM ds_congviec_phong_toi
UNION ALL
SELECT 'GIAM_SAT', COUNT(*) FROM ds_congviec_giam_sat
UNION ALL
SELECT 'TONG', 
    (SELECT COUNT(*) FROM ds_congviec_cua_toi) +
    (SELECT COUNT(*) FROM ds_congviec_phong_toi) +
    (SELECT COUNT(*) FROM ds_congviec_giam_sat)
FROM DUAL;
*/
