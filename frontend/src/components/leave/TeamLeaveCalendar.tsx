import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarDays, Users } from 'lucide-react';
import { format, parseISO, isSameDay, isWithinInterval } from 'date-fns';
import { th } from 'date-fns/locale';
import type { LeaveType, Department } from '@/types/hr';
import { leaveTypeLabels } from '@/types/hr';
import { API_BASE_URL } from '@/config/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface TeamLeave {
  id: string;
  employee_id: string;
  employee_name: string;
  department_id: string | null;
  department_name: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
}

const leaveTypeColors: Record<LeaveType, string> = {
  vacation: 'bg-info text-info-foreground',
  sick: 'bg-warning text-warning-foreground',
  personal: 'bg-success text-success-foreground',
  maternity: 'bg-pink-500 text-white',
  paternity: 'bg-blue-500 text-white',
  unpaid: 'bg-muted text-muted-foreground',
  emergency: 'bg-red-500 text-white',
  other: 'bg-secondary text-secondary-foreground',
};

interface TeamLeaveCalendarProps {
  showDepartmentFilter?: boolean;
}

export function TeamLeaveCalendar({ showDepartmentFilter = true }: TeamLeaveCalendarProps) {
  const { employee, isHROrAdmin } = useAuth();
  const [leaves, setLeaves] = useState<TeamLeave[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(() => {
    // Default to user's department if not HR/Admin
    return !isHROrAdmin && employee?.department_id ? String(employee.department_id) : 'all';
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchLeaves();
    fetchDepartments();
  }, [currentMonth, selectedDepartment]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      const startStr = format(startOfMonth, 'yyyy-MM-dd');
      const endStr = format(endOfMonth, 'yyyy-MM-dd');

      // Build query with date range and status filter to reduce payload
      const queryParams = new URLSearchParams({
        status: 'approved',
        year: String(year),
        limit: '500',
        offset: '0'
      });

      const res = await fetch(`${API_BASE_URL}/api/v1/leave-requests?${queryParams}`, {
        headers: { Authorization: `Bearer ${token || ''}` }
      });

      if (!res.ok) throw new Error('Failed to fetch leaves');
      const data = await res.json();

      let formattedLeaves = (data?.data || data || [])
        .filter((leave: any) => 
          leave.status === 'approved' &&
          parseISO(leave.start_date) <= endOfMonth &&
          parseISO(leave.end_date) >= startOfMonth
        )
        .map((leave: any) => ({
          id: leave.id,
          employee_id: leave.employee_id,
          employee_name: `${leave.first_name || ''} ${leave.last_name || ''}`.trim(),
          department_id: leave.department_id,
          department_name: leave.department_name || 'ไม่ระบุแผนก',
          leave_type: leave.leave_type as LeaveType,
          start_date: leave.start_date,
          end_date: leave.end_date,
          total_days: leave.total_days,
          status: leave.status,
        }));

      // Filter by department
      if (selectedDepartment !== 'all') {
        formattedLeaves = formattedLeaves.filter(
          leave => String(leave.department_id) === selectedDepartment
        );
      } else if (!isHROrAdmin && employee?.department_id) {
        // Non-HR/Admin users see only their department's leaves
        formattedLeaves = formattedLeaves.filter(
          leave => String(leave.department_id) === String(employee.department_id)
        );
      }

      setLeaves(formattedLeaves);
    } catch (error) {
      console.error('Error fetching team leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/departments`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch departments');
      const data = await res.json();
      setDepartments(Array.isArray(data?.data) ? data.data : []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const getLeavesForDate = (date: Date): TeamLeave[] => {
    return leaves.filter((leave) => {
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      return isWithinInterval(date, { start, end }) || isSameDay(date, start) || isSameDay(date, end);
    });
  };

  const datesWithLeaves = leaves.flatMap((leave) => {
    const dates: Date[] = [];
    let current = parseISO(leave.start_date);
    const end = parseISO(leave.end_date);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  });

  const modifiers = {
    hasLeave: datesWithLeaves,
  };

  const modifiersStyles = {
    hasLeave: {
      backgroundColor: 'hsl(var(--primary) / 0.15)',
      fontWeight: 600,
    },
  };

  const selectedDateLeaves = selectedDate ? getLeavesForDate(selectedDate) : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-primary" />
              ปฏิทินวันลาทีม
            </CardTitle>
            <CardDescription>
              ดูวันลาที่อนุมัติแล้วของทีม/แผนก
            </CardDescription>
          </div>
          {showDepartmentFilter && isHROrAdmin && (
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="เลือกแผนก" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกแผนก</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
        ) : (
          <>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-md border p-2 sm:p-3 w-full [&_.rdp-months]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full [&_.rdp-head_row]:flex [&_.rdp-head_row]:justify-between [&_.rdp-row]:flex [&_.rdp-row]:justify-between [&_.rdp-cell]:flex-1 [&_.rdp-head_cell]:flex-1 [&_.rdp-day]:w-full [&_.rdp-day]:h-8 sm:[&_.rdp-day]:h-10"
            />

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(leaveTypeColors).slice(0, 4).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded ${color}`} />
                  <span className="text-muted-foreground">
                    {leaveTypeLabels[type as LeaveType]}
                  </span>
                </div>
              ))}
            </div>

            {/* Selected date leaves */}
            {selectedDate && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-medium">
                  {format(selectedDate, 'd MMMM yyyy', { locale: th })}
                </p>
                {selectedDateLeaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ไม่มีการลาในวันนี้</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDateLeaves.map((leave) => (
                      <div
                        key={leave.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                            {leave.employee_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{leave.employee_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {leave.department_name}
                            </p>
                          </div>
                        </div>
                        <Badge className={leaveTypeColors[leave.leave_type]}>
                          {leaveTypeLabels[leave.leave_type]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming leaves this month */}
            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm font-medium flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                การลาเดือนนี้ ({leaves.length} รายการ)
              </p>
              {leaves.length === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่มีการลาในเดือนนี้</p>
              ) : (
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {leaves.slice(0, 10).map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
                    >
                      <span className="font-medium">{leave.employee_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">
                          {format(parseISO(leave.start_date), 'd MMM', { locale: th })}
                          {leave.start_date !== leave.end_date && (
                            <> - {format(parseISO(leave.end_date), 'd MMM', { locale: th })}</>
                          )}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {leave.total_days} วัน
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {leaves.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      และอีก {leaves.length - 10} รายการ
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}