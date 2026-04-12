CREATE TABLE IF NOT EXISTS leave_policies (
  id SERIAL PRIMARY KEY,
  employee_type VARCHAR(50) NOT NULL,
  employee_status VARCHAR(50),
  min_years_of_service INT DEFAULT 0,
  max_years_of_service INT,
  annual_leave_quota INT DEFAULT 6,
  sick_leave_quota INT DEFAULT 30,
  personal_leave_quota INT DEFAULT 6,
  maternity_leave_quota INT DEFAULT 120,
  paternity_leave_quota INT DEFAULT 15,
  is_prorated_first_year BOOLEAN DEFAULT true,
  is_prorated BOOLEAN DEFAULT false,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO leave_policies (
  employee_type,
  employee_status,
  min_years_of_service,
  max_years_of_service,
  annual_leave_quota,
  sick_leave_quota,
  personal_leave_quota,
  maternity_leave_quota,
  paternity_leave_quota,
  is_prorated_first_year,
  is_prorated,
  description,
  active
)
SELECT *
FROM (
  VALUES
    ('permanent', 'active', 0, 0, 0, 30, 6, 120, 15, true, true, 'พนักงานประจำอายุงานน้อยกว่า 1 ปี', true),
    ('permanent', 'active', 1, NULL, 10, 30, 6, 120, 15, false, false, 'พนักงานประจำอายุงานตั้งแต่ 1 ปีขึ้นไป', true),
    ('contract', 'active', 0, NULL, 6, 30, 6, 120, 15, true, true, 'พนักงานสัญญาจ้าง/ทดลองงาน', true),
    ('parttime', 'active', 0, NULL, 3, 15, 3, 90, 7, false, false, 'พนักงานพาร์ทไทม์', true)
) AS seed (
  employee_type,
  employee_status,
  min_years_of_service,
  max_years_of_service,
  annual_leave_quota,
  sick_leave_quota,
  personal_leave_quota,
  maternity_leave_quota,
  paternity_leave_quota,
  is_prorated_first_year,
  is_prorated,
  description,
  active
)
WHERE NOT EXISTS (SELECT 1 FROM leave_policies);