-- ===== HR Management Database Schema =====
-- สร้างตารางสำหรับระบบ HR Harmony Hub

-- 1. Departments (ฝ่าย)
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Positions (ตำแหน่ง)
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  department_id INT REFERENCES departments(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Employees (พนักงาน)
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  phone VARCHAR(20),
  employee_code VARCHAR(50) UNIQUE,
  department_id INT REFERENCES departments(id),
  position_id INT REFERENCES positions(id),
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  role VARCHAR(50) DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Leave Types (ประเภทการลา)
CREATE TABLE IF NOT EXISTS leave_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Holidays (วันหยุดราชการ)
CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Leave Requests (คำขอลา)
CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  leave_type_id INT REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  approved_by INT REFERENCES employees(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Leave Quotas (วงเงินอุปถัมภ์การลา)
CREATE TABLE IF NOT EXISTS leave_quotas (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  leave_type_id INT REFERENCES leave_types(id),
  year INT,
  total_days DECIMAL(10,2),
  used_days DECIMAL(10,2) DEFAULT 0,
  remaining_days DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Working Hours (เวลาทำงาน)
CREATE TABLE IF NOT EXISTS working_hours (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  day_of_week VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== Insert Sample Data =====

-- Insert Departments
INSERT INTO departments (name, description) VALUES
  ('IT', 'Information Technology'),
  ('HR', 'Human Resources'),
  ('Sales', 'Sales Department'),
  ('Finance', 'Finance Department'),
  ('Operations', 'Operations Department')
ON CONFLICT DO NOTHING;

-- Insert Positions
INSERT INTO positions (department_id, name, description) VALUES
  (1, 'Software Engineer', 'Software Development'),
  (1, 'DevOps Engineer', 'Infrastructure and DevOps'),
  (2, 'HR Manager', 'Human Resources Manager'),
  (3, 'Sales Executive', 'Sales Executive'),
  (4, 'Accountant', 'Accounting')
ON CONFLICT DO NOTHING;

-- Insert Leave Types
INSERT INTO leave_types (name, description, color) VALUES
  ('Sick Leave', 'ลาป่วย', '#ff6b6b'),
  ('Vacation', 'ลาพักร้อน', '#4ecdc4'),
  ('Personal Leave', 'ลาส่วนตัว', '#95e1d3'),
  ('Maternity Leave', 'ลาคลอดบุตร', '#f38181'),
  ('Unpaid Leave', 'ลาไม่จ่ายค่าจ้าง', '#aa96da')
ON CONFLICT DO NOTHING;

-- Insert Holidays
INSERT INTO holidays (name, date, is_recurring) VALUES
  ('New Year Day', '2026-01-01', TRUE),
  ('Thai New Year', '2026-04-13', TRUE),
  ('Labour Day', '2026-05-01', TRUE),
  ('Queen''s Birthday', '2026-08-12', TRUE),
  ('King''s Birthday', '2026-12-05', TRUE),
  ('New Year Eve', '2026-12-31', TRUE)
ON CONFLICT DO NOTHING;

-- ===== Create Indexes =====
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_position ON employees(position_id);
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_quotas_employee ON leave_quotas(employee_id);
CREATE INDEX idx_holidays_date ON holidays(date);
