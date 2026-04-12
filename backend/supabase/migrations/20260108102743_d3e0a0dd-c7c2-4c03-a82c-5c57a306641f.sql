-- Fix security definer view by converting to a function instead
DROP VIEW IF EXISTS public.leave_balances;

-- Create a table function instead of a view to avoid security definer issues
CREATE OR REPLACE FUNCTION public.get_leave_balances(p_employee_id UUID DEFAULT NULL)
RETURNS TABLE (
  employee_id UUID,
  employee_code TEXT,
  first_name TEXT,
  last_name TEXT,
  annual_leave_quota INTEGER,
  sick_leave_quota INTEGER,
  personal_leave_quota INTEGER,
  other_leave_quota INTEGER,
  vacation_used NUMERIC,
  sick_used NUMERIC,
  personal_used NUMERIC,
  other_used NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    e.id as employee_id,
    e.employee_code,
    e.first_name,
    e.last_name,
    e.annual_leave_quota,
    e.sick_leave_quota,
    e.personal_leave_quota,
    e.other_leave_quota,
    COALESCE(SUM(CASE WHEN lr.leave_type = 'vacation' AND lr.status = 'approved' THEN lr.total_days ELSE 0 END), 0) as vacation_used,
    COALESCE(SUM(CASE WHEN lr.leave_type = 'sick' AND lr.status = 'approved' THEN lr.total_days ELSE 0 END), 0) as sick_used,
    COALESCE(SUM(CASE WHEN lr.leave_type = 'personal' AND lr.status = 'approved' THEN lr.total_days ELSE 0 END), 0) as personal_used,
    COALESCE(SUM(CASE WHEN lr.leave_type = 'other' AND lr.status = 'approved' THEN lr.total_days ELSE 0 END), 0) as other_used
  FROM public.employees e
  LEFT JOIN public.leave_requests lr ON e.id = lr.employee_id
    AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  WHERE (p_employee_id IS NULL OR e.id = p_employee_id)
  GROUP BY e.id, e.employee_code, e.first_name, e.last_name, e.annual_leave_quota, e.sick_leave_quota, e.personal_leave_quota, e.other_leave_quota
$$;