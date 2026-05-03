-- ============================================================
-- HR Management System - Clean Database Schema
-- PostgreSQL 12+
-- ============================================================

-- ============================================================
-- USERS (Authentication & Authorization)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  display_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'employee',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- POSITIONS
-- ============================================================
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  prefix VARCHAR(20),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  id_card_number VARCHAR(13) UNIQUE,
  birth_date DATE,
  gender VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  position_id UUID REFERENCES positions(id),
  department_id UUID REFERENCES departments(id),
  manager_id UUID REFERENCES employees(id),
  employee_type VARCHAR(50) DEFAULT 'permanent',
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  annual_leave_quota INTEGER DEFAULT 15,
  sick_leave_quota INTEGER DEFAULT 10,
  personal_leave_quota INTEGER DEFAULT 5,
  other_leave_quota INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- LEAVE TYPES
-- ============================================================
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_paid BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(4,1) NOT NULL,
  reason TEXT,
  attachment_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending',
  approver_id UUID REFERENCES employees(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- HOLIDAYS
-- ============================================================
CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  holiday_date DATE NOT NULL UNIQUE,
  is_public_holiday BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_departments_name ON departments(name);
CREATE INDEX idx_positions_department_id ON positions(department_id);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_employees_position_id ON employees(position_id);
CREATE INDEX idx_employees_manager_id ON employees(manager_id);
CREATE INDEX idx_employees_employee_code ON employees(employee_code);
CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_holidays_date ON holidays(holiday_date);

-- ============================================================
-- SAMPLE DATA
-- ============================================================

-- Insert leave types
INSERT INTO leave_types (name, code, description, is_paid) VALUES
  ('ลาป่วย', 'sick', 'ลาเนื่องจากป่วยหรือบาดเจ็บ', true),
  ('ลากิจส่วนตัว', 'personal', 'ลาเพื่อกิจการส่วนตัว', true),
  ('ลาพักร้อน', 'vacation', 'ลาพักร้อนประจำปี', true),
  ('ลาคลอด', 'maternity', 'ลาคลอด', true),
  ('ลาบิดา', 'paternity', 'ลาบิดา', true),
  ('ลาไม่รับค่าจ้าง', 'unpaid', 'ลาไม่รับค่าจ้าง', false),
  ('อื่น ๆ', 'other', 'ลาประเภทอื่น', false);

-- Insert admin user
INSERT INTO users (email, password_hash, display_name, role) VALUES
  ('admin@system.com', '$2b$10$O2tu1oWlpLeG2LWwbGntReBSo4PWysoACTjA1teIxeZ2jqwkP70nC', 'Admin User', 'admin');

-- Insert sample department
INSERT INTO departments (name, description) VALUES
  ('IT', 'Information Technology'),
  ('HR', 'Human Resources'),
  ('Finance', 'Finance Department'),
  ('Operations', 'Operations Department');

-- ============================================================
