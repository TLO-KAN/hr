import LeaveRequestRepository from '../repositories/LeaveRequestRepository.js';
import { getPool } from '../config/db-pool.js';
import { sendLeaveRequestEmail } from '../utils/emailService.js';
import LeaveCalculationService from './LeaveCalculationService.js';
import logger from '../utils/logger.js';

const pool = getPool();

class LeaveRequestService {
  normalizeBalanceLeaveType(leaveType) {
    if (leaveType === 'vacation') return 'annual';
    if (leaveType === 'emergency') return 'personal';
    return leaveType;
  }

  isUnlimitedLeaveType(leaveType) {
    return leaveType === 'unpaid';
  }

  async getAllLeaveRequests(filters = {}, limit = 50, offset = 0) {
    return await LeaveRequestRepository.getAll(filters, limit, offset);
  }

  async getLeaveRequestById(leaveRequestId) {
    const leaveRequest = await LeaveRequestRepository.findById(leaveRequestId);
    if (!leaveRequest) {
      const error = new Error('ไม่พบข้อมูลการลาอย่างละเอียด');
      error.statusCode = 404;
      throw error;
    }
    return leaveRequest;
  }

  async getEmployeeLeaveRequests(employeeId, filters = {}, limit = 50, offset = 0) {
    return await LeaveRequestRepository.findByEmployeeId(employeeId, filters, limit, offset);
  }

  async createLeaveRequest(data) {
    const {
      employee_id,
      leave_type,
      start_date,
      end_date,
      reason,
      attachment_url,
      attachments = [],
      is_half_day,
      half_day_period,
      start_time,
      end_time
    } = data;

    // Validate required fields
    if (!employee_id || !leave_type || !start_date || !end_date) {
      const error = new Error('ข้อมูลจำเป็นไม่ครบถ้วน');
      error.statusCode = 400;
      throw error;
    }

    // Validate leave_type exists and is active
    let leaveTypeCheck;
    try {
      leaveTypeCheck = await pool.query(
        'SELECT code, name FROM leave_types WHERE code = $1 AND is_active = true',
        [leave_type]
      );
    } catch (error) {
      // Backward compatibility for schemas without is_active column
      if (error?.code === '42703') {
        leaveTypeCheck = await pool.query(
          'SELECT code, name FROM leave_types WHERE code = $1',
          [leave_type]
        );
      } else {
        throw error;
      }
    }

    const allowedTypes = new Set(['unpaid', 'personal', 'sick', 'vacation', 'emergency']);
    if (leaveTypeCheck.rows.length === 0 && !allowedTypes.has(leave_type)) {
      const error = new Error('ประเภทการลาไม่ถูกต้องหรือไม่เปิดใช้งาน');
      error.statusCode = 400;
      throw error;
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      const error = new Error('รูปแบบวันที่ไม่ถูกต้อง');
      error.statusCode = 400;
      throw error;
    }

    if (startDate > endDate) {
      const error = new Error('วันเริ่มต้นต้องก่อนวันสิ้นสุด');
      error.statusCode = 400;
      throw error;
    }

    // Calculate total days (exclude weekends + holidays)
    let totalDays = await this.countWorkingDays(startDate, endDate);

    // For single-day leave, enforce fixed working slots
    const isSingleDay = start_date === end_date;
    const isHalfDay = is_half_day === true || is_half_day === 'true';
    const normalizedHalfDayPeriod = isHalfDay ? (half_day_period || 'morning') : null;

    const normalizedStartTime = isHalfDay
      ? (normalizedHalfDayPeriod === 'afternoon' ? '13:00' : '08:30')
      : (start_time || '08:30');

    const normalizedEndTime = isHalfDay
      ? (normalizedHalfDayPeriod === 'afternoon' ? '17:30' : '12:00')
      : (end_time || '17:30');

    if (isSingleDay && isHalfDay) {
      totalDays = 0.5;
    }

    if (totalDays <= 0) {
      const error = new Error('ช่วงวันที่เลือกไม่มีวันทำงาน');
      error.statusCode = 400;
      throw error;
    }

    // Check leave balance
    const hasBalance = await this.checkLeaveBalance(employee_id, leave_type, totalDays);
    if (!hasBalance) {
      const error = new Error('วันลาไม่เพียงพอ');
      error.statusCode = 400;
      throw error;
    }

    const leaveRequest = await LeaveRequestRepository.create({
      employeeId: employee_id,
      leaveType: leave_type,
      startDate: start_date,
      endDate: end_date,
      totalDays: totalDays,
      reason,
      attachmentUrl: attachment_url,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      isHalfDay,
      halfDayPeriod: normalizedHalfDayPeriod,
      status: 'pending'
    });

    // Persist attachment metadata
    if (Array.isArray(attachments) && attachments.length > 0) {
      try {
        for (const file of attachments) {
          await pool.query(
            `INSERT INTO leave_attachments (leave_request_id, file_name, file_path, file_size, mime_type)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              leaveRequest.id,
              file.originalname,
              `/uploads/leaves/${file.filename}`,
              file.size,
              file.mimetype
            ]
          );
        }
      } catch (error) {
        if (!(error?.code === '42P01' && String(error?.message || '').includes('"leave_attachments"'))) {
          throw error;
        }
      }
    }

    this.sendLeaveSubmissionNotification(leaveRequest, {
      leaveType: leaveTypeCheck.rows[0]?.name || (leave_type === 'emergency' ? 'ลาฉุกเฉิน' : leave_type),
      attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
      slotLabel: this.getSlotLabel(isSingleDay, isHalfDay, normalizedHalfDayPeriod),
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      attachments: Array.isArray(attachments)
        ? attachments
            .filter(file => file?.path)
            .map(file => ({
              filename: file.originalname,
              path: file.path,
              contentType: file.mimetype
            }))
        : []
    }).catch(error => {
      logger.warn(`Leave submission notification task failed: ${error.message}`);
    });

    return leaveRequest;
  }

  async updateLeaveRequest(leaveRequestId, data) {
    const leaveRequest = await this.getLeaveRequestById(leaveRequestId);

    // Only allow updates if status is 'pending'
    if (leaveRequest.status !== 'pending') {
      const error = new Error('ไม่สามารถแก้ไขการลาที่ได้รับการอนุมัติแล้ว');
      error.statusCode = 400;
      throw error;
    }

    // Recalculate total days if dates changed
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      data.total_days = this.calculateLeavedays(startDate, endDate);
    }

    const updated = await LeaveRequestRepository.update(leaveRequestId, data);
    return updated;
  }

  async cancelLeaveRequest(leaveRequestId, reason = null) {
    const leaveRequest = await this.getLeaveRequestById(leaveRequestId);

    if (['approved', 'rejected', 'cancelled'].includes(leaveRequest.status)) {
      const error = new Error(`ไม่สามารถยกเลิกการลาที่มีสถานะ ${leaveRequest.status}`);
      error.statusCode = 400;
      throw error;
    }

    const updated = await LeaveRequestRepository.update(leaveRequestId, {
      status: 'cancelled'
    });

    return updated;
  }

  async approveLeaveRequest(leaveRequestId, approverType, approverId) {
    const leaveRequest = await this.getLeaveRequestById(leaveRequestId);

    if (leaveRequest.status !== 'pending') {
      const error = new Error('การลานี้ได้รับการตัดสินใจแล้ว');
      error.statusCode = 400;
      throw error;
    }

    const updateData = {
      status: 'approved',
      approver_id: approverId,
      approved_at: new Date(),
    };

    const updated = await LeaveRequestRepository.update(leaveRequestId, updateData);

    if (!updated) {
      const error = new Error('ไม่สามารถอนุมัติการลาได้');
      error.statusCode = 500;
      throw error;
    }

    // Update employee leave balance if fully approved
    if (updated.status === 'approved') {
      await this.deductLeaveBalance(
        leaveRequest.employee_id,
        leaveRequest.leave_type,
        leaveRequest.total_days
      );
    }

    const emailNotification = await this.sendLeaveDecisionNotification(
      { ...leaveRequest, ...updated },
      'approved'
    );

    return {
      ...updated,
      email_notification: emailNotification
    };
  }

  async rejectLeaveRequest(leaveRequestId, rejectReason = null) {
    const leaveRequest = await this.getLeaveRequestById(leaveRequestId);

    if (leaveRequest.status !== 'pending') {
      const error = new Error('การลานี้ได้รับการตัดสินใจแล้ว');
      error.statusCode = 400;
      throw error;
    }

    const updated = await LeaveRequestRepository.update(leaveRequestId, {
      status: 'rejected',
      rejection_reason: rejectReason || null,
    });

    if (!updated) {
      const error = new Error('ไม่สามารถปฏิเสธการลาได้');
      error.statusCode = 500;
      throw error;
    }

    const emailNotification = await this.sendLeaveDecisionNotification(
      { ...leaveRequest, ...updated },
      'rejected',
      rejectReason || null
    );

    return {
      ...updated,
      email_notification: emailNotification
    };
  }

  calculateLeavedays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  async countWorkingDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) return 0;

    const holidayResult = await pool.query(
      `SELECT holiday_date::date AS holiday_date
       FROM holidays
       WHERE holiday_date BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    const holidaySet = new Set(
      holidayResult.rows.map((row) => new Date(row.holiday_date).toISOString().slice(0, 10))
    );

    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      const day = cursor.getDay();
      const key = cursor.toISOString().slice(0, 10);
      const isWeekend = day === 0 || day === 6;
      if (!isWeekend && !holidaySet.has(key)) {
        count += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return count;
  }

  async checkLeaveBalance(employeeId, leaveType, requestedDays) {
    if (this.isUnlimitedLeaveType(leaveType)) {
      return true;
    }

    const currentYear = new Date().getFullYear();
    const balanceLeaveType = this.normalizeBalanceLeaveType(leaveType);

    const queryBalance = async () => pool.query(
      `SELECT COALESCE(remaining_days, entitled_days, 0) AS remaining_days
       FROM employee_leave_balances
       WHERE employee_id = $1 AND year = $2 AND leave_type = $3`,
      [employeeId, currentYear, balanceLeaveType]
    );

    let result = await queryBalance();

    // Auto-initialize balance rows if employee has none for this year
    if (result.rows.length === 0) {
      const anyRow = await pool.query(
        `SELECT 1 FROM employee_leave_balances WHERE employee_id = $1 AND year = $2 LIMIT 1`,
        [employeeId, currentYear]
      );
      if (anyRow.rows.length === 0) {
        try {
          await LeaveCalculationService.createLeaveBalancesForNewEmployee(employeeId, currentYear, 1);
          result = await queryBalance();
        } catch (initErr) {
          console.warn('[LeaveService] Auto-init balance failed for', employeeId, initErr.message);
          return true; // Allow leave when balance cannot be determined
        }
      }
    }

    // If no row for this specific leave type (type not configured in policy), allow
    if (result.rows.length === 0) {
      return true;
    }

    return Number(result.rows[0].remaining_days) >= requestedDays;
  }

  async deductLeaveBalance(employeeId, leaveType, days) {
    if (this.isUnlimitedLeaveType(leaveType)) {
      return;
    }

    const currentYear = new Date().getFullYear();
    const balanceLeaveType = this.normalizeBalanceLeaveType(leaveType);

    const employeeResult = await pool.query(
      `SELECT start_date FROM employees WHERE id = $1`,
      [employeeId]
    );

    const startDate = employeeResult.rows[0]?.start_date ? new Date(employeeResult.rows[0].start_date) : null;
    const isFirstYear = startDate ? ((new Date().getTime() - startDate.getTime()) < 365 * 24 * 60 * 60 * 1000) : false;

    try {
      await pool.query(
        `UPDATE employee_leave_balances
         SET used_days = COALESCE(used_days, 0) + $1,
             remaining_days = GREATEST(COALESCE(remaining_days, 0) - $1, 0),
             accrued_amount = CASE
               WHEN $5::boolean THEN GREATEST(COALESCE(accrued_amount, COALESCE(remaining_days, 0)) - $1, 0)
               ELSE accrued_amount
             END,
             total_entitlement = CASE
               WHEN NOT $5::boolean THEN GREATEST(COALESCE(total_entitlement, COALESCE(entitled_days, COALESCE(remaining_days, 0))) - $1, 0)
               ELSE total_entitlement
             END,
             updated_at = NOW()
         WHERE employee_id = $2 AND year = $3 AND leave_type = $4`,
        [days, employeeId, currentYear, balanceLeaveType, isFirstYear]
      );
    } catch (error) {
      // Backward compatibility for schemas without accrued_amount/total_entitlement
      if (error?.code === '42703') {
        await pool.query(
          `UPDATE employee_leave_balances
           SET used_days = COALESCE(used_days, 0) + $1,
               remaining_days = GREATEST(COALESCE(remaining_days, 0) - $1, 0),
               updated_at = NOW()
           WHERE employee_id = $2 AND year = $3 AND leave_type = $4`,
          [days, employeeId, currentYear, balanceLeaveType]
        );
      } else {
        throw error;
      }
    }
  }

  getSlotLabel(isSingleDay, isHalfDay, halfDayPeriod) {
    if (!isSingleDay) return 'เต็มวัน';
    if (!isHalfDay) return 'เต็มวัน (08:30 - 17:30)';
    return halfDayPeriod === 'afternoon'
      ? 'ครึ่งวันบ่าย (13:00 - 17:30)'
      : 'ครึ่งวันเช้า (08:30 - 12:00)';
  }

  async sendLeaveDecisionNotification(leaveRequest, decision, rejectReason = null) {
    try {
      const employeeResult = await pool.query(
        `SELECT first_name, last_name, email
         FROM employees
         WHERE id = $1
         LIMIT 1`,
        [leaveRequest.employee_id]
      );

      if (employeeResult.rows.length === 0) {
        return {
          sent: false,
          error: 'ไม่พบข้อมูลพนักงานสำหรับส่งอีเมล'
        };
      }

      const employee = employeeResult.rows[0];
      const to = String(employee.email || '').trim();

      if (!to) {
        logger.warn(`Skip leave decision email: no employee email for employee_id=${leaveRequest.employee_id}`);
        return {
          sent: false,
          error: 'ไม่พบอีเมลพนักงาน'
        };
      }

      const templateName = decision === 'approved' ? 'leaveRequestApproved' : 'leaveRequestRejected';
      const leaveType = leaveRequest.leave_type_name || leaveRequest.leave_type;

      await Promise.race([
        sendLeaveRequestEmail(templateName, {
          to,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          leaveType,
          startDate: leaveRequest.start_date,
          endDate: leaveRequest.end_date,
          totalDays: leaveRequest.total_days,
          reason: decision === 'rejected'
            ? (rejectReason || leaveRequest.rejection_reason || null)
            : undefined
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Email send timeout after 10s')), 10000))
      ]);

      logger.info(`Leave ${decision} notification sent for leave_request_id=${leaveRequest.id} to=${to}`);

      return {
        sent: true,
        to
      };
    } catch (error) {
      logger.warn(`Failed to send leave ${decision} notification: ${error.message}`);
      return {
        sent: false,
        error: error.message
      };
    }
  }

  async sendLeaveSubmissionNotification(leaveRequest, extras = {}) {
    try {
      const employeeResult = await pool.query(
        `SELECT e.id, e.first_name, e.last_name, e.department_id,
                e.department,
                COALESCE(e.department_id, (SELECT id FROM departments WHERE name = e.department LIMIT 1)) AS resolved_dept_id
         FROM employees e
         WHERE e.id = $1`,
        [leaveRequest.employee_id]
      );

      if (employeeResult.rows.length === 0) return;

      const employee = employeeResult.rows[0];
      // Use resolved_dept_id: either stored department_id FK or looked up via department name text
      employee.department_id = employee.resolved_dept_id || employee.department_id;
      const normalizedLeaveType = String(leaveRequest.leave_type || '').trim().toLowerCase();

      let settingResult;
      try {
        // New schema path
        settingResult = await pool.query(
          `SELECT
             COALESCE(to_list, email, '') AS to_list,
             COALESCE(cc_list, '') AS cc_list,
             COALESCE(bcc_list, '') AS bcc_list
           FROM notification_settings
           WHERE COALESCE(is_active, true) = true
             AND COALESCE(notify_on_leave_request, true) = true
             AND (leave_type = $2 OR leave_type = 'all' OR leave_type IS NULL)
             AND (dept_id = $1 OR dept_id IS NULL)
           ORDER BY
             CASE WHEN dept_id = $1 THEN 0 ELSE 1 END,
             CASE
               WHEN leave_type = $2 THEN 0
               WHEN leave_type = 'all' THEN 1
               ELSE 2
             END,
             updated_at DESC NULLS LAST
           LIMIT 1`,
          [employee.department_id, normalizedLeaveType]
        );
      } catch (error) {
        // Backward-compatible path for legacy schema
        if (error?.code === '42703') {
          settingResult = await pool.query(
            `SELECT
               COALESCE(to_list, email, '') AS to_list,
               COALESCE(cc_list, '') AS cc_list,
               COALESCE(bcc_list, '') AS bcc_list
             FROM notification_settings
             WHERE COALESCE(is_active, true) = true
               AND COALESCE(notify_on_leave_request, true) = true
               AND (leave_type = $2 OR leave_type = 'all' OR leave_type IS NULL)
               AND (department = $1 OR department IS NULL)
             ORDER BY
               CASE WHEN department = $1 THEN 0 ELSE 1 END,
               CASE
                 WHEN leave_type = $2 THEN 0
                 WHEN leave_type = 'all' THEN 1
                 ELSE 2
               END,
               updated_at DESC NULLS LAST
             LIMIT 1`,
            [employee.department_id, normalizedLeaveType]
          );
        } else {
          throw error;
        }
      }

      if (settingResult.rows.length === 0) {
        logger.warn(`No leave_type-specific notification setting found for dept=${employee.department_id}, leave_type=${normalizedLeaveType}; fallback to department-level setting`);

        try {
          settingResult = await pool.query(
            `SELECT
               COALESCE(to_list, email, '') AS to_list,
               COALESCE(cc_list, '') AS cc_list,
               COALESCE(bcc_list, '') AS bcc_list
             FROM notification_settings
             WHERE COALESCE(is_active, true) = true
               AND COALESCE(notify_on_leave_request, true) = true
               AND (dept_id = $1 OR dept_id IS NULL)
             ORDER BY
               CASE WHEN dept_id = $1 THEN 0 ELSE 1 END,
               updated_at DESC NULLS LAST
             LIMIT 1`,
            [employee.department_id]
          );
        } catch (error) {
          if (error?.code === '42703') {
            settingResult = await pool.query(
              `SELECT
                 COALESCE(to_list, email, '') AS to_list,
                 COALESCE(cc_list, '') AS cc_list,
                 COALESCE(bcc_list, '') AS bcc_list
               FROM notification_settings
               WHERE COALESCE(is_active, true) = true
                 AND COALESCE(notify_on_leave_request, true) = true
                 AND (department = $1 OR department IS NULL)
               ORDER BY
                 CASE WHEN department = $1 THEN 0 ELSE 1 END,
                 updated_at DESC NULLS LAST
               LIMIT 1`,
              [employee.department_id]
            );
          } else {
            throw error;
          }
        }

        if (settingResult.rows.length === 0) {
          logger.warn(`No notification setting found for dept=${employee.department_id}, leave_type=${normalizedLeaveType}`);
          return;
        }
      }

      const settings = settingResult.rows[0];
      const to = (settings.to_list || '').trim();
      if (!to) {
        logger.warn(`Notification setting matched but recipient list is empty for dept=${employee.department_id}, leave_type=${normalizedLeaveType}`);
        return;
      }

      const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

      await Promise.race([
        sendLeaveRequestEmail('leaveRequestApproval', {
          to,
          cc: (settings.cc_list || '').trim() || undefined,
          bcc: (settings.bcc_list || '').trim() || undefined,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          leaveType: extras.leaveType || leaveRequest.leave_type,
          startDate: leaveRequest.start_date,
          endDate: leaveRequest.end_date,
          totalDays: leaveRequest.total_days,
          reason: leaveRequest.reason || '-',
          attachmentCount: extras.attachmentCount || 0,
          slotLabel: extras.slotLabel || 'เต็มวัน',
          startTime: extras.startTime,
          endTime: extras.endTime,
          attachments: Array.isArray(extras.attachments) ? extras.attachments : undefined,
          appUrl,
          leaveRequestId: leaveRequest.id
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Email send timeout after 10s')), 10000))
      ]);

      logger.info(`Leave submission notification sent for leave_request_id=${leaveRequest.id} to=${to}`);
    } catch (error) {
      logger.warn(`Failed to send leave submission notification: ${error.message}`);
    }
  }
}

export default new LeaveRequestService();