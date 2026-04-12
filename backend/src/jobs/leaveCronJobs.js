import cron from 'node-cron';
import LeaveCalculationService from '../services/LeaveCalculationService.js';
import { getPool } from '../config/db-pool.js';

const pool = getPool();

/**
 * Leave Management Cron Jobs
 * Handles automated recalculation and reset of leave balances
 */

/**
 * Task 1: Update all employee leave quotas on January 1st
 * Runs at 00:00 (midnight) on January 1st every year
 * Cron expression: 0 0 1 1 *
 */
export const scheduleYearlyLeaveQuotaUpdate = () => {
  // Run at 00:00 on January 1st
  const task = cron.schedule('0 0 1 1 *', async () => {
    console.log('🔄 [Cron Job] Starting yearly leave quota update...');
    try {
      const currentYear = new Date().getFullYear();
      const result = await LeaveCalculationService.updateAllEmployeeLeaveBalancesForYear(currentYear);

      console.log('✅ [Cron Job] Yearly leave quota update completed:', result);

      // Log the event
      await pool.query(
        `INSERT INTO leave_calculation_log 
         (employee_id, calculation_type, calculation_date, years_of_service, final_entitled_days, calculated_by)
         VALUES (NULL, 'yearly_reset', CURRENT_DATE, 0, 0, 'system - cron')`,
      );
    } catch (error) {
      console.error('❌ [Cron Job] Error in yearly leave quota update:', error);
    }
  });

  return task;
};

/**
 * Task 1.1: Monthly accrual refresh for first-year vacation balances
 * Runs at 00:05 on day 1 of every month
 * Cron expression: 5 0 1 * *
 */
export const scheduleMonthlyAccrualUpdate = () => {
  const task = cron.schedule('5 0 1 * *', async () => {
    console.log('📈 [Cron Job] Starting monthly accrual update for first-year employees...');
    try {
      const currentYear = new Date().getFullYear();

      const result = await pool.query(
        `UPDATE employee_leave_balances elb
         SET accrued_amount = FLOOR((GREATEST(0, LEAST(12,
              ((DATE_PART('year', AGE(CURRENT_DATE, GREATEST(e.start_date, MAKE_DATE($1, 1, 1)))) * 12)
               + DATE_PART('month', AGE(CURRENT_DATE, GREATEST(e.start_date, MAKE_DATE($1, 1, 1))))
               + 1))) * 0.5) * 2) / 2,
             entitled_days = FLOOR((GREATEST(0, LEAST(12,
              ((DATE_PART('year', AGE(CURRENT_DATE, GREATEST(e.start_date, MAKE_DATE($1, 1, 1)))) * 12)
               + DATE_PART('month', AGE(CURRENT_DATE, GREATEST(e.start_date, MAKE_DATE($1, 1, 1))))
               + 1))) * 0.5) * 2) / 2,
             remaining_days = GREATEST(0,
                (FLOOR((GREATEST(0, LEAST(12,
                  ((DATE_PART('year', AGE(CURRENT_DATE, GREATEST(e.start_date, MAKE_DATE($1, 1, 1)))) * 12)
                   + DATE_PART('month', AGE(CURRENT_DATE, GREATEST(e.start_date, MAKE_DATE($1, 1, 1))))
                   + 1))) * 0.5) * 2) / 2) - COALESCE(elb.used_days, 0)
             ),
             updated_at = CURRENT_TIMESTAMP
         FROM employees e
         WHERE elb.employee_id = e.id
           AND elb.year = $1
           AND elb.leave_type IN ('vacation', 'annual')
           AND e.start_date IS NOT NULL
           AND EXTRACT(DAY FROM (CURRENT_DATE - e.start_date))::INT < 365`,
        [currentYear]
      );

      console.log(`✅ [Cron Job] Monthly accrual update completed. Updated ${result.rowCount} records`);
    } catch (error) {
      console.error('❌ [Cron Job] Error in monthly accrual update:', error);
    }
  });

  return task;
};

/**
 * Task 1.2: Jan 1 no-carry-over reset for first-year vacation accrual
 * Runs at 00:10 on Jan 1st
 * Cron expression: 10 0 1 1 *
 */
export const scheduleNoCarryOverReset = () => {
  const task = cron.schedule('10 0 1 1 *', async () => {
    console.log('♻️ [Cron Job] Starting Jan 1 no-carry-over reset...');
    try {
      const currentYear = new Date().getFullYear();

      await pool.query(
        `UPDATE employee_leave_balances
         SET carried_over_days = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE year = $1`,
        [currentYear]
      );

      const resetResult = await pool.query(
        `UPDATE employee_leave_balances elb
         SET accrued_amount = 0,
             entitled_days = 0,
             used_days = 0,
             remaining_days = 0,
             updated_at = CURRENT_TIMESTAMP
         FROM employees e
         WHERE elb.employee_id = e.id
           AND elb.year = $1
           AND elb.leave_type IN ('vacation', 'annual')
           AND e.start_date IS NOT NULL
           AND EXTRACT(DAY FROM (CURRENT_DATE - e.start_date))::INT < 365`,
        [currentYear]
      );

      console.log(`✅ [Cron Job] Jan 1 reset completed. Reset ${resetResult.rowCount} first-year vacation balances`);
    } catch (error) {
      console.error('❌ [Cron Job] Error in Jan 1 no-carry-over reset:', error);
    }
  });

  return task;
};

/**
 * Task 2: Check employee probation status and update in background
 * Runs daily at 01:00 (1 AM)
 * Cron expression: 0 1 * * *
 */
export const scheduleProbationStatusCheck = () => {
  // Run at 01:00 every day
  const task = cron.schedule('0 1 * * *', async () => {
    console.log('🔍 [Cron Job] Checking employee probation status...');
    try {
      // Find employees approaching end of probation (5 days before)
      const result = await pool.query(
        `SELECT id, first_name, last_name, email, start_date,
                EXTRACT(DAY FROM (CURRENT_DATE - start_date))::INT as days_worked,
                (start_date + INTERVAL '119 days')::DATE as probation_end_date
         FROM employees
         WHERE status IN ('active', 'on_probation')
           AND start_date IS NOT NULL
           AND EXTRACT(DAY FROM (CURRENT_DATE - start_date))::INT >= 114
           AND EXTRACT(DAY FROM (CURRENT_DATE - start_date))::INT <= 119`,
      );

      if (result.rows.length > 0) {
        console.log(`📌 Found ${result.rows.length} employees approaching/at end of probation`);
        // Could trigger notification here
      }

      // Update employees who have completed probation
      const updatedCount = await pool.query(
        `UPDATE employees
         SET status = 'active'
         WHERE status = 'on_probation'
           AND EXTRACT(DAY FROM (CURRENT_DATE - start_date))::INT >= 119
           AND probation_end_date <= CURRENT_DATE`,
      );

      console.log(`✅ [Cron Job] Probation check completed. Updated ${updatedCount.rowCount} employees to active status`);
    } catch (error) {
      console.error('❌ [Cron Job] Error in probation status check:', error);
    }
  });

  return task;
};

/**
 * Task 3: Send leave balance reminders
 * Runs weekly on Friday at 09:00 (9 AM)
 * Cron expression: 0 9 * * 5
 */
export const scheduleLeaveBalanceReminder = () => {
  // Run at 09:00 on Friday
  const task = cron.schedule('0 9 * * 5', async () => {
    console.log('📬 [Cron Job] Starting leave balance reminders...');
    try {
      const currentYear = new Date().getFullYear();

      // Find employees with low leave balance
      const result = await pool.query(
        `SELECT e.id, e.first_name, e.email, e.employee_type,
                elb.leave_type, elb.remaining_days, elb.entitled_days
         FROM employees e
         LEFT JOIN employee_leave_balances elb ON e.id = elb.employee_id
         WHERE elb.year = $1
           AND e.status IN ('active', 'on_leave')
           AND elb.leave_type = 'annual'
           AND elb.remaining_days <= 2
         ORDER BY elb.remaining_days ASC`,
        [currentYear]
      );

      console.log(`📌 Found ${result.rows.length} employees with low leave balance`);
      // Could send email notifications here

      return result.rows;
    } catch (error) {
      console.error('❌ [Cron Job] Error in leave balance reminder:', error);
    }
  });

  return task;
};

/**
 * Task 4: Archive old leave calculation logs
 * Runs monthly on the 1st at 03:00 (3 AM)
 * Cron expression: 0 3 1 * *
 */
export const scheduleCalculationLogArchival = () => {
  // Run at 03:00 on the 1st of each month
  const task = cron.schedule('0 3 1 * *', async () => {
    console.log('📦 [Cron Job] Archiving old calculation logs...');
    try {
      // Archive logs older than 12 months (for storage optimization)
      const archiveDate = new Date();
      archiveDate.setFullYear(archiveDate.getFullYear() - 1);

      const result = await pool.query(
        `DELETE FROM leave_calculation_log
         WHERE created_at < $1
           AND calculation_type NOT IN ('new_hire_prorate')`,
        [archiveDate]
      );

      console.log(`✅ [Cron Job] Archived ${result.rowCount} old calculation logs`);
    } catch (error) {
      console.error('❌ [Cron Job] Error in calculation log archival:', error);
    }
  });

  return task;
};

/**
 * Initialize all cron jobs
 * Call this function on application startup
 */
export const initializeLeaveCronJobs = () => {
  console.log('🚀 Initializing leave management cron jobs...');

  const tasks = {
    yearlyQuotaUpdate: scheduleYearlyLeaveQuotaUpdate(),
    monthlyAccrualUpdate: scheduleMonthlyAccrualUpdate(),
    noCarryOverReset: scheduleNoCarryOverReset(),
    probationStatusCheck: scheduleProbationStatusCheck(),
    leaveBalanceReminder: scheduleLeaveBalanceReminder(),
    calculationLogArchival: scheduleCalculationLogArchival()
  };

  console.log('✅ All leave management cron jobs initialized');
  return tasks;
};

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export const stopLeaveCronJobs = (tasks) => {
  if (tasks) {
    Object.values(tasks).forEach(task => {
      if (task && typeof task.stop === 'function') {
        task.stop();
      }
    });
    console.log('🛑 All leave management cron jobs stopped');
  }
};

export default {
  scheduleYearlyLeaveQuotaUpdate,
  scheduleMonthlyAccrualUpdate,
  scheduleNoCarryOverReset,
  scheduleProbationStatusCheck,
  scheduleLeaveBalanceReminder,
  scheduleCalculationLogArchival,
  initializeLeaveCronJobs,
  stopLeaveCronJobs
};
