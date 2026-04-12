import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Users, Shield, Plus, Trash2, UserPlus, Mail, Lock, User, Loader2, Copy, Check, KeyRound, Clock } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl } from '@/config/api';
import type { AppRole } from '@/types/hr';
import { roleLabels } from '@/types/hr';
import { useAuth } from '@/contexts/AuthContext';
import { WorkingHoursSettings } from '@/components/settings/WorkingHoursSettings';

interface UserWithRoles {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  roles: AppRole[];
}

export default function Settings() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUserForReset, setSelectedUserForReset] = useState<UserWithRoles | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('employee');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newUserCredentials, setNewUserCredentials] = useState<{ email: string; password: string } | null>(null);
  const [resetPasswordCredentials, setResetPasswordCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
  const [sendingResetTo, setSendingResetTo] = useState<string | null>(null);
  const { toast } = useToast();

  const isAdmin = hasPermission('canManageSystemSettings');

  useEffect(() => {
    fetchUsersWithRoles();
  }, []);

  const fetchUsersWithRoles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(buildApiUrl('/employees'), {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (!res.ok) {
        throw new Error('ไม่สามารถโหลดรายชื่อผู้ใช้ได้');
      }

      const payload = await res.json();
      const employees = payload?.data || [];

      const usersWithRoles: UserWithRoles[] = (employees || []).map((emp: any) => ({
        id: String(emp.id),
        email: emp.email,
        first_name: emp.first_name,
        last_name: emp.last_name,
        roles: [((emp.role as AppRole) || 'employee')],
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!selectedUserId || !selectedRole) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl('/user-roles'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: selectedRole,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'ไม่สามารถเพิ่มบทบาทได้');
      }

      toast({
        title: 'เพิ่มบทบาทสำเร็จ',
        description: 'อัปเดตสิทธิ์ผู้ใช้เรียบร้อย',
      });

      setIsRoleDialogOpen(false);
      setSelectedUserId('');
      setSelectedRole('employee');
      await fetchUsersWithRoles();
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถเพิ่มบทบาทได้',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบบทบาท ${roleLabels[role]}?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl('/user-roles'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          user_id: userId,
          role,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'ไม่สามารถลบบทบาทได้');
      }

      toast({
        title: 'ลบบทบาทสำเร็จ',
        description: 'อัปเดตสิทธิ์ผู้ใช้เรียบร้อย',
      });

      await fetchUsersWithRoles();
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถลบบทบาทได้',
        variant: 'destructive',
      });
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreatingUser(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const role = formData.get('role') as AppRole;
    const password = generatePassword();

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl('/employees'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          role: role,
          create_user_account: true,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'ไม่สามารถสร้างผู้ใช้ได้');
      }

      setNewUserCredentials({ email, password });
      toast({ title: 'สร้างผู้ใช้สำเร็จ' });
      fetchUsersWithRoles();
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const copyToClipboard = async (text: string, field: 'email' | 'password') => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const closeCreateUserDialog = () => {
    setIsCreateUserDialogOpen(false);
    setNewUserCredentials(null);
  };

  const handleSendPasswordReset = async (email: string) => {
    if (!email) {
      toast({
        title: 'ไม่พบอีเมล',
        description: 'ผู้ใช้นี้ไม่มีอีเมลในระบบ',
        variant: 'destructive',
      });
      return;
    }

    setSendingResetTo(email);
    try {
      const response = await fetch(buildApiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || 'ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้');
      }

      toast({
        title: 'ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว',
        description: `ส่งไปยัง ${email} เรียบร้อย`,
      });
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSendingResetTo(null);
    }
  };

  const handleResetPasswordDirect = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUserForReset) return;

    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get('newPassword') as string;

    if (newPassword.length < 6) {
      toast({
        title: 'รหัสผ่านสั้นเกินไป',
        description: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
        variant: 'destructive',
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl(`/employees/${selectedUserForReset.id}/reset-password`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
      }

      setResetPasswordCredentials({
        email: selectedUserForReset.email || '',
        password: result?.newPassword || newPassword,
      });

      toast({ title: 'รีเซ็ตรหัสผ่านสำเร็จ' });
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

  const openResetPasswordDialog = (user: UserWithRoles) => {
    setSelectedUserForReset(user);
    setResetPasswordCredentials(null);
    setIsResetPasswordDialogOpen(true);
  };

  const closeResetPasswordDialog = () => {
    setIsResetPasswordDialogOpen(false);
    setSelectedUserForReset(null);
    setResetPasswordCredentials(null);
  };

  const roleColors: Record<AppRole, string> = {
    admin: 'bg-destructive/15 text-destructive border-destructive/30',
    hr: 'bg-primary/15 text-primary border-primary/30',
    manager: 'bg-warning/15 text-warning border-warning/30',
    supervisor: 'bg-warning/15 text-warning border-warning/30',
    employee: 'bg-muted text-muted-foreground border-border',
    ceo: 'bg-destructive/15 text-destructive border-destructive/30',
  };

  return (
    <DashboardLayout
      title="ตั้งค่า"
      subtitle="จัดการระบบและสิทธิ์ผู้ใช้"
    >
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            ผู้ใช้และสิทธิ์
          </TabsTrigger>
          <TabsTrigger value="working-hours" className="gap-2">
            <Clock className="w-4 h-4" />
            เวลาทำงาน
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
        {/* Create User Section - Admin Only */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" />
                    <CardTitle>สร้างบัญชีผู้ใช้ใหม่</CardTitle>
                  </div>
                  <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        สร้างผู้ใช้ใหม่
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>สร้างบัญชีผู้ใช้ใหม่</DialogTitle>
                        <DialogDescription>
                          กรอกข้อมูลเพื่อสร้างบัญชีใหม่ ระบบจะสร้างรหัสผ่านอัตโนมัติ
                        </DialogDescription>
                      </DialogHeader>
                      
                      {newUserCredentials ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                            <p className="text-sm font-medium text-success mb-3">
                              ✅ สร้างบัญชีสำเร็จ! กรุณาคัดลอกข้อมูลด้านล่างส่งให้ผู้ใช้
                            </p>
                            
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">อีเมล</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <code className="flex-1 px-3 py-2 rounded bg-background text-sm">
                                    {newUserCredentials.email}
                                  </code>
                                  <Button 
                                    size="icon" 
                                    variant="outline"
                                    onClick={() => copyToClipboard(newUserCredentials.email, 'email')}
                                  >
                                    {copiedField === 'email' ? (
                                      <Check className="w-4 h-4 text-success" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              
                              <div>
                                <Label className="text-xs text-muted-foreground">รหัสผ่าน</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <code className="flex-1 px-3 py-2 rounded bg-background text-sm font-mono">
                                    {newUserCredentials.password}
                                  </code>
                                  <Button 
                                    size="icon" 
                                    variant="outline"
                                    onClick={() => copyToClipboard(newUserCredentials.password, 'password')}
                                  >
                                    {copiedField === 'password' ? (
                                      <Check className="w-4 h-4 text-success" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-xs text-muted-foreground">
                            ⚠️ โปรดแจ้งให้ผู้ใช้เปลี่ยนรหัสผ่านหลังจากเข้าสู่ระบบครั้งแรก
                          </p>
                          
                          <Button className="w-full" onClick={closeCreateUserDialog}>
                            เสร็จสิ้น
                          </Button>
                        </div>
                      ) : (
                        <form onSubmit={handleCreateUser} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="firstName">ชื่อ</Label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  id="firstName"
                                  name="firstName"
                                  placeholder="ชื่อ"
                                  className="pl-10"
                                  required
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="lastName">นามสกุล</Label>
                              <Input
                                id="lastName"
                                name="lastName"
                                placeholder="นามสกุล"
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email">อีเมล</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="email@example.com"
                                className="pl-10"
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>บทบาทเริ่มต้น</Label>
                            <Select name="role" defaultValue="employee">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                                <SelectItem value="ceo">ผู้บริหาร</SelectItem>
                                <SelectItem value="hr">HR</SelectItem>
                                <SelectItem value="manager">หัวหน้างาน</SelectItem>
                                <SelectItem value="employee">พนักงาน</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="p-3 rounded-lg bg-muted/50 border">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Lock className="w-4 h-4" />
                              <span>รหัสผ่านจะถูกสร้างโดยอัตโนมัติ</span>
                            </div>
                          </div>

                          <div className="flex justify-end gap-3">
                            <Button type="button" variant="outline" onClick={() => setIsCreateUserDialogOpen(false)}>
                              ยกเลิก
                            </Button>
                            <Button type="submit" disabled={isCreatingUser}>
                              {isCreatingUser ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                'สร้างผู้ใช้'
                              )}
                            </Button>
                          </div>
                        </form>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>
                  สร้างบัญชีผู้ใช้ใหม่และส่งข้อมูลเข้าสู่ระบบให้พนักงาน
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>
        )}

        {/* User Roles Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <CardTitle>จัดการสิทธิ์ผู้ใช้</CardTitle>
                </div>
                {isAdmin && (
                  <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        เพิ่มสิทธิ์
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>เพิ่มบทบาทให้ผู้ใช้</DialogTitle>
                        <DialogDescription>เลือกผู้ใช้และบทบาทที่ต้องการ</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>ผู้ใช้</Label>
                          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger>
                              <SelectValue placeholder="เลือกผู้ใช้" />
                            </SelectTrigger>
                            <SelectContent>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.first_name} {user.last_name} ({user.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>บทบาท</Label>
                          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                              <SelectItem value="ceo">ผู้บริหาร</SelectItem>
                              <SelectItem value="hr">HR</SelectItem>
                              <SelectItem value="manager">หัวหน้างาน</SelectItem>
                              <SelectItem value="employee">พนักงาน</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                            ยกเลิก
                          </Button>
                          <Button onClick={handleAddRole}>เพิ่มบทบาท</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <CardDescription>กำหนดบทบาทและสิทธิ์การเข้าถึงของผู้ใช้ในระบบ</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ยังไม่มีผู้ใช้ในระบบ</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user, index) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {user.first_name?.[0] || user.email?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && user.email && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openResetPasswordDialog(user)}
                            className="text-xs"
                          >
                            <KeyRound className="w-3 h-3 mr-1" />
                            รีเซ็ตรหัส
                          </Button>
                        )}
                        {user.roles.length === 0 ? (
                          <span className="text-sm text-muted-foreground">ไม่มีบทบาท</span>
                        ) : (
                          user.roles.map((role) => (
                            <Badge
                              key={role}
                              variant="outline"
                              className={`${roleColors[role]} ${isAdmin ? 'cursor-pointer hover:opacity-80' : ''}`}
                              onClick={() => isAdmin && handleRemoveRole(user.id, role)}
                            >
                              {roleLabels[role]}
                              {isAdmin && <Trash2 className="w-3 h-3 ml-1" />}
                            </Badge>
                          ))
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* System Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-primary" />
                <CardTitle>การตั้งค่าระบบ</CardTitle>
              </div>
              <CardDescription>ตั้งค่าทั่วไปของระบบ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <SettingsIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>ยังไม่มีการตั้งค่าเพิ่มเติม</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        </TabsContent>

        <TabsContent value="working-hours">
          <WorkingHoursSettings />
        </TabsContent>
      </Tabs>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>รีเซ็ตรหัสผ่าน</DialogTitle>
            <DialogDescription>
              {selectedUserForReset && (
                <>กำหนดรหัสผ่านใหม่สำหรับ {selectedUserForReset.first_name} {selectedUserForReset.last_name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {resetPasswordCredentials ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                <p className="text-sm font-medium text-success mb-3">
                  ✅ รีเซ็ตรหัสผ่านสำเร็จ! กรุณาคัดลอกข้อมูลด้านล่างส่งให้ผู้ใช้
                </p>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">อีเมล</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 px-3 py-2 rounded bg-background text-sm">
                        {resetPasswordCredentials.email}
                      </code>
                      <Button 
                        size="icon" 
                        variant="outline"
                        onClick={() => copyToClipboard(resetPasswordCredentials.email, 'email')}
                      >
                        {copiedField === 'email' ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">รหัสผ่านใหม่</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 px-3 py-2 rounded bg-background text-sm font-mono">
                        {resetPasswordCredentials.password}
                      </code>
                      <Button 
                        size="icon" 
                        variant="outline"
                        onClick={() => copyToClipboard(resetPasswordCredentials.password, 'password')}
                      >
                        {copiedField === 'password' ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                ⚠️ โปรดแจ้งให้ผู้ใช้เปลี่ยนรหัสผ่านหลังจากเข้าสู่ระบบ
              </p>
              
              <Button className="w-full" onClick={closeResetPasswordDialog}>
                เสร็จสิ้น
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPasswordDirect} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">รหัสผ่านใหม่</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="text"
                    placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                    className="pl-10"
                    defaultValue={generatePassword()}
                    required
                    minLength={6}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  ระบบสร้างรหัสผ่านให้อัตโนมัติ คุณสามารถแก้ไขได้
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeResetPasswordDialog}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={isResettingPassword}>
                  {isResettingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'รีเซ็ตรหัสผ่าน'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
