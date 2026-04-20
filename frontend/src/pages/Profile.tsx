import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { employeeStatusLabels, employeeTypeLabels } from '@/types/hr';
import { resolveAssetUrl } from '@/config/api';

export default function ProfilePage() {
  const { user, profile, employee, refreshProfile, updateAvatarLocally } = useAuth();
  const employeeAvatarUrl = (employee as { avatar_url?: string | null } | null)?.avatar_url ?? null;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const firstName = employee?.first_name || profile?.first_name || '';
  const lastName = employee?.last_name || profile?.last_name || '';
  const firstNameEn = employee?.first_name_en || '-';
  const lastNameEn = employee?.last_name_en || '-';
  const nickname = employee?.nickname || '-';
  const prefix = employee?.prefix || '-';
  const employeeCode = employee?.employee_code || '-';
  const email = user?.email || employee?.email || profile?.email || '-';
  const departmentName =
    (typeof employee?.department === 'object' && employee?.department?.name) ||
    employee?.department_name ||
    (typeof employee?.department === 'string' ? employee.department : null) ||
    '-';
  const positionName =
    (typeof employee?.position === 'object' && employee?.position?.name) ||
    employee?.position_name ||
    (typeof employee?.position === 'string' ? employee.position : null) ||
    '-';
  const employeeType = employee ? employeeTypeLabels[employee.employee_type] : '-';
  const employeeStatus = employee ? employeeStatusLabels[employee.status] : '-';
  const startDate = employee?.start_date
    ? format(new Date(employee.start_date), 'dd/MM/yyyy')
    : '-';

  useEffect(() => {
    setAvatarUrl(resolveAssetUrl(profile?.avatar_url || employeeAvatarUrl) || null);
  }, [employeeAvatarUrl, profile]);

  return (
    <DashboardLayout
      title="โปรไฟล์ของฉัน"
      subtitle="แสดงข้อมูลพนักงานจากระบบ"
    >
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-4">
              {user && (
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
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input label="รหัสพนักงาน" value={employeeCode} readOnly className="bg-muted/50" />
                <Input label="คำนำหน้า" value={prefix} readOnly className="bg-muted/50" />
                <Input label="ชื่อ" value={firstName || '-'} readOnly className="bg-muted/50" />
                <Input label="สกุล" value={lastName || '-'} readOnly className="bg-muted/50" />
                <Input label="ชื่อเล่น" value={nickname} readOnly className="bg-muted/50" />
                <Input label="ชื่อภาษาอังกฤษ" value={firstNameEn} readOnly className="bg-muted/50" />
                <Input label="นามสกุลภาษาอังกฤษ" value={lastNameEn} readOnly className="bg-muted/50" />
                <Input label="อีเมล" value={email} readOnly className="bg-muted/50 md:col-span-2" />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">ข้อมูลการทำงาน</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Input label="แผนก" value={departmentName} readOnly className="bg-muted/50" />
                  <Input label="ตำแหน่ง" value={positionName} readOnly className="bg-muted/50" />
                  <Input label="ประเภทพนักงาน" value={employeeType} readOnly className="bg-muted/50" />
                  <Input label="สถานะ" value={employeeStatus} readOnly className="bg-muted/50" />
                  <Input label="วันที่เริ่มงาน" value={startDate} readOnly className="bg-muted/50" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
