-- Fix security issues

-- 1. Drop the view and recreate without SECURITY DEFINER issue
DROP VIEW IF EXISTS public.leave_balances;

CREATE VIEW public.leave_balances AS
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
GROUP BY e.id, e.employee_code, e.first_name, e.last_name, e.annual_leave_quota, e.sick_leave_quota, e.personal_leave_quota, e.other_leave_quota;

-- 2. Fix update_updated_at_column function search path
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Fix overly permissive RLS policies
DROP POLICY IF EXISTS "System can insert change logs" ON public.employee_change_logs;

CREATE POLICY "HR and Admin can insert change logs"
  ON public.employee_change_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'admin'));