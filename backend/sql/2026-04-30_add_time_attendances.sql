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

COMMIT;
