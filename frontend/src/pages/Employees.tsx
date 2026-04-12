import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Key, Copy, Check, Shield, Info, ToggleLeft, ToggleRight } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Department, Position, EmployeeType, EmployeeStatus, AppRole } from '@/types/hr';
import { employeeTypeLabels, roleLabels } from '@/types/hr';
import { format } from 'date-fns';
import { calculateLeaveQuotas, type LeaveQuotaPreview } from '@/lib/leaveQuotaCalculation';
import { queryCache } from '@/lib/queryCache';
import { buildApiUrl } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';

// Password generator
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export default function Employees() {
  const formatDateForInput = (rawDate?: string | null) => {
    if (!rawDate) return '';
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return '';
    return format(parsed, 'yyyy-MM-dd');
  };

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  // Leave quota states
  const [leavePreview, setLeavePreview] = useState<LeaveQuotaPreview>({
    annual_leave_quota: 0,
    sick_leave_quota: 30,
    personal_leave_quota: 3,
    probationEndDate: null,
    tenureYears: 0,
    tenureMonths: 0,
    policyMode: 'accrual',
    baseQuotaDays: 0,
    monthlyAccrualRate: 0.5,
    proratePercent: 0,
    helperText: '',
    calculationDetails: '',
  });
  const [leaveAdjustments, setLeaveAdjustments] = useState({
    annual: 0,
    sick: 0,
    personal: 0,
  });
  const [manualOverride, setManualOverride] = useState(false);
  const [manualAnnualQuota, setManualAnnualQuota] = useState<number>(0);
  const [probationEndDateOverride, setProbationEndDateOverride] = useState<string>('');
  const [probationDateTouched, setProbationDateTouched] = useState(false);
  const [selectedEmployeeType, setSelectedEmployeeType] = useState<EmployeeType>('permanent');
  const [selectedStartDate, setSelectedStartDate] = useState('');
  
  // User account creation states
  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('employee');
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Reset password states
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordResult, setResetPasswordResult] = useState<string | null>(null);
  const [selectedEmployeeForReset, setSelectedEmployeeForReset] = useState<Employee | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  // Change role states
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false);
  const [selectedEmployeeForRole, setSelectedEmployeeForRole] = useState<Employee | null>(null);
  const [newRoleForEmployee, setNewRoleForEmployee] = useState<AppRole>('employee');
  const [isChangingRole, setIsChangingRole] = useState(false);
  
  // Send credentials email checkbox
  const [sendCredentialsEmail, setSendCredentialsEmail] = useState(true);
  
  // Select field states
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedPositionId, setSelectedPositionId] = useState<string>('');
  const [filteredPositions, setFilteredPositions] = useState<typeof positions>([]);

  const { toast } = useToast();
  const { permissions } = useAuth();
  const canManageEmployees = permissions.canManageUsers;

  useEffect(() => {
    fetchData();
  }, []);

  // Reset form and set selected values when editing employee changes
  useEffect(() => {
    if (editingEmployee) {
      // Convert to string to match state type (values from DB may be numbers)
      setSelectedDepartmentId(editingEmployee.department_id ? String(editingEmployee.department_id) : 'none');
      setSelectedPositionId(editingEmployee.position_id ? String(editingEmployee.position_id) : 'none');
      setSelectedEmployeeType(editingEmployee.employee_type || 'permanent');
      setSelectedStartDate(formatDateForInput(editingEmployee.start_date));
      setLeaveAdjustments({ annual: 0, sick: 0, personal: 0 });
      setManualOverride(false);
      setProbationEndDateOverride('');  // will be auto-filled by useEffect after startDate is set
      setProbationDateTouched(false);
    } else {
      setSelectedDepartmentId('none');
      setSelectedPositionId('none');
      setSelectedEmployeeType('permanent');
      setSelectedStartDate('');
      setLeaveAdjustments({ annual: 0, sick: 0, personal: 0 });
      setManualOverride(false);
      setManualAnnualQuota(0);
      setProbationEndDateOverride('');
      setProbationDateTouched(false);
    }
  }, [editingEmployee, isDialogOpen]);

  // Filter positions by selected department
  useEffect(() => {
    if (selectedDepartmentId && selectedDepartmentId !== 'none') {
      const filtered = positions.filter(pos => String(pos.department_id) === selectedDepartmentId);
      setFilteredPositions(filtered);
      // Clear position selection if it's not in the filtered list
      if (selectedPositionId && selectedPositionId !== 'none' && !filtered.some(p => String(p.id) === selectedPositionId)) {
        setSelectedPositionId('none');
      }
    } else {
      // If no department selected, show all positions
      setFilteredPositions(positions);
    }
  }, [selectedDepartmentId, positions]);

  // Auto-calculate leave quotas (Hybrid: Accrual + Step-up)
  useEffect(() => {
    const updateQuotas = async () => {
      if (!selectedStartDate) {
        setLeavePreview((prev) => ({ ...prev, annual_leave_quota: 0, probationEndDate: null, helperText: '' }));
        if (!probationDateTouched) {
          setProbationEndDateOverride('');
        }
        return;
      }

      const fallbackProbationEndDate = (() => {
        const start = new Date(selectedStartDate);
        if (Number.isNaN(start.getTime())) return '';
        const probation = new Date(start);
        probation.setDate(probation.getDate() + 119);
        return probation.toISOString().split('T')[0];
      })();

      const preview = await calculateLeaveQuotas(selectedEmployeeType, selectedStartDate);
      setLeavePreview(preview);
      if (!manualOverride) {
        setManualAnnualQuota(preview.annual_leave_quota);
      }

      // Auto-fill probation end date unless HR manually changed it
      if (!probationDateTouched) {
        setProbationEndDateOverride(preview.probationEndDate || fallbackProbationEndDate);
      }
    };
    updateQuotas();
  }, [selectedEmployeeType, selectedStartDate]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('ไม่พบข้อมูลเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
      }

      // Check cache first
      const cacheKey = 'employees-list';
      const cached = queryCache.get<any>(cacheKey);
      
      if (cached) {
        console.log('📦 Using cached employees data');
        setEmployees(cached.employees);
        setDepartments(cached.departments);
        setPositions(cached.positions);
        setLoading(false);
        return;
      }

      const [employeesSettled, departmentsSettled, positionsSettled] = await Promise.allSettled([
        fetch(buildApiUrl('/employees'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(buildApiUrl('/departments'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(buildApiUrl('/positions'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (employeesSettled.status !== 'fulfilled') {
        throw new Error('ไม่สามารถโหลดข้อมูลพนักงานได้');
      }

      const employeesRes = employeesSettled.value;
      if (!employeesRes.ok) {
        const employeesErr = await employeesRes.json().catch(() => null);
        throw new Error(employeesErr?.error || 'ไม่สามารถโหลดข้อมูลพนักงานได้');
      }

      const employeesData = await employeesRes.json();

      const departmentsData =
        departmentsSettled.status === 'fulfilled' && departmentsSettled.value.ok
          ? await departmentsSettled.value.json()
          : [];
      const positionsData =
        positionsSettled.status === 'fulfilled' && positionsSettled.value.ok
          ? await positionsSettled.value.json()
          : [];

      const normalizedEmployees = Array.isArray(employeesData)
        ? employeesData
        : (employeesData?.data ?? []);
      const normalizedDepartments = Array.isArray(departmentsData)
        ? departmentsData
        : (departmentsData?.data ?? []);
      const normalizedPositions = Array.isArray(positionsData)
        ? positionsData
        : (positionsData?.data ?? []);

      // Cache for 5 minutes
      queryCache.set(cacheKey, {
        employees: normalizedEmployees,
        departments: normalizedDepartments,
        positions: normalizedPositions,
      }, 5 * 60 * 1000);

      setEmployees(normalizedEmployees);
      setDepartments(normalizedDepartments);
      setPositions(normalizedPositions);

      if (departmentsSettled.status !== 'fulfilled' || !departmentsSettled.value.ok) {
        toast({
          title: 'โหลดรายการแผนกไม่สำเร็จ',
          description: 'ยังสามารถดูรายชื่อพนักงานได้ แต่การกำหนดแผนกอาจไม่ครบ',
          variant: 'destructive',
        });
      }

      if (positionsSettled.status !== 'fulfilled' || !positionsSettled.value.ok) {
        toast({
          title: 'โหลดรายการตำแหน่งไม่สำเร็จ',
          description: 'ยังสามารถดูรายชื่อพนักงานได้ แต่การกำหนดตำแหน่งอาจไม่ครบ',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลพนักงานได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingEmployee(true);

    // Validate required fields
    if (departments.length > 0 && selectedDepartmentId === 'none') {
      toast({
        title: 'ขาดข้อมูล',
        description: 'กรุณาเลือกแผนก',
        variant: 'destructive',
      });
      setSavingEmployee(false);
      return;
    }

    if (positions.length > 0 && selectedPositionId === 'none') {
      toast({
        title: 'ขาดข้อมูล',
        description: 'กรุณาเลือกตำแหน่ง',
        variant: 'destructive',
      });
      setSavingEmployee(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    
    const email = formData.get('email') as string;

    // Determine final annual leave quota with rounding to 0.5
    const computedAnnual = manualOverride
      ? Math.floor(manualAnnualQuota * 2) / 2
      : Math.floor(leavePreview.annual_leave_quota * 2) / 2;

    const employeeData = {
      employee_code: formData.get('employee_code') as string,
      prefix: formData.get('prefix') as string,
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      email,
      phone: formData.get('phone') as string,
      id_card_number: formData.get('id_card_number') as string,
      birth_date: formData.get('birth_date') as string || null,
      gender: formData.get('gender') as string,
      address: formData.get('address') as string,
      department_id: formData.get('department_id') as string || null,
      position_id: formData.get('position_id') as string || null,
      employee_type: selectedEmployeeType,
      start_date: formData.get('start_date') as string,
      status: (formData.get('status') as EmployeeStatus) || 'active',
      leave_adjustments: leaveAdjustments,
      // Hybrid leave entitlement fields
      annual_leave_quota: computedAnnual,
      sick_leave_quota: leavePreview.sick_leave_quota,
      personal_leave_quota: leavePreview.personal_leave_quota,
      manual_leave_override: manualOverride,
      leave_policy_mode: leavePreview.policyMode,
      probation_end_date: probationEndDateOverride || null,
    };

    try {
      if (editingEmployee) {
        // For PUT, only send fields that exist in the employees table
        const updateData = {
          employee_code: employeeData.employee_code,
          first_name: employeeData.first_name,
          last_name: employeeData.last_name,
          email: employeeData.email,
          phone: employeeData.phone,
          department_id: employeeData.department_id,
          position_id: employeeData.position_id,
          employee_type: selectedEmployeeType,
          start_date: employeeData.start_date,
          status: employeeData.status,
          leave_adjustments: leaveAdjustments,
          // Pass leave quota for balance update
          annual_leave_quota: computedAnnual,
          sick_leave_quota: leavePreview.sick_leave_quota,
          personal_leave_quota: leavePreview.personal_leave_quota,
          manual_leave_override: manualOverride,
        };

        const token = localStorage.getItem('token');
        const res = await fetch(buildApiUrl(`/employees/${editingEmployee.id}`), {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(updateData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || 'อัพเดตพนักงานล้มเหลว');
        }

        toast({ title: 'อัพเดตข้อมูลสำเร็จ' });
        setIsDialogOpen(false);
        setEditingEmployee(null);
      } else {
        // Add user account creation data if enabled
        const requestData = {
          ...employeeData,
          create_user_account: createUserAccount,
          password: createUserAccount ? generatedPassword : null,
          role: createUserAccount ? selectedRole : null,
          leave_adjustments: leaveAdjustments,
        };

        const token = localStorage.getItem('token');
        const res = await fetch(buildApiUrl('/employees'), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(requestData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || 'เพิ่มพนักงานล้มเหลว');
        }

        const createdResponse = await res.json();
        const createdEmployeeId = createdResponse?.data?.id;
        
        // Send welcome email if checkbox is enabled
        if (createUserAccount && sendCredentialsEmail && generatedPassword) {
          try {
            console.log('[Employees] Sending welcome email to:', email);
            const emailRes = await fetch(buildApiUrl('/employees/send-welcome-email'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                employee_id: createdEmployeeId,
                email,
                first_name: employeeData.first_name,
                last_name: employeeData.last_name,
                username: email,
                password: generatedPassword,
                role: selectedRole,
                app_url: window.location.origin,
              }),
            });

            if (emailRes.ok) {
              toast({ 
                title: 'เพิ่มพนักงานสำเร็จ',
                description: `ส่ง email ไปยัง ${email} แล้ว`
              });
            } else {
              console.warn('Failed to send welcome email:', await emailRes.json());
              toast({ 
                title: 'เพิ่มพนักงานสำเร็จ',
                description: 'แต่ส่ง email ไม่สำเร็จ' 
              });
            }
          } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
            toast({ 
              title: 'เพิ่มพนักงานสำเร็จ',
              description: 'แต่ส่ง email ไม่สำเร็จ' 
            });
          }
        } else {
          toast({ title: 'เพิ่มพนักงานสำเร็จ' });
        }

        setIsDialogOpen(false);
        setEditingEmployee(null);
        setCreateUserAccount(false);
        setGeneratedPassword('');
        setSelectedRole('employee');
      }

      queryCache.clear('employees-list');
      fetchData();
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deletingId) return;
    setIsDeleting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('ไม่สามารถขอ Token ได้ กรุณา login ใหม่');
      }

      const res = await fetch(buildApiUrl(`/employees/${deletingId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || data?.details || 'ลบพนักงานล้มเหลว');
      }

      const result = await res.json();
      toast({ 
        title: 'ลบพนักงานสำเร็จ',
        description: result.message
      });
      // ลบออกจาก state ทันที และล้าง cache เพื่อป้องกันข้อมูลเก่า
      setEmployees(prev => prev.filter(e => e.id !== deletingId));
      queryCache.clear('employees-list');
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ฟังก์ชันรีเซ็ตรหัสผ่าน
  const handleResetPassword = async () => {
    if (!selectedEmployeeForReset?.id) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'พนักงานนี้ยังไม่มี ID',
        variant: 'destructive',
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(buildApiUrl(`/employees/${selectedEmployeeForReset.id}/reset-password`), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}), // No password sent - backend will auto-generate
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
      }

      const data = await res.json();

      // Show new password in dialog so HR can copy it for the employee
      if (data.newPassword) {
        setResetPasswordResult(data.newPassword);
      } else {
        toast({
          title: '✅ รีเซ็ตรหัสผ่านสำเร็จ',
          description: 'ส่งรหัสผ่านใหม่ไปยังอีเมลแล้ว',
        });
        setResetPasswordDialogOpen(false);
        setSelectedEmployeeForReset(null);
      }
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  // ฟังก์ชันเปลี่ยนบทบาท
  const handleChangeRole = async () => {
    if (!selectedEmployeeForRole?.id) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'พนักงานนี้ยังไม่มี ID',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingRole(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(buildApiUrl(`/employees/${selectedEmployeeForRole.id}/role`), {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ new_role: newRoleForEmployee }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || 'ไม่สามารถเปลี่ยนบทบาทได้');
      }

      toast({
        title: 'เปลี่ยนบทบาทสำเร็จ',
        description: `เปลี่ยนเป็น ${roleLabels[newRoleForEmployee as AppRole]}`,
      });
      
      setChangeRoleDialogOpen(false);
      setSelectedEmployeeForRole(null);
      queryCache.clear('employees-list');
      fetchData();
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsChangingRole(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const search = searchQuery.toLowerCase();
    const firstName = (emp.first_name ?? '').toLowerCase();
    const lastName = (emp.last_name ?? '').toLowerCase();
    const employeeCode = (emp.employee_code ?? '').toLowerCase();
    const departmentName = ((emp as any).department_name ?? '').toLowerCase();

    const matchesSearch =
      firstName.includes(search) ||
      lastName.includes(search) ||
      employeeCode.includes(search) ||
      departmentName.includes(search);

    // Convert department_id to string for comparison since Select values are strings
    const matchesDepartment = filterDepartment === 'all' || String(emp.department_id) === filterDepartment;
    const matchesStatus = filterStatus === 'all' || emp.status === filterStatus;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  return (
    <DashboardLayout
      title="ข้อมูลพนักงาน"
      subtitle={`ทั้งหมด ${employees.length} คน`}
      actions={canManageEmployees ? (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingEmployee(null)}>
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มพนักงาน
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
              </DialogTitle>
              <DialogDescription>
                กรอกข้อมูลพนักงานให้ครบถ้วน
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveEmployee} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">ข้อมูลพื้นฐาน</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="employee_code">รหัสพนักงาน *</Label>
                    <Input
                      id="employee_code"
                      name="employee_code"
                      defaultValue={editingEmployee?.employee_code}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="prefix">คำนำหน้า</Label>
                    <Select name="prefix" defaultValue={editingEmployee?.prefix || 'นาย'}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="นาย">นาย</SelectItem>
                        <SelectItem value="นาง">นาง</SelectItem>
                        <SelectItem value="นางสาว">นางสาว</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">ชื่อ *</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      defaultValue={editingEmployee?.first_name}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">นามสกุล *</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      defaultValue={editingEmployee?.last_name}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">อีเมล *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={editingEmployee?.email || ''}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">เบอร์โทร</Label>
                    <Input
                      id="phone"
                      name="phone"
                      defaultValue={editingEmployee?.phone || ''}
                    />
                  </div>
                </div>
              </div>

              {/* Work Info */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">ข้อมูลการทำงาน</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="department_id">แผนก *</Label>
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                      <SelectTrigger className={selectedDepartmentId === 'none' ? 'border-destructive' : ''}>
                        <SelectValue placeholder="เลือกแผนก" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- ไม่ระบุ --</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={String(dept.id)}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedDepartmentId === 'none' && (
                      <p className="text-xs text-destructive mt-1">⚠️ กรุณาเลือกแผนก</p>
                    )}
                    <input type="hidden" name="department_id" value={selectedDepartmentId === 'none' ? '' : selectedDepartmentId} />
                  </div>
                  <div>
                    <Label htmlFor="position_id">ตำแหน่ง *</Label>
                    <Select value={selectedPositionId} onValueChange={setSelectedPositionId} disabled={selectedDepartmentId === 'none'}>
                      <SelectTrigger className={selectedPositionId === 'none' ? 'border-destructive' : ''}>
                        <SelectValue placeholder={selectedDepartmentId === 'none' ? 'เลือกแผนกก่อน' : 'เลือกตำแหน่ง'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- ไม่ระบุ --</SelectItem>
                        {filteredPositions.length > 0 ? (
                          filteredPositions.map((pos) => (
                            <SelectItem key={pos.id} value={String(pos.id)}>
                              {pos.name}
                            </SelectItem>
                          ))
                        ) : (
                          <p className="p-2 text-sm text-muted-foreground">ไม่มีตำแหน่งสำหรับแผนกนี้</p>
                        )}
                      </SelectContent>
                    </Select>
                    {selectedPositionId === 'none' && selectedDepartmentId !== 'none' && (
                      <p className="text-xs text-destructive mt-1">⚠️ กรุณาเลือกตำแหน่ง</p>
                    )}
                    <input type="hidden" name="position_id" value={selectedPositionId === 'none' ? '' : selectedPositionId} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="employee_type">ประเภทพนักงาน</Label>
                    <Select 
                      name="employee_type" 
                      value={selectedEmployeeType}
                      onValueChange={(value) => setSelectedEmployeeType(value as EmployeeType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanent">ประจำ</SelectItem>
                        <SelectItem value="contract">ทดลองงาน/สัญญาจ้าง</SelectItem>
                        <SelectItem value="parttime">พาร์ทไทม์</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="start_date">วันที่เริ่มงาน *</Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="date"
                      value={selectedStartDate}
                      onChange={(e) => setSelectedStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">สถานะ</Label>
                    <Select name="status" defaultValue={editingEmployee?.status || 'active'}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">ทำงาน</SelectItem>
                        <SelectItem value="resigned">ลาออก</SelectItem>
                        <SelectItem value="suspended">พักงาน</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Leave Entitlement - Hybrid (Accrual + Step-up) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    การจัดการสิทธิ์วันลา (Leave Entitlement)
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${leavePreview.policyMode === 'accrual' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                    {leavePreview.policyMode === 'accrual' ? '⏳ Option B: Accrual (สะสมรายเดือน)' : '✅ Step-up Policy (สิทธิ์เต็มปี)'}
                  </span>
                </div>

                {/* Probation End Date */}
                {selectedStartDate && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>วันที่เริ่มงาน</Label>
                      <Input value={selectedStartDate || '-'} readOnly disabled />
                    </div>
                    <div>
                      <Label>วันที่พ้นโปร (Probation End Date)</Label>
                      <Input
                        type="date"
                        name="probation_end_date"
                        value={probationEndDateOverride}
                        onChange={(e) => {
                          setProbationDateTouched(true);
                          setProbationEndDateOverride(e.target.value);
                        }}
                        className="border-amber-300 dark:border-amber-700 focus:ring-amber-400"
                      />
                      <p className="text-xs text-muted-foreground mt-1">ค่าเริ่มต้น +119 วัน · แก้ไขได้หากพ้นโปรก่อนกำหนด</p>
                    </div>
                  </div>
                )}

                {/* Current Year Quota Preview */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Info className="h-4 w-4 text-primary" />
                    สิทธิ์พักร้อนปีปัจจุบัน {new Date().getFullYear()} (Current Year Quota)
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <div>
                      <Label className="text-xs text-muted-foreground">จำนวนวัน (คำนวณอัตโนมัติ)</Label>
                      <Input
                        value={
                          manualOverride
                            ? manualAnnualQuota
                            : leavePreview.annual_leave_quota
                        }
                        readOnly={!manualOverride}
                        disabled={!manualOverride}
                        type="number"
                        min={0}
                        step={0.5}
                        onChange={(e) => {
                          if (manualOverride) {
                            setManualAnnualQuota(Math.floor(Number(e.target.value) * 2) / 2);
                          }
                        }}
                        className={manualOverride ? 'border-primary ring-1 ring-primary' : 'bg-muted/50'}
                      />
                    </div>
                    <div>
                      {/* Manual Override Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = !manualOverride;
                          setManualOverride(next);
                          if (!next) {
                            // Reset to calculated value when turning off override
                            setManualAnnualQuota(leavePreview.annual_leave_quota);
                          }
                        }}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${manualOverride ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:text-foreground'}`}
                      >
                        {manualOverride ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {manualOverride ? 'กำหนดสิทธิ์เอง (Manual)' : 'กำหนดสิทธิ์เอง'}
                      </button>
                      {manualOverride && (
                        <p className="text-xs text-primary mt-1">สำหรับพนักงานบริหารที่ได้สิทธิ์พิเศษ</p>
                      )}
                    </div>
                  </div>
                  {/* Helper Text */}
                  {leavePreview.helperText && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{leavePreview.helperText}</p>
                  )}
                </div>

                {/* Other Leave Types */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ลาป่วย (Sick Leave / ปี)</Label>
                    <Input
                      type="number"
                      value={leavePreview.sick_leave_quota}
                      readOnly
                      disabled
                    />
                  </div>
                  <div>
                    <Label>ลากิจ (Personal Leave / ปี)</Label>
                    <Input
                      type="number"
                      value={leavePreview.personal_leave_quota}
                      readOnly
                      disabled
                    />
                  </div>
                </div>

                {/* Manual Adjustment (fine-tune) */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">ปรับเพิ่ม/ลดสิทธิ์รายบุคคล (เพิ่มเติมจากค่าคำนวณ)</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>ปรับลาพักร้อน</Label>
                      <Input
                        type="number"
                        step={0.5}
                        value={leaveAdjustments.annual}
                        onChange={(e) => setLeaveAdjustments((prev) => ({ ...prev, annual: Number(e.target.value || 0) }))}
                      />
                    </div>
                    <div>
                      <Label>ปรับลาป่วย</Label>
                      <Input
                        type="number"
                        step={0.5}
                        value={leaveAdjustments.sick}
                        onChange={(e) => setLeaveAdjustments((prev) => ({ ...prev, sick: Number(e.target.value || 0) }))}
                      />
                    </div>
                    <div>
                      <Label>ปรับลากิจ</Label>
                      <Input
                        type="number"
                        step={0.5}
                        value={leaveAdjustments.personal}
                        onChange={(e) => setLeaveAdjustments((prev) => ({ ...prev, personal: Number(e.target.value || 0) }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* User Account Creation - Only for new employees */}
              {!editingEmployee && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="create_user"
                      checked={createUserAccount}
                      onCheckedChange={(checked) => {
                        setCreateUserAccount(checked === true);
                        if (checked && !generatedPassword) {
                          setGeneratedPassword(generatePassword());
                        }
                      }}
                    />
                    <Label htmlFor="create_user" className="cursor-pointer">
                      สร้างบัญชีผู้ใช้เพื่อเข้าสู่ระบบ
                    </Label>
                  </div>
                  
                  {createUserAccount && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pl-6"
                    >
                      <div className="p-4 bg-muted rounded-lg space-y-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Key className="w-4 h-4" />
                          <span>ข้อมูลบัญชีผู้ใช้</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>รหัสผ่าน (สร้างอัตโนมัติ)</Label>
                            <div className="flex gap-2">
                              <Input
                                value={generatedPassword}
                                readOnly
                                className="font-mono"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setGeneratedPassword(generatePassword())}
                              >
                                🔄
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label>สิทธิ์การใช้งาน</Label>
                            <Select
                              value={selectedRole}
                              onValueChange={(v) => setSelectedRole(v as AppRole)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="employee">{roleLabels.employee}</SelectItem>
                                <SelectItem value="supervisor">{roleLabels.supervisor}</SelectItem>
                                <SelectItem value="hr">{roleLabels.hr}</SelectItem>
                                <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          * อีเมลจะใช้จากช่อง "อีเมล" ด้านบน โปรดตรวจสอบให้ถูกต้อง
                        </p>
                        
                        <div className="flex items-center gap-2 pt-2">
                          <Checkbox
                            id="send_credentials"
                            checked={sendCredentialsEmail}
                            onCheckedChange={(checked) => setSendCredentialsEmail(checked === true)}
                          />
                          <Label htmlFor="send_credentials" className="cursor-pointer text-sm">
                            ✉️ ส่งข้อมูลการเข้าสู่ระบบผ่านอีเมล
                          </Label>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={savingEmployee}>
                  {savingEmployee ? 'กำลังบันทึก...' : editingEmployee ? 'บันทึก' : 'เพิ่มพนักงาน'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    >
      {/* Credentials Dialog */}
      <Dialog open={canManageEmployees && showCredentials} onOpenChange={setShowCredentials}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สร้างบัญชีผู้ใช้สำเร็จ</DialogTitle>
            <DialogDescription>
              กรุณาบันทึกข้อมูลนี้ไว้เพื่อแจ้งพนักงาน (รหัสผ่านจะไม่แสดงอีก)
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">อีเมล:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{createdCredentials.email}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(createdCredentials.email, 'email')}
                    >
                      {copiedField === 'email' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">รหัสผ่าน:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{createdCredentials.password}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                    >
                      {copiedField === 'password' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  copyToClipboard(
                    `อีเมล: ${createdCredentials.email}\nรหัสผ่าน: ${createdCredentials.password}`,
                    'all'
                  );
                }}
              >
                {copiedField === 'all' ? 'คัดลอกแล้ว!' : 'คัดลอกทั้งหมด'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ, รหัสพนักงาน..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="แผนก" />
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
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="active">ทำงาน</SelectItem>
                  <SelectItem value="resigned">ลาออก</SelectItem>
                  <SelectItem value="suspended">พักงาน</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="table-header">
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead>แผนก</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันเริ่มงาน</TableHead>
                  {canManageEmployees && <TableHead className="w-[80px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(canManageEmployees ? 8 : 7)].map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-muted animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManageEmployees ? 8 : 7} className="text-center py-12 text-muted-foreground">
                      ไม่พบข้อมูลพนักงาน
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp, index) => (
                    <motion.tr
                      key={emp.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="table-row-hover border-b"
                    >
                      <TableCell className="font-mono text-sm">{emp.employee_code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                            {emp.first_name ? emp.first_name[0] : '-'}
                          </div>
                          <div>
                            <p className="font-medium">{emp.prefix} {emp.first_name} {emp.last_name}</p>
                            <p className="text-sm text-muted-foreground">{emp.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{(emp as any).department_name || emp.department?.name || '-'}</TableCell>
                      <TableCell>{(emp as any).position_name || emp.position?.name || '-'}</TableCell>
                      <TableCell>{employeeTypeLabels[emp.employee_type]}</TableCell>
                      <TableCell>
                        <StatusBadge status={emp.status} type="employee" />
                      </TableCell>
                      <TableCell>
                        {emp.start_date ? format(new Date(emp.start_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      {canManageEmployees && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setEditingEmployee(emp);
                                setIsDialogOpen(true);
                              }}>
                                <Edit className="w-4 h-4 mr-2" />
                                แก้ไข
                              </DropdownMenuItem>
                              {emp.user_id && (
                                <>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedEmployeeForReset(emp);
                                    setResetPasswordDialogOpen(true);
                                  }}>
                                    <Key className="w-4 h-4 mr-2" />
                                    รีเซ็ตรหัสผ่าน
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedEmployeeForRole(emp);
                                    setNewRoleForEmployee((emp.role as AppRole) || 'employee');
                                    setChangeRoleDialogOpen(true);
                                  }}>
                                    <Shield className="w-4 h-4 mr-2" />
                                    เปลี่ยนบทบาท
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setDeletingId(emp.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                ลบ
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <DeleteConfirmDialog
        open={canManageEmployees && deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="ลบพนักงาน"
        description="คุณแน่ใจหรือไม่ที่จะลบพนักงานนี้? ข้อมูลทั้งหมดรวมถึงประวัติการลาจะถูกลบ"
        onConfirm={handleDeleteEmployee}
        isDeleting={isDeleting}
      />

      {/* Reset Password Dialog */}
      <Dialog open={canManageEmployees && resetPasswordDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setResetPasswordDialogOpen(false);
          setResetPasswordResult(null);
          setSelectedEmployeeForReset(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔐 รีเซ็ตรหัสผ่าน</DialogTitle>
            <DialogDescription>
              {resetPasswordResult
                ? `รีเซ็ตรหัสผ่านสำหรับ ${selectedEmployeeForReset?.first_name} ${selectedEmployeeForReset?.last_name} สำเร็จแล้ว`
                : `คุณต้องการรีเซ็ตรหัสผ่านสำหรับ ${selectedEmployeeForReset?.first_name} ${selectedEmployeeForReset?.last_name} ใช่หรือไม่?`
              }
            </DialogDescription>
          </DialogHeader>
          {resetPasswordResult ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-3">✅ รหัสผ่านใหม่ (คัดลอกแจ้งพนักงาน)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border rounded px-3 py-2 text-base font-mono tracking-widest select-all">
                    {resetPasswordResult}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPasswordResult);
                      toast({ title: 'คัดลอกแล้ว' });
                    }}
                  >
                    คัดลอก
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-800">
                ⚠️ รหัสผ่านนี้จะแสดงเพียงครั้งเดียว กรุณาแจ้งพนักงานให้เปลี่ยนรหัสผ่านหลัง login
              </div>
              <div className="flex justify-end">
                <Button onClick={() => {
                  setResetPasswordDialogOpen(false);
                  setResetPasswordResult(null);
                  setSelectedEmployeeForReset(null);
                }}>
                  ปิด
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-900">
                <p className="font-medium mb-2">📧 ระบบจะ:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>สร้างรหัสผ่านใหม่อัตโนมัติ</li>
                  <li>เข้ารหัส (Hash) ด้วย Bcrypt</li>
                  <li>แสดงรหัสผ่านให้ HR คัดลอกแจ้งพนักงาน</li>
                  <li>ส่งรหัสผ่านไปยังอีเมลพนักงาน (ถ้า email ใช้งานได้)</li>
                </ul>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setResetPasswordDialogOpen(false)}
                >
                  ยกเลิก
                </Button>
                <Button
                  onClick={handleResetPassword}
                  disabled={isResettingPassword}
                  className="bg-warning hover:bg-warning/90"
                >
                  {isResettingPassword ? 'กำลังรีเซ็ต...' : '✅ ยืนยันรีเซ็ตรหัสผ่าน'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={canManageEmployees && changeRoleDialogOpen} onOpenChange={setChangeRoleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🛡️ เปลี่ยนบทบาท</DialogTitle>
            <DialogDescription>
              สำหรับ {selectedEmployeeForRole?.first_name} {selectedEmployeeForRole?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new_role">บทบาทใหม่</Label>
              <Select
                value={newRoleForEmployee}
                onValueChange={(v) => setNewRoleForEmployee(v as AppRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">{roleLabels.employee}</SelectItem>
                  <SelectItem value="supervisor">{roleLabels.supervisor}</SelectItem>
                  <SelectItem value="hr">{roleLabels.hr}</SelectItem>
                  <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-amber-50 text-amber-900 rounded text-sm">
              ⚠️ การเปลี่ยนบทบาทจะมีผลสำหรับสิทธิ์การเข้าถึงในระบบทั้งหมด
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setChangeRoleDialogOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={isChangingRole}
            >
              {isChangingRole ? 'กำลังเปลี่ยน...' : 'เปลี่ยนบทบาท'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
