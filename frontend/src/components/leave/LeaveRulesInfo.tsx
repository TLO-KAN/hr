import { useEffect, useState } from 'react';
import { AlertCircle, Clock, CalendarX, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fetchLeaveValidationRules, LEAVE_BUSINESS_RULES } from '@/lib/leaveCalculation';
import type { LeaveType } from '@/types/hr';
import { leaveTypeLabels } from '@/types/hr';

interface LeaveRulesInfoProps {
  selectedLeaveType?: LeaveType;
  compact?: boolean;
}

export function LeaveRulesInfo({ selectedLeaveType, compact = false }: LeaveRulesInfoProps) {
  const [rules, setRules] = useState<typeof LEAVE_BUSINESS_RULES | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadRules = async () => {
      setLoading(true);
      try {
        const fetchedRules = await fetchLeaveValidationRules();
        setRules(fetchedRules);
      } catch (error) {
        console.error('Error loading leave rules:', error);
        setRules(LEAVE_BUSINESS_RULES);
      } finally {
        setLoading(false);
      }
    };
    loadRules();
  }, []);

  if (!selectedLeaveType || !rules) {
    if (loading && selectedLeaveType) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>กำลังโหลดกฎการลา...</span>
        </div>
      );
    }
    return null;
  }

  const typeRules = rules[selectedLeaveType];
  if (!typeRules) return null;

  const leaveTypeName = leaveTypeLabels[selectedLeaveType];

  if (compact) {
    return (
      <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-2 rounded-lg">
        {typeRules.advanceNoticeDays > 0 && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>แจ้งล่วงหน้า {typeRules.advanceNoticeDays} วันทำงาน</span>
          </div>
        )}
        {typeRules.allowBackdated && (
          <div className="flex items-center gap-1">
            <CalendarX className="w-3 h-3" />
            <span>ย้อนหลังได้ {typeRules.backdatedMaxDays} วัน</span>
          </div>
        )}
        {!typeRules.allowBackdated && (
          <div className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="w-3 h-3" />
            <span>ไม่สามารถขอย้อนหลังได้</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>กฎการลา{leaveTypeName}</AlertTitle>
      <AlertDescription className="mt-2 space-y-1 text-sm">
        {typeRules.advanceNoticeDays > 0 && (
          <p>• ต้องแจ้งล่วงหน้าอย่างน้อย {typeRules.advanceNoticeDays} วันทำงาน</p>
        )}
        {typeRules.allowBackdated ? (
          <p>• สามารถขอย้อนหลังได้ไม่เกิน {typeRules.backdatedMaxDays} วัน</p>
        ) : (
          <p>• ไม่สามารถขอย้อนหลังได้</p>
        )}
        {selectedLeaveType === 'vacation' && (
          <p className="text-warning">⚠️ ลาพักร้อนที่ไม่แจ้งล่วงหน้า {typeRules.advanceNoticeDays} วันจะถูกปฏิเสธ</p>
        )}
        {selectedLeaveType === 'personal' && (
          <p className="text-warning">⚠️ ลากิจที่ไม่แจ้งล่วงหน้า {typeRules.advanceNoticeDays} วันจะถูกปฏิเสธ</p>
        )}
        {selectedLeaveType === 'emergency' && (
          <p className="text-primary">✅ ลาฉุกเฉินสามารถยื่นลาได้ทันที ไม่ต้องแจ้งล่วงหน้า</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
