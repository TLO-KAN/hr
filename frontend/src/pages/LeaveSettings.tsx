import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Calculator, GitBranch, Bell } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { TableSkeleton, FormSkeleton } from '@/components/ui/skeleton-loaders';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import api from '@/services/api';
import type { EmployeeType, LeavePolicyRule } from '@/types/hr';
import { employeeTypeLabels } from '@/types/hr';
import { ApprovalWorkflowSettings } from '@/components/leave/ApprovalWorkflowSettings';
import { NotificationSettings } from '@/components/leave/NotificationSettings';

interface EmployeeEntitlementRow {
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  employee_type: EmployeeType;
  years_of_service?: number;
  year: number;
  leave_type: string;
  entitled_days: number;
  used_days: number;
  remaining_days: number;
}

export default function LeaveSettings() {
  const { user } = useAuth();
  const [rules, setRules] = useState<LeavePolicyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [entitlementLoading, setEntitlementLoading] = useState(true);
  const [entitlementYear, setEntitlementYear] = useState<number>(new Date().getFullYear());
  const [entitlements, setEntitlements] = useState<EmployeeEntitlementRow[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<LeavePolicyRule | null>(null);
  const [isProrated, setIsProrated] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRuleForDelete, setSelectedRuleForDelete] = useState<LeavePolicyRule | null>(null);
  const [isDeletingRule, setIsDeletingRule] = useState(false);
  const [recalculateDialogOpen, setRecalculateDialogOpen] = useState(false);
  const [isRecalculatingAll, setIsRecalculatingAll] = useState(false);
  const { toast } = useToast();

  const sortRulesByTenure = (items: LeavePolicyRule[]) => {
    return [...items].sort((a, b) => {
      const aMin = Number(a.min_years_of_service ?? 0);
      const bMin = Number(b.min_years_of_service ?? 0);
      if (aMin !== bMin) return aMin - bMin;

      const aMax = a.max_years_of_service == null ? Number.POSITIVE_INFINITY : Number(a.max_years_of_service);
      const bMax = b.max_years_of_service == null ? Number.POSITIVE_INFINITY : Number(b.max_years_of_service);
      return aMax - bMax;
    });
  };

  useEffect(() => {
    fetchRules();
    fetchEntitlements(new Date().getFullYear());
  }, []);

  const fetchEntitlements = async (year: number) => {
    try {
      setEntitlementLoading(true);
      const response = await api.get(`/leave-entitlements?year=${year}`);
      const data = response?.data?.data || [];
      setEntitlements((Array.isArray(data) ? data : []) as EmployeeEntitlementRow[]);
    } catch (error: any) {
      console.error('Error fetching entitlements:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'ไม่สามารถโหลดสิทธิ์ลารายพนักงานได้',
        variant: 'destructive',
      });
      setEntitlements([]);
    } finally {
      setEntitlementLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/leave-policies');
      const data = response?.data?.data || [];

      const normalizedRules = (Array.isArray(data) ? data : []).map((rule: any) => {
        const hasTenureRange =
          rule.tenure_year_from !== null &&
          rule.tenure_year_from !== undefined;

        return {
          ...rule,
          min_years_of_service: Number(
            hasTenureRange
              ? rule.tenure_year_from
              : (rule.min_years_of_service ?? 0)
          ),
          max_years_of_service:
            rule.tenure_year_to !== null && rule.tenure_year_to !== undefined
              ? Number(rule.tenure_year_to)
              : (rule.max_years_of_service ?? null),
          is_prorated: Boolean(rule.is_prorated ?? rule.is_prorated_first_year ?? true),
        };
      });

      setRules(sortRulesByTenure(normalizedRules as LeavePolicyRule[]));
    } catch (error: any) {
      console.error('Error fetching rules:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'โหลดนโยบายการลาไม่สำเร็จ',
        variant: 'destructive',
      });
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const maxYears = formData.get('max_years_of_service') as string;
    
    const ruleData = {
      employee_type: formData.get('employee_type') as EmployeeType,
      min_years_of_service: parseInt(formData.get('min_years_of_service') as string) || 0,
      max_years_of_service: maxYears ? parseInt(maxYears) : null,
      annual_leave_quota: parseInt(formData.get('annual_leave_quota') as string) || 0,
      sick_leave_quota: parseInt(formData.get('sick_leave_quota') as string) || 0,
      personal_leave_quota: parseInt(formData.get('personal_leave_quota') as string) || 0,
      maternity_leave_quota: parseInt(formData.get('maternity_leave_quota') as string) || 0,
      is_prorated: isProrated,
      is_prorated_first_year: isProrated,
      description: formData.get('description') as string || null,
    };

    try {
      if (editingRule?.id) {
        await api.put(`/leave-policies/${editingRule.id}`, ruleData);
        toast({ title: 'อัพเดตกฎการลาสำเร็จ' });
      } else {
        await api.post('/leave-policies', ruleData);
        toast({ title: 'เพิ่มกฎการลาสำเร็จ' });
      }

      setIsDialogOpen(false);
      setEditingRule(null);
      setIsProrated(true);
      fetchRules();
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'บันทึกข้อมูลไม่สำเร็จ',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRule = async () => {
    if (!selectedRuleForDelete?.id) return;
    setIsDeletingRule(true);
    try {
      await api.delete(`/leave-policies/${selectedRuleForDelete.id}`);
      toast({ title: 'ลบกฎการลาสำเร็จ' });
      setDeleteDialogOpen(false);
      setSelectedRuleForDelete(null);
      fetchRules();
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'ลบข้อมูลไม่สำเร็จ',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingRule(false);
    }
  };

  const openDeleteDialog = (rule: LeavePolicyRule) => {
    setSelectedRuleForDelete(rule);
    setDeleteDialogOpen(true);
  };

  const handleRecalculateAll = async () => {
    setIsRecalculatingAll(true);

    toast({ title: 'กำลังคำนวณ...', description: 'กรุณารอสักครู่' });
    
    try {
      const currentYear = new Date().getFullYear();
      const response = await api.post('/leave-balances/run-annual-update', { year: currentYear });
      const data = response?.data || {};
      
      await fetchEntitlements(entitlementYear);
      setRecalculateDialogOpen(false);
      toast({ 
        title: 'คำนวณสิทธิ์วันลาใหม่เรียบร้อย', 
        description: `อัพเดต ${data?.updated_employees || 0} คน` 
      });
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'คำนวณสิทธิ์วันลาไม่สำเร็จ',
        variant: 'destructive',
      });
    } finally {
      setIsRecalculatingAll(false);
    }
  };

  const formatYearsRange = (min: number, max: number | null) => {
    if (max === null) {
      return `${min} ปีขึ้นไป`;
    }
    if (min === 0 && max === 0) {
      return 'น้อยกว่า 1 ปี';
    }
    if (min === max) {
      return `${min} ปี`;
    }
    return `${min} - ${max} ปี`;
  };

  const openEditDialog = (rule: LeavePolicyRule) => {
    setEditingRule(rule);
    setIsProrated(rule.is_prorated);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setIsProrated(true);
    setIsDialogOpen(true);
  };

  const entitlementByEmployee = entitlements.reduce((acc, row) => {
    if (!acc[row.employee_id]) {
      const yearsOfService =
        row.years_of_service == null
          ? 0
          : Number(row.years_of_service);

      acc[row.employee_id] = {
        employee_id: row.employee_id,
        employee_code: row.employee_code,
        first_name: row.first_name,
        last_name: row.last_name,
        employee_type: row.employee_type,
        years_of_service: Number.isFinite(yearsOfService) ? yearsOfService : 0,
        vacation: { entitled: 0, used: 0, remaining: 0 },
        sick: { entitled: 0, used: 0, remaining: 0 },
        personal: { entitled: 0, used: 0, remaining: 0 },
        maternity: { entitled: 0, used: 0, remaining: 0 },
      };
    }

    const leaveType = (row.leave_type === 'annual' ? 'vacation' : row.leave_type) as 'vacation' | 'sick' | 'personal' | 'maternity';
    if (acc[row.employee_id][leaveType]) {
      acc[row.employee_id][leaveType] = {
        entitled: Number(row.entitled_days || 0),
        used: Number(row.used_days || 0),
        remaining: Number(row.remaining_days || 0),
      };
    }

    return acc;
  }, {} as Record<string, {
    employee_id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    employee_type: EmployeeType;
    years_of_service: number;
    vacation: { entitled: number; used: number; remaining: number };
    sick: { entitled: number; used: number; remaining: number };
    personal: { entitled: number; used: number; remaining: number };
    maternity: { entitled: number; used: number; remaining: number };
  }>);

  const entitlementRows = Object.values(entitlementByEmployee);

  // Group rules by employee type
  const permanentRules = rules.filter(r => r.employee_type === 'permanent');
  const contractRules = rules.filter(r => r.employee_type === 'contract');
  const parttimeRules = rules.filter(r => r.employee_type === 'parttime');

  const RulesTable = ({ rulesList, showType = false }: { rulesList: LeavePolicyRule[], showType?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          {showType && <TableHead>ประเภท</TableHead>}
          <TableHead>อายุงาน</TableHead>
          <TableHead className="text-center">พักร้อน</TableHead>
          <TableHead className="text-center">ป่วย</TableHead>
          <TableHead className="text-center">กิจ</TableHead>
          <TableHead className="text-center">คลอด</TableHead>
          <TableHead className="text-center">Pro-rate</TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rulesList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showType ? 8 : 7} className="text-center py-8 text-muted-foreground">
              ยังไม่มีกฎการลา
            </TableCell>
          </TableRow>
        ) : (
          rulesList.map((rule) => (
            <TableRow key={rule.id}>
              {showType && (
                <TableCell className="font-medium">
                  {employeeTypeLabels[rule.employee_type]}
                </TableCell>
              )}
              <TableCell>{formatYearsRange(rule.min_years_of_service, rule.max_years_of_service)}</TableCell>
              <TableCell className="text-center">{rule.annual_leave_quota}</TableCell>
              <TableCell className="text-center">{rule.sick_leave_quota}</TableCell>
              <TableCell className="text-center">{rule.personal_leave_quota}</TableCell>
              <TableCell className="text-center">{rule.maternity_leave_quota}</TableCell>
              <TableCell className="text-center">
                <span className={`text-xs px-2 py-1 rounded-full ${rule.is_prorated ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {rule.is_prorated ? 'ใช่' : 'ไม่'}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(rule)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteDialog(rule)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <DashboardLayout
      title="ตั้งค่าสิทธิ์การลา"
      subtitle="กำหนดสิทธิ์การลาตามประเภทพนักงานและอายุงาน (รองรับ Pro-rate)"
      actions={null}
    >
      <Tabs defaultValue="policies" className="space-y-6">
        <TabsList>
          <TabsTrigger value="policies">นโยบายการลา</TabsTrigger>
          <TabsTrigger value="employee-entitlements">สิทธิ์รายพนักงาน</TabsTrigger>
          <TabsTrigger value="approval">
            <GitBranch className="w-4 h-4 mr-2" />
            ลำดับการอนุมัติ
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            การแจ้งเตือน
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="space-y-6">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => setRecalculateDialogOpen(true)}>
              <Calculator className="w-4 h-4 mr-2" />
              คำนวณใหม่ทั้งหมด
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่มกฎการลา
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingRule ? 'แก้ไขกฎการลา' : 'เพิ่มกฎการลาใหม่'}
                  </DialogTitle>
                  <DialogDescription>
                    กำหนดสิทธิ์การลาตามประเภทพนักงานและอายุงาน
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveRule} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="employee_type">ประเภทพนักงาน</Label>
                      <Select name="employee_type" defaultValue={editingRule?.employee_type || 'permanent'}>
                        <SelectTrigger label="ประเภทพนักงาน">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="permanent">ประจำ</SelectItem>
                          <SelectItem value="contract">สัญญาจ้าง/ทดลองงาน</SelectItem>
                          <SelectItem value="parttime">พาร์ทไทม์</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="description">คำอธิบาย</Label>
                      <Input
                        label="คำอธิบาย"
                        id="description"
                        name="description"
                        defaultValue={editingRule?.description || ''}
                        placeholder="เช่น พนักงานใหม่"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="min_years_of_service">อายุงานขั้นต่ำ (ปี)</Label>
                      <Input
                        label="อายุงานขั้นต่ำ"
                        id="min_years_of_service"
                        name="min_years_of_service"
                        type="number"
                        min="0"
                        defaultValue={editingRule?.min_years_of_service || 0}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_years_of_service">อายุงานสูงสุด (ปี)</Label>
                      <Input
                        label="อายุงานสูงสุด"
                        id="max_years_of_service"
                        name="max_years_of_service"
                        type="number"
                        min="0"
                        defaultValue={editingRule?.max_years_of_service ?? ''}
                        placeholder="ว่างไว้ = ไม่จำกัด"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="is_prorated"
                          checked={isProrated}
                          onCheckedChange={setIsProrated}
                        />
                        <Label htmlFor="is_prorated" className="cursor-pointer">
                          ใช้ Pro-rate
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      สิทธิ์วันลา (วันต่อปี)
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="annual_leave_quota">ลาพักร้อน</Label>
                        <Input
                          label="สิทธิ์ลาพักร้อน"
                          id="annual_leave_quota"
                          name="annual_leave_quota"
                          type="number"
                          min="0"
                          defaultValue={editingRule?.annual_leave_quota || 0}
                        />
                      </div>
                      <div>
                        <Label htmlFor="sick_leave_quota">ลาป่วย</Label>
                        <Input
                          label="สิทธิ์ลาป่วย"
                          id="sick_leave_quota"
                          name="sick_leave_quota"
                          type="number"
                          min="0"
                          defaultValue={editingRule?.sick_leave_quota || 0}
                        />
                      </div>
                      <div>
                        <Label htmlFor="personal_leave_quota">ลากิจ</Label>
                        <Input
                          label="สิทธิ์ลากิจ"
                          id="personal_leave_quota"
                          name="personal_leave_quota"
                          type="number"
                          min="0"
                          defaultValue={editingRule?.personal_leave_quota || 0}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor="maternity_leave_quota">ลาคลอด</Label>
                        <Input
                          label="สิทธิ์ลาคลอด"
                          id="maternity_leave_quota"
                          name="maternity_leave_quota"
                          type="number"
                          min="0"
                          defaultValue={editingRule?.maternity_leave_quota || 0}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                    <p className="font-medium mb-2">📋 สูตรคำนวณ Pro-rate:</p>
                    <p className="font-mono text-xs">สิทธิ์วันลา = (วันลา/ปี ÷ 365) × จำนวนวันทำงานจริงในปี</p>
                    <p className="mt-2">* ปัดเศษลงขั้นต่ำ 0.5 วัน</p>
                    <p>* ลาคลอดไม่ใช้ Pro-rate</p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      ยกเลิก
                    </Button>
                    <Button type="submit">
                      {editingRule ? 'บันทึก' : 'เพิ่มกฎการลา'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Permanent Employees */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔹 พนักงานประจำ</CardTitle>
                <CardDescription>สิทธิ์การลาสำหรับพนักงานประจำ (ผ่านทดลองงาน)</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <FormSkeleton />
                ) : (
                  <RulesTable rulesList={permanentRules} />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Contract/Probation Employees */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔸 พนักงานสัญญาจ้าง/ทดลองงาน</CardTitle>
                <CardDescription>สิทธิ์การลาสำหรับพนักงานทดลองงานหรือสัญญาจ้าง</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <FormSkeleton />
                ) : (
                  <RulesTable rulesList={contractRules} />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Part-time Employees */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔻 พนักงานพาร์ทไทม์</CardTitle>
                <CardDescription>สิทธิ์การลาสำหรับพนักงานพาร์ทไทม์</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <FormSkeleton />
                ) : (
                  <RulesTable rulesList={parttimeRules} />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="employee-entitlements" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">สิทธิ์การลารายพนักงาน</CardTitle>
                <CardDescription>แสดงสิทธิ์, ใช้ไป และคงเหลือ แยกตามประเภทการลา</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="entitlement_year">ปี</Label>
                <Input
                  label="ปีสิทธิ์ลา"
                  id="entitlement_year"
                  type="number"
                  className="w-28"
                  value={entitlementYear}
                  onChange={(e) => setEntitlementYear(parseInt(e.target.value || String(new Date().getFullYear()), 10))}
                />
                <Button variant="outline" onClick={() => fetchEntitlements(entitlementYear)}>
                  โหลดข้อมูล
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {entitlementLoading ? (
                <TableSkeleton rows={5} />
              ) : entitlements?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">ยังไม่มีข้อมูลสิทธิ์ลาสำหรับปีนี้</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>รหัส</TableHead>
                      <TableHead>พนักงาน</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead className="text-center">อายุงาน</TableHead>
                      <TableHead className="text-center">สิทธิ์วันลาสะสมทั้งหมด</TableHead>
                      <TableHead className="text-center">พักร้อน</TableHead>
                      <TableHead className="text-center">ป่วย</TableHead>
                      <TableHead className="text-center">กิจ</TableHead>
                      <TableHead className="text-center">คลอด</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entitlementRows.map((row) => (
                      <TableRow key={row.employee_id}>
                        <TableCell>{row.employee_code || '-'}</TableCell>
                        <TableCell>{row.first_name} {row.last_name}</TableCell>
                        <TableCell>{employeeTypeLabels[row.employee_type] || row.employee_type}</TableCell>
                        <TableCell className="text-center">{row.years_of_service} ปี</TableCell>
                        <TableCell className="text-center">{row.vacation.entitled}</TableCell>
                        <TableCell className="text-center">{row.vacation.entitled} / {row.vacation.remaining}</TableCell>
                        <TableCell className="text-center">{row.sick.entitled} / {row.sick.remaining}</TableCell>
                        <TableCell className="text-center">{row.personal.entitled} / {row.personal.remaining}</TableCell>
                        <TableCell className="text-center">{row.maternity.entitled} / {row.maternity.remaining}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-xs text-muted-foreground mt-3">รูปแบบตัวเลข: สิทธิ์ทั้งปี / คงเหลือ</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval">
          <ApprovalWorkflowSettings />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

      </Tabs>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="ยืนยันการลบกฎการลา"
        description={selectedRuleForDelete
          ? `คุณแน่ใจหรือไม่ที่จะลบกฎอายุงาน ${formatYearsRange(selectedRuleForDelete.min_years_of_service, selectedRuleForDelete.max_years_of_service)}?`
          : 'คุณแน่ใจหรือไม่ที่จะลบกฎการลานี้?'}
        onConfirm={handleDeleteRule}
        isDeleting={isDeletingRule}
      />

      <DeleteConfirmDialog
        open={recalculateDialogOpen}
        onOpenChange={setRecalculateDialogOpen}
        title="ยืนยันการคำนวณสิทธิ์วันลาใหม่"
        description="ต้องการคำนวณสิทธิ์วันลาใหม่สำหรับพนักงานทั้งหมดใช่หรือไม่?"
        onConfirm={handleRecalculateAll}
        isDeleting={isRecalculatingAll}
        confirmLabel="ยืนยันคำนวณ"
        loadingLabel="กำลังคำนวณ..."
      />
    </DashboardLayout>
  );
}