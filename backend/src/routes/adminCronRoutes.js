import express from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { scheduleYearlyLeaveQuotaUpdate, scheduleProbationStatusCheck } from '../jobs/leaveCronJobs.js';
import LeaveCalculationService from '../services/LeaveCalculationService.js';
import { getPool } from '../config/db-pool.js';

const router = express.Router();
const pool = getPool();

/**
 * @route POST /api/admin/cron/yearly-leave-update
 * @description Manually trigger yearly leave balance update (normally runs on Jan 1)
 * @body targetYear - Year to update for (optional, default: current year)
 * @access Admin/CEO only - for emergency/manual updates
 */
router.post('/yearly-leave-update', authenticate, authorize(['admin', 'ceo']), async (req, res, next) => {
  try {
    const { targetYear } = req.body;
    const year = targetYear || new Date().getFullYear();

    console.log(`🔄 [Admin] Manually triggering yearly leave update for ${year}`);

    const result = await LeaveCalculationService.updateAllEmployeeLeaveBalancesForYear(year);

    res.json({
      success: true,
      message: `Completed yearly leave balance update for ${year}`,
      stats: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/admin/cron/probation-check
 * @description Manually trigger probation status check
 * @access Admin/CEO only
 */
router.post('/probation-check', authenticate, authorize(['admin', 'ceo']), async (req, res, next) => {
  try {
    console.log('🔍 [Admin] Manually triggering probation status check');

    const result = await scheduleProbationStatusCheck();

    res.json({
      success: true,
      message: 'Probation status check completed',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/admin/cron/reset-employee-year
 * @description Reset a specific employee's leave balance for end of year
 * Removes unused leave days (no carry over policy)
 * @body employeeId - Employee UUID
 * @body year - Year to reset
 * @access Admin/HR only
 */
router.post('/reset-employee-year', authenticate, authorize(['admin', 'hr', 'ceo']), async (req, res, next) => {
  try {
    const { employeeId, year } = req.body;

    if (!employeeId || !year) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: employeeId, year'
      });
    }

    // Reset all leave type balances for this employee in the specified year
    await pool.query(
      `UPDATE employee_leave_balances
       SET remaining_days = 0,
           used_days = entitled_days,
           updated_at = CURRENT_TIMESTAMP,
           notes = 'Reset on ' || CURRENT_DATE || ' - No carry over policy'
       WHERE employee_id = $1 AND year = $2`,
      [employeeId, year]
    );

    res.json({
      success: true,
      message: `Reset leave balances for employee in year ${year}`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/admin/cron/leave-stats/:year
 * @description Get statistics on leave utilization for a year
 * @param year - Year to get stats for
 * @access Admin/HR only
 */
router.get('/leave-stats/:year', authenticate, authorize(['admin', 'hr', 'ceo']), async (req, res, next) => {
  try {
    const { year } = req.params;

    const stats = await pool.query(
      `SELECT 
        COUNT(DISTINCT employee_id) as total_employees,
        leave_type,
        ROUND(AVG(entitled_days)::NUMERIC, 2) as avg_entitled_days,
        ROUND(AVG(used_days)::NUMERIC, 2) as avg_used_days,
        ROUND(AVG(remaining_days)::NUMERIC, 2) as avg_remaining_days,
        ROUND((SUM(used_days) / NULLIF(SUM(entitled_days), 0) * 100)::NUMERIC, 2) as utilization_percent
       FROM employee_leave_balances
       WHERE year = $1
       GROUP BY leave_type
       ORDER BY leave_type`,
      [parseInt(year)]
    );

    res.json({
      success: true,
      year: parseInt(year),
      data: stats.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/admin/cron/employees-in-probation
 * @description Get list of employees currently in probation
 * @query limit - Limit results (default: 50)
 * @query offset - Offset for pagination (default: 0)
 * @access Admin/HR only
 */
router.get('/employees-in-probation', authenticate, authorize(['admin', 'hr', 'ceo']), async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT 
        id, 
        employee_code,
        CONCAT(first_name, ' ', last_name) as name,
        email,
        employee_type,
        start_date,
        (start_date + INTERVAL '119 days')::DATE as probation_end_date,
        EXTRACT(DAY FROM (CURRENT_DATE - start_date))::INT as days_worked,
        (119 - EXTRACT(DAY FROM (CURRENT_DATE - start_date))::INT) as days_remaining
       FROM employees
       WHERE EXTRACT(DAY FROM (CURRENT_DATE - start_date))::INT < 119
       ORDER BY start_date
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM employees
       WHERE EXTRACT(DAY FROM (CURRENT_DATE - start_date))::INT < 119`
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/admin/cron/upcoming-anniversaries
 * @description Get list of employees with upcoming work anniversaries (within next 30 days)
 * These are employees who may see their leave quota increase
 * @access Admin/HR only
 */
router.get('/upcoming-anniversaries', authenticate, authorize(['admin', 'hr', 'ceo']), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        employee_code,
        CONCAT(first_name, ' ', last_name) as name,
        email,
        employee_type,
        start_date,
        FLOOR(EXTRACT(DAY FROM (CURRENT_DATE - start_date)) / 365.25)::INT as current_years,
        FLOOR(EXTRACT(DAY FROM (CURRENT_DATE + INTERVAL '30 days' - start_date)) / 365.25)::INT as years_after_30_days,
        (DATE_TRUNC('year', start_date) + 
         (start_date - DATE_TRUNC('year', start_date))::INTERVAL)::DATE as anniversary_in_current_year
       FROM employees
       WHERE status IN ('active', 'on_leave', 'on_probation')
         AND start_date IS NOT NULL
         AND EXTRACT(DOY FROM start_date) BETWEEN EXTRACT(DOY FROM CURRENT_DATE) 
                                                     AND EXTRACT(DOY FROM CURRENT_DATE + INTERVAL '30 days')
       ORDER BY start_date`,
    );

    res.json({
      success: true,
      message: `Found ${result.rows.length} employees with upcoming anniversaries in next 30 days`,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

export default router;
