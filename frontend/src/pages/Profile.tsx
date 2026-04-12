import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Lock, Save, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { API_BASE_URL } from '@/config/api';

export default function ProfilePage() {
  const { user, profile, employee, refreshProfile, updateAvatarLocally } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (employee) {
      setFirstName(employee.first_name || '');
      setLastName(employee.last_name || '');
      setPhone(employee.phone || '');
      setAddress(employee.address || '');
    } else if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
    }
    
    setAvatarUrl(profile?.avatar_url || employee?.avatar_url || null);
  }, [employee, profile]);

  const parseApiError = async (response: Response) => {
    const rawText = await response.text();
    if (!rawText) {
      return `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (${response.status})`;
    }

    try {
      const errorData = JSON.parse(rawText);
      return errorData.error || errorData.message || `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (${response.status})`;
    } catch {
      return rawText || response.statusText || `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (${response.status})`;
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get employee ID - fallback to user ID if needed
    const employeeId = employee?.id;
    
    if (!employeeId) {
      toast({
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'ไม่สามารถหาข้อมูลพนักงาน กรุณา refresh หน้าและลองใหม่',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('ไม่สามารถขอ Token ได้ กรุณา login ใหม่');
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          address,
        }),
      });

      if (!response.ok) {
        const message = await parseApiError(response);
        throw new Error(message || 'เกิดข้อผิดพลาดในการอัพเดตข้อมูล');
      }

      toast({
        title: 'บันทึกข้อมูลสำเร็จ',
        description: 'ข้อมูลส่วนตัวของคุณได้รับการอัปเดตแล้ว',
      });
      
      refreshProfile();
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถอัปเดตข้อมูลได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: 'รหัสผ่านไม่ตรงกัน',
        description: 'กรุณาตรวจสอบรหัสผ่านใหม่และยืนยันรหัสผ่านอีกครั้ง',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'รหัสผ่านสั้นเกินไป',
        description: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
        variant: 'destructive',
      });
      return;
    }

    setPasswordLoading(true);
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('ไม่สามารถขอ Token ได้ กรุณา login ใหม่');
      }

      // Call backend change password endpoint
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const message = await parseApiError(response);
        throw new Error(message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
      }

      toast({
        title: 'เปลี่ยนรหัสผ่านสำเร็จ',
        description: 'รหัสผ่านของคุณได้รับการอัปเดตแล้ว',
      });

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <DashboardLayout
      title="โปรไฟล์ของฉัน"
      subtitle="จัดการข้อมูลส่วนตัวและรหัสผ่าน"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <CardTitle>ข้อมูลส่วนตัว</CardTitle>
              </div>
              <CardDescription>แก้ไขข้อมูลส่วนตัวของคุณ</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Avatar Upload Section */}
              {user && (
                <div className="mb-6">
                  <AvatarUpload
                    userId={user.id}
                    currentAvatarUrl={avatarUrl}
                    firstName={firstName}
                    lastName={lastName}
                    onAvatarUpdate={(newUrl) => {
                      setAvatarUrl(newUrl);
                      updateAvatarLocally(newUrl);
                      refreshProfile();
                    }}
                  />
                </div>
              )}
              
              <Separator className="mb-6" />

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">ชื่อ</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="ชื่อ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">นามสกุล</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="นามสกุล"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">อีเมล</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="pl-10 bg-muted"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">อีเมลไม่สามารถเปลี่ยนแปลงได้</p>
                </div>

                {employee && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0xx-xxx-xxxx"
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">ที่อยู่</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Textarea
                          id="address"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="ที่อยู่"
                          className="pl-10 min-h-[80px]"
                        />
                      </div>
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  บันทึกข้อมูล
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Change Password */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                <CardTitle>เปลี่ยนรหัสผ่าน</CardTitle>
              </div>
              <CardDescription>เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบ</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">รหัสผ่านปัจจุบัน</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="รหัสผ่านปัจจุบัน"
                      className="pl-10 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="newPassword">รหัสผ่านใหม่</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                      className="pl-10 pr-10"
                      required
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="ยืนยันรหัสผ่านใหม่"
                      className="pl-10 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">รหัสผ่านไม่ตรงกัน</p>
                  )}
                  {newPassword && confirmPassword && newPassword === confirmPassword && (
                    <p className="text-xs text-success flex items-center gap-1">
                      <Check className="w-3 h-3" /> รหัสผ่านตรงกัน
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={passwordLoading || !currentPassword || !newPassword || newPassword !== confirmPassword}
                >
                  {passwordLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2" />
                  )}
                  เปลี่ยนรหัสผ่าน
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
