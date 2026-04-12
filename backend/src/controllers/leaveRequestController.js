import leaveRequestService from '../services/leaveRequestService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

class LeaveRequestController {
  getAll = asyncHandler(async (req, res) => {
    const { departmentId, status, year, limit = 50, offset = 0, includeEmployeeMeta } = req.query;

    const filters = {
      departmentId: departmentId || undefined,
      status,
      year: year ? parseInt(year) : undefined,
      includeEmployeeMeta: includeEmployeeMeta !== 'false'
    };

    const result = await leaveRequestService.getAllLeaveRequests(
      filters,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: result.data,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.total
      }
    });
  });

  getById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const leaveRequest = await leaveRequestService.getLeaveRequestById(id);
    res.json({
      success: true,
      data: leaveRequest
    });
  });

  getMyRequests = asyncHandler(async (req, res) => {
    const { status, year, limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    const { getPool } = await import('../config/db-pool.js');
    const pool = getPool();
    const empResult = await pool.query(
      'SELECT id FROM employees WHERE user_id = $1',
      [userId]
    );

    const employee = empResult.rows[0] || null;

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    const filters = {
      status,
      year: year ? parseInt(year) : undefined
    };

    const result = await leaveRequestService.getEmployeeLeaveRequests(
      employee.id,
      filters,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: result.data,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.total
      }
    });
  });

  create = asyncHandler(async (req, res) => {
    const { leave_type, start_date, end_date } = req.body;

    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({
        error: 'leave_type, start_date, and end_date are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Get employee by user_id
    const { getPool } = await import('../config/db-pool.js');
    const pool = getPool();
    const empResult = await pool.query(
      'SELECT id FROM employees WHERE user_id = $1',
      [req.user.id]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    const leaveRequest = await leaveRequestService.createLeaveRequest({
      employee_id: empResult.rows[0].id,
      attachments: req.files || [],
      ...req.body
    });

    res.status(201).json({
      success: true,
      message: 'สร้างใบลาสำเร็จ',
      data: leaveRequest
    });
  });

  update = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const updated = await leaveRequestService.updateLeaveRequest(id, req.body);
    res.json({
      success: true,
      message: 'อัพเดตใบลาสำเร็จ',
      data: updated
    });
  });

  cancel = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const updated = await leaveRequestService.cancelLeaveRequest(id, reason);
    res.json({
      success: true,
      message: 'ยกเลิกใบลาสำเร็จ',
      data: updated
    });
  });

  approve = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { approverType: bodyApproverType } = req.body;
    const roleList = Array.from(new Set([...(req.user.roles || []), req.user.role].filter(Boolean)));
    const approverType = bodyApproverType || roleList.find((role) => ['ceo', 'hr', 'manager', 'supervisor', 'admin'].includes(role)) || 'manager';

    const updated = await leaveRequestService.approveLeaveRequest(
      id,
      approverType,
      req.user.id
    );

    res.json({
      success: true,
      message: 'อนุมัติใบลาสำเร็จ',
      data: updated
    });
  });

  reject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const updated = await leaveRequestService.rejectLeaveRequest(id, reason);
    res.json({
      success: true,
      message: 'ปฏิเสธใบลาสำเร็จ',
      data: updated
    });
  });

  bulkApprove = asyncHandler(async (req, res) => {
    const { leave_ids } = req.body;
    
    if (!Array.isArray(leave_ids) || leave_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'leave_ids ต้องเป็น array ที่มี ID อย่างน้อย 1 รายการ'
      });
    }

    const approverType = req.user.roles?.[0] || req.user.role || 'manager';
    const approverId = req.user.id;
    
    const results = await Promise.allSettled(
      leave_ids.map(id => 
        leaveRequestService.approveLeaveRequest(
          id,
          approverType,
          approverId
        )
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({
      success: true,
      message: `อนุมัติสำเร็จ ${successful} รายการ${failed > 0 ? `, ล้มเหลว ${failed} รายการ` : ''}`,
      data: {
        successful,
        failed,
        total: leave_ids.length
      }
    });
  });

  bulkReject = asyncHandler(async (req, res) => {
    const { leave_ids, reason } = req.body;
    
    if (!Array.isArray(leave_ids) || leave_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'leave_ids ต้องเป็น array ที่มี ID อย่างน้อย 1 รายการ'
      });
    }

    const results = await Promise.allSettled(
      leave_ids.map(id => 
        leaveRequestService.rejectLeaveRequest(
          id,
          reason || 'ปฏิเสธโดยการจัดการรายการใหญ่'
        )
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({
      success: true,
      message: `ปฏิเสธสำเร็จ ${successful} รายการ${failed > 0 ? `, ล้มเหลว ${failed} รายการ` : ''}`,
      data: {
        successful,
        failed,
        total: leave_ids.length
      }
    });
  });
}

export default new LeaveRequestController();