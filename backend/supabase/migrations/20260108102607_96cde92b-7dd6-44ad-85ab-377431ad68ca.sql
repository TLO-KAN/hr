-- Create app_role enum for role-based access
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'manager', 'employee');

-- Create employee status enum
CREATE TYPE public.employee_status AS ENUM ('active', 'resigned', 'suspended');

-- Create employee type enum
CREATE TYPE public.employee_type AS ENUM ('permanent', 'contract', 'parttime');

-- Create leave type enum
CREATE TYPE public.leave_type AS ENUM ('sick', 'personal', 'vacation', 'unpaid', 'other');

-- Create leave status enum
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create positions table
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES public.departments(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create profiles table for authentication
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_roles table for RBAC
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL UNIQUE,
  prefix TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  id_card_number TEXT,
  birth_date DATE,
  gender TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  position_id UUID REFERENCES public.positions(id),
  department_id UUID REFERENCES public.departments(id),
  manager_id UUID REFERENCES public.employees(id),
  employee_type employee_type DEFAULT 'permanent',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status employee_status DEFAULT 'active',
  annual_leave_quota INTEGER DEFAULT 10,
  sick_leave_quota INTEGER DEFAULT 30,
  personal_leave_quota INTEGER DEFAULT 6,
  other_leave_quota INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  leave_type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(4,1) NOT NULL,
  reason TEXT,
  attachment_url TEXT,
  status leave_status DEFAULT 'pending',
  approver_id UUID REFERENCES public.employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create leave_balances view
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

-- Create employee_change_logs table
CREATE TABLE public.employee_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_change_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's employee_id
CREATE OR REPLACE FUNCTION public.get_user_employee_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User roles policies (admin only)
CREATE POLICY "Admin can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Departments policies (viewable by all authenticated, editable by HR/Admin)
CREATE POLICY "Authenticated users can view departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HR and Admin can manage departments"
  ON public.departments FOR ALL
  USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'admin'));

-- Positions policies
CREATE POLICY "Authenticated users can view positions"
  ON public.positions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HR and Admin can manage positions"
  ON public.positions FOR ALL
  USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'admin'));

-- Employees policies
CREATE POLICY "Employees can view their own record"
  ON public.employees FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "HR and Admin can view all employees"
  ON public.employees FOR SELECT
  USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view their team"
  ON public.employees FOR SELECT
  USING (manager_id = public.get_user_employee_id(auth.uid()));

CREATE POLICY "HR and Admin can manage employees"
  ON public.employees FOR ALL
  USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'admin'));

-- Leave requests policies
CREATE POLICY "Employees can view their own leave requests"
  ON public.leave_requests FOR SELECT
  USING (employee_id = public.get_user_employee_id(auth.uid()));

CREATE POLICY "Employees can create their own leave requests"
  ON public.leave_requests FOR INSERT
  WITH CHECK (employee_id = public.get_user_employee_id(auth.uid()));

CREATE POLICY "Employees can update pending leave requests"
  ON public.leave_requests FOR UPDATE
  USING (employee_id = public.get_user_employee_id(auth.uid()) AND status = 'pending');

CREATE POLICY "HR and Admin can view all leave requests"
  ON public.leave_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HR and Admin can manage all leave requests"
  ON public.leave_requests FOR ALL
  USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view team leave requests"
  ON public.leave_requests FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE manager_id = public.get_user_employee_id(auth.uid())
    )
  );

CREATE POLICY "Managers can approve team leave requests"
  ON public.leave_requests FOR UPDATE
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE manager_id = public.get_user_employee_id(auth.uid())
    )
  );

-- Employee change logs policies
CREATE POLICY "HR and Admin can view change logs"
  ON public.employee_change_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert change logs"
  ON public.employee_change_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Insert default departments
INSERT INTO public.departments (name, description) VALUES
  ('บริหาร', 'ฝ่ายบริหารและจัดการ'),
  ('ทรัพยากรบุคคล', 'ฝ่ายทรัพยากรบุคคล'),
  ('การเงิน', 'ฝ่ายการเงินและบัญชี'),
  ('ไอที', 'ฝ่ายเทคโนโลยีสารสนเทศ'),
  ('การตลาด', 'ฝ่ายการตลาดและขาย');

-- Insert default positions
INSERT INTO public.positions (name, department_id, description)
SELECT 'ผู้จัดการ', id, 'ผู้จัดการแผนก' FROM public.departments WHERE name = 'บริหาร'
UNION ALL
SELECT 'พนักงาน HR', id, 'เจ้าหน้าที่ทรัพยากรบุคคล' FROM public.departments WHERE name = 'ทรัพยากรบุคคล'
UNION ALL
SELECT 'นักพัฒนาซอฟต์แวร์', id, 'โปรแกรมเมอร์' FROM public.departments WHERE name = 'ไอที'
UNION ALL
SELECT 'นักบัญชี', id, 'เจ้าหน้าที่บัญชี' FROM public.departments WHERE name = 'การเงิน';