-- 1. Add multi-level approval columns to leave_requests
ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS approval_level integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_approval_step integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS requires_hr_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manager_approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS manager_approver_id uuid REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS hr_approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS hr_approver_id uuid REFERENCES public.employees(id);

-- 2. Create approval workflow configuration table
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type leave_type NOT NULL,
  min_days integer DEFAULT 1,
  max_days integer,
  approval_levels integer NOT NULL DEFAULT 1,
  requires_hr boolean DEFAULT false,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(leave_type, min_days)
);

-- Enable RLS
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_workflows
CREATE POLICY "Authenticated users can view workflows" 
ON public.approval_workflows FOR SELECT 
USING (true);

CREATE POLICY "HR and Admin can manage workflows" 
ON public.approval_workflows FOR ALL 
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Insert default workflow configurations
INSERT INTO public.approval_workflows (leave_type, min_days, max_days, approval_levels, requires_hr, description) VALUES
  ('vacation', 1, 2, 1, false, 'ลาพักร้อน 1-2 วัน อนุมัติ 1 ขั้น'),
  ('vacation', 3, null, 2, true, 'ลาพักร้อน 3+ วัน อนุมัติ 2 ขั้น'),
  ('sick', 1, 3, 1, false, 'ลาป่วย 1-3 วัน อนุมัติ 1 ขั้น'),
  ('sick', 4, null, 2, true, 'ลาป่วย 4+ วัน อนุมัติ 2 ขั้น (ต้องมีใบรับรองแพทย์)'),
  ('personal', 1, null, 1, false, 'ลากิจทั่วไป อนุมัติ 1 ขั้น'),
  ('maternity', 1, null, 2, true, 'ลาคลอด อนุมัติ 2 ขั้น'),
  ('paternity', 1, null, 2, true, 'ลาช่วยภรรยาคลอด อนุมัติ 2 ขั้น'),
  ('unpaid', 1, null, 2, true, 'ลาไม่รับค่าจ้าง อนุมัติ 2 ขั้น'),
  ('other', 1, null, 1, false, 'ลาอื่นๆ อนุมัติ 1 ขั้น')
ON CONFLICT DO NOTHING;

-- 3. Create storage bucket for leave attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('leave-attachments', 'leave-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for leave attachments
CREATE POLICY "Employees can upload their own attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'leave-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Employees can view their own attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leave-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "HR and Admin can view all attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leave-attachments' 
  AND (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Managers can view team attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leave-attachments' 
  AND has_role(auth.uid(), 'manager'::app_role)
);

-- 4. Add realtime to approval_workflows
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_workflows;