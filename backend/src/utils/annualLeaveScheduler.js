import cron from 'node-cron';
import { getPool } from '../config/db-pool.js';
import logger from './logger.js';

const pool = getPool();

// Run at 00:00 on January 1st every year
export const startAnnualLeaveBalanceScheduler = () => {
  const cronJob = cron.schedule('0 0 1 1 *', async () => {
    try {
      logger.info('🎯 Starting annual leave balance calculation...');
      await calculateAnnualLeaveBalances();
      logger.info('✅ Annual leave balance calculation completed');
    } catch (error) {
      logger.error(`Annual leave scheduler error: ${error.message}`);
    }
  });

  // Also run on server startup if it's January 1st
  const today = new Date();
  if (today.getMonth() === 0 && today.getDate() === 1) {
    calculateAnnualLeaveBalances().catch(error => {
      logger.error(`Failed to calculate annual leave on startup: ${error.message}`);
    });
  }

  return cronJob;
};

// Manual trigger for testing or manual reset
export const calculateAnnualLeaveBalances = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentYear = new Date().getFullYear();

    // Get all active employees with their policies
    const empResult = await client.query(`
      SELECT e.id, e.employee_type, e.start_date
      FROM employees e
      WHERE e.status = 'active' AND e.end_date IS NULL
    `);

    for (const employee of empResult.rows) {
      const policy = await client.query(
        `SELECT * FROM leave_policies 
         WHERE employee_type = $1 AND active = true
         LIMIT 1`,
        [employee.employee_type]
      );

      if (policy.rows.length > 0) {
        const pol = policy.rows[0];
        const yearsOfService = calculateYearsOfService(employee.start_date);

        // Check if policy applies to this employee's years of service
        if (
          yearsOfService >= pol.min_years_of_service &&
          (!pol.max_years_of_service || yearsOfService <= pol.max_years_of_service)
        ) {
          // Get all leave types
          const leaveTypes = await client.query('SELECT code FROM leave_types');

          for (const leaveType of leaveTypes.rows) {
            let entitledDays = 0;

            // Calculate entitled days based on leave type
            if (leaveType.code === 'annual') {
              entitledDays = pol.annual_leave_quota;
            } else if (leaveType.code === 'sick') {
              entitledDays = pol.sick_leave_quota;
            } else if (leaveType.code === 'personal') {
              entitledDays = pol.personal_leave_quota;
            } else if (leaveType.code === 'maternity') {
              entitledDays = pol.maternity_leave_quota;
            } else if (leaveType.code === 'paternity') {
              entitledDays = pol.paternity_leave_quota;
            }

            // Prorate if it's the first year
            if (pol.is_prorated_first_year && yearsOfService < 1) {
              const monthsWorked = Math.floor(yearsOfService * 12);
              entitledDays = Math.floor((entitledDays / 12) * monthsWorked);
            }

            // Insert or update balance
            await client.query(
              `INSERT INTO employee_leave_balances 
               (employee_id, year, leave_type, entitled_days, remaining_days)
               VALUES ($1, $2, $3, $4, $4)
               ON CONFLICT (employee_id, year, leave_type) DO UPDATE
               SET entitled_days = $4, remaining_days = $4`,
              [employee.id, currentYear, leaveType.code, entitledDays]
            );

            logger.debug(`Set ${leaveType.code} balance for employee ${employee.id}: ${entitledDays} days`);
          }
        }
      }
    }

    await client.query('COMMIT');
    logger.info(`✅ Annual leave balances updated for ${empResult.rows.length} employees`);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Failed to calculate annual leave balances: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
};

const calculateYearsOfService = (startDate) => {
  const start = new Date(startDate);
  const now = new Date();
  return (now - start) / (1000 * 60 * 60 * 24 * 365);
};

// Cron job to reset expired password reset tokens (every day at 3 AM)
export const startPasswordTokenCleanupScheduler = () => {
  const cronJob = cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('🧹 Cleaning up expired password reset tokens...');
      const result = await pool.query(
        'DELETE FROM password_reset_tokens WHERE expires_at < NOW() AND used_at IS NULL'
      );
      logger.info(`✅ Deleted ${result.rowCount} expired tokens`);
    } catch (error) {
      logger.error(`Password token cleanup error: ${error.message}`);
    }
  });

  return cronJob;
};