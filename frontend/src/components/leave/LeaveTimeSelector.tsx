import { useEffect, useState, useMemo } from 'react';
import { Clock, Calculator } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const WORKING_HOURS_KEY = 'company_working_hours';

interface WorkingHours {
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  working_hours_per_day: number;
}

interface LeaveTimeSelectorProps {
  isHalfDay: boolean;
  onHalfDayChange: (isHalfDay: boolean) => void;
  halfDayPeriod: 'morning' | 'afternoon' | null;
  onHalfDayPeriodChange: (period: 'morning' | 'afternoon' | null) => void;
  startTime: string;
  onStartTimeChange: (time: string) => void;
  endTime: string;
  onEndTimeChange: (time: string) => void;
  isSingleDay: boolean;
  onCalculatedDays?: (days: number) => void;
}

// Calculate partial day based on time
function calculatePartialDayFromTime(
  startTime: string,
  endTime: string,
  workingHours: WorkingHours
): number {
  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const workStart = parseTime(workingHours.start_time);
  const workEnd = parseTime(workingHours.end_time);
  const breakStart = parseTime(workingHours.break_start);
  const breakEnd = parseTime(workingHours.break_end);
  
  let leaveStart = parseTime(startTime);
  let leaveEnd = parseTime(endTime);

  // Clamp to working hours
  leaveStart = Math.max(leaveStart, workStart);
  leaveEnd = Math.min(leaveEnd, workEnd);

  if (leaveEnd <= leaveStart) return 0;

  // Calculate total working minutes (excluding break)
  const totalWorkMinutes = (workEnd - workStart) - (breakEnd - breakStart);
  
  // Calculate leave minutes (accounting for break time)
  let leaveMinutes = leaveEnd - leaveStart;
  
  // Subtract break time if leave spans break period
  if (leaveStart < breakEnd && leaveEnd > breakStart) {
    const overlapStart = Math.max(leaveStart, breakStart);
    const overlapEnd = Math.min(leaveEnd, breakEnd);
    if (overlapEnd > overlapStart) {
      leaveMinutes -= (overlapEnd - overlapStart);
    }
  }

  // Calculate as fraction of day
  const fraction = leaveMinutes / totalWorkMinutes;
  
  // Round to nearest 0.5
  return Math.round(fraction * 2) / 2;
}

export function LeaveTimeSelector({
  isHalfDay,
  onHalfDayChange,
  halfDayPeriod,
  onHalfDayPeriodChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  isSingleDay,
  onCalculatedDays,
}: LeaveTimeSelectorProps) {
  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);

  useEffect(() => {
    fetchWorkingHours();
  }, []);

  const fetchWorkingHours = async () => {
    const raw = localStorage.getItem(WORKING_HOURS_KEY);
    if (raw) {
      setWorkingHours(JSON.parse(raw) as WorkingHours);
      return;
    }

    setWorkingHours({
      start_time: '08:30',
      end_time: '17:30',
      break_start: '12:00',
      break_end: '13:00',
      working_hours_per_day: 8,
    });
  };

  // Calculate days when times or half-day changes
  const calculatedDays = useMemo(() => {
    if (!workingHours || !isSingleDay) return 1;
    
    if (isHalfDay) {
      return 0.5;
    }

    return 1;
  }, [startTime, endTime, workingHours, isHalfDay, isSingleDay]);

  // Notify parent of calculated days
  useEffect(() => {
    if (onCalculatedDays) {
      onCalculatedDays(calculatedDays);
    }
  }, [calculatedDays, onCalculatedDays]);

  // Set times based on half-day selection
  useEffect(() => {
    if (workingHours && halfDayPeriod) {
      if (halfDayPeriod === 'morning') {
        onStartTimeChange(workingHours.start_time);
        onEndTimeChange(workingHours.break_start);
      } else {
        onStartTimeChange(workingHours.break_end);
        onEndTimeChange(workingHours.end_time);
      }
    } else if (workingHours && !isHalfDay) {
      // Full day - reset to full working hours
      onStartTimeChange(workingHours.start_time);
      onEndTimeChange(workingHours.end_time);
    }
  }, [halfDayPeriod, isHalfDay, workingHours]);

  // Always show for single day
  if (!isSingleDay) {
    return null;
  }

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <Label className="font-medium">ลาครึ่งวัน</Label>
        </div>
        <Switch
          checked={isHalfDay}
          onCheckedChange={(checked) => {
            onHalfDayChange(checked);
            if (!checked) {
              onHalfDayPeriodChange(null);
            } else {
              onHalfDayPeriodChange('morning');
            }
          }}
        />
      </div>

      {isHalfDay && (
        <RadioGroup
          value={halfDayPeriod || 'morning'}
          onValueChange={(value) => onHalfDayPeriodChange(value as 'morning' | 'afternoon')}
          className="grid grid-cols-2 gap-4"
        >
          <Label
            htmlFor="morning"
            className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${
              halfDayPeriod === 'morning' ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
            }`}
          >
            <RadioGroupItem value="morning" id="morning" className="sr-only" />
            <span>🌅 ครึ่งเช้า</span>
            {workingHours && (
              <span className="text-xs text-muted-foreground">
                {workingHours.start_time} - {workingHours.break_start}
              </span>
            )}
          </Label>
          <Label
            htmlFor="afternoon"
            className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${
              halfDayPeriod === 'afternoon' ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
            }`}
          >
            <RadioGroupItem value="afternoon" id="afternoon" className="sr-only" />
            <span>🌇 ครึ่งบ่าย</span>
            {workingHours && (
              <span className="text-xs text-muted-foreground">
                {workingHours.break_end} - {workingHours.end_time}
              </span>
            )}
          </Label>
        </RadioGroup>
      )}

      {/* Full day fixed slot */}
      {!isHalfDay && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">ช่วงเวลาเต็มวัน (คงที่)</Label>
          <div className="p-2 rounded-md bg-background border text-sm text-muted-foreground">
            08:30 - 17:30
          </div>
        </div>
      )}

      {/* Calculated days display */}
      <div className="flex items-center justify-between p-2 bg-primary/5 rounded-md">
        <div className="flex items-center gap-2 text-sm">
          <Calculator className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">จำนวนวันลา:</span>
        </div>
        <span className="font-semibold text-primary">
          {calculatedDays === 0.5 ? 'ครึ่งวัน' : calculatedDays === 1 ? '1 วัน' : `${calculatedDays} วัน`}
        </span>
      </div>
    </div>
  );
}
