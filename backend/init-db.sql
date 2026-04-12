-- ============================================================
-- HR Management System - Database Schema
-- PostgreSQL Version 12+
-- ============================================================

-- Create users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  display_name VARCHAR(255),
  employee_id UUID,
  role VARCHAR(50) DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create employees table (HR data)
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255),
  display_name VARCHAR(255),
  employment_date DATE NOT NULL,
  employment_status VARCHAR(50) DEFAULT 'probation',
  annual_leave_days INTEGER DEFAULT 15,
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department VARCHAR(100),
  role VARCHAR(50),
  email VARCHAR(255),
  notify_on_leave_request BOOLEAN DEFAULT true,
  notify_on_approval BOOLEAN DEFAULT true,
  notify_on_rejection BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_notification_settings_department ON notification_settings(department);
CREATE INDEX IF NOT EXISTS idx_notification_settings_role ON notification_settings(role);

-- ============================================================
-- Sample Notification Settings (Optional)
-- ============================================================

INSERT INTO notification_settings (department, role, email, notify_on_leave_request, notify_on_approval, notify_on_rejection)
VALUES 
  ('HR', 'manager', 'hr-manager@company.com', true, true, true),
  ('IT', 'manager', 'it-manager@company.com', true, true, true),
  ('Finance', 'manager', 'finance-manager@company.com', true, true, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Verification
-- ============================================================

-- Run these commands to verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT * FROM pg_indexes WHERE tablename IN ('users', 'employees', 'leave_requests', 'notification_settings');
