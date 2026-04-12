import express from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import LeaveCalculationService from '../services/LeaveCalculationService.js';

const router = express.Router();

/**
 * @route GET /api/leave-calculation/prorate-preview
 * @description Get pro-rate preview for new hire (real-time calculation during HR form)
 * @query startDate - Start date (YYYY-MM-DD)  
 * @query employeeType - Employee type
 * @query year - Calendar year (optional, default: current year)
 * @access HR/Admin
 */
router.get('/prorate-preview', authenticate, authorize(['hr', 'admin', 'ceo']), async (req, res, next) => {
  try {
    const { startDate, employeeType, year } = req.query;

    if (!startDate || !employeeType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: startDate, employeeType'
      });
    }

    const preview = await LeaveCalculationService.getProratePreviewForNewHire(
      startDate,
      employeeType,
      year ? parseInt(year) : new Date().getFullYear()
    );

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/leave-calculation/employee/:employeeId/summary
 * @description Get leave entitlement summary for an employee
 * @param employeeId - Employee UUID
 * @query year - Target year (optional, default: current year)
 * @access Authenticated user (self or HR/Admin)
 */
router.get('/employee/:employeeId/summary', authenticate, async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { year } = req.query;

    // Check authorization - user can view own summary or HR/Admin can view anyone
    if (
      req.user.id !== employeeId &&
      !['hr', 'admin', 'ceo'].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only view own leave summary'
      });
    }

    const summary = await LeaveCalculationService.getEmployeeLeaveSummary(
      employeeId,
      year ? parseInt(year) : new Date().getFullYear()
    );

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/leave-calculation/employee/:employeeId/history
 * @description Get leave balance change history for an employee
 * @param employeeId - Employee UUID
 * @query year - Target year
 * @access HR/Admin
 */
router.get('/employee/:employeeId/history', authenticate, authorize(['hr', 'admin', 'ceo']), async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: year'
      });
    }

    const history = await LeaveCalculationService.getLeaveBalanceHistory(
      employeeId,
      parseInt(year)
    );

    res.json({
      success: true,
      year: parseInt(year),
      data: history
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/leave-calculation/create-balances
 * @description Create leave balance records for a new employee
 * @body employeeId - Employee UUID
 * @body startYear - Year to start creating balances
 * @body yearsToCreate - Number of years to pre-create (optional, default: 2)
 * @access HR/Admin
 */
router.post('/create-balances', authenticate, authorize(['hr', 'admin', 'ceo']), async (req, res, next) => {
  try {
    const { employeeId, startYear, yearsToCreate = 2 } = req.body;

    if (!employeeId || !startYear) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: employeeId, startYear'
      });
    }

    const balances = await LeaveCalculationService.createLeaveBalancesForNewEmployee(
      employeeId,
      startYear,
      yearsToCreate
    );

    res.status(201).json({
      success: true,
      message: `Created ${balances.length} leave balance records`,
      data: balances
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/leave-calculation/update-yearly-quotas
 * @description Trigger annual leave balance update for all employees (Cron Job)
 * Typically called on January 1st to create quotas for new year
 * @body targetYear - Year to create balances for (optional, default: current year)
 * @access Admin/CEO only
 */
router.post('/update-yearly-quotas', authenticate, authorize(['admin', 'ceo']), async (req, res, next) => {
  try {
    const { targetYear } = req.body;
    const year = targetYear || new Date().getFullYear();

    // Check if quotas already exist for this year to prevent duplication
    const checkResult = await LeaveCalculationService.hasYearlyQuotasBeenCreated(year);
    if (checkResult) {
      return res.status(400).json({
        success: false,
        error: `Leave quotas for ${year} have already been created`
      });
    }

    const result = await LeaveCalculationService.updateAllEmployeeLeaveBalancesForYear(year);

    res.json({
      success: true,
      message: `Updated leave balances for ${year}`,
      stats: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/leave-calculation/years-of-service/:employeeId
 * @description Get calculated years of service for an employee
 * @param employeeId - Employee UUID
 * @access Authenticated user (self or HR/Admin)
 */
router.get('/years-of-service/:employeeId', authenticate, async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    // Check authorization
    if (
      req.user.id !== employeeId &&
      !['hr', 'admin', 'ceo'].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const yearsOfService = await LeaveCalculationService.getEmployeeYearsOfService(employeeId);
    const inProbation = await LeaveCalculationService.isEmployeeInProbation(employeeId);

    res.json({
      success: true,
      data: {
        yearsOfService,
        inProbation
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/leave-calculation/policy/:employeeType/:yearsOfService
 * @description Get applicable leave policy for an employee
 * @param employeeType - Employee type
 * @param yearsOfService - Years of service
 * @access Authenticated user (HR/Admin)
 */
router.get('/policy/:employeeType/:yearsOfService', authenticate, async (req, res, next) => {
  try {
    const { employeeType, yearsOfService } = req.params;

    const policy = await LeaveCalculationService.getApplicableLeavePolicy(
      employeeType,
      parseInt(yearsOfService)
    );

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/leave-calculation/check-eligibility/:employeeId
 * @description Check if employee is eligible to request leave (not in probation)
 * @param employeeId - Employee UUID
 * @access Authenticated user (self or HR/Admin)
 */
router.post('/check-eligibility/:employeeId', authenticate, async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    // Check authorization
    if (
      req.user.id !== employeeId &&
      !['hr', 'admin', 'ceo'].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const inProbation = await LeaveCalculationService.isEmployeeInProbation(employeeId);
    const eligibility = !inProbation;

    res.json({
      success: true,
      data: {
        isEligible: eligibility,
        inProbation,
        message: eligibility
          ? 'Employee is eligible to request leave'
          : 'Employee is still in probation period (119 days)'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
