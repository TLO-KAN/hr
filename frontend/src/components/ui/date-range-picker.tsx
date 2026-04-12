import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { format, subDays, subMonths, subQuarters, subYears, startOfMonth, startOfQuarter, startOfYear, endOfMonth, endOfQuarter, endOfYear } from 'date-fns';
import { th } from 'date-fns/locale';

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  presetLabel?: string;
  className?: string;
}

interface Preset {
  label: string;
  getValue: () => DateRange;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  presetLabel = 'ช่วงเวลา',
  className,
}) => {
  const [selectedRange, setSelectedRange] = React.useState<DateRange>(
    value || { from: subDays(new Date(), 30), to: new Date() }
  );
  const [showCustom, setShowCustom] = React.useState(false);

  const presets: Preset[] = [
    {
      label: 'วันนี้',
      getValue: () => ({ from: new Date(), to: new Date() }),
    },
    {
      label: '7 วันที่ผ่านมา',
      getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }),
    },
    {
      label: '30 วันที่ผ่านมา',
      getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }),
    },
    {
      label: 'เดือนนี้',
      getValue: () => ({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
      }),
    },
    {
      label: 'เดือนที่ผ่านมา',
      getValue: () => {
        const lastMonth = subMonths(new Date(), 1);
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        };
      },
    },
    {
      label: 'ไตรมาส 3 เดือนที่ผ่านมา',
      getValue: () => ({
        from: startOfQuarter(subQuarters(new Date(), 1)),
        to: endOfQuarter(subQuarters(new Date(), 1)),
      }),
    },
    {
      label: 'ปีนี้',
      getValue: () => ({
        from: startOfYear(new Date()),
        to: endOfYear(new Date()),
      }),
    },
  ];

  const handlePresetClick = (preset: Preset) => {
    const range = preset.getValue();
    setSelectedRange(range);
    onChange?.(range);
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    const newRange = { ...selectedRange, from: newDate };
    setSelectedRange(newRange);
    onChange?.(newRange);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    const newRange = { ...selectedRange, to: newDate };
    setSelectedRange(newRange);
    onChange?.(newRange);
  };

  const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');
  const displayFormat = (date: Date) => format(date, 'd MMM yyyy', { locale: th });

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">{presetLabel}</label>
        <Button
          variant="link"
          size="sm"
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs"
        >
          {showCustom ? 'ปิด' : 'กำหนดเอง'}
        </Button>
      </div>

      {/* Preset Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {presets.map(preset => (
          <Button
            key={preset.label}
            variant={
              formatDate(selectedRange.from) === formatDate(preset.getValue().from) &&
              formatDate(selectedRange.to) === formatDate(preset.getValue().to)
                ? 'default'
                : 'outline'
            }
            size="sm"
            onClick={() => handlePresetClick(preset)}
            className="text-xs h-8"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom Date Inputs */}
      {showCustom && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">วันที่เริ่มต้น</label>
              <Input
                type="date"
                value={formatDate(selectedRange.from)}
                onChange={handleFromChange}
                className="h-9"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">วันที่สิ้นสุด</label>
              <Input
                type="date"
                value={formatDate(selectedRange.to)}
                onChange={handleToChange}
                className="h-9"
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{displayFormat(selectedRange.from)}</span>
            {' ถึง '}
            <span className="font-medium text-foreground">{displayFormat(selectedRange.to)}</span>
          </div>
        </Card>
      )}

      {/* Display Selected Range */}
      <div className="text-sm">
        <span className="text-muted-foreground">เลือกแล้ว: </span>
        <span className="font-medium">{displayFormat(selectedRange.from)}</span>
        <span className="text-muted-foreground"> ถึง </span>
        <span className="font-medium">{displayFormat(selectedRange.to)}</span>
      </div>
    </div>
  );
};

// Hook for managing date range state
export const useDateRange = (initialFrom?: Date, initialTo?: Date) => {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: initialFrom || subDays(new Date(), 30),
    to: initialTo || new Date(),
  });

  return { dateRange, setDateRange };
};
