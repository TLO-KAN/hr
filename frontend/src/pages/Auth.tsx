import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Mail, Lock, Loader2, ArrowLeft, CheckCircle, Calendar, Shield, Building2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { buildApiUrl } from '@/config/api';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [isOffice365Loading, setIsOffice365Loading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signInWithOAuth } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await signIn(email, password);
      toast({
        title: 'เข้าสู่ระบบสำเร็จ',
        description: 'ยินดีต้อนรับเข้าสู่ระบบ HR',
      });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถเข้าสู่ระบบได้',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(buildApiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || 'Cannot reset password');
      }

      setResetEmailSent(true);
      toast({
        title: 'ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว',
        description: 'กรุณาตรวจสอบอีเมลของคุณ',
      });
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForgotPasswordState = () => {
    setShowForgotPassword(false);
    setResetEmailSent(false);
    setForgotEmail('');
  };

  // const features = [
  //   {
  //     icon: Users,
  //     title: 'จัดการพนักงาน',
  //     description: 'เก็บข้อมูลพนักงานเป็นศูนย์กลาง จัดการง่ายและปลอดภัย',
  //   },
  //   {
  //     icon: Calendar,
  //     title: 'ระบบลาออนไลน์',
  //     description: 'ยื่นลา อนุมัติ และติดตามสถานะได้ทุกที่ทุกเวลา',
  //   },
  //   {
  //     icon: Shield,
  //     title: 'แยกสิทธิ์ผู้ใช้งาน',
  //     description: 'กำหนดสิทธิ์ตามบทบาท Admin, HR, หัวหน้างาน, พนักงาน',
  //   },
  // ];

  return (
    <div className="min-h-screen flex">
      {/* Theme Toggle - Fixed position */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle 
          variant="outline" 
          className="bg-background/80 backdrop-blur-sm border-border hover:bg-accent"
        />
      </div>

      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-primary relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute bottom-40 right-20 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-white/5" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Building2 className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary-foreground">HR Management</h1>
              <p className="text-primary-foreground/70 text-sm">ระบบบริหารทรัพยากรบุคคล</p>
            </div>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            {/* <div>
              <h2 className="text-4xl font-bold text-primary-foreground leading-tight">
                จัดการ HR<br />
                <span className="text-white/90">อย่างมืออาชีพ</span>
              </h2>
              <p className="text-primary-foreground/80 mt-4 max-w-md leading-relaxed">
                ระบบบริหารทรัพยากรบุคคลที่ครบครัน ใช้งานง่าย
                พัฒนาตามมาตรฐานกฎหมายแรงงานไทย
              </p>
            </div> */}

            {/* Features */}
            <div className="space-y-4">
              {/* {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10">
                    <feature.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary-foreground">{feature.title}</h3>
                    <p className="text-sm text-primary-foreground/70">{feature.description}</p>
                  </div>
                </motion.div>
              ))} */}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Right side - Login form / Forgot Password */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 pb-24 bg-background relative">
        <AnimatePresence mode="wait">
          {!showForgotPassword ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              {/* Mobile Logo */}
              <div className="lg:hidden flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-bold text-xl text-foreground">HR System</h1>
                  <p className="text-xs text-muted-foreground">ระบบบริหารทรัพยากรบุคคล</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">เข้าสู่ระบบ</h2>
                  <p className="text-muted-foreground mt-1">กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบ</p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-foreground">อีเมล</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="Email"
                        className="pl-11 h-12 bg-background border-input"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-foreground">รหัสผ่าน</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        className="pl-11 pr-12 h-12 bg-background border-input"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'เข้าสู่ระบบ'
                    )}
                  </Button>

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                </form>

                {/* Divider */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="px-2 bg-background text-muted-foreground">หรือ</span>
                  </div>
                </div>

                {/* Office365 Seamless SSO Login Button */}
                <Button 
                  type="button" 
                  onClick={async () => {
                    setIsOffice365Loading(true);
                    try {
                      console.log('[Auth] Starting Azure AD OAuth...');
                      // Seamless OAuth - no manual email input needed
                      // User will be redirected directly to Azure AD login
                      await signInWithOAuth();
                      // OAuth callback will handle auto-login
                    } catch (error: any) {
                      console.error('[Auth] Azure AD OAuth error:', error);
                      toast({
                        title: 'เกิดข้อผิดพลาด',
                        description: error.message || 'ไม่สามารถเข้าสู่ระบบ Azure AD ได้',
                        variant: 'destructive',
                      });
                      setIsOffice365Loading(false);
                    }
                  }} 
                  variant="outline"
                  className="w-full h-12 border-input hover:bg-accent gap-2" 
                  disabled={isOffice365Loading}
                >
                  {isOffice365Loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-5 h-5"
                        aria-hidden="true"
                      >
                        <path fill="#f25022" d="M1 1h10v10H1z" />
                        <path fill="#00a4ef" d="M13 1h10v10H13z" />
                        <path fill="#7fba00" d="M1 13h10v10H1z" />
                        <path fill="#ffb900" d="M13 13h10v10H13z" />
                      </svg>
                      {' '}Sign in with Microsoft 365
                    </>
                  )}
                </Button>

                {/* <div className="border-t border-border pt-6">
                  <p className="text-sm text-muted-foreground text-center">
                    ติดต่อ Admin หากต้องการสร้างบัญชีผู้ใช้
                  </p>
                </div> */}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="forgot-password"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <div className="space-y-6">
                {resetEmailSent ? (
                  <>
                    <div className="text-center">
                      <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-success" />
                      </div>
                      <h2 className="text-2xl font-bold text-success">ส่งอีเมลแล้ว!</h2>
                      <p className="text-muted-foreground mt-2">
                        เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง<br />
                        <span className="font-medium text-foreground">{forgotEmail}</span>
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm text-muted-foreground text-center">
                        กรุณาตรวจสอบกล่องจดหมายของคุณ (รวมถึงโฟลเดอร์สแปม) และคลิกลิงก์เพื่อตั้งรหัสผ่านใหม่
                      </p>
                    </div>

                    <Button
                      className="w-full h-12"
                      onClick={resetForgotPasswordState}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      กลับไปหน้าเข้าสู่ระบบ
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="mx-auto w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground">ลืมรหัสผ่าน?</h2>
                      <p className="text-muted-foreground mt-1">กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>
                    </div>

                    <form onSubmit={handleForgotPassword} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">อีเมล</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="forgot-email"
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="pl-11 h-12"
                            required
                          />
                        </div>
                      </div>

                      <Button type="submit" className="w-full h-12" disabled={isLoading}>
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          'ส่งลิงก์รีเซ็ตรหัสผ่าน'
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={resetForgotPasswordState}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        กลับไปหน้าเข้าสู่ระบบ
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground text-sm text-center w-full px-8"
        >
          © 2026 HR Management. Digital Transformation by{' '}
          <a
            href="https://www.tlogical.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex align-middle"
            aria-label="Visit T.logical website"
          >
            <img src="/tlogical.png" alt="T.logical" className="h-4 w-auto" />
          </a>
        </motion.p>
      </div>
    </div>
  );
}
