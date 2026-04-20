import { getPool } from '../config/db-pool.js';

const pool = getPool();

/**
 * LeaveCalculationService
 * Handles all calculations related to leave entitlements
 * Including: pro-rate, annual increment, probation checks
 */
class LeaveCalculationService {
  /**
   * Calculate years of service from hire date to reference date
   * @param {Date|string} hireDate - Employee's hire date
   * @param {Date|string} referenceDate - Reference date (default: today)
   * @returns {number} Years of service (rounded down)
   */
  static calculateYearsOfService(hireDate, referenceDate = new Date()) {
    const hire = new Date(hireDate);
    const ref = new Date(referenceDate);
    const diffTime = ref - hire;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 365.25);
  }

  /**
   * Check if employee is still in probation period (119 days)
   * @param {string} employeeId - Employee UUID
   * @param {Date|string} referenceDate - Reference date (default: today)
   * @returns {Promise<boolean>}
   */
  static async isEmployeeInProbation(employeeId, referenceDate = new Date()) {
    try {
      const result = await pool.query(
        `SELECT EXTRACT(DAY FROM ($1::DATE - start_date))::INT as days_worked
         FROM employees WHERE id = $2`,
        [referenceDate, employeeId]
      );

      if (result.rows.length === 0) {
        throw new Error('Employee not found');
      }

      const daysWorked = result.rows[0].days_worked || 0;
      return daysWorked < 119;
    } catch (error) {
      console.error('Error checking probation status:', error);
      throw error;
    }
  }

  /**
   * Get applicable leave policy for an employee based on tenure
   * Implements step-up policy: Year 1=6 days, Year 2=7 days, ... Year 10=15 days, Year 11+=15 days
   * @param {string} employeeType - Employee type (permanent, contract, parttime)
   * @param {number} yearsOfService - Years of service
   * @returns {Promise<Object>} Leave policy record
   */
  static async getApplicableLeavePolicy(employeeType, yearsOfService) {
    try {
      const hasIsActiveColumnResult = await pool.query(
        `SELECT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_name = 'leave_policies' AND column_name = 'is_active'
         ) AS has_is_active`
      );

      const hasIsActiveColumn = hasIsActiveColumnResult.rows[0]?.has_is_active === true;
      const activeFilter = hasIsActiveColumn ? 'AND is_active = true' : '';

      const result = await pool.query(
        `SELECT * FROM leave_policies
         WHERE employee_type = $1
           AND tenure_year_from <= $2
           AND (tenure_year_to IS NULL OR tenure_year_to >= $2)
           ${activeFilter}
         ORDER BY tenure_year_from DESC
         LIMIT 1`,
        [employeeType, yearsOfService]
      );

      if (result.rows.length === 0) {
        // Return default policy if no match found
        return {
          annual_leave_quota: 6,
          sick_leave_quota: 10,
          personal_leave_quota: 5,
          maternity_leave_quota: 90,
          paternity_leave_quota: 7
        };
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting leave policy:', error);
      throw error;
    }
  }

  /**
   * Calculate pro-rated leave for a new hire in current year
   * Uses monthly average: (Days_OldRate / 12 * Months_Before) + (Days_NewRate / 12 * Months_After)
   * Rounds down to 0.5 day increments
   * @param {Object} params
   *   - startDate: Employee start date
   *   - employeeType: Employee type
   *   - calendarYear: Year to calculate for
   *   - referenceDate: Reference date for calculations
   * @returns {Promise<Object>} { entitledDays, proRatePercent, calculationDetails }
   */
  static async calculateProratedLeave(params) {
    const { startDate, employeeType, calendarYear } = params;

    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      throw new Error('Invalid startDate for prorated leave calculation');
    }

    const yearsOfServiceAtYearEnd = this.calculateYearsOfService(startDate, new Date(calendarYear, 11, 31));
    const policy = await this.getApplicableLeavePolicy(employeeType, yearsOfServiceAtYearEnd);
    const annualQuota = Number(policy?.annual_leave_quota ?? 6);

    const monthsWorked = start.getFullYear() === calendarYear ? 12 - start.getMonth() : 12;
    const rawProrated = (annualQuota * monthsWorked) / 12;
    const entitledDays = Math.floor(rawProrated * 2) / 2;
    const proRatePercent = Number(((monthsWorked / 12) * 100).toFixed(2));

    return {
      entitledDays,
      proRatePercent,
      calculationDetails: `prorated:${monthsWorked}/12 from annual ${annualQuota}`,
    };
  }

  /**
   * Calculate leave entitlement for a specific employee for a specific year
   * Considers:
   * 1. Probation restrictions (can't request until 119 days)
   * 2. Step-up policy based on tenure
   * 3. Pro-rate for first year or when anniversary occurs during the year
   * @param {string} employeeId - Employee UUID
   * @param {number} year - Target year for calculation
   * @returns {Promise<Object>} Leave balances with details
   */
  static async calculateEmployeeLeaveEntitlements(employeeId, year) {
    try {
      // Get employee info
      const empResult = await pool.query(
        `SELECT id, employee_type, start_date, status
         FROM employees
         WHERE id = $1`,
        [employeeId]
      );

      if (empResult.rows.length === 0) {
        throw new Error('Employee not found');
      }

      const employee = empResult.rows[0];
      const yearsOfService = this.calculateYearsOfService(employee.start_date, new Date(year, 11, 31));

      // Get applicable policy
      const policy = await this.getApplicableLeavePolicy(employee.employee_type, yearsOfService);

      // Calculate pro-rate if first year or anniversary within the year
      let entitledDays = policy.annual_leave_quota;
      let proRatePercent = 100;
      let calculationDetails = null;

      // Check if this is the hire year
      const hireYear = new Date(employee.start_date).getFullYear();
      if (hireYear === year) {
        const prorateResult = await this.calculateProratedLeave({
          startDate: employee.start_date,
          employeeType: employee.employee_type,
          calendarYear: year
        });
        entitledDays = prorateResult.entitledDays;
        proRatePercent = prorateResult.proRatePercent;
        calculationDetails = prorateResult.calculationDetails;
      }

      return {
        entitledDays,
        proRatePercent,
        policy,
        calculationDetails
      };
    } catch (error) {
      console.error('Error calculating employee leave entitlements:', error);
      throw error;
    }
  }

  /**
   * Create leave balance records for a new employee
   * Called when HR adds a new employee
   * @param {string} employeeId - Employee UUID
   * @param {number} startYear - Year to start creating balances
   * @param {number} yearsToCreate - Number of years to pre-create (default: 2)
   * @returns {Promise<Array>} Created balance records
   */
  static async createLeaveBalancesForNewEmployee(employeeId, startYear, yearsToCreate = 2) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const balances = [];

      // Create leave type records
      const leaveTypes = ['annual', 'sick', 'personal', 'maternity', 'paternity'];

      for (let yearOffset = 0; yearOffset < yearsToCreate; yearOffset++) {
        const year = startYear + yearOffset;

        // Calculate entitlements
        const entitlements = await this.calculateEmployeeLeaveEntitlements(employeeId, year);

        // Create balance for each leave type
        for (const leaveType of leaveTypes) {
          let entitledDays = 0;
          const quotaKey = `${leaveType}_leave_quota`;

          if (leaveType === 'annual') {
            entitledDays = entitlements.entitledDays;
          } else if (entitlements.policy[quotaKey]) {
            entitledDays = entitlements.policy[quotaKey];
          }

          const existing = await client.query(
            `SELECT id FROM employee_leave_balances WHERE employee_id = $1 AND leave_type = $2 AND year = $3`,
            [employeeId, leaveType, year]
          );

          let result;
          if (existing.rows.length > 0) {
            result = await client.query(
              `UPDATE employee_leave_balances
               SET entitled_days = $1, remaining_days = $1, pro_rated_percent = $2
               WHERE employee_id = $3 AND leave_type = $4 AND year = $5
               RETURNING *`,
              [entitledDays, entitlements.proRatePercent, employeeId, leaveType, year]
            );
          } else {
            result = await client.query(
              `INSERT INTO employee_leave_balances 
               (employee_id, leave_type, year, entitled_days, used_days, remaining_days, pro_rated_percent)
               VALUES ($1, $2, $3, $4, 0, $4, $5)
               RETURNING *`,
              [employeeId, leaveType, year, entitledDays, entitlements.proRatePercent]
            );
          }

          balances.push(result.rows[0]);
        }
      }

      // Log calculation
      const empResult = await client.query(
        `SELECT start_date FROM employees WHERE id = $1`,
        [employeeId]
      );
      const employee = empResult.rows[0];
      const yearsOfService = this.calculateYearsOfService(employee.start_date);

      await client.query(
        `INSERT INTO leave_calculation_log 
         (employee_id, calculation_type, calculation_date, years_of_service, tenure_year_for_policy, final_entitled_days, calculated_by)
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)`,
        [employeeId, 'new_hire_prorate', yearsOfService, yearsOfService, balances[0].entitled_days, 'system']
      );

      await client.query('COMMIT');
      return balances;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating leave balances for new employee:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update all employee leave balances on Jan 1 (Cron Job)
   * Resets previous year balances, creates new year records
   * @param {number} targetYear - Year to create balances for
   * @returns {Promise<Object>} { totalEmployees, totalCreated, totalFailed }
   */
  static async updateAllEmployeeLeaveBalancesForYear(targetYear) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let totalEmployees = 0;
      let totalCreated = 0;
      let totalFailed = 0;

      // Get all active employees
      const empResult = await client.query(
        `SELECT id FROM employees WHERE status IN ('active', 'on_leave', 'on_probation')`
      );

      totalEmployees = empResult.rows.length;

      const leaveTypes = ['annual', 'sick', 'personal', 'maternity', 'paternity'];

      for (const emp of empResult.rows) {
        try {
          // Calculate entitlements for target year
          const entitlements = await this.calculateEmployeeLeaveEntitlements(emp.id, targetYear);

          // Create/update balance for each leave type
          for (const leaveType of leaveTypes) {
            let entitledDays = 0;
            const quotaKey = `${leaveType}_leave_quota`;

            if (leaveType === 'annual') {
              entitledDays = entitlements.entitledDays;
            } else if (entitlements.policy[quotaKey]) {
              entitledDays = entitlements.policy[quotaKey];
            }

            const updateResult = await client.query(
              `UPDATE employee_leave_balances
               SET entitled_days = $1,
                   remaining_days = $1,
                   pro_rated_percent = $2,
                   used_days = 0,
                   updated_at = NOW()
               WHERE employee_id = $3 AND leave_type = $4 AND year = $5
               RETURNING id`,
              [entitledDays, entitlements.proRatePercent, emp.id, leaveType, targetYear]
            );

            if (updateResult.rowCount === 0) {
              await client.query(
                `INSERT INTO employee_leave_balances
                 (employee_id, leave_type, year, entitled_days, used_days, remaining_days, pro_rated_percent)
                 VALUES ($1, $2, $3, $4, 0, $4, $5)`,
                [emp.id, leaveType, targetYear, entitledDays, entitlements.proRatePercent]
              );
            }
          }

          totalCreated++;
        } catch (err) {
          console.error(`Failed to create balance for employee ${emp.id}:`, err);
          totalFailed++;
        }
      }

      // Log the batch operation
      await client.query(
        `INSERT INTO leave_calculation_log 
         (employee_id, calculation_type, calculation_date, years_of_service, final_entitled_days, calculated_by)
         VALUES (NULL, $1, CURRENT_DATE, 0, 0, $2)`,
        ['yearly_reset', 'system']
      );

      await client.query('COMMIT');
      return { totalEmployees, totalCreated, totalFailed };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating employee leave balances:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Deduct leave from employee's balance
   * Updates remaining_days and used_days
   * @param {string} employeeId - Employee UUID
   * @param {string} leaveType - Leave type code
   * @param {number} year - Year
   * @param {number} deductDays - Days to deduct
   * @returns {Promise<Object>} Updated balance
   */
  static async deductLeaveBalance(employeeId, leaveType, year, deductDays) {
    try {
      const result = await pool.query(
        `UPDATE employee_leave_balances 
         SET used_days = used_days + $1,
             remaining_days = remaining_days - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE employee_id = $2 AND leave_type = $3 AND year = $4
         RETURNING *`,
        [deductDays, employeeId, leaveType, year]
      );

      if (result.rows.length === 0) {
        throw new Error('Leave balance not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error deducting leave balance:', error);
      throw error;
    }
  }

  /**
   * Get leave summary for an employee
   * Shows current year balance and historical data
   * @param {string} employeeId - Employee UUID
   * @param {number} year - Target year (default: current year)
   * @returns {Promise<Object>} Leave summary
   */
  static async getEmployeeLeaveSummary(employeeId, year = new Date().getFullYear()) {
    try {
      // Get employee info
      const empResult = await pool.query(
        `SELECT id, first_name, last_name, employee_type, start_date
         FROM employees
         WHERE id = $1`,
        [employeeId]
      );

      if (empResult.rows.length === 0) {
        throw new Error('Employee not found');
      }

      const employee = empResult.rows[0];
      const yearsOfService = this.calculateYearsOfService(employee.start_date);

      // Get current year balance
      const balanceResult = await pool.query(
        `SELECT * FROM employee_leave_balances
         WHERE employee_id = $1 AND year = $2
         ORDER BY leave_type`,
        [employeeId, year]
      );

      // Get probation status
      const inProbation = await this.isEmployeeInProbation(employeeId);

      return {
        employee: {
          id: employee.id,
          name: `${employee.first_name} ${employee.last_name}`,
          employeeType: employee.employee_type,
          yearsOfService,
          inProbation
        },
        year,
        balances: balanceResult.rows,
        totalEntitledDays: balanceResult.rows
          .filter(b => b.leave_type === 'annual')
          .reduce((sum, b) => sum + b.entitled_days, 0),
        totalUsedDays: balanceResult.rows
          .filter(b => b.leave_type === 'annual')
          .reduce((sum, b) => sum + b.used_days, 0),
        totalRemainingDays: balanceResult.rows
          .filter(b => b.leave_type === 'annual')
          .reduce((sum, b) => sum + b.remaining_days, 0)
      };
    } catch (error) {
      console.error('Error getting leave summary:', error);
      throw error;
    }
  }

  /**
   * Get pro-rate preview for new hire during employee creation
   * Implements Hybrid policy: Accrual (< 1 yr tenure) or Step-up (>= 1 yr tenure)
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} employeeType - Employee type
   * @param {number} year - Calendar year
   * @returns {Promise<Object>} Pro-rate preview data with Hybrid policy details
   */
  static async getProratePreviewForNewHire(startDate, employeeType, year = new Date().getFullYear()) {
    try {
      const startDateObj = new Date(startDate);

      // Calculate probation end date (+119 days)
      const probationEndDate = new Date(startDateObj);
      probationEndDate.setDate(probationEndDate.getDate() + 119);

      // Calculate actual tenure from start date to today
      const today = new Date();
      const tenureYears = this.calculateYearsOfService(startDate, today);
      const tenureMonths = Math.floor(
        (today - startDateObj) / (1000 * 60 * 60 * 24 * 30.4375)
      );

      let policyMode; // 'accrual' | 'stepup'
      let entitledDays;
      let baseQuotaDays;
      let proratePercent;
      let monthlyAccrualRate = 0.5;
      let helperText;
      let calculationDetails;

      if (tenureYears < 1) {
        // --- Option B: Accrual mode (< 1 year tenure) ---
        // Monthly accrual: 0.5 day/month accrued up to reference date
        policyMode = 'accrual';
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        const accrualStart = startDateObj > yearStart ? startDateObj : yearStart;
        const referenceDate = today.getFullYear() === year ? today : yearEnd;

        let monthsAccrued = 0;
        if (referenceDate >= accrualStart) {
          monthsAccrued =
            (referenceDate.getFullYear() - accrualStart.getFullYear()) * 12 +
            (referenceDate.getMonth() - accrualStart.getMonth()) +
            1;
        }
        monthsAccrued = Math.max(0, Math.min(12, monthsAccrued));

        const rawAccrued = monthsAccrued * monthlyAccrualRate;
        entitledDays = Math.floor(rawAccrued * 2) / 2; // round down to 0.5
        baseQuotaDays = entitledDays;
        proratePercent = Math.round((monthsAccrued / 12) * 100);
        calculationDetails = `accrual:${monthsAccrued} months × ${monthlyAccrualRate} day/month`;
        helperText = `พนักงานใหม่: สะสมเดือนละ ${monthlyAccrualRate} วัน (สะสมถึงปัจจุบัน ${entitledDays} วัน)`;
      } else {
        // --- Step-up Policy (>= 1 year tenure) ---
        policyMode = 'stepup';
        const policy = await this.getApplicableLeavePolicy(employeeType, tenureYears);
        baseQuotaDays = Number(policy?.annual_leave_quota ?? 6);
        entitledDays = Math.floor(baseQuotaDays * 2) / 2; // round down to 0.5
        proratePercent = 100;
        calculationDetails = `stepup:year ${tenureYears + 1} = ${entitledDays} days`;
        helperText = `พนักงานเก่าปีที่ ${tenureYears + 1}: สิทธิ์เต็มปี ${entitledDays} วัน`;
      }

      return {
        startDate,
        employeeType,
        year,
        tenureYears,
        tenureMonths,
        policyMode,
        baseQuotaDays,
        monthlyAccrualRate: policyMode === 'accrual' ? monthlyAccrualRate : null,
        proratePercent,
        entitledDays,
        probationEndDate: probationEndDate.toISOString().split('T')[0],
        calculationDetails,
        helperText,
        canRequestLeaveAfter: probationEndDate.toISOString().split('T')[0],
        // Included for UI display
        annual_leave_quota: entitledDays,
        sick_leave_quota: 30,
        personal_leave_quota: 3,
      };
    } catch (error) {
      console.error('Error getting pro-rate preview:', error);
      throw error;
    }
  }

  /**
   * Get leave balance history for auditing
   * @param {string} employeeId - Employee UUID
   * @param {number} year - Target year
   * @returns {Promise<Array>} Historical records
   */
  static async getLeaveBalanceHistory(employeeId, year) {
    try {
      const result = await pool.query(
        `SELECT * FROM leave_balance_history
         WHERE employee_id = $1 AND year = $2
         ORDER BY changed_at DESC`,
        [employeeId, year]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting leave balance history:', error);
      throw error;
    }
  }

  /**
   * Get years of service for an employee
   * @param {string} employeeId - Employee UUID
   * @param {Date|string} referenceDate - Reference date (default: today)
   * @returns {Promise<number>} Years of service
   */
  static async getEmployeeYearsOfService(employeeId, referenceDate = new Date()) {
    try {
      const result = await pool.query(
        `SELECT EXTRACT(DAY FROM ($1::DATE - start_date))::INT as days_worked
         FROM employees WHERE id = $2`,
        [referenceDate, employeeId]
      );

      if (result.rows.length === 0) {
        throw new Error('Employee not found');
      }

      const daysWorked = result.rows[0].days_worked || 0;
      return Math.floor(daysWorked / 365.25);
    } catch (error) {
      console.error('Error getting years of service:', error);
      throw error;
    }
  }

  /**
   * Check if yearly quotas have already been created for a given year
   * Prevents duplicate cron job executions
   * @param {number} year - Target year
   * @returns {Promise<boolean>}
   */
  static async hasYearlyQuotasBeenCreated(year) {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM employee_leave_balances WHERE year = $1 LIMIT 1`,
        [year]
      );

      return result.rows[0].count > 0;
    } catch (error) {
      console.error('Error checking yearly quotas:', error);
      throw error;
    }
  }
}

export default LeaveCalculationService;
