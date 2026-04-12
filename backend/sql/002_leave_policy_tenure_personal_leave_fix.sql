-- Align leave policy rules with HR requirement:
-- 1) Permanent policy starts at 1 year
-- 2) Permanent 10+ years = 15 vacation days
-- 3) Personal leave quota = 3 days for all active policies

BEGIN;

UPDATE leave_policies
SET personal_leave_quota = 3,
    updated_at = NOW()
WHERE COALESCE(active, true) = true;

WITH permanent_rows AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY annual_leave_quota ASC, id ASC) AS service_year
  FROM leave_policies
  WHERE employee_type = 'permanent'
    AND COALESCE(active, true) = true
)
UPDATE leave_policies lp
SET tenure_year_from = pr.service_year,
    tenure_year_to = pr.service_year,
    min_years_of_service = pr.service_year,
    max_years_of_service = pr.service_year,
    updated_at = NOW()
FROM permanent_rows pr
WHERE lp.id = pr.id;

WITH top_tier AS (
  SELECT id
  FROM leave_policies
  WHERE employee_type = 'permanent'
    AND COALESCE(active, true) = true
  ORDER BY annual_leave_quota DESC, id DESC
  LIMIT 1
)
UPDATE leave_policies
SET tenure_year_from = 10,
    tenure_year_to = NULL,
    min_years_of_service = 10,
    max_years_of_service = NULL,
    annual_leave_quota = 15,
    updated_at = NOW()
WHERE id IN (SELECT id FROM top_tier);

COMMIT;
