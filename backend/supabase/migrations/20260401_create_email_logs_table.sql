-- Create email_logs table for tracking sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  id BIGSERIAL PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  leave_request_id INTEGER REFERENCES leave_requests(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'error')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_leave_request ON email_logs(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- Create email_reminders table for tracking follow-up reminders
CREATE TABLE IF NOT EXISTS email_reminders (
  id BIGSERIAL PRIMARY KEY,
  leave_request_id INTEGER NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL, -- 'submit_24h', 'submit_48h', etc
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(leave_request_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_email_reminders_leave_request ON email_reminders(leave_request_id);
