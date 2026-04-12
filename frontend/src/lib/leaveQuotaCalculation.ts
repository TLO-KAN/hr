import type { EmployeeType } from '@/types/hr';
import { API_BASE_URL } from '@/config/api';

export type PolicyMode = 'accrual' | 'stepup';

export interface LeaveQuotaPreview {
  annual_leave_quota: number;
  sick_leave_quota: number;
  personal_leave_quota: number;
  probationEndDate: string | null;
  tenureYears: number;
  tenureMonths: number;
  policyMode: PolicyMode;
  baseQuotaDays: number;
  monthlyAccrualRate: number | null;
  proratePercent: number;
  helperText: string;
  calculationDetails: string;
}

/** Round down to nearest 0.5 */
export function roundHalfDown(value: number): number {
  return Math.floor(value * 2) / 2;
}

/**
 * Calculate leave quotas in real-time from backend Hybrid policy engine.
 * Calls GET /api/v1/leave-calculation/prorate-preview
 */
export async function calculateLeaveQuotas(
  employeeType: EmployeeType,
  startDate: string,
): Promise<LeaveQuotaPreview> {
  const defaultResult: LeaveQuotaPreview = {
    annual_leave_quota: 6,
    sick_leave_quota: 30,
    personal_leave_quota: 3,
    probationEndDate: null,
    tenureYears: 0,
    tenureMonths: 0,
    policyMode: 'accrual',
    baseQuotaDays: 6,
    monthlyAccrualRate: 0.5,
    proratePercent: 100,
    helperText: '',
    calculationDetails: '',
  };

  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({
      startDate,
      employeeType,
      year: String(new Date().getFullYear()),
    });
    const response = await fetch(
      `${API_BASE_URL}/api/v1/leave-calculation/prorate-preview?${params}`,
      {
        headers: { Authorization: `Bearer ${token || ''}` },
      }
    );

    if (!response.ok) {
      throw new Error('preview failed');
    }

    const json = await response.json();
    const data = json.data ?? json;

    return {
      annual_leave_quota: roundHalfDown(Number(data.entitledDays ?? data.annual_leave_quota ?? 6)),
      sick_leave_quota: Number(data.sick_leave_quota ?? 30),
      personal_leave_quota: Number(data.personal_leave_quota ?? 3),
      probationEndDate: data.probationEndDate ?? null,
      tenureYears: Number(data.tenureYears ?? 0),
      tenureMonths: Number(data.tenureMonths ?? 0),
      policyMode: (data.policyMode ?? 'accrual') as PolicyMode,
      baseQuotaDays: Number(data.baseQuotaDays ?? 6),
      monthlyAccrualRate: data.monthlyAccrualRate != null ? Number(data.monthlyAccrualRate) : null,
      proratePercent: Number(data.proratePercent ?? 100),
      helperText: data.helperText ?? '',
      calculationDetails: data.calculationDetails ?? '',
    };
  } catch {
    return defaultResult;
  }
}
