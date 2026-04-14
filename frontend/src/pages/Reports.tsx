import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Users, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { API_BASE_URL } from '@/config/api';
import { leaveTypeLabels } from '@/types/hr';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#6b7280', '#ef4444'];

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [leaveStats, setLeaveStats] = useState<any[]>([]);
  const [departmentStats, setDepartmentStats] = useState<any[]>([]);
  const [employeeLeaveRanking, setEmployeeLeaveRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [selectedMonth]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/v1/leave-requests`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error('ไม่สามารถโหลดข้อมูลรายงานได้');
      }

      const payload = await response.json();
      const leavesRaw = payload?.data || payload || [];
      const leaves = (leavesRaw || []).filter((leave: any) => {
        return (
          leave.status === 'approved' &&
          leave.start_date >= startDate &&
          leave.start_date <= endDate
        );
      });

      if (leaves) {
        // Leave type statistics
        const typeStats = Object.entries(
          leaves.reduce((acc: any, leave) => {
            const type = leave.leave_type;
            acc[type] = (acc[type] || 0) + Number(leave.total_days);
            return acc;
          }, {})
        ).map(([type, days]) => ({
          name: leaveTypeLabels[type as keyof typeof leaveTypeLabels],
          value: days,
        }));
        setLeaveStats(typeStats);

        // Department statistics
        const deptStats = Object.entries(
          leaves.reduce((acc: any, leave) => {
            const deptName = leave.department_name || 'ไม่ระบุ';
            acc[deptName] = (acc[deptName] || 0) + Number(leave.total_days);
            return acc;
          }, {})
        ).map(([name, days]) => ({ name, days }));
        setDepartmentStats(deptStats);

        // Employee ranking
        const empRanking = Object.entries(
          leaves.reduce((acc: any, leave) => {
            const empName = `${leave.first_name || ''} ${leave.last_name || ''}`.trim() || 'ไม่ระบุ';
            acc[empName] = (acc[empName] || 0) + Number(leave.total_days);
            return acc;
          }, {})
        )
          .map(([name, days]) => ({ name, days }))
          .sort((a: any, b: any) => b.days - a.days)
          .slice(0, 5);
        setEmployeeLeaveRanking(empRanking);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: th }),
    };
  });

  return (
    <DashboardLayout
      title="รายงาน"
      subtitle="สถิติการลาและข้อมูลพนักงาน"
      actions={
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger label="เดือนรายงาน" className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            ส่งออก
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leave by Type */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  สถิติการลาตามประเภท
                </CardTitle>
                <CardDescription>
                  จำนวนวันลาแยกตามประเภท
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-64 bg-muted animate-pulse rounded-lg" />
                ) : leaveStats.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    ไม่มีข้อมูลการลาในเดือนนี้
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leaveStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value} วัน`}
                        >
                          {leaveStats.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Leave by Department */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  สถิติการลาตามแผนก
                </CardTitle>
                <CardDescription>
                  จำนวนวันลาแยกตามแผนก
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-64 bg-muted animate-pulse rounded-lg" />
                ) : departmentStats.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    ไม่มีข้อมูลการลาในเดือนนี้
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentStats} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="days" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Employee Leave Ranking */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                พนักงานที่ลามากที่สุด (Top 5)
              </CardTitle>
              <CardDescription>
                จัดอันดับตามจำนวนวันลาในเดือนนี้
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : employeeLeaveRanking.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  ไม่มีข้อมูลการลาในเดือนนี้
                </div>
              ) : (
                <div className="space-y-3">
                  {employeeLeaveRanking.map((emp, index) => (
                    <motion.div
                      key={emp.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-warning/20 text-warning' :
                        index === 1 ? 'bg-muted text-muted-foreground' :
                        index === 2 ? 'bg-warning/10 text-warning/70' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{emp.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{emp.days} วัน</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
