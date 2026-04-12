-- Ensure optional time-related leave request fields exist in all environments
ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS half_day_period VARCHAR(20);
