import axios from 'axios';
import { API_ORIGIN, API_PREFIX } from '@/config/api';

/**
 * Centralized Axios Instance
 * 
 * Features:
 * - Automatic JWT token injection from localStorage
 * - Global error handling (401 redirects to login)
 * - BaseURL from environment variable (VITE_API_URL)
 */

const api = axios.create({
  baseURL: `${API_ORIGIN}${API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor: Add JWT Token
 * Automatically attaches the JWT token from localStorage to Authorization header
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor: Handle Global Errors
 * - 401 Unauthorized: Clear auth and redirect to login
 * - 403 Forbidden: Show permission error
 * - 500 Server Error: Generic error handling
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('permissions');
      
      // Redirect to login (assuming '/login' route exists)
      window.location.href = '/login';
      
      return Promise.reject(new Error('Session expired. Please login again.'));
    }

    if (error.response?.status === 403) {
      return Promise.reject(new Error('You do not have permission to access this resource.'));
    }

    if (error.response?.status === 429) {
      // Rate limit exceeded
      const retryAfter = error.response.data?.retryAfter || 60;
      return Promise.reject(
        new Error(`Too many requests. Please try again in ${retryAfter} seconds.`)
      );
    }

    if (error.response?.status >= 500) {
      return Promise.reject(new Error('Server error. Please try again later.'));
    }

    // Return API error message if available, otherwise use default error
    return Promise.reject(
      error.response?.data?.error || error.message || 'An error occurred'
    );
  }
);

export default api;
