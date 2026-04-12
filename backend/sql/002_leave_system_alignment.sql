-- ============================================================
-- Enhanced Leave Management System - Data Model Alignment
-- Compatible with existing schema
-- PostgreSQL 12+
-- ============================================================

-- ============================================================
-- 1. ENHANCE leave_policies TABLE
-- Add step-up tenure tracking columns
-- ============================================================

-- Add columns if they don't exist
ALTER TABLE leave_policies 
ADD COLUMN IF NOT EXISTS tenure_year_from INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS tenure_year_to INT,
ADD COLUMN IF NOT EXISTS policy_name VARCHAR(255);

-- Update existing records to support step-up policy (permanent staff)
-- Year 1: 6 days
UPDATE leave_policies 
SET tenure_year_from = 0, 
    tenure_year_to = 0, 
    annual_leave_quota = 6,
    policy_name = 'Permanent - Year 1'
WHERE employee_type = 'permanent' 
  AND employee_status = 'active'
  AND min_years_of_service = 0 
  AND max_years_of_service = 0;

-- If permanent Year 1 doesn't exist, insert it
INSERT INTO leave_policies (
  employee_type, 
  employee_status,
  tenure_year_from,
  tenure_year_to,
  policy_name,
  annual_leave_quota, 
  sick_leave_quota, 
  personal_leave_quota, 
  maternity_leave_quota, 
  paternity_leave_quota, 
  is_prorated_first_year, 
  description,
  is_prorated,
  active
)
SELECT 'permanent', 'active', 0, 0, 'Permanent - Year 1', 6, 30, 6, 120, 15, true, 'พนักงานประจำปีที่ 1', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM leave_policies 
  WHERE employee_type = 'permanent' 
    AND min_years_of_service = 0 
    AND max_years_of_service = 0
);

-- Insert step-up policies for Year 2-11
INSERT INTO leave_policies (
  employee_type, 
  employee_status,
  tenure_year_from,
  tenure_year_to,
  policy_name,
  annual_leave_quota, 
  sick_leave_quota, 
  personal_leave_quota, 
  maternity_leave_quota, 
  paternity_leave_quota, 
  is_prorated_first_year, 
  description,
  is_prorated,
  active
)
VALUES 
  ('permanent', 'active', 1, 1, 'Permanent - Year 2', 7, 30, 6, 120, 15, false, 'พนักงานประจำปีที่ 2', false, true),
  ('permanent', 'active', 2, 2, 'Permanent - Year 3', 8, 30, 6, 120, 15, false, 'พนักงานประจำปีที่ 3', false, true),
  ('permanent', 'active', 3, 3, 'Permanent - Year 4', 9, 30, 6, 120, 15, false, 'พนักงานประจำปีที่ 4', false, true),
  ('permanent', 'active', 4, 4, 'Permanent - Year 5', 10, 30, 6, 120, 15, false, 'พนักงานประจำปีที่ 5', false, true),
  ('permanent', 'active', 5, 5, 'Permanent - Year 6', 11, 30, 6, 120, 15, false, 'พนักงานประจำปีที่ 6', false, true),
  ('permanent', 'active', 6, 6, 'Permanent - Year 7', 12, 30, 6, 120, 15, false, 'พนักงานประจำปีที่ 7', false, true),
  ('permanent', 'active', 7, 7, 'Permanent - Year 8', 13, 30, 6, 120, 15, false, 'พนักงานประจำปีที่ 8', false, true),
  ('permanent', 'active', 8, 8, 'Permanent - Year 9', 14, 30, 6, 120, 15, false, 'พนักงานประจำปีที่ 9', false, true),
  ('permanent', 'active', 9, 9, 'Permanent - Year 10', 15, 30, 6, 120, 15, false, 'พนักงานประจำปีที่ 10', false, true),
  ('permanent', 'active', 10, NULL, 'Permanent - Year 11+', 15, 30, 6, 120, 15, false, 'พนักงานประจำปีที่ 11+', false, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. ENHANCE employee_leave_balances TABLE
-- Add detailed balance tracking columns
-- ============================================================

ALTER TABLE employee_leave_balances 
ADD COLUMN IF NOT EXISTS entitled_days DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_days DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_days DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS carried_over_days DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pro_rated_percent DECIMAL(5,2) DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_utilized BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Migrate existing balance_days to entitled_days if needed
UPDATE employee_leave_balances 
SET entitled_days = balance_days, 
    remaining_days = balance_days,
    used_days = 0
WHERE balance_days IS NOT NULL AND entitled_days = 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_year 
  ON employee_leave_balances(employee_id, year);

-- ============================================================
-- 3. CREATE leave_balance_history TABLE
-- Track audit trail of balance changes
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
  changed_by UUID,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_balance_history_employee_year 
  ON leave_balance_history(employee_id, year);

-- ============================================================
-- 4. CREATE leave_calculation_log TABLE
-- Track calculation operations for audit
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_calculation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  calculation_type VARCHAR(50) NOT NULL,
  calculation_date DATE NOT NULL,
  years_of_service INT NOT NULL DEFAULT 0,
  tenure_year_for_policy INT,
  policy_id INTEGER REFERENCES leave_policies(id),
  base_quota DECIMAL(5,2),
  pro_rate_percent DECIMAL(5,2) DEFAULT 100,
  final_entitled_days DECIMAL(5,2),
  calculation_details JSONB,
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
-- Add leave-related fields
-- ============================================================

ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS probation_end_date DATE,
ADD COLUMN IF NOT EXISTS pro_rate_applied_for_year INT,
ADD COLUMN IF NOT EXISTS last_leave_calculation_date DATE;

-- Set start_date from employment_date if not set
UPDATE employees 
SET start_date = employment_date::DATE
WHERE start_date IS NULL AND employment_date IS NOT NULL;

-- Calculate probation_end_date for employees without it (start_date + 119 days)
UPDATE employees 
SET probation_end_date = start_date + INTERVAL '119 days'
WHERE probation_end_date IS NULL AND start_date IS NOT NULL;

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_employees_probation_end_date 
  ON employees(probation_end_date);
CREATE INDEX IF NOT EXISTS idx_employees_start_date 
  ON employees(start_date);

-- ============================================================
-- 6. CREATE leave_entitlement_config TABLE
-- Store configurable business rules
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_entitlement_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value VARCHAR(255) NOT NULL,
  data_type VARCHAR(50) DEFAULT 'string',
  description TEXT,
  last_updated_by UUID REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO leave_entitlement_config (config_key, config_value, data_type, description) VALUES 
  ('probation_days', '119', 'integer', 'จำนวนวันทดลองงานก่อนจะสามารถขอลาได้'),
  ('yearly_reset_date', '01-01', 'string', 'วันที่ระบบตัดสิทธิ์วันลาการไม่ใช้ของปีปีหน้า'),
  ('rounding_method', '0.5', 'decimal', 'การปัดเศษวันลา (0.5 = ปัดลงที่ 0.5 วัน)'),
  ('max_carry_over_days', '0', 'decimal', 'จำนวนวันลาสูงสุดที่สามารถยกไปปีหน้าได้'),
  ('pro_rate_calculation_enabled', 'true', 'boolean', 'เปิดใช้งานการคำนวณ Pro-rate'),
  ('step_up_policy_enabled', 'true', 'boolean', 'เปิดใช้งานนโยบายเพิ่มสิทธิ์ตามอายุงาน')
ON CONFLICT (config_key) DO NOTHING;

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
-- Returns policy based on employee type and tenure
-- ============================================================

CREATE OR REPLACE FUNCTION get_applicable_leave_policy(
  p_employee_type VARCHAR(50),
  p_years_of_service INT
)
RETURNS SETOF leave_policies AS $$
BEGIN
  RETURN QUERY
  SELECT lp.*
  FROM leave_policies lp
  WHERE lp.employee_type = p_employee_type
    AND lp.tenure_year_from <= p_years_of_service
    AND (lp.tenure_year_to IS NULL OR lp.tenure_year_to >= p_years_of_service)
    AND lp.active = true
  ORDER BY lp.tenure_year_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 9. CREATE FUNCTION: Calculate Prorated Leave Days
-- Handles work anniversary within same calendar year
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
  v_months_at_old_rate INT := 0;
  v_months_at_new_rate INT := 0;
  v_old_rate DECIMAL;
  v_new_rate DECIMAL;
  v_policy_old RECORD;
  v_policy_new RECORD;
  v_years_before_anniversary INT;
  v_years_at_anniversary INT;
  v_rounded_days DECIMAL;
  v_start_year INT;
BEGIN
  v_start_year := EXTRACT(YEAR FROM p_start_date)::INT;
  
  -- If hire date is after the calendar year, no entitlement
  IF v_start_year > p_calendar_year THEN
    entitled_days := 0;
    pro_rate_percent := 0;
    calculation_details := jsonb_build_object('error', 'Start date is after calendar year');
    RETURN;
  END IF;
  
  -- Calculate anniversary date in the calendar year
  BEGIN
    v_anniversary_date := make_date(p_calendar_year, EXTRACT(MONTH FROM p_start_date)::INT, EXTRACT(DAY FROM p_start_date)::INT);
  EXCEPTION WHEN OTHERS THEN
    -- Handle Feb 29 in non-leap years
    v_anniversary_date := make_date(p_calendar_year, 2, 28);
  END;
  
  -- Get years of service before anniversary
  v_years_before_anniversary := FLOOR(EXTRACT(DAY FROM (v_anniversary_date - p_start_date)) / 365.25)::INT;
  v_years_at_anniversary := v_years_before_anniversary;
  
  -- Get policy before anniversary
  SELECT * INTO v_policy_old
  FROM leave_policies
  WHERE employee_type = p_employee_type
    AND tenure_year_from <= v_years_before_anniversary
    AND (tenure_year_to IS NULL OR tenure_year_to >= v_years_before_anniversary)
    AND active = true
  ORDER BY tenure_year_from DESC
  LIMIT 1;
  
  -- Get policy at/after anniversary
  SELECT * INTO v_policy_new
  FROM leave_policies
  WHERE employee_type = p_employee_type
    AND tenure_year_from <= v_years_at_anniversary
    AND (tenure_year_to IS NULL OR tenure_year_to >= v_years_at_anniversary)
    AND active = true
  ORDER BY tenure_year_from DESC
  LIMIT 1;
  
  -- Handle cases where no policy found
  IF v_policy_old IS NULL AND v_policy_new IS NULL THEN
    entitled_days := 6;
    pro_rate_percent := 100;
    calculation_details := jsonb_build_object('error', 'No policy found');
    RETURN;
  END IF;
  
  -- If same policy or only old policy exists (hire date after anniversary)
  IF v_policy_old IS NULL OR (v_policy_old IS NOT NULL AND v_policy_new IS NOT NULL AND v_policy_old.id = v_policy_new.id) THEN
    v_old_rate := COALESCE(v_policy_old.annual_leave_quota, v_policy_new.annual_leave_quota);
    
    -- Pro-rate from hire date to end of year
    IF v_start_year = p_calendar_year THEN
      v_months_at_old_rate := EXTRACT(MONTH FROM (DATE(p_calendar_year || '-12-31') - p_start_date))::INT + 1;
      entitled_days := ROUND((v_old_rate::DECIMAL / 12 * v_months_at_old_rate)::NUMERIC, 2);
      pro_rate_percent := ROUND(((v_months_at_old_rate::DECIMAL * 100) / 12)::NUMERIC, 2);
    ELSE
      -- Full year
      entitled_days := v_old_rate;
      pro_rate_percent := 100;
      v_months_at_old_rate := 12;
    END IF;
  ELSE
    -- Policy changes at anniversary
    IF v_policy_old.annual_leave_quota <> v_policy_new.annual_leave_quota THEN
      v_old_rate := v_policy_old.annual_leave_quota;
      v_new_rate := v_policy_new.annual_leave_quota;
      
      -- Anniversary is after Jan 1 in the same year
      IF v_anniversary_date > (p_calendar_year || '-01-01')::DATE THEN
        v_months_at_old_rate := EXTRACT(MONTH FROM v_anniversary_date)::INT - 1;
        v_months_at_new_rate := 12 - v_months_at_old_rate;
        
        -- If hire date is after anniversary, no old rate applies
        IF p_start_date > v_anniversary_date THEN
          v_months_at_old_rate := 0;
          v_months_at_new_rate := 12;
          entitled_days := v_new_rate;
        ELSE
          entitled_days := ROUND((v_old_rate::DECIMAL / 12 * v_months_at_old_rate + v_new_rate::DECIMAL / 12 * v_months_at_new_rate)::NUMERIC, 2);
        END IF;
        pro_rate_percent := ROUND(((v_months_at_old_rate + v_months_at_new_rate)::DECIMAL * 100 / 12)::NUMERIC, 2);
      ELSE
        -- Anniversary already passed, use new rate for entire year
        entitled_days := v_new_rate;
        pro_rate_percent := 100;
        v_months_at_new_rate := 12;
      END IF;
    ELSE
      -- Same quota despite policy change
      entitled_days := v_policy_old.annual_leave_quota;
      pro_rate_percent := 100;
      v_months_at_old_rate := 12;
    END IF;
  END IF;
  
  -- Apply rounding to 0.5 (round down)
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
-- Returns true if employee is still in probation (< 119 days)
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
-- SUMMARY
-- ============================================================
-- Tables created/enhanced:
--   - leave_policies: Added tenure_year_from/to, policy_name for step-up, defaulted tier records
--   - employee_leave_balances: Added entitled_days, used_days, remaining_days, pro_rated_percent
--   - leave_balance_history: NEW - audit trail
--   - leave_calculation_log: NEW - calculation tracking
--   - employees: Added start_date, probation_end_date, pro_rate_applied_for_year
--   - leave_entitlement_config: NEW - configurable business rules
--
-- Functions created:
--   - calculate_years_of_service(date, date) → INT
--   - get_applicable_leave_policy(varchar, int) → leave_policies
--   - calculate_prorated_leave_days(date, varchar, int) → (decimal, decimal, jsonb)
--   - is_employee_in_probation(uuid, date) → BOOLEAN
--
-- Schema now ready for LeaveCalculationService and cron jobs
