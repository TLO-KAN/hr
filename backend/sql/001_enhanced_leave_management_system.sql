-- ============================================================
-- Enhanced Leave Management System
-- Pro-rate & Annual Increment Implementation
-- PostgreSQL 12+
-- ============================================================

-- ============================================================
-- 1. ENHANCE leave_policies TABLE
-- Support Step-up Policy (Year 1-10 increment, Year 11+ max)
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name VARCHAR(255) NOT NULL,
  employee_type VARCHAR(50) NOT NULL,
  tenure_year_from INT NOT NULL DEFAULT 0,
  tenure_year_to INT,
  annual_leave_quota DECIMAL(5,2) NOT NULL DEFAULT 6,
  sick_leave_quota INT NOT NULL DEFAULT 10,
  personal_leave_quota INT NOT NULL DEFAULT 5,
  maternity_leave_quota INT NOT NULL DEFAULT 90,
  paternity_leave_quota INT NOT NULL DEFAULT 7,
  is_prorated_first_year BOOLEAN DEFAULT true,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID
);

-- Create index for quick policy lookups
CREATE INDEX IF NOT EXISTS idx_leave_policies_employee_type_tenure 
  ON leave_policies(employee_type, tenure_year_from, tenure_year_to);

-- Insert default policies - Step-up model (Years 1-10: +1 day/year, Year 11+: 15 days max)
INSERT INTO leave_policies (
  policy_name, 
  employee_type, 
  tenure_year_from, 
  tenure_year_to, 
  annual_leave_quota, 
  sick_leave_quota, 
  personal_leave_quota, 
  maternity_leave_quota, 
  paternity_leave_quota, 
  is_prorated_first_year, 
  description, 
  is_active
) VALUES 
-- Permanent Staff Policy
  ('Permanent - Year 1', 'permanent', 0, 0, 6, 10, 5, 90, 7, true, 'พนักงานประจำปีที่ 1 (0-1 ปี)', true),
  ('Permanent - Year 2', 'permanent', 1, 1, 7, 10, 5, 90, 7, false, 'พนักงานประจำปีที่ 2 (1-2 ปี)', true),
  ('Permanent - Year 3', 'permanent', 2, 2, 8, 10, 5, 90, 7, false, 'พนักงานประจำปีที่ 3 (2-3 ปี)', true),
  ('Permanent - Year 4', 'permanent', 3, 3, 9, 10, 5, 90, 7, false, 'พนักงานประจำปีที่ 4 (3-4 ปี)', true),
  ('Permanent - Year 5', 'permanent', 4, 4, 10, 10, 5, 90, 7, false, 'พนักงานประจำปีที่ 5 (4-5 ปี)', true),
  ('Permanent - Year 6', 'permanent', 5, 5, 11, 10, 5, 90, 7, false, 'พนักงานประจำปีที่ 6 (5-6 ปี)', true),
  ('Permanent - Year 7', 'permanent', 6, 6, 12, 10, 5, 90, 7, false, 'พนักงานประจำปีที่ 7 (6-7 ปี)', true),
  ('Permanent - Year 8', 'permanent', 7, 7, 13, 10, 5, 90, 7, false, 'พนักงานประจำปีที่ 8 (7-8 ปี)', true),
  ('Permanent - Year 9', 'permanent', 8, 8, 14, 10, 5, 90, 7, false, 'พนักงานประจำปีที่ 9 (8-9 ปี)', true),
  ('Permanent - Year 10', 'permanent', 9, 9, 15, 10, 5, 90, 7, false, 'พนักงานประจำปีที่ 10 (9-10 ปี)', true),
  ('Permanent - Year 11+', 'permanent', 10, NULL, 15, 10, 5, 90, 7, false, 'พนักงานประจำปีที่ 11+ (10+ ปี)', true),
-- Contract Staff Policy
  ('Contract - Year 1', 'contract', 0, 0, 6, 10, 5, 90, 7, true, 'พนักงานสัญญาจ้าง/ทดลองงาน', true),
-- Part-time Staff Policy
  ('Part-time', 'parttime', 0, NULL, 3, 5, 2, 45, 3, true, 'พนักงานพาร์ทไทม์', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. ENHANCE employee_leave_balances TABLE
-- Store detailed balance information per year
-- ============================================================
ALTER TABLE employee_leave_balances 
ADD COLUMN IF NOT EXISTS entitled_days DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_days DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_days DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS carried_over_days DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pro_rated_percent DECIMAL(5,2) DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_utilized BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_year 
  ON employee_leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_leave_type 
  ON employee_leave_balances(leave_type);

-- ============================================================
-- 3. CREATE leave_balance_history TABLE
-- Track historical records for auditing and reporting
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  leave_type VARCHAR(50) NOT NULL,
  previous_entitled_days DECIMAL(5,2),
  previous_used_days DECIMAL(5,2),
  previous_remaining_days DECIMAL(5,2),
  new_entitled_days DECIMAL(5,2),
  new_used_days DECIMAL(5,2),
  new_remaining_days DECIMAL(5,2),
  change_reason VARCHAR(255),
  changed_by UUID REFERENCES employees(id),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_balance_history_employee_year 
  ON leave_balance_history(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_balance_history_changed_at 
  ON leave_balance_history(changed_at);

-- ============================================================
-- 4. CREATE leave_calculation_log TABLE
-- Track when calculations happen and parameters used
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_calculation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  calculation_type VARCHAR(50) NOT NULL, -- 'new_hire_prorate', 'anniversary_update', 'yearly_reset'
  calculation_date DATE NOT NULL,
  years_of_service INT NOT NULL,
  tenure_year_for_policy INT NOT NULL,
  policy_id UUID REFERENCES leave_policies(id),
  base_quota DECIMAL(5,2) NOT NULL,
  pro_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 100,
  final_entitled_days DECIMAL(5,2) NOT NULL,
  calculation_details JSONB, -- Store detailed calculation breakdown
  calculated_by VARCHAR(50) DEFAULT 'system',
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_calculation_log_employee 
  ON leave_calculation_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_calculation_log_date 
  ON leave_calculation_log(calculation_date);

-- ============================================================
-- 5. ENHANCE employees TABLE
-- Add fields for leave calculation
-- ============================================================
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS probation_end_date DATE,
ADD COLUMN IF NOT EXISTS pro_rate_applied_for_year INT,
ADD COLUMN IF NOT EXISTS last_leave_calculation_date DATE;

-- Update probation_end_date based on start_date (119 days = ~4 months)
UPDATE employees 
SET probation_end_date = start_date + INTERVAL '119 days'
WHERE probation_end_date IS NULL AND start_date IS NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_employees_probation_end_date 
  ON employees(probation_end_date);
CREATE INDEX IF NOT EXISTS idx_employees_start_date 
  ON employees(start_date);

-- ============================================================
-- 6. CREATE leave_entitlement_config TABLE
-- Store business rules for leave entitlement
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_entitlement_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value VARCHAR(255) NOT NULL,
  data_type VARCHAR(50) DEFAULT 'string', -- 'string', 'integer', 'decimal', 'boolean'
  description TEXT,
  last_updated_by UUID REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO leave_entitlement_config (config_key, config_value, data_type, description) VALUES 
  ('probation_days', '119', 'integer', 'จำนวนวันทดลองงานก่อนจะสามารถขอลาได้'),
  ('yearly_reset_date', '2026-01-01', 'string', 'วันที่ระบบตัดสิทธิ์วันลาการไม่ใช้ของปีปีหน้า'),
  ('rounding_method', '0.5', 'decimal', 'การปัดเศษวันลา (0.5 = ปัดลงที่ 0.5 วัน)'),
  ('max_carry_over_days', '0', 'decimal', 'จำนวนวันลาสูงสุดที่สามารถยกไปปีหน้าได้'),
  ('pro_rate_calculation_enabled', 'true', 'boolean', 'เปิดใช้งานการคำนวณ Pro-rate'),
  ('step_up_policy_enabled', 'true', 'boolean', 'เปิดใช้งานนโยบายเพิ่มสิทธิ์ตามอายุงาน')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. CREATE FUNCTION: Calculate Years of Service
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_years_of_service(start_date DATE, reference_date DATE DEFAULT CURRENT_DATE)
RETURNS INT AS $$
BEGIN
  RETURN FLOOR(EXTRACT(DAY FROM (reference_date - start_date)) / 365.25)::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 8. CREATE FUNCTION: Get Applicable Leave Policy
-- Returns the leave policy based on employee type and tenure
-- ============================================================
CREATE OR REPLACE FUNCTION get_applicable_leave_policy(
  p_employee_type VARCHAR(50),
  p_years_of_service INT
)
RETURNS SETOF leave_policies AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM leave_policies
  WHERE employee_type = p_employee_type
    AND tenure_year_from <= p_years_of_service
    AND (tenure_year_to IS NULL OR tenure_year_to >= p_years_of_service)
    AND is_active = true
  ORDER BY tenure_year_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 9. CREATE FUNCTION: Calculate Pro-rated Leave Days
-- Pro-rates leave based on start date and anniversary date within the same year
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_prorated_leave_days(
  p_start_date DATE,
  p_employee_type VARCHAR(50),
  p_calendar_year INT,
  OUT entitled_days DECIMAL,
  OUT pro_rate_percent DECIMAL,
  OUT calculation_details JSONB
) AS $$
DECLARE
  v_anniversary_date DATE;
  v_months_at_old_rate INT;
  v_months_at_new_rate INT;
  v_old_rate DECIMAL;
  v_new_rate DECIMAL;
  v_policy_old RECORD;
  v_policy_new RECORD;
  v_years_before_anniversary INT;
  v_years_at_anniversary INT;
  v_rounded_days DECIMAL;
BEGIN
  -- Calculate anniversary date (same day/month as start_date, but in the calendar year)
  v_anniversary_date := make_date(p_calendar_year, EXTRACT(MONTH FROM p_start_date)::INT, EXTRACT(DAY FROM p_start_date)::INT);
  
  -- Get years of service before and at anniversary
  v_years_before_anniversary := FLOOR(EXTRACT(DAY FROM (v_anniversary_date::DATE - p_start_date)) / 365.25)::INT;
  v_years_at_anniversary := FLOOR(EXTRACT(DAY FROM (v_anniversary_date::DATE - p_start_date)) / 365.25)::INT;
  
  -- Get policy valid before anniversary
  SELECT lp.* INTO v_policy_old
  FROM leave_policies lp
  WHERE lp.employee_type = p_employee_type
    AND lp.tenure_year_from <= v_years_before_anniversary
    AND (lp.tenure_year_to IS NULL OR lp.tenure_year_to >= v_years_before_anniversary)
    AND lp.is_active = true
  ORDER BY lp.tenure_year_from DESC
  LIMIT 1;
  
  -- Get policy valid at/after anniversary
  SELECT lp.* INTO v_policy_new
  FROM leave_policies lp
  WHERE lp.employee_type = p_employee_type
    AND lp.tenure_year_from <= v_years_at_anniversary
    AND (lp.tenure_year_to IS NULL OR lp.tenure_year_to >= v_years_at_anniversary)
    AND lp.is_active = true
  ORDER BY lp.tenure_year_from DESC
  LIMIT 1;
  
  -- If no policy change, use simple pro-rate from start date
  IF v_policy_old IS NULL OR v_policy_new IS NULL THEN
    IF v_policy_old IS NULL AND v_policy_new IS NULL THEN
      entitled_days := 6; -- Default fallback
      pro_rate_percent := 100;
    ELSE
      v_old_rate := COALESCE(v_policy_old.annual_leave_quota, v_policy_new.annual_leave_quota);
      -- Calculate days from start_date to end of year
      v_months_at_old_rate := EXTRACT(MONTH FROM (DATE(p_calendar_year || '-12-31')::DATE - p_start_date))::INT + 1;
      entitled_days := ROUND((v_old_rate / 12 * v_months_at_old_rate)::NUMERIC, 2);
      pro_rate_percent := ROUND(((v_months_at_old_rate * 100::DECIMAL) / 12)::NUMERIC, 2);
    END IF;
  ELSIF v_policy_old.id = v_policy_new.id THEN
    -- Same policy before and after anniversary
    v_old_rate := v_policy_old.annual_leave_quota;
    -- Calculate days from start_date to end of year
    v_months_at_old_rate := EXTRACT(MONTH FROM (DATE(p_calendar_year || '-12-31')::DATE - p_start_date))::INT + 1;
    entitled_days := ROUND((v_old_rate / 12 * v_months_at_old_rate)::NUMERIC, 2);
    pro_rate_percent := ROUND(((v_months_at_old_rate * 100::DECIMAL) / 12)::NUMERIC, 2);
  ELSE
    -- Policy changes at anniversary (step-up case)
    v_old_rate := v_policy_old.annual_leave_quota;
    v_new_rate := v_policy_new.annual_leave_quota;
    
    -- Calculate months before anniversary (in same calendar year)
    IF v_anniversary_date > DATE(p_calendar_year || '-01-01') THEN
      v_months_at_old_rate := EXTRACT(MONTH FROM v_anniversary_date) - 1;
      v_months_at_new_rate := 12 - v_months_at_old_rate;
      entitled_days := ROUND((v_old_rate / 12 * v_months_at_old_rate + v_new_rate / 12 * v_months_at_new_rate)::NUMERIC, 2);
      pro_rate_percent := ROUND(((v_months_at_old_rate + v_months_at_new_rate) * 100::DECIMAL / 12)::NUMERIC, 2);
    ELSE
      -- Anniversary already passed, use new rate for entire year
      entitled_days := v_new_rate;
      pro_rate_percent := 100;
    END IF;
  END IF;
  
  -- Apply rounding to 0.5 (round down to nearest 0.5)
  v_rounded_days := FLOOR(entitled_days * 2) / 2;
  entitled_days := v_rounded_days;
  
  -- Build calculation details
  calculation_details := jsonb_build_object(
    'start_date', p_start_date::TEXT,
    'calendar_year', p_calendar_year,
    'anniversary_date', v_anniversary_date::TEXT,
    'years_at_anniversary', v_years_at_anniversary,
    'old_policy_annual_quota', COALESCE(v_policy_old.annual_leave_quota, 0),
    'new_policy_annual_quota', COALESCE(v_policy_new.annual_leave_quota, 0),
    'months_at_old_rate', v_months_at_old_rate,
    'months_at_new_rate', v_months_at_new_rate,
    'pro_rate_percent', pro_rate_percent,
    'final_entitled_days', entitled_days
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 10. CREATE FUNCTION: Check Probation Status
-- Returns true if employee is still in probation period
-- ============================================================
CREATE OR REPLACE FUNCTION is_employee_in_probation(p_employee_id UUID, reference_date DATE DEFAULT CURRENT_DATE)
RETURNS BOOLEAN AS $$
DECLARE
  v_start_date DATE;
  v_days_worked INT;
BEGIN
  SELECT start_date INTO v_start_date
  FROM employees
  WHERE id = p_employee_id;
  
  IF v_start_date IS NULL THEN
    RETURN FALSE;
  END IF;
  
  v_days_worked := EXTRACT(DAY FROM (reference_date - v_start_date))::INT;
  RETURN v_days_worked < 119;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Sample Index for Common Queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leave_policies_active 
  ON leave_policies(is_active, employee_type);

-- ============================================================
-- Output Summary
-- ============================================================
-- Enhanced tables: leave_policies, employee_leave_balances, employees
-- New tables: leave_balance_history, leave_calculation_log, leave_entitlement_config
-- New functions: calculate_years_of_service, get_applicable_leave_policy, calculate_prorated_leave_days, is_employee_in_probation
