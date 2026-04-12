-- Create company settings table for working hours
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can view settings
CREATE POLICY "Authenticated users can view company settings"
ON public.company_settings
FOR SELECT
TO authenticated
USING (true);

-- Only HR/Admin can manage
CREATE POLICY "HR and Admin can manage company settings"
ON public.company_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Insert default working hours
INSERT INTO public.company_settings (setting_key, setting_value, description)
VALUES (
  'working_hours',
  '{"start_time": "08:30", "end_time": "17:30", "break_start": "12:00", "break_end": "13:00", "working_hours_per_day": 8}'::jsonb,
  'เวลาทำงานของบริษัท'
) ON CONFLICT (setting_key) DO NOTHING;

-- Insert leave validation rules
INSERT INTO public.company_settings (setting_key, setting_value, description)
VALUES (
  'leave_validation_rules',
  '{"vacation": {"advance_days": 3, "description": "ลาพักร้อนต้องแจ้งล่วงหน้าอย่างน้อย 3 วัน"}, "personal": {"advance_days": 1, "description": "ลากิจต้องแจ้งล่วงหน้าอย่างน้อย 1 วัน"}, "sick": {"retroactive_days": 7, "description": "ลาป่วยแจ้งย้อนหลังได้ไม่เกิน 7 วัน"}}'::jsonb,
  'กฎเกณฑ์การแจ้งลาล่วงหน้า'
) ON CONFLICT (setting_key) DO NOTHING;

-- Add time fields to leave_requests
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS start_time TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS end_time TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS half_day_period TEXT DEFAULT NULL CHECK (half_day_period IN ('morning', 'afternoon', NULL)),
ADD COLUMN IF NOT EXISTS validation_warnings JSONB DEFAULT NULL;

-- Update trigger for company_settings
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();