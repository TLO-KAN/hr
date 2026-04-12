-- Add new leave types to enum
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'maternity';
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'paternity';

-- Add employee_type to leave_policy_rules and restructure
ALTER TABLE public.leave_policy_rules 
ADD COLUMN IF NOT EXISTS employee_type employee_type NOT NULL DEFAULT 'permanent',
ADD COLUMN IF NOT EXISTS maternity_leave_quota integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS paternity_leave_quota integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_prorated boolean NOT NULL DEFAULT true;

-- Create leave_entitlements table to track yearly entitlements per employee
CREATE TABLE IF NOT EXISTS public.leave_entitlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  leave_type leave_type NOT NULL,
  base_quota NUMERIC(5,2) NOT NULL DEFAULT 0,
  prorated_quota NUMERIC(5,2) NOT NULL DEFAULT 0,
  used_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  remaining_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  calculation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  policy_version_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, year, leave_type)
);

-- Enable RLS
ALTER TABLE public.leave_entitlements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_entitlements
CREATE POLICY "Employees can view their own entitlements" 
ON public.leave_entitlements 
FOR SELECT 
USING (employee_id = get_user_employee_id(auth.uid()));

CREATE POLICY "HR and Admin can manage all entitlements" 
ON public.leave_entitlements 
FOR ALL 
USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'admin'));

-- Create policy_audit_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.policy_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  old_values JSONB,
  new_values JSONB,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
);

-- Enable RLS
ALTER TABLE public.policy_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for policy_audit_logs
CREATE POLICY "HR and Admin can view audit logs" 
ON public.policy_audit_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "HR and Admin can insert audit logs" 
ON public.policy_audit_logs 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at on leave_entitlements
CREATE TRIGGER update_leave_entitlements_updated_at
BEFORE UPDATE ON public.leave_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate prorated leave
CREATE OR REPLACE FUNCTION public.calculate_prorated_leave(
  p_annual_days NUMERIC,
  p_start_date DATE,
  p_year INTEGER,
  p_is_prorated BOOLEAN DEFAULT true
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_year_start DATE;
  v_year_end DATE;
  v_effective_start DATE;
  v_worked_days INTEGER;
  v_entitled NUMERIC;
BEGIN
  -- If not prorated, return full amount
  IF NOT p_is_prorated THEN
    RETURN p_annual_days;
  END IF;
  
  -- If annual days is 0, return 0
  IF p_annual_days = 0 THEN
    RETURN 0;
  END IF;
  
  -- Calculate year boundaries
  v_year_start := make_date(p_year, 1, 1);
  v_year_end := make_date(p_year, 12, 31);
  
  -- Effective start is the later of start_date or year start
  v_effective_start := GREATEST(p_start_date, v_year_start);
  
  -- If employee started after year end, no entitlement
  IF v_effective_start > v_year_end THEN
    RETURN 0;
  END IF;
  
  -- Calculate worked days (inclusive)
  v_worked_days := v_year_end - v_effective_start + 1;
  
  -- Calculate prorated entitlement
  v_entitled := (p_annual_days::NUMERIC / 365.0) * v_worked_days;
  
  -- Round down to nearest 0.5
  v_entitled := FLOOR(v_entitled * 2) / 2;
  
  RETURN v_entitled;
END;
$$;

-- Create function to recalculate all entitlements for an employee
CREATE OR REPLACE FUNCTION public.recalculate_employee_entitlements(
  p_employee_id UUID,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee RECORD;
  v_policy RECORD;
  v_prorated_quota NUMERIC;
  v_used_days NUMERIC;
  v_leave_types TEXT[] := ARRAY['vacation', 'sick', 'personal', 'other', 'maternity', 'paternity'];
  v_leave_type TEXT;
  v_quota_column TEXT;
  v_is_prorated BOOLEAN;
BEGIN
  -- Get employee info
  SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Get applicable policy based on employee type and status
  SELECT * INTO v_policy 
  FROM leave_policy_rules 
  WHERE employee_type = v_employee.employee_type
    AND employee_status = v_employee.status
  ORDER BY min_years_of_service DESC
  LIMIT 1;
  
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
$$;

-- Insert default policies for permanent employees
INSERT INTO leave_policy_rules (
  employee_type, employee_status, min_years_of_service, max_years_of_service,
  annual_leave_quota, sick_leave_quota, personal_leave_quota, other_leave_quota,
  maternity_leave_quota, paternity_leave_quota, is_prorated, description
)
VALUES 
  ('permanent', 'active', 0, NULL, 6, 30, 3, 5, 120, 15, true, 'พนักงานประจำ (ผ่านทดลองงาน)')
ON CONFLICT DO NOTHING;

-- Insert default policies for contract employees (probation)
INSERT INTO leave_policy_rules (
  employee_type, employee_status, min_years_of_service, max_years_of_service,
  annual_leave_quota, sick_leave_quota, personal_leave_quota, other_leave_quota,
  maternity_leave_quota, paternity_leave_quota, is_prorated, description
)
VALUES 
  ('contract', 'active', 0, NULL, 0, 30, 2, 0, 0, 0, false, 'พนักงานทดลองงาน')
ON CONFLICT DO NOTHING;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_leave_entitlements_employee_year 
ON leave_entitlements(employee_id, year);

CREATE INDEX IF NOT EXISTS idx_policy_audit_logs_policy_id 
ON policy_audit_logs(policy_id);