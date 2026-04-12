-- Create company holidays table
CREATE TABLE public.company_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(holiday_date)
);

-- Enable RLS
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view holidays"
ON public.company_holidays
FOR SELECT
USING (true);

CREATE POLICY "HR and Admin can manage holidays"
ON public.company_holidays
FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_company_holidays_updated_at
BEFORE UPDATE ON public.company_holidays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate working days (excluding weekends and holidays)
CREATE OR REPLACE FUNCTION public.calculate_working_days(start_date DATE, end_date DATE)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  total_days NUMERIC := 0;
  current_date_iter DATE := start_date;
BEGIN
  WHILE current_date_iter <= end_date LOOP
    -- Skip weekends (0 = Sunday, 6 = Saturday)
    IF EXTRACT(DOW FROM current_date_iter) NOT IN (0, 6) THEN
      -- Check if it's not a company holiday
      IF NOT EXISTS (
        SELECT 1 FROM public.company_holidays 
        WHERE holiday_date = current_date_iter
      ) THEN
        total_days := total_days + 1;
      END IF;
    END IF;
    current_date_iter := current_date_iter + INTERVAL '1 day';
  END LOOP;
  RETURN total_days;
END;
$$;