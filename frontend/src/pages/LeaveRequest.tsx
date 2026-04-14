import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Plus, X, FileText, Baby, Heart, Info, AlertTriangle, Loader2, AlertCircle, Tooltip } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { LeaveRequest, LeaveType, LeaveEntitlement } from '@/types/hr';
import { leaveTypeLabels } from '@/types/hr';
import { format } from 'date-fns';
import { sanitizeReason } from '@/lib/textSanitizer';
import { th } from 'date-fns/locale';
import { validateLeaveRequest } from '@/lib/leaveCalculation';
import { LeaveRulesInfo } from '@/components/leave/LeaveRulesInfo';
import { buildApiUrl } from '@/config/api';
import { LeaveTimeSelector } from '@/components/leave/LeaveTimeSelector';

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];


interface LeaveBalanceItem {
  key: LeaveType;
  label: string;
  color: string;
  icon?: React.ElementType;
  quota: number;
  used: number;
  remaining: number;
  isProrated: boolean;
}

interface LeaveTypeOption {
  code: string;
  name: string;
  is_active?: boolean;
  active?: boolean;
}

const resolveBalanceKey = (leaveType: string): string => {
  if (leaveType === 'annual') return 'vacation';
  if (leaveType === 'emergency') return 'personal';
  return leaveType;
};

export default function LeaveRequestPage() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntitlements, setLoadingEntitlements] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [entitlements, setEntitlements] = useState<LeaveEntitlement[]>([]);
  const [balanceCards, setBalanceCards] = useState<LeaveBalanceItem[]>([]);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<LeaveTypeOption[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | undefined>(undefined);
  const [pendingLeavesByType, setPendingLeavesByType] = useState<Record<string, number>>({});
  const [entitlementError, setEntitlementError] = useState<string | null>(null);
  
  // Time selection states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'morning' | 'afternoon' | null>(null);
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('17:30');
  const [calculatedPartialDays, setCalculatedPartialDays] = useState(1);
  
  // Validation states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [calculatedWorkingDays, setCalculatedWorkingDays] = useState<number>(0);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const isSingleDay = startDate && endDate && startDate === endDate;
  const isDateRangeInvalid = Boolean(startDate && endDate && new Date(startDate) > new Date(endDate));
  const employmentDays = employee?.start_date
    ? Math.max(0, Math.floor((new Date().getTime() - new Date(employee.start_date).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isProbationEmployee = String(employee?.employee_type || '').toLowerCase() === 'probation';
  const isFemaleEmployee = employee?.gender && ['female', 'f', 'หญิง'].includes(String(employee.gender).toLowerCase());
  const isInactiveStatus = String(employee?.status || '').toLowerCase() !== 'active';
  const canSubmitLeaveRequest = Boolean(
    employee &&
      !isInactiveStatus &&
      (!isProbationEmployee || employmentDays >= 119)
  );

  const selectedBalance = selectedLeaveType
    ? balanceCards.find((b) => b.key === resolveBalanceKey(selectedLeaveType))
    : undefined;
  const requestedDaysPreview = isSingleDay ? calculatedPartialDays : calculatedWorkingDays;
  const remainingAfterRequest = selectedBalance
    ? Number((selectedBalance.remaining - requestedDaysPreview).toFixed(1))
    : null;

  let leaveLockReason: string | null = null;
  if (isInactiveStatus) {
    leaveLockReason = 'ไม่สามารถยื่นลาได้ เนื่องจากสถานะพนักงานไม่ใช่ทำงาน';
  } else if (isProbationEmployee && employmentDays < 119) {
    leaveLockReason = `ไม่สามารถยื่นลาได้จนกว่าจะครบ 119 วัน (ปัจจุบัน ${employmentDays} วัน)`;
  }

  // Helper function to get progress bar color based on usage percentage
  const getProgressBarColor = (used: number, quota: number): string => {
    if (quota === 0) return 'bg-muted';
    const percentage = (used / quota) * 100;
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 75) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Helper function to calculate eligible vacation date (119 days from start)
  const getEligibleVacationDate = (): string => {
    if (!employee?.start_date) return '';
    const eligible = new Date(employee.start_date);
    eligible.setDate(eligible.getDate() + 119);
    return format(eligible, 'd MMM yyyy', { locale: th });
  };

  // Check if it's Nov or Dec for year-end notice
  const isYearEndPeriod = () => {
    const month = new Date().getMonth();
    return month === 10 || month === 11; // Oct (10) or Nov (11)
  };

  // Real-time validation when dates or leave type changes
  useEffect(() => {
    const validateForm = async () => {
      if (!startDate || !endDate || !selectedLeaveType) {
        setValidationError(null);
        setValidationWarnings([]);
        setCalculatedWorkingDays(0);
        return;
      }

      setIsValidating(true);
      try {
        const balance = balanceCards.find(b => b.key === resolveBalanceKey(selectedLeaveType));
        const remainingBalance = balance?.remaining;
        
        const validation = await validateLeaveRequest(
          startDate, 
          endDate, 
          selectedLeaveType, 
          remainingBalance,
          isHalfDay,
          startTime,
          endTime
        );
        
        if (!validation.isValid) {
          setValidationError(validation.message || 'ไม่สามารถยื่นคำขอลาได้');
          setCalculatedWorkingDays(0);
        } else {
          setValidationError(null);
          // For single day, use calculated partial days
          if (isSingleDay) {
            setCalculatedWorkingDays(calculatedPartialDays);
          } else {
            setCalculatedWorkingDays(validation.workingDays);
          }
        }
        
        setValidationWarnings(validation.warnings || []);
      } catch (error) {
        console.error('Validation error:', error);
      } finally {
        setIsValidating(false);
      }
    };

    validateForm();
  }, [startDate, endDate, selectedLeaveType, balanceCards, isHalfDay, startTime, endTime, calculatedPartialDays, isSingleDay]);

  useEffect(() => {
    if (employee) {
      fetchLeaveRequests();
      fetchEntitlements();
      fetchLeaveTypes();
    }
  }, [employee]);

  const fetchLeaveTypes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(buildApiUrl('/leave-types'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        console.warn('Failed to fetch leave types:', res.status);
        setLeaveTypeOptions([]);
        return;
      }

      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      setLeaveTypeOptions(rows);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      setLeaveTypeOptions([]);
    }
  };

  const fetchLeaveRequests = async () => {
    if (!employee) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(buildApiUrl('/leave-requests/my-requests'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch leave requests');
      const data = await res.json();
      const requests = Array.isArray(data) ? data : (data?.data || []);
      setLeaveRequests(requests);

      // Calculate pending leaves by type
      const pendingCounts: Record<string, number> = {};
      requests.forEach((leave: LeaveRequest) => {
        if (leave.status === 'pending') {
          pendingCounts[leave.leave_type] = (pendingCounts[leave.leave_type] || 0) + leave.total_days;
        }
      });
      setPendingLeavesByType(pendingCounts);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntitlements = async () => {
    if (!employee) {
      console.log('⏭️ Skipping entitlements fetch - no employee data');
      return;
    }
    
    try {
      setLoadingEntitlements(true);
      setEntitlementError(null);
      
      const token = localStorage.getItem('token');
      console.log('🔍 Fetching entitlements with token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
      
      const res = await fetch(buildApiUrl('/leave-entitlements/my'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('📡 API Response Status:', res.status, res.statusText);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ API Error Response:', errorText);
        setEntitlementError(`API Error: ${res.status} ${res.statusText}`);
        setBalanceCards([]);
        return;
      }

      const data = await res.json();
      const rows = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      console.log('✅ API Response Data rows:', rows);

      setEntitlements(rows);
      buildBalanceCards(rows);
    } catch (error) {
      console.error('🚨 Error fetching entitlements:', error);
      setEntitlementError(error instanceof Error ? error.message : 'Unknown error fetching entitlements');
      setBalanceCards([]);
    } finally {
      setLoadingEntitlements(false);
    }
  };

  const buildBalanceCards = (data: LeaveEntitlement[]) => {
    console.log('📊 buildBalanceCards called');
    console.log('  - Data length:', data?.length);
    console.log('  - Data type:', Array.isArray(data) ? 'array' : typeof data);
    console.log('  - Employee:', employee?.id, employee?.first_name, employee?.last_name);
    console.log('  - Gender:', employee?.gender);
    
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('⚠️ No entitlement data received');
      setBalanceCards([]);
      return;
    }
    
    const leaveTypeConfig: Record<string, { label: string; color: string; icon?: React.ElementType; order: number }> = {
      vacation: { label: 'ลาพักร้อน', color: 'bg-info', order: 1 },
      sick: { label: 'ลาป่วย', color: 'bg-warning', order: 2 },
      personal: { label: 'ลากิจ', color: 'bg-success', order: 3 },
      emergency: { label: 'ลาฉุกเฉิน', color: 'bg-red-500', order: 4 },
      unpaid: { label: 'ลากิจไม่รับค่าจ้าง', color: 'bg-muted-foreground', order: 5 },
      maternity: { label: 'ลาคลอด', color: 'bg-pink-500', icon: Baby, order: 4 },
      paternity: { label: 'ลาช่วยภรรยาคลอด', color: 'bg-blue-500', icon: Heart, order: 5 },
      other: { label: 'ลาอื่นๆ', color: 'bg-muted-foreground', order: 6 },
    };

    // Check if employee is female - show maternity leave only for female employees
    const isFemale = employee?.gender && ['female', 'f', 'หญิง'].includes(String(employee.gender).toLowerCase());
    console.log('👥 Employee gender check:', { gender: employee?.gender, isFemale });
    console.log('📋 Raw data from API:', JSON.stringify(data, null, 2));

    const cards: LeaveBalanceItem[] = data
      .filter((ent, index) => {
        const quota = Number(ent.prorated_quota ?? ent.entitled_days ?? ent.balance_days ?? 0);
        const isValidQuota = quota > 0;
        const isMaternityleaveFemale = ent.leave_type === 'maternity' ? isFemale : true;
        const isPaternity = ent.leave_type === 'paternity';
        const shouldInclude = isValidQuota && isMaternityleaveFemale && !isPaternity;
        
        if (!shouldInclude) {
          console.log(`⊘ Filtering out [${index}]:`, {
            leave_type: ent.leave_type,
            quota: ent.prorated_quota,
            isValidQuota,
            isMaternityleaveFemale,
            isPaternity,
          });
        }
        return shouldInclude;
      })
      .map((ent, index) => {
        const balanceKey = resolveBalanceKey(ent.leave_type);
        const card: LeaveBalanceItem = {
          key: balanceKey as LeaveType,
          label: leaveTypeConfig[balanceKey]?.label || ent.leave_type,
          color: leaveTypeConfig[balanceKey]?.color || 'bg-muted',
          icon: leaveTypeConfig[balanceKey]?.icon,
          quota: Number(ent.prorated_quota ?? ent.entitled_days ?? ent.balance_days ?? 0),
          used: Number(ent.used_days ?? 0),
          remaining: Number(ent.remaining_days ?? ent.balance_days ?? 0),
          isProrated: Number(ent.base_quota ?? ent.total_entitlement ?? 0) !== Number(ent.prorated_quota ?? ent.entitled_days ?? ent.balance_days ?? 0),
        };
        console.log(`✓ Card [${index}]:`, card);
        return card;
      })
      .sort((a, b) => (leaveTypeConfig[a.key]?.order || 99) - (leaveTypeConfig[b.key]?.order || 99));

    console.log(`✅ Cards built successfully: ${cards.length} cards`);
    cards.forEach((c, i) => console.log(`  Card ${i + 1}: ${c.label} - ${c.remaining}/${c.quota}`));
    
    setBalanceCards(cards);
  };

  const handleSubmitLeave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!employee) return;

    if (isDateRangeInvalid) {
      toast({
        title: 'ช่วงวันที่ไม่ถูกต้อง',
        description: 'วันที่เริ่มลาต้องไม่มากกว่าวันที่สิ้นสุดการลา',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData(e.currentTarget);
    const leaveType = selectedLeaveType || (formData.get('leave_type') as LeaveType | null) || undefined;
    if (!leaveType) {
      toast({
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณาเลือกประเภทการลา',
        variant: 'destructive',
      });
      return;
    }
    
    // Get remaining balance for this leave type
    const balance = balanceCards.find(b => b.key === leaveType);
    const remainingBalance = balance?.remaining;

    // Validate with business rules (including advance notice, backdated rules)
    const validation = await validateLeaveRequest(startDate, endDate, leaveType, remainingBalance);

    if (!validation.isValid) {
      toast({
        title: 'ไม่สามารถยื่นคำขอลาได้',
        description: validation.message || 'กรุณาตรวจสอบช่วงวันลาอีกครั้ง',
        variant: 'destructive',
      });
      return;
    }

    // Calculate total days based on selection
    let totalDays = validation.workingDays;
    if (isSingleDay) {
      totalDays = calculatedPartialDays;
    }

    // Show warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      const warningMessage = validation.warnings.join('\n');
      if (validation.requiresSpecialApproval) {
        if (!confirm(`⚠️ คำเตือน:\n${warningMessage}\n\nต้องการดำเนินการต่อหรือไม่?`)) {
          return;
        }
      } else {
        toast({
          title: 'คำเตือน',
          description: validation.warnings[0],
          variant: 'default',
        });
      }
    }

    // For non-special approval, check balance strictly
    if (!validation.requiresSpecialApproval && balance && totalDays > balance.remaining) {
      toast({
        title: 'สิทธิ์วันลาไม่เพียงพอ',
        description: `คุณมีสิทธิ์${balance.label}คงเหลือ ${balance.remaining} วัน แต่ต้องการลา ${totalDays} วัน`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = new FormData();
      payload.append('leave_type', leaveType);
      payload.append('start_date', startDate);
      payload.append('end_date', endDate);
      payload.append('total_days', String(totalDays));
      payload.append('reason', sanitizeReason(formData.get('reason') as string));
      payload.append('start_time', isSingleDay ? startTime : '08:30');
      payload.append('end_time', isSingleDay ? endTime : '17:30');
      payload.append('is_half_day', String(isSingleDay && isHalfDay));
      payload.append('half_day_period', isHalfDay ? String(halfDayPeriod || 'morning') : '');
      for (const file of attachmentFiles) {
        payload.append('attachments', file);
      }

      const res = await fetch(buildApiUrl('/leave-requests'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: payload
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'ไม่สามารถยื่นคำขอลาได้');
      }

      const dayLabel = totalDays === 0.5 ? 'ครึ่งวัน' : `${totalDays} วันทำงาน`;
      const message = validation.requiresSpecialApproval
        ? `ขอลา ${dayLabel} (เกินสิทธิ์) รอการอนุมัติพิเศษ`
        : `ขอลา ${dayLabel} รอการอนุมัติจากหัวหน้างาน`;

      toast({
        title: 'ยื่นคำขอลาสำเร็จ',
        description: message,
      });
      
      // Reset form
      setIsDialogOpen(false);
      setStartDate('');
      setEndDate('');
      setIsHalfDay(false);
      setHalfDayPeriod(null);
      setStartTime('08:30');
      setEndTime('17:30');
      setSelectedLeaveType(undefined);
      setValidationError(null);
      setValidationWarnings([]);
      setAttachmentFiles([]);
      setAttachmentError(null);
      
      fetchLeaveRequests();
      fetchEntitlements();
    } catch (error: unknown) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCancelLeave = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะยกเลิกคำขอลานี้?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(buildApiUrl(`/leave-requests/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'ไม่สามารถยกเลิกคำขอลาได้');
      }

      toast({ title: 'ยกเลิกคำขอลาสำเร็จ' });
      fetchLeaveRequests();
      fetchEntitlements();
    } catch (error: unknown) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const allowedLeaveTypeCodes = ['unpaid', 'personal', 'sick', 'vacation', 'emergency'];

  // Enforce business-approved leave type list and order
  const availableLeaveTypes = allowedLeaveTypeCodes;

  const getLeaveTypeDisplayLabel = (code: string): string => {
    const fromMap = leaveTypeLabels[code as LeaveType];
    if (fromMap) return fromMap;
    const fromDb = leaveTypeOptions.find((lt) => lt.code === code)?.name;
    return fromDb || code;
  };

  const handleAttachmentChange = (files: FileList | null) => {
    if (!files) return;

    const selected = Array.from(files);
    const valid: File[] = [];

    for (const file of selected) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
        setAttachmentError('รองรับเฉพาะไฟล์ .pdf, .doc, .docx, .jpg, .jpeg, .png');
        continue;
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setAttachmentError(`ไฟล์ ${file.name} มีขนาดเกิน 5MB`);
        continue;
      }
      valid.push(file);
    }

    if (valid.length > 0) {
      setAttachmentFiles((prev) => [...prev, ...valid]);
      setAttachmentError(null);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (!employee) {
    return (
      <DashboardLayout title="ขอลางาน">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            กรุณาติดต่อ HR เพื่อเชื่อมโยงบัญชีกับข้อมูลพนักงาน
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="ขอลางาน"
      subtitle="ดูสิทธิ์การลา (Pro-rate ตามวันทำงาน) และยื่นคำขอลา"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              ยื่นคำขอลา
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ยื่นคำขอลา</DialogTitle>
              <DialogDescription>กรอกรายละเอียดการลา</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitLeave} className="space-y-4">
              <div>
                <Label htmlFor="leave_type">ประเภทการลา *</Label>
                <Select 
                  name="leave_type" 
                  required
                  onValueChange={(value) => setSelectedLeaveType(value as LeaveType)}
                >
                  <SelectTrigger label="ประเภทการลา *">
                    <SelectValue placeholder="เลือกประเภทการลา" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLeaveTypes.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">ไม่พบประเภทการลาในระบบ</div>
                    )}

                    {availableLeaveTypes.map((code) => {
                      if (code === 'maternity' && !isFemaleEmployee) {
                        return null;
                      }

                      if (code === 'vacation' && isProbationEmployee && employmentDays < 119) {
                        return (
                          <div key={code} className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-2 opacity-50">
                            <span>{getLeaveTypeDisplayLabel(code)}</span>
                            <span className="text-[10px]">(บ. {getEligibleVacationDate()})</span>
                          </div>
                        );
                      }

                      return (
                        <SelectItem key={code} value={code}>
                          {getLeaveTypeDisplayLabel(code)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {isProbationEmployee && employmentDays < 119 && availableLeaveTypes.includes('vacation') && (
                  <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    ลาพักร้อนพร้อมใช้ได้เมื่อครบ 119 วัน ({getEligibleVacationDate()})
                  </p>
                )}
              </div>

              {/* Show leave rules for selected type */}
              <LeaveRulesInfo selectedLeaveType={selectedLeaveType} compact />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">วันที่เริ่ม *</Label>
                  <Input
                    label="วันที่เริ่มลา"
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">วันที่สิ้นสุด *</Label>
                  <Input
                    label="วันที่สิ้นสุดลา"
                    id="end_date"
                    name="end_date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {isDateRangeInvalid && (
                <div className="flex items-start gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>วันที่เริ่มลาต้องไม่มากกว่าวันที่สิ้นสุดการลา</span>
                </div>
              )}

              {/* Time selector for single day leave */}
              <LeaveTimeSelector
                isHalfDay={isHalfDay}
                onHalfDayChange={setIsHalfDay}
                halfDayPeriod={halfDayPeriod}
                onHalfDayPeriodChange={setHalfDayPeriod}
                startTime={startTime}
                onStartTimeChange={setStartTime}
                endTime={endTime}
                onEndTimeChange={setEndTime}
                isSingleDay={!!isSingleDay}
                onCalculatedDays={setCalculatedPartialDays}
              />

              {/* Display calculated working days */}
              {!isSingleDay && startDate && endDate && calculatedWorkingDays > 0 && !validationError && (
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <span className="text-sm text-muted-foreground">จำนวนวันทำงานที่ลา:</span>
                  <span className="font-semibold text-primary">{calculatedWorkingDays} วัน</span>
                </div>
              )}

              {!validationError && selectedBalance && requestedDaysPreview > 0 && (
                <div className="p-3 rounded-lg bg-muted/40 border text-sm">
                  <p>
                    หากลาครั้งนี้ {requestedDaysPreview.toFixed(1)} วัน จะเหลือ
                    {' '}
                    <span className={`font-semibold ${remainingAfterRequest !== null && remainingAfterRequest < 0 ? 'text-destructive' : 'text-primary'}`}>
                      {remainingAfterRequest?.toFixed(1)} วัน
                    </span>
                    {' '}
                    ({selectedBalance.label})
                  </p>
                </div>
              )}

              {/* Validation Error Display */}
              {validationError && (
                <div className="flex items-start gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Validation Warnings Display */}
              {!validationError && validationWarnings.length > 0 && (
                <div className="flex items-start gap-2 p-3 text-sm text-warning bg-warning/10 rounded-lg border border-warning/20">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    {validationWarnings.map((warning, idx) => (
                      <p key={idx}>{warning}</p>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="reason">เหตุผล</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  placeholder="ระบุเหตุผลการลา..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attachments">แนบหลักฐาน (หลายไฟล์ได้)</Label>
                <Input
                  label="ไฟล์แนบหลักฐาน"
                  id="attachments"
                  name="attachments"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => handleAttachmentChange(e.target.files)}
                />
                <p className="text-xs text-muted-foreground">
                  รองรับ .pdf, .doc, .docx, .jpg, .jpeg, .png ขนาดไม่เกิน 5MB ต่อไฟล์
                </p>
                {attachmentError && (
                  <p className="text-xs text-destructive">{attachmentError}</p>
                )}
                {attachmentFiles.length > 0 && (
                  <div className="space-y-1">
                    {attachmentFiles.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="flex items-center justify-between text-xs p-2 rounded bg-muted/40">
                        <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(idx)}>
                          ลบ
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  setSelectedLeaveType(undefined);
                  setStartDate('');
                  setEndDate('');
                  setValidationError(null);
                  setValidationWarnings([]);
                  setAttachmentFiles([]);
                  setAttachmentError(null);
                }}>
                  ยกเลิก
                </Button>
                {leaveLockReason && (
                  <div className="text-xs text-destructive self-center">
                    {leaveLockReason}
                  </div>
                )}
                <Button 
                  type="submit" 
                  disabled={
                    !!validationError ||
                    isDateRangeInvalid ||
                    isValidating ||
                    !startDate ||
                    !endDate ||
                    !selectedLeaveType ||
                    !canSubmitLeaveRequest
                  }
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังตรวจสอบ...
                    </>
                  ) : (
                    'ยื่นคำขอ'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-4 lg:space-y-6">
        {/* Main Content */}
        <div className="space-y-4 lg:space-y-6">
          {/* Year-End Notice Banner */}
          {isYearEndPeriod() && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">
                  ⚠️ แจ้งเตือน: การรีเซ็ตสิทธิ์ลาพักร้อน
                </p>
                <p className="text-sm text-amber-800 mt-1">
                  สิทธิ์ลาพักร้อนคงเหลือของคุณจะถูกรีเซ็ตเป็น 0 ในวันที่ 1 มกราคม โปรดใช้สิทธิ์การลาพักร้อนของคุณให้เต็มก่อนวันดังกล่าว
                </p>
              </div>
            </motion.div>
          )}

          {/* Leave History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                ประวัติการลา
              </CardTitle>
              <CardDescription>รายการขอลาทั้งหมดของคุณ</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : leaveRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ยังไม่มีประวัติการลา</p>
                </div>
              ) : (
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">ประเภท</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">วันที่</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">จำนวนวัน</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">สถานะ</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">ผู้อนุมัติ</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">ปฏิบัติการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveRequests.map((leave) => (
                        <tr key={leave.id} className="border-b hover:bg-muted/30">
                          <td className="py-3 px-3">{leaveTypeLabels[leave.leave_type]}</td>
                          <td className="py-3 px-3 text-muted-foreground">
                            {format(new Date(leave.start_date), 'd MMM', { locale: th })} - {format(new Date(leave.end_date), 'd MMM yyyy', { locale: th })}
                          </td>
                          <td className="py-3 px-3">{leave.total_days} วัน</td>
                          <td className="py-3 px-3">
                            <StatusBadge status={leave.status} type="leave" />
                          </td>
                          <td className="py-3 px-3 text-muted-foreground text-sm">
                            {leave.approver_first_name && leave.approver_last_name
                              ? `${leave.approver_first_name} ${leave.approver_last_name}`
                              : leave.status === 'pending' ? 'รอการอนุมัติ'
                              : '-'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {leave.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleCancelLeave(leave.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Mobile view - card layout */}
              {!loading && leaveRequests.length > 0 && (
                <div className="sm:hidden space-y-3">
                  {leaveRequests.map((leave, index) => (
                    <motion.div
                      key={leave.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium">{leaveTypeLabels[leave.leave_type]}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(leave.start_date), 'd MMM', { locale: th })} - {format(new Date(leave.end_date), 'd MMM yyyy', { locale: th })}
                          </p>
                        </div>
                        <StatusBadge status={leave.status} type="leave" />
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                        <span>{leave.total_days} วันทำงาน</span>
                        {leave.approver_first_name && leave.approver_last_name && (
                          <span className="text-xs">อนุมัติโดย: {leave.approver_first_name} {leave.approver_last_name}</span>
                        )}
                      </div>
                      {leave.reason && (
                        <p className="text-xs text-muted-foreground mb-3">
                          เหตุผล: {leave.reason}
                        </p>
                      )}
                      {leave.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-destructive"
                          onClick={() => handleCancelLeave(leave.id)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          ยกเลิก
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}