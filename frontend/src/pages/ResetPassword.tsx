import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/config/api';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token');

    if (!resetToken) {
      setError('ลิงก์รีเซ็ตรหัสผ่านหมดอายุหรือไม่ถูกต้อง');
      return;
    }

    setToken(resetToken);
    setError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'รหัสผ่านไม่ตรงกัน',
        description: 'กรุณากรอกรหัสผ่านให้ตรงกันทั้งสองช่อง',
        variant: 'destructive',
      });
      return;
    }

    // Enhanced password validation: min 8 chars, uppercase, number, special char
    if (password.length < 8) {
      toast({
        title: 'รหัสผ่านสั้นเกินไป',
        description: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
        variant: 'destructive',
      });
      return;
    }

    if (!/[A-Z]/.test(password)) {
      toast({
        title: 'รหัสผ่านไม่รัดแน่น',
        description: 'รหัสผ่านต้องมีอักษรตัวใหญ่อย่างน้อย 1 ตัว',
        variant: 'destructive',
      });
      return;
    }

    if (!/\d/.test(password)) {
      toast({
        title: 'รหัสผ่านไม่รัดแน่น',
        description: 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว',
        variant: 'destructive',
      });
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      toast({
        title: 'รหัสผ่านไม่รัดแน่น',
        description: 'รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว (!@#$%^&* เป็นต้น)',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (!token) {
        throw new Error('ไม่พบ token สำหรับรีเซ็ตรหัสผ่าน');
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
      }

      setSuccess(true);
      toast({
        title: 'เปลี่ยนรหัสผ่านสำเร็จ',
        description: 'คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว',
      });
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-destructive">ลิงก์ไม่ถูกต้อง</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/auth')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                กลับไปหน้าเข้าสู่ระบบ
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <CardTitle className="text-success">เปลี่ยนรหัสผ่านสำเร็จ!</CardTitle>
              <CardDescription>คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/auth')}>
                เข้าสู่ระบบ
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>ตั้งรหัสผ่านใหม่</CardTitle>
            <CardDescription>กรุณากรอกรหัสผ่านใหม่ของคุณ</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่านใหม่</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="ขั้นต่ำ 8 ตัว (ใหญ่/ตัวเลข/พิเศษ)"
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  ต้องมี: อักษรตัวใหญ่, ตัวเลข, และอักขระพิเศษ
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'เปลี่ยนรหัสผ่าน'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
