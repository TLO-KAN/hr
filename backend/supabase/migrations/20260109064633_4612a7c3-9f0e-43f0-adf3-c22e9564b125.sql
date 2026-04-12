-- Create leave_policy_rules table for managing leave quotas based on years of service and employee status
CREATE TABLE public.leave_policy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_years_of_service integer NOT NULL DEFAULT 0,
  max_years_of_service integer,
  employee_status employee_status NOT NULL DEFAULT 'active',
  annual_leave_quota integer NOT NULL DEFAULT 6,
  sick_leave_quota integer NOT NULL DEFAULT 30,
  personal_leave_quota integer NOT NULL DEFAULT 6,
  other_leave_quota integer NOT NULL DEFAULT 5,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_policy_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view leave policy rules"
ON public.leave_policy_rules
FOR SELECT
USING (true);

CREATE POLICY "HR and Admin can manage leave policy rules"
ON public.leave_policy_rules
FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_leave_policy_rules_updated_at
BEFORE UPDATE ON public.leave_policy_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default leave policy rules
INSERT INTO public.leave_policy_rules (min_years_of_service, max_years_of_service, employee_status, annual_leave_quota, sick_leave_quota, personal_leave_quota, other_leave_quota, description)
VALUES 
  (0, 1, 'active', 6, 30, 6, 5, 'พนักงานใหม่ (0-1 ปี)'),
  (1, 3, 'active', 8, 30, 6, 5, 'พนักงานอายุงาน 1-3 ปี'),
  (3, 5, 'active', 10, 30, 6, 5, 'พนักงานอายุงาน 3-5 ปี'),
  (5, NULL, 'active', 15, 30, 6, 5, 'พนักงานอายุงาน 5 ปีขึ้นไป'),
  (0, NULL, 'resigned', 0, 0, 0, 0, 'พนักงานลาออก'),
  (0, NULL, 'suspended', 0, 0, 0, 0, 'พนักงานพักงาน');