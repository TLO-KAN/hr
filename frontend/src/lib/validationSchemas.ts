/**
 * Zod Schema Validation Library
 * Provides runtime validation for all API request/response data
 * 
 * Install: npm install zod
 */

import { z } from 'zod';

// ============= EMPLOYEE SCHEMAS =============

export const EmployeeSchema = z.object({
  id: z.string().uuid().optional(),
  employee_code: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  department_id: z.string().uuid().optional(),
  department_name: z.string().optional(),
  position_id: z.string().uuid().optional(),
  position_name: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  start_date: z.string().date().optional(),
  status: z.enum(['active', 'inactive', 'resigned']),
  phone: z.string().optional(),
  salary: z.number().positive().optional(),
});

export type Employee = z.infer<typeof EmployeeSchema>;

// ============= LEAVE SCHEMAS =============

export const LeaveTypeSchema = z.enum(['vacation', 'sick', 'personal', 'maternity', 'paternity']);

export const LeaveRequestSchema = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  leave_type: LeaveTypeSchema,
  start_date: z.string().date(),
  end_date: z.string().date(),
  total_days: z.number().positive(),
  reason: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']),
  approval_notes: z.string().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
}).refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
  message: 'End date must be after or equal to start date',
  path: ['end_date'],
});

export type LeaveRequest = z.infer<typeof LeaveRequestSchema>;

export const CreateLeaveRequestSchema = z.object({
  employee_id: z.string().uuid(),
  leave_type: LeaveTypeSchema,
  start_date: z.string().date(),
  end_date: z.string().date(),
  total_days: z.number().positive(),
  reason: z.string().optional(),
  approval_notes: z.string().optional(),
}).refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
  message: 'End date must be after or equal to start date',
  path: ['end_date'],
});

// ============= DEPARTMENT SCHEMAS =============

export const DepartmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  head_id: z.string().uuid().optional(),
  head_name: z.string().optional(),
  budget: z.number().optional(),
  created_at: z.string().datetime().optional(),
});

export type Department = z.infer<typeof DepartmentSchema>;

// ============= HOLIDAY SCHEMAS =============

export const HolidaySchema = z.object({
  id: z.string().uuid().optional(),
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  name: z.string().min(1),
  description: z.string().optional(),
  is_recurring: z.boolean().default(false),
  created_at: z.string().datetime().optional(),
});

export type Holiday = z.infer<typeof HolidaySchema>;

// ============= REQUEST/RESPONSE SCHEMAS =============

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
  }).optional(),
});

export type ApiResponse<T = any> = z.infer<typeof ApiResponseSchema> & { data?: T };

export const PaginatedResponseSchema = ApiResponseSchema.extend({
  pagination: z.object({
    limit: z.number().positive(),
    offset: z.number().nonnegative(),
    total: z.number().nonnegative(),
  }),
});

/**
 * Validation helper function
 * Validates data against schema and throws detailed error
 */
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      throw new Error(`Validation failed: ${messages}`);
    }
    throw error;
  }
}

/**
 * Safe validation (returns null on error instead of throwing)
 */
export function safeValidateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | null {
  try {
    return schema.parse(data);
  } catch {
    return null;
  }
}
