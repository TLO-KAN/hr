/**
 * Leave Service
 * 
 * Handles:
 * - Leave request creation and validation
 * - Leave balance calculation (pro-rate: 6 days/year, round 0.5)
 * - 119-day probation entitlement check
 * - 3-day advance notice validation
 */

import { query } from '../config/db.js';

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface LeaveBalance {
  total_entitled: number;
  used_this_year: number;
  remaining: number;
  annual_allowance: number;
  service_days: number;
  accrued_amount: number;
  total_entitlement: number;
  months_worked: number;
  is_first_year: boolean;
  next_month_unlock: number;
}

export class LeaveService {
  private floorToHalfDay(value: number): number {
    return Math.floor(value * 2) / 2;
  }

  private getMonthsWorkedWithinYear(employmentDate: Date, referenceDate: Date): number {
    const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);
    const accrualStart = employmentDate > startOfYear ? employmentDate : startOfYear;
    const months = (referenceDate.getFullYear() - accrualStart.getFullYear()) * 12 + (referenceDate.getMonth() - accrualStart.getMonth()) + 1;
    return Math.max(0, Math.min(12, months));
  }

  private async getVacationPolicyQuota(employeeType: string, yearsOfService: number): Promise<number> {
    const policyResult = await query(
      `SELECT annual_leave_quota
       FROM leave_policies
       WHERE employee_type = $1
         AND tenure_year_from <= $2
         AND (tenure_year_to IS NULL OR tenure_year_to >= $2)
         AND active = true
       ORDER BY tenure_year_from DESC
       LIMIT 1`,
      [employeeType, yearsOfService]
    );

    if (policyResult.rows.length > 0) {
      return Number(policyResult.rows[0].annual_leave_quota) || 6;
    }

    return 6;
  }

  private async calculateHybridVacationEntitlement(employee: any, referenceDate: Date): Promise<{ totalEntitled: number; annualAllowance: number; accruedAmount: number; totalEntitlement: number; monthsWorked: number; isFirstYear: boolean; nextMonthUnlock: number }> {
    const employmentDate = new Date(employee.employment_date || employee.start_date);
    const serviceDays = Math.floor((referenceDate.getTime() - employmentDate.getTime()) / (1000 * 60 * 60 * 24));
    const yearsOfService = Math.floor(serviceDays / 365.25);
    const isFirstYear = yearsOfService < 1;

    if (isFirstYear) {
      const monthsWorked = this.getMonthsWorkedWithinYear(employmentDate, referenceDate);
      const accruedAmount = this.floorToHalfDay(monthsWorked * 0.5);
      const totalEntitlement = await this.getVacationPolicyQuota(employee.employee_type || 'permanent', 0);
      return {
        totalEntitled: accruedAmount,
        annualAllowance: totalEntitlement,
        accruedAmount,
        totalEntitlement,
        monthsWorked,
        isFirstYear: true,
        nextMonthUnlock: 0.5,
      };
    }

    const currentYear = referenceDate.getFullYear();
    const anniversaryThisYear = new Date(currentYear, employmentDate.getMonth(), employmentDate.getDate());
    const quotaBefore = await this.getVacationPolicyQuota(employee.employee_type || 'permanent', yearsOfService - 1);
    const quotaAfter = await this.getVacationPolicyQuota(employee.employee_type || 'permanent', yearsOfService);

    let totalEntitlement = quotaAfter;
    if (anniversaryThisYear > new Date(currentYear, 0, 1) && anniversaryThisYear <= referenceDate && quotaAfter !== quotaBefore) {
      const monthsBefore = anniversaryThisYear.getMonth();
      const monthsAfter = 12 - monthsBefore;
      totalEntitlement = this.floorToHalfDay((quotaBefore / 12) * monthsBefore + (quotaAfter / 12) * monthsAfter);
    }

    return {
      totalEntitled: totalEntitlement,
      annualAllowance: quotaAfter,
      accruedAmount: totalEntitlement,
      totalEntitlement,
      monthsWorked: 12,
      isFirstYear: false,
      nextMonthUnlock: 0,
    };
  }

  /**
   * Calculate total entitled leave days for an employee
   * 
   * Rules:
   * - Confirmed employees: 15 days/year (or contract-defined)
   * - Probation period: Must work 119 days before eligible (0 vacation days during probation)
   * - Pro-rate calculation: 6 additional days per year (rounded to nearest 0.5)
   * - Pending leaves are reserved (not yet deducted) in remaining calculation
   */
  async calculateLeaveEntitlement(employeeId: string): Promise<LeaveBalance> {
    try {
      // Get employee details
      const empResult = await query(
        `SELECT id, employment_date, start_date, employment_status, annual_leave_days, employee_type
         FROM employees WHERE id = $1`,
        [employeeId]
      );

      if (empResult.rows.length === 0) {
        throw new Error('Employee not found');
      }

      const employee = empResult.rows[0];
      const today = new Date();
      const employmentDate = new Date(employee.employment_date || employee.start_date);
      const serviceDays = Math.floor((today.getTime() - employmentDate.getTime()) / (1000 * 60 * 60 * 24));

      const hybrid = await this.calculateHybridVacationEntitlement(employee, today);
      const baseEntitlement = hybrid.annualAllowance;
      const totalEntitled = hybrid.totalEntitled;

      // Calculate used days this year (approved + pending reserved)
      const currentYear = today.getFullYear();
      const yearStart = new Date(`${currentYear}-01-01`);
      
      const usedResult = await query(
        `SELECT 
          COALESCE(SUM(CASE WHEN status = 'approved' THEN (end_date::DATE - start_date::DATE) 
                            WHEN status = 'pending' THEN (end_date::DATE - start_date::DATE)
                            ELSE 0 END), 0) as days_used
         FROM leave_requests 
         WHERE employee_id = $1 
         AND status IN ('approved', 'pending')
         AND start_date >= $2`,
        [employeeId, yearStart.toISOString()]
      );

      const daysUsed = parseFloat(usedResult.rows[0].days_used) || 0;
      const remaining = Math.max(0, totalEntitled - daysUsed);

      // Keep balance table in sync for hybrid fields (vacation row in current year)
      await query(
        `UPDATE employee_leave_balances
         SET accrued_amount = $1,
             total_entitlement = $2,
             entitled_days = $3,
             remaining_days = GREATEST(0, $3 - COALESCE(used_days, 0)),
             updated_at = NOW()
         WHERE employee_id = $4
           AND year = $5
           AND leave_type IN ('vacation', 'annual')`,
        [hybrid.accruedAmount, hybrid.totalEntitlement, totalEntitled, employeeId, currentYear]
      );

      return {
        total_entitled: totalEntitled,
        used_this_year: daysUsed,
        remaining,
        annual_allowance: baseEntitlement,
        service_days: serviceDays,
        accrued_amount: hybrid.accruedAmount,
        total_entitlement: hybrid.totalEntitlement,
        months_worked: hybrid.monthsWorked,
        is_first_year: hybrid.isFirstYear,
        next_month_unlock: hybrid.nextMonthUnlock,
      };
    } catch (error) {
      console.error('Leave entitlement calculation error:', error);
      throw error;
    }
  }

  // Backward-compatible alias for callers using the old method name.
  async calculateLeaveBalance(employeeId: string): Promise<LeaveBalance> {
    return this.calculateLeaveEntitlement(employeeId);
  }

  /**
   * Validate leave request
   * 
   * Rules:
   * 1. Employee must have remaining leave balance
   * 2. For probation employees: Must wait 119 days from employment date
   * 3. Leave must be requested at least 3 days in advance
   * 4. Leave dates must be valid (no past dates except approved)
   */
  async validateLeaveRequest(
    employeeId: string,
    leaveType: string,
    startDate: string,
    endDate: string
  ): Promise<{ valid: boolean; message?: string }> {
    try {
      // Validate date format and logic
      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if start date is valid
      if (start < today) {
        return { valid: false, message: 'Leave start date cannot be in the past' };
      }

      // Check if end date is after start date
      if (end < start) {
        return { valid: false, message: 'Leave end date must be after start date' };
      }

      // Check 3-day advance notice rule
      const daysUntilLeave = Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilLeave < 3) {
        return { valid: false, message: 'Leave must be requested at least 3 days in advance' };
      }

      // Get employee details
      const empResult = await query(
        `SELECT employment_date, start_date, employment_status, employee_type
         FROM employees WHERE id = $1`,
        [employeeId]
      );

      if (empResult.rows.length === 0) {
        return { valid: false, message: 'Employee not found' };
      }

      const employee = empResult.rows[0];
      const employmentDate = new Date(employee.employment_date || employee.start_date);
      const serviceDays = Math.floor((today.getTime() - employmentDate.getTime()) / (1000 * 60 * 60 * 24));
      const isVacationType = ['vacation', 'annual', 'พักร้อน'].includes((leaveType || '').toLowerCase());

      // Probation lock applies to vacation only
      if (isVacationType && serviceDays < 119) {
        return { 
          valid: false, 
          message: `กรุณารอให้ครบ 119 วันทำงาน (อีก ${119 - serviceDays} วัน) ถึงจะสามารถลาพักร้อนได้` 
        };
      }

      // Check leave balance and first-year accrual lock for vacation
      const requestedDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

      if (isVacationType) {
        const balance = await this.calculateLeaveEntitlement(employeeId);
        const accrualAtLeaveDate = await this.calculateHybridVacationEntitlement(employee, start);
        const availableAtLeaveDate = Math.min(balance.remaining, accrualAtLeaveDate.accruedAmount);

        if (accrualAtLeaveDate.isFirstYear && requestedDays > availableAtLeaveDate) {
          return {
            valid: false,
            message: `ปีแรกใช้ได้เฉพาะยอดสะสม ณ วันที่ลา (${availableAtLeaveDate.toFixed(1)} วัน) แต่ขอ ${requestedDays} วัน`
          };
        }

        if (requestedDays > balance.remaining) {
          return { valid: false, message: `Insufficient leave balance (Remaining: ${balance.remaining} days)` };
        }
      } else {
        const currentYear = today.getFullYear();
        const balanceResult = await query(
          `SELECT remaining_days
           FROM employee_leave_balances
           WHERE employee_id = $1
             AND year = $2
             AND leave_type = $3`,
          [employeeId, currentYear, leaveType]
        );

        const remainingDays = balanceResult.rows.length > 0 ? Number(balanceResult.rows[0].remaining_days) : 0;
        if (requestedDays > remainingDays) {
          return { valid: false, message: `วันลาไม่เพียงพอ (คงเหลือ ${remainingDays} วัน)` };
        }
      }

      return { valid: true };
    } catch (error) {
      console.error('Leave validation error:', error);
      return { valid: false, message: 'Error validating leave request' };
    }
  }

  /**
   * Create leave request
   */
  async createLeaveRequest(
    employeeId: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    reason: string
  ): Promise<LeaveRequest> {
    try {
      const normalizedLeaveType = (leaveType || '').toLowerCase();
      const validationResult = await this.validateLeaveRequest(employeeId, normalizedLeaveType, startDate, endDate);
      if (!validationResult.valid) {
        throw new Error(validationResult.message || 'Invalid leave request');
      }

      // Create leave request
      const result = await query(
        `INSERT INTO leave_requests 
         (employee_id, leave_type, start_date, end_date, reason, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, employee_id, leave_type, start_date, end_date, reason, status, created_at`,
        [employeeId, normalizedLeaveType, startDate, endDate, reason, 'pending']
      );

      return result.rows[0];
    } catch (error) {
      console.error('Leave request creation error:', error);
      throw error;
    }
  }

  /**
   * Approve leave request
   */
  async approveLeaveRequest(leaveRequestId: string): Promise<LeaveRequest> {
    try {
      const result = await query(
        `UPDATE leave_requests 
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, employee_id, leave_type, start_date, end_date, reason, status, created_at`,
        ['approved', leaveRequestId]
      );

      if (result.rows.length === 0) {
        throw new Error('Leave request not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Leave approval error:', error);
      throw error;
    }
  }

  /**
   * Reject leave request
   */
  async rejectLeaveRequest(leaveRequestId: string, reason?: string): Promise<LeaveRequest> {
    try {
      const result = await query(
        `UPDATE leave_requests 
         SET status = $1, rejection_reason = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, employee_id, leave_type, start_date, end_date, reason, status, created_at`,
        ['rejected', reason || null, leaveRequestId]
      );

      if (result.rows.length === 0) {
        throw new Error('Leave request not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Leave rejection error:', error);
      throw error;
    }
  }
}

export default new LeaveService();
