export const EMPLOYEE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  TERMINATED: 'terminated',
  ON_LEAVE: 'on_leave'
};

export const EMPLOYEE_TYPES = {
  PERMANENT: 'permanent',
  CONTRACT: 'contract',
  PROBATION: 'probation',
  TEMPORARY: 'temporary'
};

export const LEAVE_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

export const LEAVE_TYPES = {
  ANNUAL: 'annual',
  SICK: 'sick',
  PERSONAL: 'personal',
  MATERNITY: 'maternity',
  PATERNITY: 'paternity',
  UNPAID: 'unpaid'
};

export const USER_ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  SUPERVISOR: 'supervisor',
  CEO: 'ceo',
  EMPLOYEE: 'employee'
};

export const APPROVAL_FLOW = {
  SUPERVISOR_ONLY: 'supervisor',
  SUPERVISOR_THEN_HR: 'supervisor_then_hr',
  SUPERVISOR_THEN_CEO: 'supervisor_then_ceo',
  SUPERVISOR_THEN_HR_THEN_CEO: 'supervisor_then_hr_then_ceo'
};