-- ===== Clear Employee and Leave Data =====
-- ลบข้อมูลการลาและพนักงาน

-- 1. ลบข้อมูลการลา
DELETE FROM leave_requests;

-- 2. ลบข้อมูลวงเงินอุปถัมภ์การลา
DELETE FROM leave_quotas;

-- 3. ลบข้อมูลเวลาทำงาน
DELETE FROM working_hours;

-- 4. ลบข้อมูลพนักงาน
DELETE FROM employees;

-- Reset sequences (IDs)
ALTER SEQUENCE employees_id_seq RESTART WITH 1;
ALTER SEQUENCE leave_requests_id_seq RESTART WITH 1;
ALTER SEQUENCE leave_quotas_id_seq RESTART WITH 1;
ALTER SEQUENCE working_hours_id_seq RESTART WITH 1;
