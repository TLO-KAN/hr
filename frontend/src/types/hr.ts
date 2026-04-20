export type AppRole = 'admin' | 'hr' | 'manager' | 'supervisor' | 'employee' | 'ceo';

export type EmployeeStatus = 'active' | 'resigned' | 'suspended';

export type EmployeeType = 'permanent' | 'contract' | 'parttime';

export type LeaveType = 'sick' | 'personal' | 'vacation' | 'unpaid' | 'emergency' | 'other' | 'maternity' | 'paternity';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  name: string;
  department_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
}

export interface Employee {
  id: string;
  user_id: string | null;
  employee_code: string;
  prefix: string | null;
  first_name: string;
  last_name: string;
  first_name_en?: string | null;
  last_name_en?: string | null;
  nickname?: string | null;
  id_card_number: string | null;
  birth_date: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  position_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  employee_type: EmployeeType;
  start_date: string;
  end_date?: string | null;
  probation_end_date?: string | null;
  status: EmployeeStatus;
  annual_leave_quota: number;
  sick_leave_quota: number;
  personal_leave_quota: number;
  other_leave_quota: number;
  role?: AppRole;
  created_at: string;
  updated_at: string;
  position?: Position | string | null;
  department?: Department | string | null;
  position_name?: string | null;
  department_name?: string | null;
  manager?: Employee;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  attachment_url: string | null;
  status: LeaveStatus;
  approver_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  start_time?: string | null;
  end_time?: string | null;
  is_half_day?: boolean;
  half_day_period?: 'morning' | 'afternoon' | null;
  approver_first_name?: string | null;
  approver_last_name?: string | null;
  attachments?: Array<{
    id: string | number;
    file_name: string;
    file_path: string;
    file_size?: number;
    mime_type?: string;
    uploaded_at?: string;
  }>;
  employee?: Employee;
  approver?: Employee;
}

export interface LeaveBalance {
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  annual_leave_quota: number;
  sick_leave_quota: number;
  personal_leave_quota: number;
  other_leave_quota: number;
  vacation_used: number;
  sick_used: number;
  personal_used: number;
  other_used: number;
}

export interface LeavePolicyRule {
  id: string;
  employee_type: EmployeeType;
  employee_status?: EmployeeStatus;
  min_years_of_service: number;
  max_years_of_service: number | null;
  annual_leave_quota: number;
  sick_leave_quota: number;
  personal_leave_quota: number;
  other_leave_quota: number;
  maternity_leave_quota: number;
  paternity_leave_quota?: number;
  is_prorated: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveEntitlement {
  id: string;
  employee_id: string;
  year: number;
  leave_type: LeaveType;
  base_quota: number;
  prorated_quota: number;
  entitled_days?: number;
  balance_days?: number;
  total_entitlement?: number;
  used_days: number;
  remaining_days: number;
  calculation_date: string;
  policy_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PolicyAuditLog {
  id: string;
  policy_id: string;
  action: 'create' | 'update' | 'delete';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by: string;
  changed_at: string;
  year: number;
}

export interface ApprovalWorkflow {
  id: string;
  leave_type: LeaveType;
  approval_levels: number;
  min_days: number | null;
  max_days: number | null;
  requires_hr: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Profile {
  id: string;
  employee_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Thai translations
export const leaveTypeLabels: Record<LeaveType, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจได้รับค่าจ้าง',
  vacation: 'ลาพักผ่อน',
  unpaid: 'ลากิจไม่รับค่าจ้าง',
  emergency: 'ลาฉุกเฉิน',
  other: 'ลาอื่นๆ',
  maternity: 'ลาคลอด',
  paternity: 'ลาช่วยภรรยาคลอด',
};

export const leaveStatusLabels: Record<LeaveStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติ',
  rejected: 'ไม่อนุมัติ',
  cancelled: 'ยกเลิก',
};

export const employeeStatusLabels: Record<EmployeeStatus, string> = {
  active: 'ทำงาน',
  resigned: 'ลาออก',
  suspended: 'พักงาน',
};

export const employeeTypeLabels: Record<EmployeeType, string> = {
  permanent: 'ประจำ',
  contract: 'สัญญาจ้าง/ทดลองงาน',
  parttime: 'พาร์ทไทม์',
};

export const roleLabels: Record<AppRole, string> = {
  admin: 'CEO/ผู้ดูแลระบบ',
  hr: 'HR',
  manager: 'ผู้จัดการ',
  supervisor: 'หัวหน้างาน',
  employee: 'พนักงาน',
  ceo: 'ผู้บริหาร',
};
