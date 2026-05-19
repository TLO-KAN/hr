BEGIN;

WITH ranked_attendances AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, access_datetime
      ORDER BY id
    ) AS row_num
  FROM time_attendances
)
DELETE FROM time_attendances AS target
USING ranked_attendances AS ranked
WHERE target.id = ranked.id
  AND ranked.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_time_attendances_employee_datetime_unique
  ON time_attendances(employee_id, access_datetime);

COMMIT;
