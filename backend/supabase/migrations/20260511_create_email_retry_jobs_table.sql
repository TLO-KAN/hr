-- Email retry queue for background resend jobs
CREATE TABLE IF NOT EXISTS email_retry_jobs (
  id BIGSERIAL PRIMARY KEY,
  template_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  leave_request_id TEXT,
  source TEXT DEFAULT 'leave_request',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_retry_jobs_status_next_retry
ON email_retry_jobs(status, next_retry_at);

-- Optional columns for richer email log observability
ALTER TABLE IF EXISTS email_logs
ADD COLUMN IF NOT EXISTS attempt_no INTEGER,
ADD COLUMN IF NOT EXISTS source TEXT;
