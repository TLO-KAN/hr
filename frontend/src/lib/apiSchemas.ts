/**
 * API Response Validation Schemas
 * Ensures all backend responses match expected structure
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface EmployeeData {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  department_id?: string;
  department_name?: string;
  position_id?: string;
  position_name?: string;
  gender?: string;
  status: 'active' | 'inactive' | 'resigned';
  years_of_service?: number;
  start_date?: string;
  phone?: string;
  salary?: number;
}

export interface LeaveRequestData {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approval_notes?: string;
  created_at: string;
  updated_at: string;
  // From JOIN
  employee?: EmployeeData;
  first_name?: string;
  last_name?: string;
  employee_code?: string;
}

export interface LeaveEntitlementData {
  id: string;
  employee_id: string;
  year: number;
  leave_type: string;
  annual_quota: number;
  prorated_quota?: number;
  used_days: number;
  remaining_days: number;
}

export interface DepartmentData {
  id: string;
  name: string;
  description?: string;
  head_id?: string;
  head_name?: string;
  budget?: number;
  created_at?: string;
}

export interface HolidayData {
  id: string;
  holiday_date: string; // YYYY-MM-DD
  name: string;
  description?: string;
  is_recurring: boolean;
  created_at?: string;
}

/**
 * Validate API response structure
 * Throws error if response is missing required fields
 */
export function validateApiResponse<T>(
  response: any,
  expectedFields?: (keyof T)[]
): ApiResponse<T> {
  if (!response) {
    throw new Error('Empty response from server');
  }

  if (typeof response.success !== 'boolean') {
    throw new Error('Invalid response format: missing success field');
  }

  if (!response.success && !response.error) {
    throw new Error('Error response without error message');
  }

  // Validate data if expected fields are provided
  if (response.data && expectedFields) {
    const data = response.data;
    const missing = expectedFields.filter((field) => !(field in (Array.isArray(data) ? data[0] : data)));
    if (missing.length > 0) {
      console.warn(`Missing fields in API response: ${missing.join(', ')}`);
    }
  }

  return response as ApiResponse<T>;
}

/**
 * Validate pagination response
 */
export function validatePaginationResponse<T>(
  response: any
): ApiResponse<T> {
  const v = validateApiResponse<T>(response);

  if (!response.pagination) {
    throw new Error('List response missing pagination info');
  }

  const { limit, offset, total } = response.pagination;
  if (typeof limit !== 'number' || typeof offset !== 'number' || typeof total !== 'number') {
    throw new Error('Invalid pagination structure');
  }

  return v;
}
