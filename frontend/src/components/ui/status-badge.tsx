import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { LeaveStatus, EmployeeStatus } from '@/types/hr';
import { leaveStatusLabels, employeeStatusLabels } from '@/types/hr';

interface StatusBadgeProps {
  status: LeaveStatus | EmployeeStatus;
  type?: 'leave' | 'employee';
  className?: string;
}

const statusStyles: Record<string, string> = {
  // Leave statuses
  pending: 'bg-warning/15 text-warning border-warning/30 hover:bg-warning/20',
  approved: 'bg-success/15 text-success border-success/30 hover:bg-success/20',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20',
  cancelled: 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
  // Employee statuses
  active: 'bg-success/15 text-success border-success/30 hover:bg-success/20',
  resigned: 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
  suspended: 'bg-warning/15 text-warning border-warning/30 hover:bg-warning/20',
};

export function StatusBadge({ status, type = 'leave', className }: StatusBadgeProps) {
  const labels = type === 'leave' ? leaveStatusLabels : employeeStatusLabels;
  const label = labels[status as keyof typeof labels] || status;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium transition-colors',
        statusStyles[status],
        className
      )}
    >
      {label}
    </Badge>
  );
}
