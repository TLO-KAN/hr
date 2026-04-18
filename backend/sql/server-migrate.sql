-- ============================================================
-- SERVER MIGRATION SCRIPT
-- รันไฟล์นี้บน PostgreSQL ของ server เพื่อ align schema กับ code
-- คำสั่ง: psql -U <user> -d <dbname> -f server-migrate.sql
-- ============================================================

-- ============================================================
-- STEP 1: user_auth table (ต้องมีก่อน employees)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STEP 2: departments table
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STEP 3: positions table
-- ============================================================
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STEP 4: employees table — add missing columns (safe)
-- ============================================================
-- ถ้าไม่มี table เลย สร้างใหม่
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_auth(id) ON DELETE SET NULL,
  employee_code VARCHAR(50) UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  display_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  department VARCHAR(100),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  position VARCHAR(100),
  position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  employment_date DATE,
  birth_date DATE,
  gender VARCHAR(20),
  id_card_number VARCHAR(13),
  address TEXT,
  avatar_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active',
  employment_status VARCHAR(50) DEFAULT 'active',
  employee_type VARCHAR(50) DEFAULT 'permanent',
  annual_leave_quota INTEGER DEFAULT 15,
  annual_leave_days INTEGER DEFAULT 15,
  sick_leave_quota INTEGER DEFAULT 10,
  personal_leave_quota INTEGER DEFAULT 5,
  other_leave_quota INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ถ้า table มีแล้ว เพิ่ม columns ที่ขาด (safe — ไม่ทำลายข้อมูลเดิม)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_auth(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id UUID;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50) DEFAULT 'permanent';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS annual_leave_quota INTEGER DEFAULT 15;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sick_leave_quota INTEGER DEFAULT 10;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal_leave_quota INTEGER DEFAULT 5;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS other_leave_quota INTEGER DEFAULT 5;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS annual_leave_days INTEGER DEFAULT 15;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Sync display_name → first_name/last_name ถ้ามี display_name แต่ไม่มี first_name
UPDATE employees
SET first_name = SPLIT_PART(display_name, ' ', 1),
    last_name  = CASE WHEN POSITION(' ' IN display_name) > 0
                      THEN SUBSTRING(display_name FROM POSITION(' ' IN display_name) + 1)
                      ELSE ''
                 END
WHERE display_name IS NOT NULL
  AND (first_name IS NULL OR first_name = '');

-- ============================================================
-- STEP 5: leave_types table
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_paid BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  color VARCHAR(7),
  max_days_per_year INTEGER,
  requires_document BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS color VARCHAR(7);
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT true;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS max_days_per_year INTEGER;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS requires_document BOOLEAN DEFAULT false;

-- Insert default leave types ถ้ายังไม่มี
INSERT INTO leave_types (code, name, description, is_paid, is_active) VALUES
  ('annual',   'ลาพักผ่อน',  'ลาพักผ่อนประจำปี',   true,  true),
  ('sick',     'ลาป่วย',     'ลาป่วย',              true,  true),
  ('personal', 'ลากิจ',      'ลากิจส่วนตัว',        true,  true),
  ('maternity','ลาคลอด',     'ลาคลอดบุตร',          true,  true),
  ('ordain',   'ลาบวช',      'ลาบวช',               true,  true),
  ('other',    'ลาอื่นๆ',    'ลาประเภทอื่น',        false, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- STEP 6: leave_requests table
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50),
  leave_type_id UUID REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER,
  reason TEXT,
  attachment_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending',
  approver_id UUID REFERENCES employees(id),
  approved_at TIMESTAMP,
  start_time TIME,
  end_time TIME,
  is_half_day BOOLEAN DEFAULT false,
  half_day_period VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type_id UUID REFERENCES leave_types(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT false;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS half_day_period VARCHAR(20);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approver_id UUID;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- ============================================================
-- STEP 7: leave_attachments table (สำหรับไฟล์แนบของใบลา)
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID NOT NULL REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STEP 8: user_roles table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_auth(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES user_auth(id),
  UNIQUE(user_id, role)
);

-- ============================================================
-- STEP 9: สร้าง Admin user
-- password = Admin@1234 (bcrypt hash)
-- ============================================================
INSERT INTO user_auth (email, password_hash, role)
VALUES (
  'admin@company.com',
  '$2b$10$b0iPjoTeTzVWV8i4lvTw8.1xMWXQm5.WfPbRUJeBGUnZP28GofWcy', -- Admin@1234
  'admin'
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- ดูผลลัพธ์
-- ============================================================
SELECT 'user_auth'  AS tbl, COUNT(*) FROM user_auth
UNION ALL
SELECT 'employees'  AS tbl, COUNT(*) FROM employees
UNION ALL
SELECT 'departments'AS tbl, COUNT(*) FROM departments
UNION ALL
SELECT 'positions'  AS tbl, COUNT(*) FROM positions
UNION ALL
SELECT 'leave_types'AS tbl, COUNT(*) FROM leave_types;
