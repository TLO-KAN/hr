import { isWeekend, eachDayOfInterval, parseISO, format, differenceInCalendarDays, startOfDay, addDays, isAfter, isBefore } from 'date-fns';
import type { LeaveType } from '@/types/hr';
import { API_BASE_URL } from '@/config/api';

interface CompanyHoliday {
  holiday_date?: string;
  date?: string;
}

const LEAVE_RULES_KEY = 'company_leave_validation_rules';

export interface LeaveValidationResult {
  isValid: boolean;
  workingDays: number;
  message?: string;
  requiresSpecialApproval?: boolean;
  warnings?: string[];
}

// Business rules configuration - default values (can be overridden from database)
export const LEAVE_BUSINESS_RULES = {
  vacation: {
    advanceNoticeDays: 3, // ต้องแจ้งล่วงหน้า 3 วัน
    allowBackdated: false,
    backdatedMaxDays: 0,
  },
  sick: {
    advanceNoticeDays: 0,
    allowBackdated: true,
    backdatedMaxDays: 7, // ย้อนหลังได้ 7 วัน (1 สัปดาห์)
  },
  personal: {
    advanceNoticeDays: 1, // ต้องแจ้งล่วงหน้า 1 วัน
    allowBackdated: false,
    backdatedMaxDays: 0,
  },
  maternity: {
    advanceNoticeDays: 7,
    allowBackdated: false,
    backdatedMaxDays: 0,
  },
  paternity: {
    advanceNoticeDays: 3,
    allowBackdated: false,
    backdatedMaxDays: 0,
  },
  unpaid: {
    advanceNoticeDays: 3,
    allowBackdated: false,
    backdatedMaxDays: 0,
  },
  emergency: {
    advanceNoticeDays: 0,
    allowBackdated: false,
    backdatedMaxDays: 0,
  },
  other: {
    advanceNoticeDays: 1,
    allowBackdated: true,
    backdatedMaxDays: 1,
  },
};

/**
 * Fetches leave validation rules from company settings
 */
export async function fetchLeaveValidationRules(): Promise<typeof LEAVE_BUSINESS_RULES> {
  try {
    const raw = localStorage.getItem(LEAVE_RULES_KEY);
    if (raw) {
      const dbRules = JSON.parse(raw) as Record<string, { advance_days?: number; retroactive_days?: number }>;
      
      // Merge with defaults
      return {
        ...LEAVE_BUSINESS_RULES,
        vacation: {
          ...LEAVE_BUSINESS_RULES.vacation,
          advanceNoticeDays: dbRules.vacation?.advance_days ?? 3,
        },
        personal: {
          ...LEAVE_BUSINESS_RULES.personal,
          advanceNoticeDays: dbRules.personal?.advance_days ?? 1,
        },
        sick: {
          ...LEAVE_BUSINESS_RULES.sick,
          backdatedMaxDays: dbRules.sick?.retroactive_days ?? 7,
        },
      };
    }
  } catch (error) {
    console.error('Error fetching leave rules:', error);
  }
  
  return LEAVE_BUSINESS_RULES;
}

/**
 * Fetches company holidays for a given date range
 */
export async function fetchCompanyHolidays(startDate: string, endDate: string): Promise<Set<string>> {
  const holidaySet = new Set<string>();
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/api/v1/holidays`, {
      headers: {
        Authorization: `Bearer ${token || ''}`,
      },
    });

    if (!res.ok) return holidaySet;
    const payload = await res.json();
    const data = payload?.data || [];

    data.forEach((h: CompanyHoliday) => {
      const holidayDate = h.holiday_date || h.date;
      if (holidayDate && holidayDate >= startDate && holidayDate <= endDate) {
        holidaySet.add(holidayDate);
      }
    });
  } catch {
    // Fall back to no holiday list if API is unavailable.
  }

  return holidaySet;
}

/**
 * Calculates the number of working days between two dates
 * Excludes weekends (Saturday & Sunday) and company holidays
 */
export async function calculateWorkingDays(startDate: string, endDate: string): Promise<number> {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  if (start > end) return 0;

  // Get all company holidays in the date range
  const holidays = await fetchCompanyHolidays(startDate, endDate);

  // Get all days in the range
  const allDays = eachDayOfInterval({ start, end });

  // Count working days (not weekend and not holiday)
  let workingDays = 0;
  for (const day of allDays) {
    if (!isWeekend(day)) {
      const dateStr = format(day, 'yyyy-MM-dd');
      if (!holidays.has(dateStr)) {
        workingDays++;
      }
    }
  }

  return workingDays;
}

/**
 * Calculates the number of working days between two dates (excluding today)
 * Used for checking advance notice requirements
 */
export async function calculateWorkingDaysUntil(targetDate: string): Promise<number> {
  const today = startOfDay(new Date());
  const target = parseISO(targetDate);
  
  if (isBefore(target, today)) return -1; // Past date
  if (format(today, 'yyyy-MM-dd') === targetDate) return 0; // Same day

  const tomorrow = addDays(today, 1);
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
  
  return calculateWorkingDays(tomorrowStr, targetDate);
}

/**
 * Validates if a leave request complies with business rules
 */
export async function validateLeaveRequest(
  startDate: string, 
  endDate: string,
  leaveType?: LeaveType,
  remainingBalance?: number,
  isHalfDay?: boolean,
  startTime?: string,
  endTime?: string
): Promise<LeaveValidationResult> {
  const warnings: string[] = [];
  let requiresSpecialApproval = false;

  // Fetch rules from database (with fallback to defaults)
  const rules = await fetchLeaveValidationRules();

  // Calculate working days
  const workingDays = await calculateWorkingDays(startDate, endDate);

  if (workingDays <= 0) {
    return {
      isValid: false,
      workingDays: 0,
      message: 'ช่วงวันที่เลือกไม่มีวันทำงาน (อาจเป็นวันหยุดสุดสัปดาห์หรือวันหยุดบริษัททั้งหมด)',
    };
  }

  // If leave type is provided, apply business rules
  if (leaveType && rules[leaveType]) {
    const leaveRules = rules[leaveType];
    const today = startOfDay(new Date());
    const start = parseISO(startDate);
    const todayStr = format(today, 'yyyy-MM-dd');

    // Check if start date is today (same day leave)
    if (startDate === todayStr) {
      // Sick + Emergency leave allows same-day
      if (leaveType === 'sick' || leaveType === 'emergency') {
        // Allow sick leave for today - no blocking
      } else if (leaveType === 'vacation') {
        return {
          isValid: false,
          workingDays,
          message: 'ลาพักร้อนไม่สามารถลาวันเดียวกันได้ ต้องแจ้งล่วงหน้าอย่างน้อย 3 วันทำงาน',
        };
      } else if (leaveType === 'personal') {
        return {
          isValid: false,
          workingDays,
          message: 'ลากิจไม่สามารถลาวันเดียวกันได้ ต้องแจ้งล่วงหน้าอย่างน้อย 1 วันทำงาน',
        };
      } else if (leaveType === 'maternity' || leaveType === 'paternity') {
        return {
          isValid: false,
          workingDays,
          message: 'การลาคลอด/ลาช่วยภรรยาคลอดต้องแจ้งล่วงหน้า',
        };
      }
      // Other types may allow same-day with warning
    }

    // Check if start date is in the past (backdated leave)
    if (isBefore(start, today)) {
      if (!leaveRules.allowBackdated) {
        return {
          isValid: false,
          workingDays,
          message: `การลาประเภท${getLeaveTypeName(leaveType)}ไม่สามารถขอย้อนหลังได้`,
        };
      }

      // Check how many calendar days backdated (simpler calculation)
      const daysDiff = differenceInCalendarDays(today, start);
      
      if (daysDiff > leaveRules.backdatedMaxDays) {
        return {
          isValid: false,
          workingDays,
          message: `การลาประเภท${getLeaveTypeName(leaveType)}สามารถขอย้อนหลังได้ไม่เกิน ${leaveRules.backdatedMaxDays} วัน`,
        };
      }

      warnings.push(`ลาย้อนหลัง ${daysDiff} วัน`);
    }

    // Check advance notice requirement (only for future dates, not same day which is already handled)
    if (leaveRules.advanceNoticeDays > 0 && isAfter(start, today)) {
      const daysUntilLeave = await calculateWorkingDaysUntil(startDate);
      
      if (daysUntilLeave < leaveRules.advanceNoticeDays) {
        // For vacation, this is a hard rule - block submission
        if (leaveType === 'vacation') {
          return {
            isValid: false,
            workingDays,
            message: `ลาพักร้อนต้องแจ้งล่วงหน้าอย่างน้อย ${leaveRules.advanceNoticeDays} วันทำงาน`,
          };
        }
        
        // For personal leave, also block but with different message
        if (leaveType === 'personal') {
          return {
            isValid: false,
            workingDays,
            message: `ลากิจต้องแจ้งล่วงหน้าอย่างน้อย ${leaveRules.advanceNoticeDays} วันทำงาน`,
          };
        }
        
        // For other types, just add warning
        const warningMsg = `ควรแจ้งล่วงหน้าอย่างน้อย ${leaveRules.advanceNoticeDays} วันทำงาน (แจ้งล่วงหน้า ${daysUntilLeave} วัน)`;
        warnings.push(warningMsg);
      }
    }
  }

  // Check if exceeding balance (requires special approval)
  if (remainingBalance !== undefined && workingDays > remainingBalance) {
    requiresSpecialApproval = true;
    warnings.push(`เกินสิทธิ์วันลาคงเหลือ (${remainingBalance} วัน) ต้องขออนุมัติพิเศษ`);
  }

  return {
    isValid: true,
    workingDays,
    requiresSpecialApproval,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Get Thai name for leave type
 */
function getLeaveTypeName(leaveType: LeaveType): string {
  const names: Record<LeaveType, string> = {
    sick: 'ลาป่วย',
    personal: 'ลากิจได้รับค่าจ้าง',
    vacation: 'ลาพักผ่อน',
    unpaid: 'ลากิจไม่รับค่าจ้าง',
    emergency: 'ลาฉุกเฉิน',
    other: 'ลาอื่นๆ',
    maternity: 'ลาคลอด',
    paternity: 'ลาช่วยภรรยาคลอด',
  };
  return names[leaveType] || leaveType;
}

/**
 * Calculate partial day based on time selection
 */
export function calculatePartialDay(
  startTime: string,
  endTime: string,
  workingHours: { start_time: string; end_time: string; break_start: string; break_end: string; working_hours_per_day: number }
): number {
  // Parse times
  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const workStart = parseTime(workingHours.start_time);
  const workEnd = parseTime(workingHours.end_time);
  const breakStart = parseTime(workingHours.break_start);
  const breakEnd = parseTime(workingHours.break_end);
  
  const leaveStart = parseTime(startTime);
  const leaveEnd = parseTime(endTime);

  // Calculate total working minutes (excluding break)
  const totalWorkMinutes = (workEnd - workStart) - (breakEnd - breakStart);
  
  // Calculate leave minutes (accounting for break time)
  let leaveMinutes = leaveEnd - leaveStart;
  
  // Subtract break time if leave spans break period
  if (leaveStart < breakEnd && leaveEnd > breakStart) {
    const overlapStart = Math.max(leaveStart, breakStart);
    const overlapEnd = Math.min(leaveEnd, breakEnd);
    leaveMinutes -= (overlapEnd - overlapStart);
  }

  // Calculate as fraction of day
  const fraction = leaveMinutes / totalWorkMinutes;
  
  // Round to nearest 0.5
  return Math.round(fraction * 2) / 2;
}
