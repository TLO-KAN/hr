import express from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { getPool } from '../config/db-pool.js';

const router = express.Router();
const pool = getPool();

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// Get leave balance for current authenticated employee
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const { year } = req.query;
    const currentYear = year
      ? parsePositiveInt(year, Number.NaN)
      : new Date().getFullYear();

    if (!Number.isFinite(currentYear) || currentYear < 2000 || currentYear > 3000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter'
      });
    }

    const employeeResult = await pool.query(
      'SELECT id FROM employees WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    const employeeId = employeeResult.rows[0].id;

    const result = await pool.query(
      `SELECT elb.*, 
              COALESCE(elb.entitled_days, elb.balance_days, 0) as prorated_quota,
              COALESCE(elb.total_entitlement, elb.entitled_days, elb.balance_days, 0) as base_quota,
              COALESCE(elb.entitled_days, elb.balance_days, 0) as entitled_days,
              COALESCE(elb.used_days, 0) as used_days,
              COALESCE(elb.remaining_days, elb.balance_days, 0) as remaining_days,
              COALESCE(elb.accrued_amount, COALESCE(elb.entitled_days, elb.balance_days, 0)) as accrued_amount,
              COALESCE(elb.total_entitlement, COALESCE(elb.entitled_days, elb.balance_days, 0)) as total_entitlement,
              CASE WHEN e.start_date IS NOT NULL AND (CURRENT_DATE - e.start_date) < 365 THEN true ELSE false END as is_first_year,
              0.5 as next_unlock_days
       FROM employee_leave_balances elb
       LEFT JOIN employees e ON elb.employee_id = e.id
       WHERE elb.employee_id = $1 AND elb.year = $2
       ORDER BY elb.leave_type`,
      [employeeId, currentYear]
    );

    res.json({
      success: true,
      year: currentYear,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get leave balance for employee
router.get('/employee/:employeeId', authenticate, async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { year } = req.query;
    const currentYear = year
      ? parsePositiveInt(year, Number.NaN)
      : new Date().getFullYear();

    if (!Number.isFinite(currentYear) || currentYear < 2000 || currentYear > 3000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter'
      });
    }

    const result = await pool.query(
      `SELECT * FROM employee_leave_balances 
       WHERE employee_id = $1 AND year = $2
       ORDER BY leave_type`,
      [employeeId, currentYear]
    );

    res.json({
      success: true,
      year: currentYear,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Create leave entitlements for new employee
router.post('/', authenticate, authorize(['admin', 'ceo', 'hr']), async (req, res, next) => {
  try {
    const { employee_id, annual_leave_quota, sick_leave_quota, personal_leave_quota, year } = req.body;
    const currentYear = year || new Date().getFullYear();

    if (!employee_id || !annual_leave_quota) {
      return res.status(400).json({
        success: false,
        error: 'employee_id และ annual_leave_quota เป็นสิ่งจำเป็น'
      });
    }

    const result = await pool.query(
      `INSERT INTO employee_leave_balances 
       (employee_id, year, annual_leave_quota, sick_leave_quota, personal_leave_quota)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [employee_id, currentYear, annual_leave_quota, sick_leave_quota || 30, personal_leave_quota || 6]
    );

    res.status(201).json({
      success: true,
      message: 'สร้างสิทธิการลาสำเร็จ',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Get all leave balances with pagination
router.get('/', authenticate, authorize(['admin', 'ceo', 'hr']), async (req, res, next) => {
  try {
    const { year, limit = 100, offset = 0 } = req.query;
    const currentYear = year
      ? parsePositiveInt(year, Number.NaN)
      : new Date().getFullYear();
    const parsedLimit = parsePositiveInt(limit, 100);
    const parsedOffset = parsePositiveInt(offset, 0);

    if (!Number.isFinite(currentYear) || currentYear < 2000 || currentYear > 3000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter'
      });
    }

    const result = await pool.query(
      `SELECT elb.*, 
              COALESCE(e.email, e.id::text) as employee_code,
              e.first_name,
              e.last_name,
              e.employee_type,
              COALESCE(DATE_PART('year', AGE(CURRENT_DATE, COALESCE(e.employment_date, e.start_date))), 0) as years_of_service,
              COALESCE(DATE_PART('month', AGE(CURRENT_DATE, GREATEST(COALESCE(e.start_date, e.employment_date), MAKE_DATE($1, 1, 1)))) + 1, 0) as months_worked,
              CASE WHEN COALESCE(e.start_date, e.employment_date) IS NOT NULL AND (CURRENT_DATE - COALESCE(e.start_date, e.employment_date)) < 365 THEN true ELSE false END as is_first_year,
              CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) as employee_name,
              d.name as department_name,
              COALESCE(p.name, e.position) as position_name,
              COALESCE(elb.entitled_days, elb.balance_days, 0) as entitled_days,
              COALESCE(elb.used_days, 0) as used_days,
              COALESCE(elb.remaining_days, elb.balance_days, 0) as remaining_days,
              COALESCE(elb.accrued_amount, COALESCE(elb.entitled_days, elb.balance_days, 0)) as accrued_amount,
              COALESCE(elb.total_entitlement, COALESCE(elb.entitled_days, elb.balance_days, 0)) as total_entitlement,
              COALESCE(lt.name, INITCAP(elb.leave_type)) as leave_type_name,
              0.5 as next_unlock_days
       FROM employee_leave_balances elb
       LEFT JOIN employees e ON elb.employee_id = e.id
       LEFT JOIN departments d ON d.name = e.department
       LEFT JOIN leave_types lt ON lt.code = elb.leave_type
       LEFT JOIN positions p ON p.id = e.position_id
       WHERE elb.year = $1
       ORDER BY e.first_name, e.last_name, elb.leave_type
       LIMIT $2 OFFSET $3`,
                [currentYear, parsedLimit, parsedOffset]
    );

    res.json({
      success: true,
      year: currentYear,
      data: result.rows,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update leave balance (Admin/HR only)
router.put('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { entitled_days, used_days, remaining_days } = req.body;

      const result = await pool.query(
        `UPDATE employee_leave_balances 
         SET entitled_days = COALESCE($1, entitled_days),
             used_days = COALESCE($2, used_days),
             remaining_days = COALESCE($3, remaining_days),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [entitled_days, used_days, remaining_days, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Leave balance not found'
        });
      }

      res.json({
        success: true,
        message: 'อัพเดตวันลาสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;