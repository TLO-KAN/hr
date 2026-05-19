BEGIN;

CREATE TABLE IF NOT EXISTS time_attendances (
  id SERIAL PRIMARY KEY,
  local_id INTEGER,
  employee_id VARCHAR(100) NOT NULL,
  person_name VARCHAR(255),
  card_number VARCHAR(255),
  department VARCHAR(255),
  access_datetime TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_time_attendances_employee_id
  ON time_attendances(employee_id);

CREATE INDEX IF NOT EXISTS idx_time_attendances_access_datetime
  ON time_attendances(access_datetime);

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
