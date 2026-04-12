import api from './api';

/**
 * Employee Service
 * 
 * Handles all employee-related API calls
 */

const employeeService = {
  /**
   * Get all employees
   * @param {object} options - Query options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Items per page (default: 10)
   * @returns {Promise}
   */
  getEmployees: (options = {}) => {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page);
    if (options.limit) params.append('limit', options.limit);
    return api.get(`/employees?${params.toString()}`);
  },

  /**
   * Get employee by ID
   * @param {string} id - Employee ID
   * @returns {Promise}
   */
  getEmployee: (id) => {
    return api.get(`/employees/${id}`);
  },

  /**
   * Create a new employee
   * @param {object} employeeData - Employee data
   * @returns {Promise}
   */
  createEmployee: (employeeData) => {
    return api.post('/employees', employeeData);
  },

  /**
   * Update an employee
   * @param {string} id - Employee ID
   * @param {object} employeeData - Updated employee data
   * @returns {Promise}
   */
  updateEmployee: (id, employeeData) => {
    return api.put(`/employees/${id}`, employeeData);
  },

  /**
   * Delete an employee
   * @param {string} id - Employee ID
   * @returns {Promise}
   */
  deleteEmployee: (id) => {
    return api.delete(`/employees/${id}`);
  },

  /**
   * Get current employee profile
   * @returns {Promise}
   */
  getProfile: () => {
    return api.get('/employees/profile/me');
  },

  /**
   * Update current employee profile
   * @param {object} profileData - Profile data
   * @returns {Promise}
   */
  updateProfile: (profileData) => {
    return api.put('/employees/profile/me', profileData);
  },
};

export default employeeService;
