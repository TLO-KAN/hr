import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DepartmentStats {
  department_name: string;
  total_employees: number;
  approved_leaves: number;
  pending_leaves: number;
  avg_balance: number;
}

export default function TeamAnalytics() {
  const { toast } = useToast();
  const [stats, setStats] = useState<DepartmentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchAnalytics();
  }, [year]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/analytics/departments?year=${year}`);
      setStats(response?.data?.data || []);
    } catch (error: any) {
      console.error('Analytics error:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลการวิเคราะห์',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">การวิเคราะห์ทีม</h1>
            <p className="text-muted-foreground">ข้อมูลสรุปการลาตามแผนก</p>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">กำลังโหลด...</div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
              <TabsTrigger value="details">รายละเอียด</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Approvals by Department */}
                <Card>
                  <CardHeader>
                    <CardTitle>การอนุมัติตามแผนก</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="department_name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="approved_leaves" fill="#10b981" name="อนุมัติแล้ว" />
                        <Bar dataKey="pending_leaves" fill="#f59e0b" name="รอการอนุมัติ" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Employees per Dept */}
                <Card>
                  <CardHeader>
                    <CardTitle>จำนวนพนักงาน</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats}
                          dataKey="total_employees"
                          nameKey="department_name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label
                        >
                          {stats.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="details">
              {/* Summary Table */}
              <Card>
                <CardHeader>
                  <CardTitle>สรุปข้อมูลแผนก</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left">แผนก</th>
                          <th className="px-4 py-2 text-center">พนักงาน</th>
                          <th className="px-4 py-2 text-center">อนุมัติแล้ว</th>
                          <th className="px-4 py-2 text-center">รอการอนุมัติ</th>
                          <th className="px-4 py-2 text-center">สิทธิ์เฉลี่ย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map((row) => (
                          <tr key={row.department_name} className="border-t hover:bg-muted/50">
                            <td className="px-4 py-3">{row.department_name}</td>
                            <td className="px-4 py-3 text-center">{row.total_employees}</td>
                            <td className="px-4 py-3 text-center text-green-600">{row.approved_leaves}</td>
                            <td className="px-4 py-3 text-center text-amber-600">{row.pending_leaves}</td>
                            <td className="px-4 py-3 text-center">{row.avg_balance.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
