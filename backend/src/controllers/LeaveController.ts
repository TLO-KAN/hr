/**
 * Leave Controller
 * 
 * Handles:
 * - Create leave request
 * - Get leave balance
 * - Approve/Reject leave
 * - Get leave history
 */

import { Request, Response } from 'express';
import LeaveService from '../services/LeaveService.js';
import NotificationService from '../services/NotificationService.js';
import { query } from '../config/db.js';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    employee_id?: string;
    role: string;
  };
}

export class LeaveController {
  /**
   * POST /leaves/request
   * Create a new leave request
   */
  async createLeaveRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { leaveType, startDate, endDate, reason } = req.body;

      if (!leaveType || !startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'leaveType, startDate, and endDate are required',
        });
        return;
      }

      // Use employee_id from auth token
      const employeeId = req.user.employee_id;

      if (!employeeId) {
        res.status(400).json({
          success: false,
          error: 'Employee ID not found in user profile',
        });
        return;
      }

      // Create leave request
      const leaveRequest = await LeaveService.createLeaveRequest(
        employeeId,
        leaveType,
        startDate,
        endDate,
        reason || ''
      );

      // Get employee details for notification
      const empResult = await query(
        'SELECT id, email, display_name, department FROM employees WHERE id = $1',
        [employeeId]
      );

      if (empResult.rows.length > 0) {
        const employee = empResult.rows[0];
        // Send notification to managers
        await NotificationService.notifyLeaveRequest(employeeId, leaveRequest, employee);
      }

      res.status(201).json({
        success: true,
        data: {
          leaveRequest,
        },
      });
    } catch (error: any) {
      console.error('Leave request creation error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /leaves/balance
   * Get current leave balance for employee
   */
  async getLeaveBalance(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const employeeId = req.user.employee_id;

      if (!employeeId) {
        res.status(400).json({
          success: false,
          error: 'Employee ID not found in user profile',
        });
        return;
      }

      const balance = await LeaveService.calculateLeaveEntitlement(employeeId);

      res.status(200).json({
        success: true,
        data: {
          balance,
        },
      });
    } catch (error: any) {
      console.error('Leave balance error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /leaves/requests
   * Get all leave requests for employee or (if manager) for team
   */
  async getLeaveRequests(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const status = req.query.status as string;
      const employeeId = req.query.employeeId as string;

      let query_text = 'SELECT * FROM leave_requests WHERE 1=1';
      const params: any[] = [];

      // Filter by employee (default to current user)
      if (employeeId && req.user.role === 'manager') {
        // Managers can view their team's leaves
        params.push(employeeId);
        query_text += ` AND employee_id = $${params.length}`;
      } else {
        // Regular employees see only their own
        params.push(req.user.employee_id);
        query_text += ` AND employee_id = $${params.length}`;
      }

      // Filter by status if provided
      if (status) {
        params.push(status);
        query_text += ` AND status = $${params.length}`;
      }

      query_text += ' ORDER BY created_at DESC';

      const result = await query(query_text, params);

      res.status(200).json({
        success: true,
        data: {
          requests: result.rows,
        },
      });
    } catch (error: any) {
      console.error('Fetch leave requests error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /leaves/:id/approve
   * Approve leave request (managers only)
   */
  async approveLeave(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Only managers can approve leave' });
        return;
      }

      const leaveRequestId = req.params.id;

      // Approve the leave
      const leaveRequest = await LeaveService.approveLeaveRequest(leaveRequestId);

      // Get employee details
      const empResult = await query(
        'SELECT id, email, display_name FROM employees WHERE id = $1',
        [leaveRequest.employee_id]
      );

      if (empResult.rows.length > 0) {
        const employee = empResult.rows[0];
        // Send approval notification
        await NotificationService.notifyLeaveApproval(
          leaveRequest.employee_id,
          leaveRequest,
          employee,
          req.user.email
        );
      }

      res.status(200).json({
        success: true,
        data: {
          leaveRequest,
        },
      });
    } catch (error: any) {
      console.error('Leave approval error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /leaves/:id/reject
   * Reject leave request (managers only)
   */
  async rejectLeave(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Only managers can reject leave' });
        return;
      }

      const leaveRequestId = req.params.id;
      const { reason } = req.body;

      // Reject the leave
      const leaveRequest = await LeaveService.rejectLeaveRequest(leaveRequestId, reason);

      // Get employee details
      const empResult = await query(
        'SELECT id, email, display_name FROM employees WHERE id = $1',
        [leaveRequest.employee_id]
      );

      if (empResult.rows.length > 0) {
        const employee = empResult.rows[0];
        // Send rejection notification
        await NotificationService.notifyLeaveRejection(
          leaveRequest.employee_id,
          leaveRequest,
          employee,
          reason || 'Not specified',
          req.user.email
        );
      }

      res.status(200).json({
        success: true,
        data: {
          leaveRequest,
        },
      });
    } catch (error: any) {
      console.error('Leave rejection error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /leaves/pending
   * Get all pending leave requests for manager
   */
  async getPendingLeaveRequests(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Only managers can view pending requests' });
        return;
      }

      // Get manager's department
      const mgrResult = await query(
        'SELECT department FROM employees WHERE id = $1',
        [req.user.employee_id]
      );

      if (mgrResult.rows.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Manager profile not found',
        });
        return;
      }

      const managerDept = mgrResult.rows[0].department;

      // Get pending requests from team
      const result = await query(
        `SELECT lr.* FROM leave_requests lr
         JOIN employees e ON lr.employee_id = e.id
         WHERE e.department = $1 AND lr.status = 'pending'
         ORDER BY lr.created_at DESC`,
        [managerDept]
      );

      res.status(200).json({
        success: true,
        data: {
          requests: result.rows,
        },
      });
    } catch (error: any) {
      console.error('Fetch pending requests error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new LeaveController();
