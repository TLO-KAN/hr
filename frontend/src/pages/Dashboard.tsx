import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, CalendarDays, Clock, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/config/api';
import type { LeaveRequest, Employee } from '@/types/hr';
import { leaveTypeLabels } from '@/types/hr';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { HolidayNotification } from '@/components/notifications/HolidayNotification';
import { LeaveBalanceDisplay } from '@/components/leave/LeaveBalanceDisplay';
import { HolidayCalendar } from '@/components/leave/HolidayCalendar';
import { TeamLeaveCalendar } from '@/components/leave/TeamLeaveCalendar';
import { TableSkeleton } from '@/components/ui/skeleton-loaders';


export default function Dashboard() {
  const { isHROrAdmin, employee, roles } = useAuth();
  const isManager = roles.includes('supervisor') || roles.includes('manager');
  
  // Stats for HR/Admin only
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingLeaves: 0,
    approvedThisMonth: 0,
  });
  const [recentLeaves, setRecentLeaves] = useState<(LeaveRequest & { employee: Employee })[]>([]);
  const [monthlyLeaveSummary, setMonthlyLeaveSummary] = useState({
    vacation: 0,
    sick: 0,
    personal: 0,
    other: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isHROrAdmin) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [isHROrAdmin]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token || ''}`,
      };

      const [employeesRes, leavesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/employees`, { headers }),
        fetch(`${API_BASE_URL}/api/v1/leave-requests`, { headers }),
      ]);

      const employeesPayload = employeesRes.ok ? await employeesRes.json() : {};
      const leavesPayload = leavesRes.ok ? await leavesRes.json() : [];

      const employees = employeesPayload?.data || employeesPayload?.employees || [];
      const leavesRaw = leavesPayload?.data || leavesPayload || [];

      const leaves = (leavesRaw || []).map((item: any) => ({
        ...item,
        employee: {
          id: item.employee_id,
          first_name: item.first_name,
          last_name: item.last_name,
          email: item.email,
          user_id: item.user_id,
        },
      }));

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthStartStr = startOfMonth.toISOString().split('T')[0];

      const pendingCount = leaves.filter((leave: any) => leave.status === 'pending').length;
      const approvedThisMonth = leaves.filter((leave: any) => {
        if (leave.status !== 'approved') return false;
        const dateSource = leave.approved_at || leave.updated_at || leave.start_date;
        return dateSource ? new Date(dateSource) >= startOfMonth : false;
      }).length;

      const monthlyLeaves = leaves.filter((leave: any) => {
        return leave.status === 'approved' && leave.start_date >= monthStartStr;
      });

      const leaveSummary = { vacation: 0, sick: 0, personal: 0, other: 0 };
      if (monthlyLeaves) {
        const employeesByType: Record<string, Set<string>> = {
          vacation: new Set(),
          sick: new Set(),
          personal: new Set(),
          other: new Set(),
        };
        monthlyLeaves.forEach((leave) => {
          const type = leave.leave_type as string;
          if (type === 'vacation' || type === 'sick' || type === 'personal') {
            employeesByType[type].add(leave.employee_id);
          } else {
            employeesByType.other.add(leave.employee_id);
          }
        });
        leaveSummary.vacation = employeesByType.vacation.size;
        leaveSummary.sick = employeesByType.sick.size;
        leaveSummary.personal = employeesByType.personal.size;
        leaveSummary.other = employeesByType.other.size;
      }
      setMonthlyLeaveSummary(leaveSummary);

      setStats({
        totalEmployees: employees.filter((emp: any) => emp.status !== 'inactive').length,
        pendingLeaves: pendingCount || 0,
        approvedThisMonth: approvedThisMonth || 0,
      });

      const recent = [...leaves]
        .sort((a: any, b: any) => {
          const aTs = new Date(a.created_at || a.start_date).getTime();
          const bTs = new Date(b.created_at || b.start_date).getTime();
          return bTs - aTs;
        })
        .slice(0, 5);

      setRecentLeaves(recent as any || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // ============ EMPLOYEE DASHBOARD ============
  if (!isHROrAdmin && !isManager) {
    return (
      <DashboardLayout
        title="แดชบอร์ด"
        subtitle={`ยินดีต้อนรับ${employee ? `, ${employee.first_name}` : ''}`}
      >
        <HolidayNotification daysAhead={7} />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Leave Entitlements */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">สิทธิ์วันลาของคุณ</CardTitle>
                </div>
                <CardDescription>สิทธิ์วันลาแต่ละประเภท - ปัจจุบัน</CardDescription>
              </CardHeader>
              <CardContent>
                <LeaveBalanceDisplay />
              </CardContent>
            </Card>
          </motion.div>

          {/* Holiday Calendar - ปิดชั่วคราว */}
          {/* <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">ปฏิทินวันหยุด</CardTitle>
                </div>
                <CardDescription>วันหยุดของบริษัท และวันหยุดสาธารณะ</CardDescription>
              </CardHeader>
              <CardContent>
                <HolidayCalendar />
              </CardContent>
            </Card>
          </motion.div> */}

          {/* Team Leave Calendar - ปิดชั่วคราว */}
          {/* <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">ปฏิทินการลาของทีม</CardTitle>
                </div>
                <CardDescription>ดูการลาของเพื่อนร่วมทีมของคุณ</CardDescription>
              </CardHeader>
              <CardContent>
                <TeamLeaveCalendar />
              </CardContent>
            </Card>
          </motion.div> */}
        </motion.div>
      </DashboardLayout>
    );
  }

  // ============ MANAGER DASHBOARD ============
  if (isManager && !isHROrAdmin) {
    return (
      <DashboardLayout
        title="แดชบอร์ด"
        subtitle={`ยินดีต้อนรับ${employee ? `, ${employee.first_name}` : ''}`}
      >
        <HolidayNotification daysAhead={7} />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Manager's Leave Entitlements */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">สิทธิ์วันลาของคุณ</CardTitle>
                </div>
                <CardDescription>สิทธิ์วันลาแต่ละประเภท - ปัจจุบัน</CardDescription>
              </CardHeader>
              <CardContent>
                <LeaveBalanceDisplay />
              </CardContent>
            </Card>
          </motion.div>

          {/* Holiday Calendar - ปิดชั่วคราว */}
          {/* <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">ปฏิทินวันหยุด</CardTitle>
                </div>
                <CardDescription>วันหยุดของบริษัท และวันหยุดสาธารณะ</CardDescription>
              </CardHeader>
              <CardContent>
                <HolidayCalendar />
              </CardContent>
            </Card>
          </motion.div> */}

          {/* Team Leave Calendar - ปิดชั่วคราว */}
          {/* <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">ปฏิทินการลาของทีม</CardTitle>
                </div>
                <CardDescription>ดูการลาของเพื่อนร่วมทีมของคุณ</CardDescription>
              </CardHeader>
              <CardContent>
                <TeamLeaveCalendar />
              </CardContent>
            </Card>
          </motion.div> */}
        </motion.div>
      </DashboardLayout>
    );
  }

  // ============ HR/ADMIN DASHBOARD ============
  return (
    <DashboardLayout
      title="แดชบอร์ด"
      subtitle={`ยินดีต้อนรับ${employee ? `, ${employee.first_name}` : ''}`}
    >
      <HolidayNotification daysAhead={7} />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="พนักงานทั้งหมด"
            value={stats.totalEmployees}
            icon={<Users className="w-6 h-6" />}
            variant="primary"
            description="พนักงานที่ทำงานอยู่"
          />
          <StatCard
            title="รออนุมัติ"
            value={stats.pendingLeaves}
            icon={<Clock className="w-6 h-6" />}
            variant="warning"
            description="คำขอลาที่รอดำเนินการ"
          />
          <StatCard
            title="อนุมัติเดือนนี้"
            value={stats.approvedThisMonth}
            icon={<CheckCircle className="w-6 h-6" />}
            variant="success"
            description="การลาที่อนุมัติแล้ว"
          />
          <StatCard
            title="ลาพักร้อนเดือนนี้"
            value={monthlyLeaveSummary.vacation}
            icon={<CalendarDays className="w-6 h-6" />}
            variant="info"
            description="จำนวนพนักงานที่ลา"
          />
        </motion.div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div variants={itemVariants}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">คำขอลาล่าสุด</CardTitle>
                </div>
                <CardDescription>รายการขอลาที่เพิ่งสร้าง</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <TableSkeleton rows={4} />
                ) : recentLeaves.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>ยังไม่มีคำขอลา</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentLeaves.map((leave, index) => (
                      <motion.div
                        key={leave.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                            {leave.employee?.first_name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium">
                              {leave.employee?.first_name} {leave.employee?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {leaveTypeLabels[leave.leave_type]} • {leave.total_days} วัน
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={leave.status} type="leave" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">สรุปการลาประจำเดือน</CardTitle>
                </div>
                <CardDescription>
                  {format(new Date(), 'MMMM yyyy', { locale: th })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'ลาพักร้อน', value: monthlyLeaveSummary.vacation, color: 'bg-info' },
                    { label: 'ลาป่วย', value: monthlyLeaveSummary.sick, color: 'bg-warning' },
                    { label: 'ลากิจ', value: monthlyLeaveSummary.personal, color: 'bg-success' },
                    { label: 'ลาอื่นๆ', value: monthlyLeaveSummary.other, color: 'bg-muted-foreground' },
                  ].map((item, index) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: '100%' }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-sm text-muted-foreground">{item.value} คน</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((item.value / Math.max(stats.totalEmployees * 0.3, 1)) * 100, 100)}%` }}
                          transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                          className={`h-full ${item.color} rounded-full`}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <AlertCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">มี {stats.pendingLeaves} คำขอลารออนุมัติ</p>
                  <p className="text-sm text-muted-foreground">
                    คลิกที่เมนู "อนุมัติการลา" เพื่อดำเนินการ
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
