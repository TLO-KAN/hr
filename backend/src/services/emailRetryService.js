import cron from 'node-cron';
import { getPool } from '../config/db-pool.js';
import { sendLeaveRequestEmail } from '../utils/emailService.js';
import logger from '../utils/logger.js';

const pool = getPool();

const DEFAULT_MAX_ATTEMPTS = Math.max(1, Number(process.env.EMAIL_RETRY_MAX_ATTEMPTS || 3));
const DEFAULT_DELAY_SECONDS = Math.max(10, Number(process.env.EMAIL_RETRY_DELAY_SECONDS || 60));
const RETRY_CRON = process.env.EMAIL_RETRY_CRON || '*/2 * * * *';
const SEND_TIMEOUT_MS = Math.max(5000, Number(process.env.EMAIL_SEND_TIMEOUT_MS || 10000));

let retryTask = null;
let isProcessing = false;
let schemaReady = false;

function normalizeError(error) {
  if (!error) return 'Unknown error';
  return typeof error === 'string' ? error : (error.message || 'Unknown error');
}

async function sendWithTimeout(templateName, payload) {
  await Promise.race([
    sendLeaveRequestEmail(templateName, payload),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Email send timeout after ${Math.floor(SEND_TIMEOUT_MS / 1000)}s`)), SEND_TIMEOUT_MS)),
  ]);
}

export async function ensureEmailRetryInfrastructure() {
  if (schemaReady) return;

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_retry_jobs_status_next_retry
    ON email_retry_jobs(status, next_retry_at)
  `);

  await pool.query(`
    ALTER TABLE email_logs
    ADD COLUMN IF NOT EXISTS attempt_no INTEGER,
    ADD COLUMN IF NOT EXISTS source TEXT
  `).catch(() => {
    // Keep compatibility with environments where email_logs does not exist yet.
  });

  schemaReady = true;
}

export async function logEmailAttempt({
  recipientEmail,
  subject,
  leaveRequestId,
  status,
  errorMessage = null,
  attemptNo = null,
  source = 'leave_request',
}) {
  const safeRecipient = String(recipientEmail || 'UNKNOWN');
  const safeSubject = String(subject || 'Leave notification');
  const safeLeaveRequestId = leaveRequestId ? String(leaveRequestId) : null;

  try {
    await pool.query(
      `INSERT INTO email_logs (recipient_email, subject, leave_request_id, status, error_message, attempt_no, source, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [safeRecipient, safeSubject, safeLeaveRequestId, status, errorMessage, attemptNo, source]
    );
    return;
  } catch (error) {
    // Fallback for legacy schemas where leave_request_id type differs (e.g. integer).
    const fallbackMessage = [
      errorMessage,
      safeLeaveRequestId ? `leave_request_id=${safeLeaveRequestId}` : null,
    ].filter(Boolean).join(' | ');

    try {
      await pool.query(
        `INSERT INTO email_logs (recipient_email, subject, status, error_message, sent_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [safeRecipient, safeSubject, status, fallbackMessage || null]
      );
    } catch (fallbackError) {
      logger.warn(`Failed to write email log: ${normalizeError(fallbackError)}`);
    }
  }
}

export async function enqueueEmailRetryJob({
  templateName,
  payload,
  recipientEmail,
  subject,
  leaveRequestId,
  source = 'leave_request',
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  nextRetryAt = new Date(Date.now() + DEFAULT_DELAY_SECONDS * 1000),
}) {
  await ensureEmailRetryInfrastructure();

  try {
    const result = await pool.query(
      `INSERT INTO email_retry_jobs
       (template_name, payload, recipient_email, subject, leave_request_id, source, status, attempt_count, max_attempts, next_retry_at)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6, 'pending', 0, $7, $8)
       RETURNING id, next_retry_at, max_attempts`,
      [
        templateName,
        JSON.stringify(payload || {}),
        String(recipientEmail || ''),
        String(subject || 'Leave notification'),
        leaveRequestId ? String(leaveRequestId) : null,
        source,
        Math.max(1, Number(maxAttempts || DEFAULT_MAX_ATTEMPTS)),
        nextRetryAt,
      ]
    );

    return {
      queued: true,
      jobId: result.rows[0]?.id || null,
      nextRetryAt: result.rows[0]?.next_retry_at || null,
      maxAttempts: result.rows[0]?.max_attempts || Math.max(1, Number(maxAttempts || DEFAULT_MAX_ATTEMPTS)),
    };
  } catch (error) {
    logger.warn(`Failed to queue email retry job: ${normalizeError(error)}`);
    return {
      queued: false,
      error: normalizeError(error),
    };
  }
}

async function markRetrySuccess(job, attemptNo) {
  await pool.query(
    `UPDATE email_retry_jobs
     SET status = 'sent', attempt_count = $2, last_error = NULL, updated_at = NOW()
     WHERE id = $1`,
    [job.id, attemptNo]
  );

  await logEmailAttempt({
    recipientEmail: job.recipient_email,
    subject: job.subject,
    leaveRequestId: job.leave_request_id,
    status: 'sent',
    attemptNo: attemptNo + 1,
    source: job.source || 'leave_request',
  });
}

async function markRetryFailure(job, attemptNo, errorMessage) {
  const hasNextRetry = attemptNo < Number(job.max_attempts || DEFAULT_MAX_ATTEMPTS);
  const nextRetryAt = hasNextRetry
    ? new Date(Date.now() + DEFAULT_DELAY_SECONDS * Math.max(1, attemptNo) * 1000)
    : null;

  await pool.query(
    `UPDATE email_retry_jobs
     SET status = $2,
         attempt_count = $3,
         last_error = $4,
         next_retry_at = COALESCE($5, next_retry_at),
         updated_at = NOW()
     WHERE id = $1`,
    [
      job.id,
      hasNextRetry ? 'pending' : 'failed',
      attemptNo,
      errorMessage,
      nextRetryAt,
    ]
  );

  await logEmailAttempt({
    recipientEmail: job.recipient_email,
    subject: job.subject,
    leaveRequestId: job.leave_request_id,
    status: hasNextRetry ? 'failed' : 'error',
    errorMessage: hasNextRetry
      ? `Retry attempt ${attemptNo}/${job.max_attempts} failed: ${errorMessage}`
      : `Retry exhausted after ${attemptNo}/${job.max_attempts} attempts: ${errorMessage}`,
    attemptNo: attemptNo + 1,
    source: job.source || 'leave_request',
  });
}

export async function processDueEmailRetryJobs(limit = 20) {
  if (isProcessing) return;

  isProcessing = true;

  try {
    await ensureEmailRetryInfrastructure();

    const dueJobsResult = await pool.query(
      `WITH due AS (
         SELECT id
         FROM email_retry_jobs
         WHERE status IN ('pending', 'retrying')
           AND next_retry_at <= NOW()
         ORDER BY next_retry_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE email_retry_jobs j
       SET status = 'retrying', updated_at = NOW()
       FROM due
       WHERE j.id = due.id
       RETURNING j.*`,
      [limit]
    );

    if (dueJobsResult.rows.length === 0) {
      return;
    }

    for (const job of dueJobsResult.rows) {
      const attemptNo = Number(job.attempt_count || 0) + 1;

      try {
        const payload = typeof job.payload === 'string'
          ? JSON.parse(job.payload)
          : job.payload;

        await sendWithTimeout(job.template_name, payload);
        await markRetrySuccess(job, attemptNo);
      } catch (error) {
        await markRetryFailure(job, attemptNo, normalizeError(error));
      }
    }
  } catch (error) {
    logger.warn(`Email retry worker run failed: ${normalizeError(error)}`);
  } finally {
    isProcessing = false;
  }
}

export async function startEmailRetryWorker() {
  await ensureEmailRetryInfrastructure();

  if (retryTask) {
    return retryTask;
  }

  retryTask = cron.schedule(RETRY_CRON, () => {
    processDueEmailRetryJobs().catch((error) => {
      logger.warn(`Email retry cron failure: ${normalizeError(error)}`);
    });
  });

  logger.info(`Email retry worker started (cron: ${RETRY_CRON})`);

  processDueEmailRetryJobs().catch((error) => {
    logger.warn(`Initial email retry run failed: ${normalizeError(error)}`);
  });

  return retryTask;
}

export function stopEmailRetryWorker() {
  if (retryTask) {
    retryTask.stop();
    retryTask = null;
    logger.info('Email retry worker stopped');
  }
}
