-- Fix half-day leave support on existing production databases.
-- The leave request flow stores 0.5 in leave_requests.total_days,
-- and approval deducts the same fractional amount from employee_leave_balances.

BEGIN;

-- Inspect current numeric/integer types before changing anything.
SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'leave_requests' AND column_name IN ('total_days'))
    OR
    (table_name = 'employee_leave_balances' AND column_name IN (
      'entitled_days',
      'used_days',
      'remaining_days',
      'accrued_amount',
      'total_entitlement'
    ))
  )
ORDER BY table_name, column_name;

-- Required: request creation fails immediately if this stays INTEGER.
ALTER TABLE IF EXISTS public.leave_requests
  ALTER COLUMN total_days TYPE NUMERIC(4,1)
  USING total_days::NUMERIC(4,1);

-- Recommended: approval/balance deduction also uses fractional days.
ALTER TABLE IF EXISTS public.employee_leave_balances
  ADD COLUMN IF NOT EXISTS entitled_days NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS used_days NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_days NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accrued_amount NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_entitlement NUMERIC(5,2) DEFAULT 0;

ALTER TABLE IF EXISTS public.employee_leave_balances
  ALTER COLUMN entitled_days TYPE NUMERIC(5,2)
  USING entitled_days::NUMERIC(5,2),
  ALTER COLUMN used_days TYPE NUMERIC(5,2)
  USING used_days::NUMERIC(5,2),
  ALTER COLUMN remaining_days TYPE NUMERIC(5,2)
  USING remaining_days::NUMERIC(5,2),
  ALTER COLUMN accrued_amount TYPE NUMERIC(5,2)
  USING accrued_amount::NUMERIC(5,2),
  ALTER COLUMN total_entitlement TYPE NUMERIC(5,2)
  USING total_entitlement::NUMERIC(5,2);

-- Backfill enhanced balance columns from legacy balance_days if needed.
UPDATE public.employee_leave_balances
SET entitled_days = COALESCE(entitled_days, balance_days, 0),
    remaining_days = COALESCE(remaining_days, balance_days, 0),
    total_entitlement = COALESCE(total_entitlement, entitled_days, balance_days, 0)
WHERE COALESCE(entitled_days, remaining_days, total_entitlement) IS NULL;

COMMIT;

-- Verify final types after migration.
SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'leave_requests' AND column_name IN ('total_days'))
    OR
    (table_name = 'employee_leave_balances' AND column_name IN (
      'entitled_days',
      'used_days',
      'remaining_days',
      'accrued_amount',
      'total_entitlement'
    ))
  )
ORDER BY table_name, column_name;