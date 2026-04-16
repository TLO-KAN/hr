import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Send, Info } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/api';

interface NotificationSetting {
  id: string;
  dept_id: string | null;
  department_name: string;
  leave_type: string;
  to_list: string;
  cc_list: string;
  bcc_list: string;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
}

export function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<NotificationSetting | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return fallback;
  };

  // Form state
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState('vacation');
  const [toList, setToList] = useState('');
  const [ccList, setCcList] = useState('');
  const [bbcList, setBbcList] = useState('');
  const [isActive, setIsActive] = useState(true);

  const leaveTypes = [
    { value: 'vacation', label: 'ลาพักร้อน (Vacation)' },
    { value: 'sick', label: 'ลาป่วย (Sick)' },
    { value: 'personal', label: 'ลากิจ (Personal)' },
    { value: 'maternity', label: 'ลาคลอด (Maternity)' },
    { value: 'paternity', label: 'ลาพ่อ (Paternity)' },
  ];

  const dynamicTags = [
    { tag: '{manager_email}', description: 'อีเมลหัวหน้างานของพนักงาน (เลือกจากข้อมูลพนักงาน)' },
    { tag: '{hr_email}', description: 'อีเมลฝ่ายบุคคล' },
    { tag: '{dept_head_email}', description: 'อีเมลหัวหน้าฝ่าย' },
  ];

  useEffect(() => {
    fetchSettings();
    fetchDepartments();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/v1/notification-settings`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      if (!res.ok) throw new Error('ไม่สามารถโหลดการตั้งค่าแจ้งเตือน');
      const payload = await res.json();
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      setSettings(rows as NotificationSetting[]);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: getErrorMessage(error, 'ไม่สามารถโหลดการตั้งค่าแจ้งเตือนได้'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/v1/departments`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) throw new Error('ไม่สามารถโหลดแผนก');
      const payload = await res.json();
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      setDepartments(rows as Department[]);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: getErrorMessage(error, 'ไม่สามารถโหลดข้อมูลแผนกได้'),
        variant: 'destructive',
      });
    }
  };

  const handleOpenCreate = () => {
    setEditingSetting(null);
    setSelectedDept('');
    setSelectedLeaveType('vacation');
    setToList('');
    setCcList('');
    setBbcList('');
    setIsActive(true);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (setting: NotificationSetting) => {
    setEditingSetting(setting);
    setSelectedDept(setting.dept_id ? String(setting.dept_id) : '');
    setSelectedLeaveType(setting.leave_type);
    setToList(setting.to_list);
    setCcList(setting.cc_list);
    setBbcList(setting.bcc_list);
    setIsActive(setting.is_active);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDept || !toList.trim()) {
      toast({
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณากรอกแผนกและอีเมลถึง',
        variant: 'destructive',
      });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const method = editingSetting ? 'PUT' : 'POST';
      const url = editingSetting 
        ? `${API_BASE_URL}/api/v1/notification-settings/${editingSetting.id}`
        : `${API_BASE_URL}/api/v1/notification-settings`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          dept_id: selectedDept,
          leave_type: selectedLeaveType,
          to_list: toList,
          cc_list: ccList,
          bcc_list: bbcList,
          is_active: isActive,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 409) {
          throw new Error('กำหนดการแจ้งเตือนสำหรับแผนก/ประเภทการลานี้มีอยู่แล้ว');
        }
        throw new Error(errorData.error || 'ไม่สามารถบันทึกการตั้งค่า');
      }
      
      toast({ title: 'บันทึกการตั้งค่าสำเร็จ' });
      setIsDialogOpen(false);
      fetchSettings();
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: getErrorMessage(error, 'ไม่สามารถบันทึกการตั้งค่าได้'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณต้องการลบการตั้งค่านี้หรือไม่?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/v1/notification-settings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'ไม่สามารถลบการตั้งค่า');
      }
      
      toast({ title: 'ลบการตั้งค่าสำเร็จ' });
      fetchSettings();
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: getErrorMessage(error, 'ไม่สามารถลบการตั้งค่าได้'),
        variant: 'destructive',
      });
    }
  };

  const handleTestSend = async (setting: NotificationSetting) => {
    if (!testEmail.trim()) {
      toast({
        title: 'กรุณากรอกอีเมล',
        description: 'ระบุอีเมลสำหรับรับการทดสอบ',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSending(true);
      const token = localStorage.getItem('token');
      const deptParam = setting.dept_id ?? 'null';
      const res = await fetch(
        `${API_BASE_URL}/api/v1/notification-settings/test-send/${deptParam}/${encodeURIComponent(setting.leave_type)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`,
          },
          body: JSON.stringify({ to_email: testEmail }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'ไม่สามารถส่งเมลทดสอบ');
      }
      
      toast({
        title: 'ส่งเมลทดสอบสำเร็จ',
        description: `ส่งไปยัง ${testEmail}`,
      });
      setTestEmail('');
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: getErrorMessage(error, 'ไม่สามารถส่งเมลทดสอบได้'),
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Tags Info Box */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <CardTitle className="text-base">Dynamic Tags ที่พร้อมใช้</CardTitle>
                <CardDescription className="mt-2 space-y-1">
                  {dynamicTags.map(({ tag, description }) => (
                    <div key={tag}>
                      <code className="bg-white px-2 py-1 rounded text-blue-600 font-mono">{tag}</code>
                      <span className="ml-2 text-sm">{description}</span>
                    </div>
                  ))}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Mapping Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>ตั้งค่าเส้นทางการส่งเมล</CardTitle>
              <CardDescription>กำหนดผู้รับเมลแจ้งเตือนสำหรับแต่ละประเภทการลา</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={handleOpenCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่มการตั้งค่า
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingSetting ? 'แก้ไข' : 'เพิ่ม'}การตั้งค่าแจ้งเตือน
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      {/* <Label>แผนก *</Label> */}
                      <Select value={selectedDept} onValueChange={setSelectedDept}>
                        <SelectTrigger label="แผนก *">
                          <SelectValue placeholder="เลือกแผนก" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map(dept => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      {/* <Label>ประเภทการลา *</Label> */}
                      <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                        <SelectTrigger label="ประเภทการลา *">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    {/* <Label>ส่งถึง (To) * - คั่นหลายรายชื่อด้วยเครื่องหมายจุลภาค</Label> */}
                    <Input
                      label="ส่งถึง (To) *"
                      placeholder="admin@company.com, {manager_email}, {hr_email}"
                      value={toList}
                      onChange={(e) => setToList(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      รองรับอีเมลธรรมดาและ Dynamic Tags
                    </p>
                  </div>

                  <div>
                    {/* <Label>สำเนา (CC) - ไม่บังคับ</Label> */}
                    <Input
                      label="สำเนา (CC)"
                      placeholder="cc@company.com, {dept_head_email}"
                      value={ccList}
                      onChange={(e) => setCcList(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div>
                    {/* <Label>ซ่อนสำเนา (BCC) - ไม่บังคับ</Label> */}
                    <Input
                      label="ซ่อนสำเนา (BCC)"
                      placeholder="bcc@company.com"
                      value={bbcList}
                      onChange={(e) => setBbcList(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is-active"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="is-active" className="mb-0">
                      เปิดใช้งาน
                    </Label>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      ยกเลิก
                    </Button>
                    <Button onClick={handleSave} className="flex-1">
                      บันทึก
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : settings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ยังไม่มีการตั้งค่าแจ้งเตือน คลิก "เพิ่มการตั้งค่า" เพื่อเริ่มต้น
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>แผนก</TableHead>
                      <TableHead>ประเภทการลา</TableHead>
                      <TableHead>ส่งถึง</TableHead>
                      <TableHead>สำเนา</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">ปฏิบัติการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.map(setting => (
                      <TableRow key={setting.id}>
                        <TableCell className="font-medium">{setting.department_name}</TableCell>
                        <TableCell>{leaveTypes.find(t => t.value === setting.leave_type)?.label}</TableCell>
                        <TableCell className="font-mono text-sm max-w-[300px] truncate">
                          {setting.to_list}
                        </TableCell>
                        <TableCell className="font-mono text-sm max-w-[200px] truncate">
                          {setting.cc_list || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={setting.is_active ? 'default' : 'secondary'}>
                            {setting.is_active ? 'เปิด' : 'ปิด'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setTestEmail('')}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>ทดสอบการส่งเมล</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  ส่งเมลทดสอบไปยังที่อยู่อีเมลที่ระบุ
                                </p>
                                <Input
                                  label="อีเมลทดสอบ"
                                  placeholder="your-email@company.com"
                                  value={testEmail}
                                  onChange={(e) => setTestEmail(e.target.value)}
                                />
                                <Button
                                  onClick={() => handleTestSend(setting)}
                                  disabled={isSending}
                                  className="w-full"
                                >
                                  {isSending ? 'กำลังส่ง...' : 'ส่งเมลทดสอบ'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(setting)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => handleDelete(setting.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
