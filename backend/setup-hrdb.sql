-- ============================================================
-- HR Management System - Complete Schema for hrdb
-- PostgreSQL 12+
-- ============================================================

-- First, drop all existing tables to avoid conflicts
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS employee_leave_balances CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS user_auth CASCADE;
DROP TABLE IF EXISTS notification_settings CASCADE;

-- ============================================================
-- USER_AUTH (Authentication & Authorization)
-- ============================================================
CREATE TABLE user_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'employee',
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
-- EMPLOYEES
-- ============================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_auth(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE,
  display_name VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  id_card_number VARCHAR(13) UNIQUE,
  employment_date DATE,
  employment_status VARCHAR(50) DEFAULT 'probation',
  annual_leave_days INTEGER DEFAULT 15,
  department VARCHAR(100),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  position VARCHAR(100),
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  phone VARCHAR(20),
  address TEXT,
  birth_date DATE,
  gender VARCHAR(20),
  employee_type VARCHAR(50) DEFAULT 'permanent',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- USER_ROLES (Role Management)
-- ============================================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_auth(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES user_auth(id),
  UNIQUE(user_id, role)
);

-- ============================================================
-- LEAVE_REQUESTS
-- ============================================================
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(4,1),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  approver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- EMPLOYEE_LEAVE_BALANCES
-- ============================================================
CREATE TABLE employee_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL,
  balance_days INTEGER DEFAULT 0,
  year INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, leave_type, year)
);

-- ============================================================
-- PASSWORD_RESET_TOKENS
-- ============================================================
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_auth(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- HOLIDAYS
-- ============================================================
CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- NOTIFICATION_SETTINGS
-- ============================================================
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department VARCHAR(100),
  role VARCHAR(50),
  email VARCHAR(255),
  notify_on_leave_request BOOLEAN DEFAULT true,
  notify_on_approval BOOLEAN DEFAULT true,
  notify_on_rejection BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX idx_user_auth_email ON user_auth(email);
CREATE INDEX idx_user_auth_role ON user_auth(role);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_employee_leave_balances_employee_id ON employee_leave_balances(employee_id);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token_hash);
CREATE INDEX idx_holidays_date ON holidays(holiday_date);
CREATE INDEX idx_notification_settings_department ON notification_settings(department);
CREATE INDEX idx_notification_settings_role ON notification_settings(role);

-- ============================================================
-- INITIAL DATA
-- ============================================================

-- Insert default departments
INSERT INTO departments (name, description) VALUES
  ('Human Resources', 'Human Resources Department'),
  ('Finance', 'Finance and Accounting'),
  ('Operations', 'Operations Management'),
  ('IT', 'Information Technology'),
  ('Sales', 'Sales and Marketing')
ON CONFLICT (name) DO NOTHING;

-- Insert default holidays
INSERT INTO holidays (holiday_date, name, description) VALUES
  ('2025-01-01', 'New Year Day', 'New Year Holiday'),
  ('2025-02-13', 'Makha Bucha', 'Buddhist Holiday'),
  ('2025-04-06', 'Chakri Memorial Day', 'Thai National Holiday'),
  ('2025-04-13', 'Songkran Festival', 'Thai New Year - Day 1'),
  ('2025-04-14', 'Songkran Festival', 'Thai New Year - Day 2'),
  ('2025-04-15', 'Songkran Festival', 'Thai New Year - Day 3'),
  ('2025-05-01', 'Labour Day', 'International Labour Day'),
  ('2025-05-22', 'Visakha Bucha', 'Buddhist Holiday'),
  ('2025-07-29', 'King Vajiralongkorn Birthday', 'Thai National Holiday'),
  ('2025-07-31', 'Buddhist Lent Day', 'Buddhist Observance'),
  ('2025-10-13', 'King Bhumibol Memorial Day', 'Thai National Holiday'),
  ('2025-10-14', 'King Bhumibol Memorial Day Observed', 'Thai National Holiday'),
  ('2025-10-23', 'Chulalongkorn Memorial Day', 'Thai National Holiday'),
  ('2025-12-05', 'King Bhumibol Birthday', 'Thai National Holiday'),
  ('2025-12-10', 'Constitution Day', 'Thai National Holiday'),
  ('2025-12-31', 'New Year''s Eve', 'Year End')
ON CONFLICT (holiday_date) DO NOTHING;

-- Insert sample notification settings
INSERT INTO notification_settings (department, role, email, notify_on_leave_request, notify_on_approval, notify_on_rejection) VALUES
  ('HR', 'manager', 'hr-manager@company.local', true, true, true),
  ('IT', 'manager', 'it-manager@company.local', true, true, true),
  ('Finance', 'manager', 'finance-manager@company.local', true, true, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SCHEMA COMPLETE
-- ============================================================
