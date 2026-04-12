import { useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { buildApiUrl } from '@/config/api';

export default function PermissionsDebug() {
  const { user, roles, permissions } = useAuth();
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchPermissionsFromApi = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl('/auth/permissions'), {
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json();
      setRawResponse({ status: response.status, payload });
    } catch (error: any) {
      setRawResponse({
        status: 0,
        payload: { error: error?.message || 'Unknown error' },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      title="Permissions Debug"
      subtitle="ตรวจสอบ role และสิทธิ์ที่ระบบคำนวณให้ผู้ใช้ปัจจุบัน"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <CardTitle>Auth Context</CardTitle>
            </div>
            <CardDescription>ข้อมูลสิทธิ์ที่ frontend ใช้งานจริงใน session ปัจจุบัน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">User</p>
              <p className="font-medium">{user?.email || '-'}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Roles</p>
              <div className="flex flex-wrap gap-2">
                {roles.length === 0 ? (
                  <span className="text-sm text-muted-foreground">ไม่มี role</span>
                ) : (
                  roles.map((role) => (
                    <Badge key={role} variant="outline">{role}</Badge>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Permissions</p>
              <pre className="p-3 rounded-md bg-muted text-xs overflow-x-auto">
{JSON.stringify(permissions, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backend API Response</CardTitle>
            <CardDescription>เรียก /api/v1/auth/permissions โดยตรงเพื่อเทียบกับค่าที่ frontend ถืออยู่</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={fetchPermissionsFromApi} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรชจาก API
            </Button>

            {rawResponse && (
              <pre className="p-3 rounded-md bg-muted text-xs overflow-x-auto">
{JSON.stringify(rawResponse, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}