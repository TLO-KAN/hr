/**
 * Leave Request Routes
 * 
 * POST   /leaves/request        - Create leave request
 * GET    /leaves/balance        - Get leave balance
 * GET    /leaves/requests       - Get all leave requests
 * GET    /leaves/pending        - Get pending requests (managers)
 * POST   /leaves/:id/approve    - Approve leave (managers)
 * POST   /leaves/:id/reject     - Reject leave (managers)
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import LeaveController from '../controllers/LeaveController.js';
import AuthService from '../services/AuthService.js';

const router: Router = express.Router();

/**
 * Middleware: Authenticate JWT token
 */
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Missing authorization header',
      });
    }

    try {
      const token = AuthService.extractTokenFromHeader(authHeader);
      const payload = AuthService.verifyToken(token);
      (req as any).user = payload;
      next();
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * POST /leaves/request
 * Create a new leave request
 */
router.post('/request', authenticate, async (req: Request, res: Response) => {
  try {
    await LeaveController.createLeaveRequest(req as any, res);
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /leaves/balance
 * Get current leave balance
 */
router.get('/balance', authenticate, async (req: Request, res: Response) => {
  try {
    await LeaveController.getLeaveBalance(req as any, res);
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /leaves/requests
 * Get all leave requests
 */
router.get('/requests', authenticate, async (req: Request, res: Response) => {
  try {
    await LeaveController.getLeaveRequests(req as any, res);
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /leaves/pending
 * Get pending leave requests (managers only)
 */
router.get('/pending', authenticate, async (req: Request, res: Response) => {
  try {
    await LeaveController.getPendingLeaveRequests(req as any, res);
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /leaves/:id/approve
 * Approve leave request (managers only)
 */
router.post('/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    await LeaveController.approveLeave(req as any, res);
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /leaves/:id/reject
 * Reject leave request (managers only)
 */
router.post('/:id/reject', authenticate, async (req: Request, res: Response) => {
  try {
    await LeaveController.rejectLeave(req as any, res);
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
