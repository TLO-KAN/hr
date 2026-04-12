-- Update recalculate_employee_entitlements to auto-calculate based on years of service
CREATE OR REPLACE FUNCTION public.recalculate_employee_entitlements(p_employee_id uuid, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee RECORD;
  v_policy RECORD;
  v_prorated_quota NUMERIC;
  v_used_days NUMERIC;
  v_leave_types TEXT[] := ARRAY['vacation', 'sick', 'personal', 'other', 'maternity', 'paternity'];
  v_leave_type TEXT;
  v_years_of_service NUMERIC;
  v_is_prorated BOOLEAN;
BEGIN
  -- Get employee info
  SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate years of service based on start_date
  v_years_of_service := EXTRACT(YEAR FROM age(make_date(p_year, 12, 31), v_employee.start_date));
  IF v_years_of_service < 0 THEN
    v_years_of_service := 0;
  END IF;
  
  -- Get applicable policy based on employee type, status, and years of service
  SELECT * INTO v_policy 
  FROM leave_policy_rules 
  WHERE employee_type = v_employee.employee_type
    AND employee_status = v_employee.status
    AND min_years_of_service <= v_years_of_service
    AND (max_years_of_service IS NULL OR max_years_of_service >= v_years_of_service)
  ORDER BY min_years_of_service DESC
  LIMIT 1;
  
  -- If no matching policy, try to get a default policy for the employee type
  IF NOT FOUND THEN
    SELECT * INTO v_policy 
    FROM leave_policy_rules 
    WHERE employee_type = v_employee.employee_type
      AND employee_status = v_employee.status
    ORDER BY min_years_of_service ASC
    LIMIT 1;
  END IF;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Process each leave type
  FOREACH v_leave_type IN ARRAY v_leave_types
  LOOP
    -- Determine quota and prorate flag based on leave type
    CASE v_leave_type
      WHEN 'vacation' THEN
        v_prorated_quota := v_policy.annual_leave_quota;
        v_is_prorated := v_policy.is_prorated;
      WHEN 'sick' THEN
        v_prorated_quota := v_policy.sick_leave_quota;
        v_is_prorated := v_policy.is_prorated;
      WHEN 'personal' THEN
        v_prorated_quota := v_policy.personal_leave_quota;
        v_is_prorated := v_policy.is_prorated;
      WHEN 'other' THEN
        v_prorated_quota := v_policy.other_leave_quota;
        v_is_prorated := v_policy.is_prorated;
      WHEN 'maternity' THEN
        v_prorated_quota := v_policy.maternity_leave_quota;
        v_is_prorated := false; -- Maternity is never prorated
      WHEN 'paternity' THEN
        v_prorated_quota := v_policy.paternity_leave_quota;
        v_is_prorated := false; -- Paternity is never prorated
      ELSE
        v_prorated_quota := 0;
        v_is_prorated := false;
    END CASE;
    
    -- Calculate prorated amount
    v_prorated_quota := calculate_prorated_leave(
      v_prorated_quota,
      v_employee.start_date,
      p_year,
      v_is_prorated
    );
    
    -- Get used days for this leave type
    SELECT COALESCE(SUM(total_days), 0) INTO v_used_days
    FROM leave_requests
    WHERE employee_id = p_employee_id
      AND leave_type = v_leave_type::leave_type
      AND status = 'approved'
      AND EXTRACT(YEAR FROM start_date) = p_year;
    
    -- Upsert entitlement
    INSERT INTO leave_entitlements (
      employee_id, year, leave_type, base_quota, prorated_quota, 
      used_days, remaining_days, policy_version_id
    )
    VALUES (
      p_employee_id, p_year, v_leave_type::leave_type, 
      CASE v_leave_type
        WHEN 'vacation' THEN v_policy.annual_leave_quota
        WHEN 'sick' THEN v_policy.sick_leave_quota
        WHEN 'personal' THEN v_policy.personal_leave_quota
        WHEN 'other' THEN v_policy.other_leave_quota
        WHEN 'maternity' THEN v_policy.maternity_leave_quota
        WHEN 'paternity' THEN v_policy.paternity_leave_quota
        ELSE 0
      END,
      v_prorated_quota, v_used_days, v_prorated_quota - v_used_days, v_policy.id
    )
    ON CONFLICT (employee_id, year, leave_type) 
    DO UPDATE SET
      base_quota = EXCLUDED.base_quota,
      prorated_quota = EXCLUDED.prorated_quota,
      used_days = EXCLUDED.used_days,
      remaining_days = EXCLUDED.prorated_quota - EXCLUDED.used_days,
      policy_version_id = EXCLUDED.policy_version_id,
      calculation_date = now(),
      updated_at = now();
  END LOOP;
END;
$function$;

-- Create a function to get all employees' leave balances for HR dashboard
CREATE OR REPLACE FUNCTION public.get_all_employees_leave_summary(p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer)
RETURNS TABLE (
  employee_id uuid,
  employee_code text,
  first_name text,
  last_name text,
  department_name text,
  position_name text,
  start_date date,
  years_of_service numeric,
  employee_type text,
  employee_status text,
  vacation_quota numeric,
  vacation_used numeric,
  vacation_remaining numeric,
  sick_quota numeric,
  sick_used numeric,
  sick_remaining numeric,
  personal_quota numeric,
  personal_used numeric,
  personal_remaining numeric,
  maternity_quota numeric,
  maternity_used numeric,
  maternity_remaining numeric,
  paternity_quota numeric,
  paternity_used numeric,
  paternity_remaining numeric,
  other_quota numeric,
  other_used numeric,
  other_remaining numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT 
    e.id as employee_id,
    e.employee_code,
    e.first_name,
    e.last_name,
    COALESCE(d.name, '-') as department_name,
    COALESCE(p.name, '-') as position_name,
    e.start_date,
    ROUND(EXTRACT(YEAR FROM age(make_date(p_year, 12, 31), e.start_date)) + 
          (EXTRACT(MONTH FROM age(make_date(p_year, 12, 31), e.start_date)) / 12.0), 1) as years_of_service,
    e.employee_type::text,
    e.status::text as employee_status,
    COALESCE(MAX(CASE WHEN le.leave_type = 'vacation' THEN le.prorated_quota END), 0) as vacation_quota,
    COALESCE(MAX(CASE WHEN le.leave_type = 'vacation' THEN le.used_days END), 0) as vacation_used,
    COALESCE(MAX(CASE WHEN le.leave_type = 'vacation' THEN le.remaining_days END), 0) as vacation_remaining,
    COALESCE(MAX(CASE WHEN le.leave_type = 'sick' THEN le.prorated_quota END), 0) as sick_quota,
    COALESCE(MAX(CASE WHEN le.leave_type = 'sick' THEN le.used_days END), 0) as sick_used,
    COALESCE(MAX(CASE WHEN le.leave_type = 'sick' THEN le.remaining_days END), 0) as sick_remaining,
    COALESCE(MAX(CASE WHEN le.leave_type = 'personal' THEN le.prorated_quota END), 0) as personal_quota,
    COALESCE(MAX(CASE WHEN le.leave_type = 'personal' THEN le.used_days END), 0) as personal_used,
    COALESCE(MAX(CASE WHEN le.leave_type = 'personal' THEN le.remaining_days END), 0) as personal_remaining,
    COALESCE(MAX(CASE WHEN le.leave_type = 'maternity' THEN le.prorated_quota END), 0) as maternity_quota,
    COALESCE(MAX(CASE WHEN le.leave_type = 'maternity' THEN le.used_days END), 0) as maternity_used,
    COALESCE(MAX(CASE WHEN le.leave_type = 'maternity' THEN le.remaining_days END), 0) as maternity_remaining,
    COALESCE(MAX(CASE WHEN le.leave_type = 'paternity' THEN le.prorated_quota END), 0) as paternity_quota,
    COALESCE(MAX(CASE WHEN le.leave_type = 'paternity' THEN le.used_days END), 0) as paternity_used,
    COALESCE(MAX(CASE WHEN le.leave_type = 'paternity' THEN le.remaining_days END), 0) as paternity_remaining,
    COALESCE(MAX(CASE WHEN le.leave_type = 'other' THEN le.prorated_quota END), 0) as other_quota,
    COALESCE(MAX(CASE WHEN le.leave_type = 'other' THEN le.used_days END), 0) as other_used,
    COALESCE(MAX(CASE WHEN le.leave_type = 'other' THEN le.remaining_days END), 0) as other_remaining
  FROM employees e
  LEFT JOIN departments d ON e.department_id = d.id
  LEFT JOIN positions p ON e.position_id = p.id
  LEFT JOIN leave_entitlements le ON e.id = le.employee_id AND le.year = p_year
  WHERE e.status = 'active'
  GROUP BY e.id, e.employee_code, e.first_name, e.last_name, d.name, p.name, e.start_date, e.employee_type, e.status
  ORDER BY e.employee_code;
$function$;