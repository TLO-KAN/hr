import authService from '../services/authService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

class AuthController {
  register = asyncHandler(async (req, res) => {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    const result = await authService.register(email, password, fullName);
    res.status(201).json(result);
  });

  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    const result = await authService.login(email, password);
    res.json(result);
  });

  forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_FIELDS'
      });
    }

    const result = await authService.forgotPassword(email);
    res.json(result);
  });

  resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'Token and new password are required',
        code: 'MISSING_FIELDS'
      });
    }

    const result = await authService.resetPassword(token, newPassword);
    res.json(result);
  });

  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current and new password are required',
        code: 'MISSING_FIELDS'
      });
    }

    const result = await authService.changePassword(userId, currentPassword, newPassword);
    res.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จ',
      user: result
    });
  });

  getMe = asyncHandler(async (req, res) => {
    const result = await authService.getMe(req.user.id);
    res.json(result);
  });

  getPermissions = asyncHandler(async (req, res) => {
    const roleList = Array.from(new Set([...(req.user.roles || []), req.user.role].filter(Boolean)));
    const isAdminLike = roleList.includes('admin') || roleList.includes('ceo');
    const isHrLike = isAdminLike || roleList.includes('hr');
    const isApprover = isHrLike || roleList.includes('manager') || roleList.includes('supervisor');

    const permissions = {
      isAdminLike,
      canViewDashboard: true,
      canRequestLeave: true,
      canViewProfile: true,
      canViewEmployees: isApprover,
      canManageUsers: isHrLike,
      canManageOrgStructure: isHrLike,
      canManageLeavePolicies: isHrLike,
      canViewLeaveBalance: isHrLike,
      canViewHolidays: true,
      canManageHolidays: isHrLike,
      canApproveLeave: isApprover,
      canViewReports: isApprover,
      canManageSystemSettings: isAdminLike,
      canCreateNotificationsForOthers: isAdminLike || roleList.includes('hr') || roleList.includes('manager'),
    };

    res.json({
      success: true,
      data: {
        userId: req.user.id,
        roles: roleList,
        permissions,
      },
    });
  });
}

export default new AuthController();