import api from './api';
import { buildApiUrl } from '@/config/api';

/**
 * Authentication Service
 * 
 * Handles all authentication-related API calls
 * Methods abstract the API endpoints and HTTP methods
 */

const authService = {
  /**
   * Register a new user
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} fullName - User full name
   * @returns {Promise}
   */
  register: (email, password, fullName) => {
    return api.post('/auth/register', {
      email,
      password,
      fullName,
    });
  },

  /**
   * Login with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise}
   */
  login: (email, password) => {
    return api.post('/auth/login', {
      email,
      password,
    });
  },

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise}
   */
  forgotPassword: (email) => {
    return api.post('/auth/forgot-password', {
      email,
    });
  },

  /**
   * Reset password with token
   * @param {string} token - Reset token from email
   * @param {string} newPassword - New password
   * @returns {Promise}
   */
  resetPassword: (token, newPassword) => {
    return api.post('/auth/reset-password', {
      token,
      newPassword,
    });
  },

  /**
   * Change password (requires authentication)
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise}
   */
  changePassword: (oldPassword, newPassword) => {
    return api.post('/auth/change-password', {
      oldPassword,
      newPassword,
    });
  },

  /**
   * Get current user information
   * @returns {Promise}
   */
  getMe: () => {
    return api.get('/auth/me');
  },

  /**
   * Get user permissions
   * @returns {Promise}
   */
  getPermissions: () => {
    return api.get('/auth/permissions');
  },

  /**
   * Logout (clears local storage)
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
  },

  /**
   * Login via Microsoft OAuth
   */
  loginWithMicrosoft: () => {
    window.location.href = buildApiUrl('/auth/microsoft');
  },
};

export default authService;
