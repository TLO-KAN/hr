-- Create a function to recalculate all employee entitlements for a new year
CREATE OR REPLACE FUNCTION public.recalculate_all_entitlements_for_year(p_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE)::integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_count integer := 0;
BEGIN
  -- Loop through all active employees
  FOR v_employee IN 
    SELECT id FROM employees WHERE status = 'active'
  LOOP
    -- Call the existing recalculate function for each employee
    PERFORM recalculate_employee_entitlements(v_employee.id, p_year);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Create a trigger function to recalculate entitlements when employee data changes
CREATE OR REPLACE FUNCTION public.trigger_recalculate_employee_entitlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalculate entitlements when start_date, employee_type, or status changes
  IF TG_OP = 'UPDATE' THEN
    IF OLD.start_date IS DISTINCT FROM NEW.start_date 
       OR OLD.employee_type IS DISTINCT FROM NEW.employee_type 
       OR OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM recalculate_employee_entitlements(NEW.id, EXTRACT(year FROM CURRENT_DATE)::integer);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- For new employees, recalculate their entitlements
    PERFORM recalculate_employee_entitlements(NEW.id, EXTRACT(year FROM CURRENT_DATE)::integer);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on employees table
DROP TRIGGER IF EXISTS employee_entitlements_trigger ON employees;
CREATE TRIGGER employee_entitlements_trigger
  AFTER INSERT OR UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_employee_entitlements();

-- Create a function that can be called by pg_cron (or manually) at the start of each year
CREATE OR REPLACE FUNCTION public.yearly_entitlements_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_year integer;
  v_count integer;
BEGIN
  v_current_year := EXTRACT(year FROM CURRENT_DATE)::integer;
  
  -- Recalculate all entitlements for the new year
  SELECT recalculate_all_entitlements_for_year(v_current_year) INTO v_count;
  
  -- Log the operation
  RAISE NOTICE 'Yearly entitlements reset completed. Updated % employees for year %', v_count, v_current_year;
END;
$$;