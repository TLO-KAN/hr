-- ============================================================
-- Hybrid Vacation Entitlement (Accrual + Step-up)
-- Adds explicit fields for first-year accrual visibility
-- ============================================================

ALTER TABLE employee_leave_balances
ADD COLUMN IF NOT EXISTS accrued_amount DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_entitlement DECIMAL(5,2) DEFAULT 0;

-- Backfill for existing records
UPDATE employee_leave_balances
SET total_entitlement = COALESCE(NULLIF(total_entitlement, 0), entitled_days, balance_days, 0),
    accrued_amount = COALESCE(NULLIF(accrued_amount, 0), entitled_days, balance_days, 0)
WHERE total_entitlement = 0 OR accrued_amount = 0;

-- Keep no-carry-over as default behavior
UPDATE employee_leave_balances
SET carried_over_days = 0
WHERE carried_over_days IS NULL;

CREATE INDEX IF NOT EXISTS idx_leave_balances_hybrid_year_type
  ON employee_leave_balances(year, leave_type);

CREATE INDEX IF NOT EXISTS idx_leave_balances_hybrid_employee
  ON employee_leave_balances(employee_id, year, leave_type);
