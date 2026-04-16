import LeaveRequestRepository from '../repositories/LeaveRequestRepository.js';
import { getPool } from '../config/db-pool.js';
import { sendLeaveRequestEmail } from '../utils/emailService.js';
import LeaveCalculationService from './LeaveCalculationService.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

const pool = getPool();

class LeaveRequestService {
  async ensureNotificationsTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT false,
        link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async insertNotifications(userIds, title, message, type = 'info', link = null) {
    if (!Array.isArray(userIds) || userIds.length === 0) return;

    await this.ensureNotificationsTable();

    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    for (const userId of uniqueUserIds) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, title, message, type, link]
      );
    }
  }

  deriveFlowPattern(workflow) {
    if (workflow?.flow_pattern) return workflow.flow_pattern;
    if (workflow?.approval_levels === 0) return 'ceo';
    if (workflow?.approval_levels >= 2 && workflow?.requires_hr) return 'supervisor_hr_ceo';
    if (workflow?.approval_levels >= 2) return 'supervisor_ceo';
    if (workflow?.requires_hr) return 'supervisor_hr';
    return 'supervisor';
  }

  flowPatternToRoles(flowPattern) {
    switch (flowPattern) {
      case 'supervisor_hr':
        return ['manager', 'supervisor', 'hr'];
      case 'supervisor_hr_ceo':
        return ['manager', 'supervisor', 'hr', 'ceo'];
      case 'supervisor_ceo':
        return ['manager', 'supervisor', 'ceo'];
      case 'ceo':
        return ['ceo'];
      case 'supervisor':
      default:
        return ['manager', 'supervisor'];
    }
  }

  flowPatternToFirstStepRoles(flowPattern) {
    switch (flowPattern) {
      case 'ceo':
        return ['ceo'];
      case 'supervisor':
      case 'supervisor_hr':
      case 'supervisor_hr_ceo':
      case 'supervisor_ceo':
      default:
        return ['manager', 'supervisor'];
    }
  }

  async getApprovalWorkflow(leaveType, totalDays) {
    const result = await pool.query(
      `SELECT *
       FROM approval_workflows
       WHERE (leave_type = $1 OR leave_type = 'all')
         AND (min_days IS NULL OR min_days <= $2)
         AND (max_days IS NULL OR max_days >= $2)
       ORDER BY
         CASE WHEN leave_type = $1 THEN 0 ELSE 1 END,
         CASE WHEN min_days IS NULL THEN 1 ELSE 0 END,
         COALESCE(min_days, 0) DESC,
         updated_at DESC NULLS LAST,
         id DESC
       LIMIT 1`,
      [leaveType, Number(totalDays || 0)]
    );

    return result.rows[0] || null;
  }

  async resolveApproverUserIds({ departmentId, department, leaveType, totalDays, requesterUserId }) {
    const workflow = await this.getApprovalWorkflow(leaveType, totalDays);
    const flowPattern = this.deriveFlowPattern(workflow);
    const approverRoles = this.flowPatternToRoles(flowPattern);
    const firstStepRoles = this.flowPatternToFirstStepRoles(flowPattern);

    const result = await pool.query(
      `SELECT DISTINCT ua.id AS user_id
       FROM user_auth ua
       LEFT JOIN employees approver_emp ON approver_emp.user_id = ua.id
       WHERE ua.role = ANY($1::text[])
         AND (
           ua.role IN ('hr', 'ceo')
           OR (
             ua.role IN ('manager', 'supervisor')
             AND (
               (approver_emp.department_id IS NOT NULL AND approver_emp.department_id = $2)
               OR (approver_emp.department_id IS NULL AND approver_emp.department = $3)
             )
           )
         )`,
      [firstStepRoles, departmentId || null, department || null]
    );

    const approverUserIds = result.rows
      .map((row) => row.user_id)
      .filter((id) => id && id !== requesterUserId);

    return {
      approverUserIds,
      approverRoles,
      firstStepRoles,
      flowPattern,
      workflow,
    };
  }

  async notifyApproversForNewLeave(leaveRequest) {
    const detailResult = await pool.query(
      `SELECT e.user_id, e.first_name, e.last_name, e.department_id, e.department,
              lr.leave_type, lr.start_date, lr.end_date
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       WHERE lr.id = $1
       LIMIT 1`,
      [leaveRequest.id]
    );

    if (detailResult.rows.length === 0) return;

    const detail = detailResult.rows[0];
    const requesterUserId = detail.user_id;
    const employeeName = `${detail.first_name || ''} ${detail.last_name || ''}`.trim() || 'พนักงาน';

    const { approverUserIds, flowPattern, firstStepRoles } = await this.resolveApproverUserIds({
      departmentId: detail.department_id,
      department: detail.department,
      leaveType: detail.leave_type,
      totalDays: leaveRequest.total_days,
      requesterUserId,
    });

    if (approverUserIds.length === 0) {
      logger.warn(`Skip in-app leave submit notification: no first-step approver found for leave_request_id=${leaveRequest.id}, flow=${flowPattern}, roles=${firstStepRoles.join(',')}`);
      return;
    }

    const title = 'มีคำขอลาใหม่รออนุมัติ';
    const message = `[#${leaveRequest.id}] ${employeeName} ส่งคำขอลาประเภท ${detail.leave_type} (${detail.start_date} - ${detail.end_date}) | flow: ${flowPattern}`;

    await this.insertNotifications(approverUserIds, title, message, 'leave', '/leave/approval');
  }

  async notifyEmployeeForDecision(leaveRequest, decision, rejectReason = null) {
    const employeeResult = await pool.query(
      `SELECT user_id, first_name, last_name
       FROM employees
       WHERE id = $1
       LIMIT 1`,
      [leaveRequest.employee_id]
    );

    if (employeeResult.rows.length === 0) return;

    const employee = employeeResult.rows[0];
    if (!employee.user_id) return;

    const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'พนักงาน';
    const approved = decision === 'approved';
    const title = approved ? 'คำขอลาได้รับการอนุมัติ' : 'คำขอลาถูกปฏิเสธ';
    const reasonText = !approved && rejectReason ? ` เหตุผล: ${rejectReason}` : '';
    const message = approved
      ? `[#${leaveRequest.id}] คำขอลาประเภท ${leaveRequest.leave_type} ของคุณได้รับการอนุมัติแล้ว`
      : `[#${leaveRequest.id}] คำขอลาประเภท ${leaveRequest.leave_type} ของคุณถูกปฏิเสธแล้ว${reasonText}`;

    await this.insertNotifications([employee.user_id], title, message, approved ? 'success' : 'warning', '/leave/request');
  }

  async notifyApproversForCancellation(leaveRequest, cancelReason = null) {
    const detailResult = await pool.query(
      `SELECT e.user_id, e.first_name, e.last_name, e.department_id, e.department,
              lr.leave_type, lr.start_date, lr.end_date
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       WHERE lr.id = $1
       LIMIT 1`,
      [leaveRequest.id]
    );

    if (detailResult.rows.length === 0) return;

    const detail = detailResult.rows[0];
    const requesterUserId = detail.user_id;
    const employeeName = `${detail.first_name || ''} ${detail.last_name || ''}`.trim() || 'พนักงาน';

    const { approverUserIds, flowPattern, firstStepRoles } = await this.resolveApproverUserIds({
      departmentId: detail.department_id,
      department: detail.department,
      leaveType: detail.leave_type,
      totalDays: leaveRequest.total_days,
      requesterUserId,
    });

    if (approverUserIds.length === 0) {
      logger.warn(`Skip in-app leave cancel notification: no first-step approver found for leave_request_id=${leaveRequest.id}, flow=${flowPattern}, roles=${firstStepRoles.join(',')}`);
      return;
    }

    const reasonText = cancelReason ? ` เหตุผล: ${cancelReason}` : '';
    const title = 'มีการยกเลิกคำขอลา';
    const message = `[#${leaveRequest.id}] ${employeeName} ยกเลิกคำขอลาประเภท ${detail.leave_type}${reasonText} | flow: ${flowPattern}`;

    await this.insertNotifications(approverUserIds, title, message, 'info', '/leave/approval');
  }

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

    this.notifyApproversForNewLeave(leaveRequest).catch((error) => {
      logger.warn(`In-app leave submission notification failed: ${error.message}`);
    });

    return leaveRequest;
  }

  async updateLeaveRequest(leaveRequestId, data, actor = {}) {
    const leaveRequest = await this.getLeaveRequestById(leaveRequestId);
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];

    const actorRoles = Array.from(new Set([...(actor.roles || []), actor.role].filter(Boolean)));
    const isPrivileged = actorRoles.some((role) => ['admin', 'hr', 'ceo'].includes(role));

    if (!isPrivileged && actor.userId) {
      const ownerResult = await pool.query(
        `SELECT 1
         FROM leave_requests lr
         JOIN employees e ON e.id = lr.employee_id
         WHERE lr.id = $1 AND e.user_id = $2
         LIMIT 1`,
        [leaveRequestId, actor.userId]
      );

      if (ownerResult.rows.length === 0) {
        const error = new Error('ไม่มีสิทธิ์แก้ไขใบลานี้');
        error.statusCode = 403;
        throw error;
      }
    }

    // Only allow updates if status is 'pending'
    if (leaveRequest.status !== 'pending') {
      const error = new Error('ไม่สามารถแก้ไขการลาที่ได้รับการอนุมัติแล้ว');
      error.statusCode = 400;
      throw error;
    }

    const allowedUpdateData = {
      leave_type: data.leave_type,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason,
      total_days: data.total_days,
      start_time: data.start_time,
      end_time: data.end_time,
      is_half_day: data.is_half_day,
      half_day_period: data.half_day_period,
    };

    // Recalculate total days if dates changed
    if (allowedUpdateData.start_date && allowedUpdateData.end_date && !allowedUpdateData.total_days) {
      const startDate = new Date(allowedUpdateData.start_date);
      const endDate = new Date(allowedUpdateData.end_date);
      allowedUpdateData.total_days = this.calculateLeavedays(startDate, endDate);
    }

    const updated = await LeaveRequestRepository.update(leaveRequestId, allowedUpdateData);

    if (attachments.length > 0) {
      try {
        for (const file of attachments) {
          await pool.query(
            `INSERT INTO leave_attachments (leave_request_id, file_name, file_path, file_size, mime_type)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              leaveRequestId,
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

    if (updated) {
      updated.attachments = await LeaveRequestRepository.loadAttachments(leaveRequestId);
    }

    return updated;
  }

  async removeLeaveAttachment(leaveRequestId, attachmentId, actor = {}) {
    const leaveRequest = await this.getLeaveRequestById(leaveRequestId);

    const actorRoles = Array.from(new Set([...(actor.roles || []), actor.role].filter(Boolean)));
    const isPrivileged = actorRoles.some((role) => ['admin', 'hr', 'ceo'].includes(role));

    if (!isPrivileged && actor.userId) {
      const ownerResult = await pool.query(
        `SELECT 1
         FROM leave_requests lr
         JOIN employees e ON e.id = lr.employee_id
         WHERE lr.id = $1 AND e.user_id = $2
         LIMIT 1`,
        [leaveRequestId, actor.userId]
      );

      if (ownerResult.rows.length === 0) {
        const error = new Error('ไม่มีสิทธิ์ลบไฟล์แนบใบลานี้');
        error.statusCode = 403;
        throw error;
      }
    }

    if (leaveRequest.status !== 'pending') {
      const error = new Error('ลบไฟล์แนบได้เฉพาะใบลาที่ยังไม่อนุมัติ');
      error.statusCode = 400;
      throw error;
    }

    const attachmentResult = await pool.query(
      `SELECT id, file_path
       FROM leave_attachments
       WHERE id = $1 AND leave_request_id = $2
       LIMIT 1`,
      [attachmentId, leaveRequestId]
    );

    if (attachmentResult.rows.length === 0) {
      const error = new Error('ไม่พบไฟล์แนบ');
      error.statusCode = 404;
      throw error;
    }

    const attachment = attachmentResult.rows[0];

    await pool.query(
      `DELETE FROM leave_attachments WHERE id = $1 AND leave_request_id = $2`,
      [attachmentId, leaveRequestId]
    );

    if (attachment.file_path) {
      const normalizedPath = String(attachment.file_path).replace(/^\/+/, '');
      const absolutePath = path.join(process.cwd(), normalizedPath);
      await fs.unlink(absolutePath).catch(() => {});
    }

    const attachments = await LeaveRequestRepository.loadAttachments(leaveRequestId);
    return { leave_request_id: leaveRequestId, attachments };
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

    this.notifyApproversForCancellation({ ...leaveRequest, ...updated }, reason).catch((error) => {
      logger.warn(`In-app leave cancellation notification failed: ${error.message}`);
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

    this.notifyEmployeeForDecision({ ...leaveRequest, ...updated }, 'approved').catch((error) => {
      logger.warn(`In-app leave approval notification failed: ${error.message}`);
    });

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

    this.notifyEmployeeForDecision(
      { ...leaveRequest, ...updated },
      'rejected',
      rejectReason || null
    ).catch((error) => {
      logger.warn(`In-app leave rejection notification failed: ${error.message}`);
    });

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

  async getNotificationFlowHealthSummary() {
    await this.ensureNotificationsTable();

    const workflowResult = await pool.query(
      `SELECT id, leave_type, approval_levels, flow_pattern, requires_hr, min_days, max_days
       FROM approval_workflows
       ORDER BY id ASC`
    );

    const checks = [];
    const issues = [];

    for (const workflow of workflowResult.rows) {
      const flowPattern = this.deriveFlowPattern(workflow);
      const firstStepRoles = this.flowPatternToFirstStepRoles(flowPattern);

      const roleCountResult = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM user_auth
         WHERE role = ANY($1::text[])`,
        [firstStepRoles]
      );

      const approverCount = roleCountResult.rows[0]?.count || 0;
      const check = {
        workflow_id: workflow.id,
        leave_type: workflow.leave_type,
        flow_pattern: flowPattern,
        first_step_roles: firstStepRoles,
        matching_users: approverCount,
        ok: approverCount > 0,
      };

      checks.push(check);

      if (!check.ok) {
        issues.push({
          level: 'error',
          code: 'NO_FIRST_STEP_APPROVER',
          message: `Workflow ${workflow.id} (${workflow.leave_type}) has no users for first step roles ${firstStepRoles.join(',')}`,
        });
      }
    }

    return {
      checked_at: new Date().toISOString(),
      strict_mode: true,
      first_step_only: true,
      workflow_count: workflowResult.rows.length,
      healthy: issues.length === 0,
      issues,
      checks,
    };
  }
}

export default new LeaveRequestService();