-- ============================================================
-- Migration: Initialize hrdb with Base Data
-- ============================================================

-- ============================================================
-- INSERT DEPARTMENTS (Base Data)
-- ============================================================
INSERT INTO departments (name, description) VALUES
  ('Human Resources', 'Human Resources Department'),
  ('Finance', 'Finance and Accounting'),
  ('Operations', 'Operations Management'),
  ('IT', 'Information Technology'),
  ('Sales', 'Sales and Marketing'),
  ('Customer Service', 'Customer Support'),
  ('Administration', 'Administration')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- INSERT POSITIONS (Base Data)
-- ============================================================
INSERT INTO positions (name, department_id, description) VALUES
  ('HR Manager', (SELECT id FROM departments WHERE name = 'Human Resources'), 'Human Resources Manager'),
  ('HR Officer', (SELECT id FROM departments WHERE name = 'Human Resources'), 'HR Officer'),
  ('Finance Manager', (SELECT id FROM departments WHERE name = 'Finance'), 'Finance Manager'),
  ('Accountant', (SELECT id FROM departments WHERE name = 'Finance'), 'Accountant'),
  ('Operations Manager', (SELECT id FROM departments WHERE name = 'Operations'), 'Operations Manager'),
  ('IT Manager', (SELECT id FROM departments WHERE name = 'IT'), 'IT Manager'),
  ('Senior Developer', (SELECT id FROM departments WHERE name = 'IT'), 'Senior Software Developer'),
  ('Junior Developer', (SELECT id FROM departments WHERE name = 'IT'), 'Junior Software Developer'),
  ('Sales Manager', (SELECT id FROM departments WHERE name = 'Sales'), 'Sales Manager'),
  ('Sales Executive', (SELECT id FROM departments WHERE name = 'Sales'), 'Sales Executive'),
  ('Customer Service Officer', (SELECT id FROM departments WHERE name = 'Customer Service'), 'Customer Service Officer'),
  ('Administrator', (SELECT id FROM departments WHERE name = 'Administration'), 'Administrator')
ON CONFLICT DO NOTHING;

-- ============================================================
-- INSERT LEAVE TYPES (Base Data)
-- ============================================================
INSERT INTO leave_types (name, code, description, is_paid) VALUES
  ('Annual Leave', 'AL', 'Paid Annual Leave', true),
  ('Sick Leave', 'SL', 'Sick Leave', true),
  ('Personal Leave', 'PL', 'Unpaid Personal Leave', false),
  ('Maternity Leave', 'ML', 'Maternity Leave', true),
  ('Paternity Leave', 'PL', 'Paternity Leave', true),
  ('Emergency Leave', 'EL', 'Emergency Leave', false),
  ('Study Leave', 'SL', 'Paid Study Leave', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- INSERT DEFAULT ADMIN USER
-- ============================================================
INSERT INTO users (email, password_hash, display_name, role, is_active) VALUES
  ('admin@hrdb.local', '$2b$10$PLACEHOLDER_HASH', 'Administrator', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
