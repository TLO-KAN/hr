import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Download, 
  RefreshCw, 
  Search, 
  Calendar, 
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  Building2,
  Briefcase
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/ui/skeleton-loaders';
import { MobileTableWrapper } from '@/components/ui/mobile-table';
import { DateRangePicker, useDateRange } from '@/components/ui/date-range-picker';
import api from '@/services/api';
import { employeeTypeLabels } from '@/types/hr';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { buildApiUrl } from '@/config/api';

interface EmployeeLeaveSummary {
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  department_name: string;
  position_name: string;
  start_date: string;
  years_of_service: number;
  employee_type: string;
  employee_status: string;
  vacation_quota: number;
  vacation_used: number;
  vacation_remaining: number;
  sick_quota: number;
  sick_used: number;
  sick_remaining: number;
  personal_quota: number;
  personal_used: number;
  personal_remaining: number;
  maternity_quota: number;
  maternity_used: number;
  maternity_remaining: number;
  paternity_quota: number;
  paternity_used: number;
  paternity_remaining: number;
  other_quota: number;
  other_used: number;
  other_remaining: number;
}

interface Department {
  id: string;
  name: string;
}

type SortField = 'employee_code' | 'first_name' | 'department_name' | 'years_of_service' | 'vacation_remaining' | 'sick_remaining';
type SortDirection = 'asc' | 'desc';

export default function LeaveBalanceDashboard() {
  const [data, setData] = useState<EmployeeLeaveSummary[]>([]);
  const [filteredData, setFilteredData] = useState<EmployeeLeaveSummary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sortField, setSortField] = useState<SortField>('employee_code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { dateRange, setDateRange } = useDateRange();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    fetchData();
    fetchDepartments();
  }, [selectedYear]);

  useEffect(() => {
    filterAndSortData();
  }, [data, searchTerm, departmentFilter, typeFilter, sortField, sortDirection]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/leave-entitlements?year=${selectedYear}`);
      const entitlements = response?.data || [];
      
      if (!Array.isArray(entitlements)) {
        throw new Error('Invalid response format: expected array');
      }

      // Transform entitlements into employee summary format
      const summaryMap = new Map<string, EmployeeLeaveSummary>();

      for (const ent of entitlements) {
        const key = ent.employee_id;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            employee_id: ent.employee_id,
            employee_code: ent.employee_code,
            first_name: ent.first_name,
            last_name: ent.last_name,
            department_name: ent.department_name || '',
            position_name: ent.position_name || '',
            start_date: ent.start_date || '',
            years_of_service: ent.years_of_service || 0,
            employee_type: ent.employee_type || 'permanent',
            employee_status: ent.employee_status || 'active',
            vacation_quota: 0,
            vacation_used: 0,
            vacation_remaining: 0,
            sick_quota: 0,
            sick_used: 0,
            sick_remaining: 0,
            personal_quota: 0,
            personal_used: 0,
            personal_remaining: 0,
            maternity_quota: 0,
            maternity_used: 0,
            maternity_remaining: 0,
            paternity_quota: 0,
            paternity_used: 0,
            paternity_remaining: 0,
            other_quota: 0,
            other_used: 0,
            other_remaining: 0,
          });
        }

        const summary = summaryMap.get(key)!;
        const leaveType = (ent.leave_type || '').toLowerCase().trim();
        
        const entitledDays = parseFloat(ent.entitled_days) || 0;
        const usedDays = parseFloat(ent.used_days) || 0;
        const remainingDays = parseFloat(ent.remaining_days) || 0;
        
        if (leaveType === 'vacation' || leaveType === 'annual' || leaveType === 'พักร้อน') {
          summary.vacation_quota = entitledDays;
          summary.vacation_used = usedDays;
          summary.vacation_remaining = remainingDays;
        } else if (leaveType === 'sick' || leaveType === 'ป่วย') {
          summary.sick_quota = entitledDays;
          summary.sick_used = usedDays;
          summary.sick_remaining = remainingDays;
        } else if (leaveType === 'personal' || leaveType === 'กิจ') {
          summary.personal_quota = entitledDays;
          summary.personal_used = usedDays;
          summary.personal_remaining = remainingDays;
        } else if (leaveType === 'maternity' || leaveType === 'คลอด') {
          summary.maternity_quota = entitledDays;
          summary.maternity_used = usedDays;
          summary.maternity_remaining = remainingDays;
        } else if (leaveType === 'paternity' || leaveType === 'พ่อ') {
          summary.paternity_quota = entitledDays;
          summary.paternity_used = usedDays;
          summary.paternity_remaining = remainingDays;
        } else if (leaveType) {
          summary.other_quota = entitledDays;
          summary.other_used = usedDays;
          summary.other_remaining = remainingDays;
        }
      }

      const summaryData = Array.from(summaryMap.values());
      setData(summaryData);
    } catch (error: any) {
      console.error('Error fetching leave summary:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'ไม่สามารถโหลดข้อมูลได้',
        variant: 'destructive',
      });
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      const data = response?.data || [];
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };

  const filterAndSortData = () => {
    let result = [...data];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(emp =>
        emp.employee_code.toLowerCase().includes(term) ||
        emp.first_name.toLowerCase().includes(term) ||
        emp.last_name.toLowerCase().includes(term)
      );
    }

    // Apply department filter
    if (departmentFilter !== 'all') {
      result = result.filter(emp => emp.department_name === departmentFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter(emp => emp.employee_type === typeFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'employee_code':
          aVal = a.employee_code;
          bVal = b.employee_code;
          break;
        case 'first_name':
          aVal = a.first_name;
          bVal = b.first_name;
          break;
        case 'department_name':
          aVal = a.department_name;
          bVal = b.department_name;
          break;
        case 'years_of_service':
          aVal = a.years_of_service;
          bVal = b.years_of_service;
          break;
        case 'vacation_remaining':
          aVal = a.vacation_remaining;
          bVal = b.vacation_remaining;
          break;
        case 'sick_remaining':
          aVal = a.sick_remaining;
          bVal = b.sick_remaining;
          break;
        default:
          aVal = a.employee_code;
          bVal = b.employee_code;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal, 'th') 
          : bVal.localeCompare(aVal, 'th');
      }
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number) 
        : (bVal as number) - (aVal as number);
    });

    setFilteredData(result);
  };

  const handleRecalculateAll = async () => {
    if (!confirm('คุณต้องการคำนวณสิทธิ์วันลาใหม่ให้พนักงานทั้งหมดหรือไม่?')) return;

    setRecalculating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl('/leave-balances/run-annual-update'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ year: selectedYear }),
      });

      if (!response.ok) throw new Error('Failed to recalculate');
      const result = await response.json();

      toast({ 
        title: 'คำนวณสิทธิ์วันลาใหม่เรียบร้อย', 
        description: `อัพเดต ${result.updated_employees || 0} คน` 
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถคำนวณใหม่ได้',
        variant: 'destructive',
      });
    } finally {
      setRecalculating(false);
    }
  };

  const handleExport = () => {
    // Create CSV content
    const headers = [
      'รหัสพนักงาน', 'ชื่อ', 'นามสกุล', 'แผนก', 'ตำแหน่ง', 'วันเริ่มงาน', 'อายุงาน (ปี)', 'ประเภท',
      'พักร้อน (สิทธิ์)', 'พักร้อน (ใช้)', 'พักร้อน (คงเหลือ)',
      'ป่วย (สิทธิ์)', 'ป่วย (ใช้)', 'ป่วย (คงเหลือ)',
      'กิจ (สิทธิ์)', 'กิจ (ใช้)', 'กิจ (คงเหลือ)',
    ];
    
    const rows = filteredData.map(emp => [
      emp.employee_code,
      emp.first_name,
      emp.last_name,
      emp.department_name,
      emp.position_name,
      emp.start_date,
      emp.years_of_service,
      employeeTypeLabels[emp.employee_type as keyof typeof employeeTypeLabels] || emp.employee_type,
      emp.vacation_quota, emp.vacation_used, emp.vacation_remaining,
      emp.sick_quota, emp.sick_used, emp.sick_remaining,
      emp.personal_quota, emp.personal_used, emp.personal_remaining,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leave_balance_${selectedYear}.csv`;
    link.click();
    
    toast({ title: 'ส่งออกข้อมูลเรียบร้อย' });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 inline ml-1" />
      : <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const formatYearsOfService = (years: number) => {
    if (years < 1) {
      return 'น้อยกว่า 1 ปี';
    }
    return `${years.toFixed(1)} ปี`;
  };

  // Calculate summary stats
  const totalEmployees = filteredData.length;
  const avgVacationRemaining = totalEmployees > 0 
    ? filteredData.reduce((sum, e) => sum + e.vacation_remaining, 0) / totalEmployees 
    : 0;
  const lowVacationCount = filteredData.filter(e => e.vacation_quota > 0 && e.vacation_remaining <= 2).length;
  const highSickUsage = filteredData.filter(e => e.sick_used > 10).length;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <DashboardLayout
      title="สรุปยอดวันลาพนักงาน"
      subtitle="ดูภาพรวมสิทธิ์และการใช้วันลาของพนักงานทั้งหมด (คำนวณอัตโนมัติตามอายุงาน)"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="text-xs sm:text-sm">
            <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">ส่งออก CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <Button size="sm" onClick={handleRecalculateAll} disabled={recalculating} className="text-xs sm:text-sm">
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${recalculating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">คำนวณใหม่ทั้งหมด</span>
            <span className="sm:hidden">คำนวณใหม่</span>
          </Button>
        </div>
      }
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Stats Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="พนักงานทั้งหมด"
            value={totalEmployees}
            icon={<Users className="w-6 h-6" />}
            variant="primary"
            description={`ปี ${selectedYear}`}
          />
          <StatCard
            title="เฉลี่ยพักร้อนคงเหลือ"
            value={avgVacationRemaining.toFixed(1)}
            icon={<Calendar className="w-6 h-6" />}
            variant="info"
            description="วัน/คน"
          />
          <StatCard
            title="พักร้อนใกล้หมด"
            value={lowVacationCount}
            icon={<Clock className="w-6 h-6" />}
            variant="warning"
            description="≤ 2 วัน"
          />
          <StatCard
            title="ใช้ลาป่วยมาก"
            value={highSickUsage}
            icon={<Calendar className="w-6 h-6" />}
            variant="warning"
            description="> 10 วัน"
          />
        </motion.div>

        {/* Filters */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">ตัวกรอง</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">ปี</label>
                  <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">ค้นหา</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="รหัส, ชื่อ, นามสกุล..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">แผนก</label>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">ประเภทพนักงาน</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="permanent">ประจำ</SelectItem>
                      <SelectItem value="contract">สัญญาจ้าง/ทดลองงาน</SelectItem>
                      <SelectItem value="parttime">พาร์ทไทม์</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border-t pt-4">
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  presetLabel="ช่วงเวลารายงาน"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data Table */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    รายการสรุปวันลาพนักงาน
                  </CardTitle>
                  <CardDescription>
                    แสดง {filteredData.length} จาก {data.length} คน
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={5} />
              ) : (
                <MobileTableWrapper>
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                          onClick={() => handleSort('employee_code')}
                        >
                          รหัส <SortIcon field="employee_code" />
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('first_name')}
                        >
                          ชื่อ-นามสกุล <SortIcon field="first_name" />
                        </TableHead>
                        <TableHead 
                          className="hidden md:table-cell cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('department_name')}
                        >
                          แผนก <SortIcon field="department_name" />
                        </TableHead>
                        <TableHead 
                          className="hidden lg:table-cell cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('years_of_service')}
                        >
                          อายุงาน <SortIcon field="years_of_service" />
                        </TableHead>
                        <TableHead className="hidden lg:table-cell text-center">ประเภท</TableHead>
                        <TableHead 
                          className="text-center cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                          onClick={() => handleSort('vacation_remaining')}
                        >
                          พักร้อน <SortIcon field="vacation_remaining" />
                        </TableHead>
                        <TableHead 
                          className="text-center cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('sick_remaining')}
                        >
                          ป่วย <SortIcon field="sick_remaining" />
                        </TableHead>
                        <TableHead className="hidden sm:table-cell text-center">กิจ</TableHead>
                        <TableHead className="hidden md:table-cell text-center">คลอด</TableHead>
                        <TableHead className="hidden md:table-cell text-center">อื่นๆ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>ไม่พบข้อมูลพนักงาน</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredData.map((emp, index) => (
                          <motion.tr
                            key={emp.employee_id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="group hover:bg-muted/30"
                          >
                            <TableCell className="font-mono text-xs sm:text-sm">{emp.employee_code}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs sm:text-sm">
                                  {emp.first_name[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{emp.first_name} {emp.last_name}</p>
                                  <p className="text-xs text-muted-foreground truncate md:hidden">{emp.department_name}</p>
                                  <p className="text-xs text-muted-foreground hidden md:block">{emp.position_name}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-sm">{emp.department_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-sm">{formatYearsOfService(emp.years_of_service)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-center">
                              <Badge variant="outline" className="text-xs">
                                {employeeTypeLabels[emp.employee_type as keyof typeof employeeTypeLabels] || emp.employee_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <LeaveBalanceCell 
                                quota={emp.vacation_quota} 
                                used={emp.vacation_used} 
                                remaining={emp.vacation_remaining}
                                color="bg-info"
                              />
                            </TableCell>
                            <TableCell>
                              <LeaveBalanceCell 
                                quota={emp.sick_quota} 
                                used={emp.sick_used} 
                                remaining={emp.sick_remaining}
                                color="bg-warning"
                              />
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <LeaveBalanceCell 
                                quota={emp.personal_quota} 
                                used={emp.personal_used} 
                                remaining={emp.personal_remaining}
                                color="bg-success"
                              />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <LeaveBalanceCell 
                                quota={emp.maternity_quota + emp.paternity_quota} 
                                used={emp.maternity_used + emp.paternity_used} 
                                remaining={emp.maternity_remaining + emp.paternity_remaining}
                                color="bg-pink-500"
                              />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <LeaveBalanceCell 
                                quota={emp.other_quota} 
                                used={emp.other_used} 
                                remaining={emp.other_remaining}
                                color="bg-muted-foreground"
                              />
                            </TableCell>
                          </motion.tr>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </MobileTableWrapper>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}

// Sub-component for leave balance cell
function LeaveBalanceCell({ 
  quota, 
  used, 
  remaining, 
  color 
}: { 
  quota: number; 
  used: number; 
  remaining: number; 
  color: string;
}) {
  if (quota === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const percentage = quota > 0 ? (used / quota) * 100 : 0;
  const isLow = remaining <= 2 && quota > 0;

  return (
    <div className="min-w-[80px]">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-medium ${isLow ? 'text-destructive' : ''}`}>
          {remaining.toFixed(1)}
        </span>
        <span className="text-xs text-muted-foreground">/{quota.toFixed(0)}</span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  );
}
