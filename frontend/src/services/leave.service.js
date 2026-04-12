import api from './api';

/**
 * Leave Management Service
 * 
 * Handles all leave request and leave management API calls
 */

const leaveService = {
  /**
   * Get all leave requests with pagination
   * @param {number} limit - Records per page (default: 50)
   * @param {number} offset - Starting record (default: 0)
   * @param {object} filters - Optional filters { status, year }
   * @returns {Promise}
   */
  getLeaveRequests: (limit = 50, offset = 0, filters = {}) => {
    const params = new URLSearchParams({ limit, offset, ...filters });
    return api.get(`/leaves?${params.toString()}`);
  },

  /**
   * Get leave request by ID
   * @param {string} id - Leave request ID
   * @returns {Promise}
   */
  getLeaveRequest: (id) => {
    return api.get(`/leaves/${id}`);
  },

  /**
   * Create a new leave request
   * @param {object} leaveData - Leave request data
   * @param {string} leaveData.leaveTypeId - Type of leave
   * @param {string} leaveData.startDate - Start date (YYYY-MM-DD)
   * @param {string} leaveData.endDate - End date (YYYY-MM-DD)
   * @param {string} leaveData.reason - Reason for leave
   * @returns {Promise}
   */
  createLeaveRequest: (leaveData) => {
    return api.post('/leaves', leaveData);
  },

  /**
   * Update a leave request
   * @param {string} id - Leave request ID
   * @param {object} leaveData - Updated leave data
   * @returns {Promise}
   */
  updateLeaveRequest: (id, leaveData) => {
    return api.put(`/leaves/${id}`, leaveData);
  },

  /**
   * Cancel a leave request
   * @param {string} id - Leave request ID
   * @returns {Promise}
   */
  cancelLeaveRequest: (id) => {
    return api.patch(`/leaves/${id}`, {
      status: 'cancelled',
    });
  },

  /**
   * Get leave entitlements for current user
   * @returns {Promise}
   */
  getLeaveEntitlements: () => {
    return api.get('/leave-entitlements');
  },

  /**
   * Get leave policies
   * @returns {Promise}
   */
  getLeavePolicies: () => {
    return api.get('/leave-policies');
  },

  /**
   * Get leave types
   * @returns {Promise}
   */
  getLeaveTypes: () => {
    return api.get('/leave-types');
  },

  /**
   * Approve a leave request (Admin/Manager only)
   * @param {string} id - Leave request ID
   * @param {object} data - Approval data
   * @returns {Promise}
   */
  approveLeaveRequest: (id, data = {}) => {
    return api.patch(`/leaves/${id}/approve`, {
      status: 'approved',
      ...data,
    });
  },

  /**
   * Reject a leave request (Admin/Manager only)
   * @param {string} id - Leave request ID
   * @param {string} reason - Reason for rejection
   * @returns {Promise}
   */
  rejectLeaveRequest: (id, reason) => {
    return api.patch(`/leaves/${id}/reject`, {
      status: 'rejected',
      rejectionReason: reason,
    });
  },

  /**
   * Get leave requests for approval with pagination
   * @param {number} limit - Records per page (default: 50)
   * @param {number} offset - Starting record (default: 0)
   * @param {object} filters - Optional filters { status, year }
   * @returns {Promise}
   */
  getLeaveRequestsForApproval: (limit = 50, offset = 0, filters = {}) => {
    const params = new URLSearchParams({ limit, offset, ...filters });
    return api.get(`/leave-requests?${params.toString()}`);
  },
};

export default leaveService;
