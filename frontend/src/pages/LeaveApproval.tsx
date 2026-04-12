import { useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Check, X, Clock, User, Paperclip, Download, ExternalLink } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdvancedTableControls, useTableControls } from '@/components/ui/advanced-table-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';
import type { LeaveRequest, Employee, LeaveStatus } from '@/types/hr';
import { leaveTypeLabels } from '@/types/hr';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { downloadCSV, formatLeaveRequestForExport, createExportFilename } from '@/lib/exportUtils';
import { queryCache } from '@/lib/queryCache';
import { API_ORIGIN } from '@/config/api';

interface LeaveWithEmployee extends LeaveRequest {
  employee: Employee;
  attachments?: Array<{
    id: number;
    file_name: string;
    file_path: string;
    file_size?: number;
    mime_type?: string;
  }>;
}

type EmailNotificationStatus = {
  sent?: boolean;
  error?: string;
  to?: string;
};

const API_BASE_URL = API_ORIGIN.replace(/\/$/, '');
const BROWSER_PREVIEW_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain'
]);
const BROWSER_PREVIEW_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt']);

function resolveAttachmentUrl(filePath?: string) {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  return `${API_BASE_URL}${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
}

function getFileExtension(fileName?: string) {
  if (!fileName) return '';
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function canPreviewInBrowser(attachment: LeaveWithEmployee['attachments'][number]) {
  const mime = String(attachment?.mime_type || '').toLowerCase();
  const ext = getFileExtension(attachment?.file_name);
  return BROWSER_PREVIEW_MIME_TYPES.has(mime) || BROWSER_PREVIEW_EXTENSIONS.has(ext);
}

// Memoized Leave Request Card Component
const LeaveRequestCard = memo(({
  leave,
  index,
  onReject,
  onApprove,
}: {
  leave: LeaveWithEmployee;
  index: number;
  onReject: (leave: LeaveWithEmployee) => void;
  onApprove: (leave: LeaveWithEmployee) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    className="flex items-center justify-between p-5 rounded-xl border bg-card hover:shadow-card transition-all"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
        <User className="w-7 h-7 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-lg">
          {leave.employee.prefix} {leave.employee.first_name} {leave.employee.last_name}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm font-medium text-primary">
            {leaveTypeLabels[leave.leave_type]}
          </span>
          <span className="text-sm text-muted-foreground">
            {format(new Date(leave.start_date), 'd MMM', { locale: th })} - {format(new Date(leave.end_date), 'd MMM yyyy', { locale: th })}
          </span>
          <span className="px-2 py-0.5 bg-muted rounded text-sm">
            {leave.total_days} วัน
          </span>
        </div>
        {leave.reason && (
          <p className="text-sm text-muted-foreground mt-2">
            <span className="font-medium">เหตุผล:</span> {leave.reason}
          </p>
        )}
        {Array.isArray(leave.attachments) && leave.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">ไฟล์แนบ:</p>
            <div className="space-y-2">
              {leave.attachments.map((attachment) => {
                const href = resolveAttachmentUrl(attachment.file_path);
                const previewable = canPreviewInBrowser(attachment);
                return (
                  <div
                    key={attachment.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-xs"
                  >
                    {previewable ? (
                      <span className="inline-flex items-center gap-1 text-primary" title={attachment.file_name}>
                        <Paperclip className="h-3 w-3" />
                        {attachment.file_name}
                      </span>
                    ) : (
                      <a
                        href={href}
                        download={attachment.file_name || true}
                        className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                        title={`ดาวน์โหลด ${attachment.file_name}`}
                      >
                        <Paperclip className="h-3 w-3" />
                        {attachment.file_name}
                      </a>
                    )}

                    <span className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      Preview {previewable ? 'ได้' : 'ไม่ได้'}
                    </span>

                    {previewable && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] text-primary hover:bg-primary/5"
                      >
                        <ExternalLink className="h-3 w-3" />
                        เปิด
                      </a>
                    )}

                    <a
                      href={href}
                      download={attachment.file_name || true}
                      className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] hover:bg-muted"
                    >
                      <Download className="h-3 w-3" />
                      ดาวน์โหลด
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {(leave as any).workflow_status === 'pending_hr' && (
          <p className="text-sm text-warning mt-2">
            <span className="font-medium">สถานะ Workflow:</span> หัวหน้างานอนุมัติแล้ว รอ HR อนุมัติ
          </p>
        )}
        {(leave as any).workflow_status === 'pending_ceo' && (
          <p className="text-sm text-warning mt-2">
            <span className="font-medium">สถานะ Workflow:</span> ผ่านขั้นตอนก่อนหน้าแล้ว รอ CEO อนุมัติขั้นสุดท้าย
          </p>
        )}
        {leave.rejection_reason && (
          <p className="text-sm text-destructive mt-2">
            <span className="font-medium">เหตุผลที่ไม่อนุมัติ:</span> {leave.rejection_reason}
          </p>
        )}
      </div>
    </div>
    
    <div className="flex items-center gap-3">
      <StatusBadge status={leave.status} type="leave" />
      
      {leave.status === 'pending' && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => onReject(leave)}
          >
            <X className="w-4 h-4 mr-1" />
            ไม่อนุมัติ
          </Button>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => onApprove(leave)}
          >
            <Check className="w-4 h-4" />
            อนุมัติ
          </Button>
        </div>
      )}
    </div>
  </motion.div>
));

LeaveRequestCard.displayName = 'LeaveRequestCard';

export default function LeaveApproval() {
  const { employee, user, isHROrAdmin } = useAuth();
  const { toast } = useToast();
  const cacheKey = 'leave-requests-list';
  const [leaveRequests, setLeaveRequests] = useState<LeaveWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState<LeaveWithEmployee | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const { sort, filters, handleSort, handleFilter } = useTableControls();

  useEffect(() => {
    if (employee || isHROrAdmin) {
      fetchLeaveRequests();
    }
  }, [employee?.id, isHROrAdmin]);

  const fetchLeaveRequests = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        // Check cache first (5 min TTL)
        const cached = queryCache.get<LeaveWithEmployee[]>(cacheKey);

        if (cached) {
          console.log('📦 Using cached leave requests');
          setLeaveRequests(cached);
          setLoading(false);
          return;
        }
      }

      // Use pagination: 50 items per page, offset = 0
      const response = await api.get('/leave-requests?limit=50&offset=0&includeEmployeeMeta=false');
      const data = response?.data?.data || [];
      
      // Transform the API response with null safety
      const transformedData = (Array.isArray(data) ? data : []).map((item: any) => ({
        ...item,
        employee: item?.employee || {
          id: item?.employee_id,
          first_name: item?.first_name || '',
          last_name: item?.last_name || '',
          email: item?.email || '',
          user_id: item?.user_id,
        }
      }));

      const result = (transformedData as LeaveWithEmployee[]) || [];
      
      // Store in cache for 5 minutes
      queryCache.set(cacheKey, result, 5 * 60 * 1000);
      setLeaveRequests(result);
    } catch (error: any) {
      console.error('Error fetching leave requests:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'ไม่สามารถโหลดคำขอลาได้',
        variant: 'destructive',
      });
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const applyLeaveUpdate = (leaveId: string, patch: Partial<LeaveWithEmployee>) => {
    setLeaveRequests((prev) => {
      const next = prev.map((item) => (item.id === leaveId ? { ...item, ...patch } : item));
      queryCache.set(cacheKey, next, 5 * 60 * 1000);
      return next;
    });
  };

  const showEmailStatusToast = (emailStatus: EmailNotificationStatus | undefined, actionLabel: 'อนุมัติ' | 'ปฏิเสธ') => {
    if (emailStatus?.sent) {
      toast({
        title: `ส่งเมลแจ้งผล${actionLabel}สำเร็จ`,
        description: emailStatus.to ? `ส่งไปที่ ${emailStatus.to}` : undefined,
      });
      return;
    }

    toast({
      title: `ส่งเมลแจ้งผล${actionLabel}ไม่สำเร็จ`,
      description: emailStatus?.error || 'กรุณาตรวจสอบการตั้งค่าอีเมล SMTP',
      variant: 'destructive',
    });
  };

  const sendNotification = async (
    userId: string,
    title: string,
    message: string,
    type: 'success' | 'error' | 'info',
    link?: string
  ) => {
    // Notifications will be handled by backend in future
    // For now, just skip sending via Supabase
    console.log(`[Notification] ${title}: ${message}`);
  };

  const handleApprove = async (leave: LeaveWithEmployee) => {
    if (!user?.id) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถแสดงข้อมูลผู้อนุมัติได้',
        variant: 'destructive',
      });
      return;
    }

    try {
      const roles = (user.roles || []) as string[];
      const rolePriority = ['ceo', 'hr', 'manager', 'supervisor', 'admin'];
      const approverType = rolePriority.find((role) => roles.includes(role)) || 'manager';

      const response = await api.post(`/leave-requests/${leave?.id}/approve`, {
        approverType,
      });
      const result = response?.data || {};
      const updatedLeave = result?.data;

      if (updatedLeave?.id) {
        applyLeaveUpdate(leave.id, updatedLeave);
      }

      // Send notification with null safety
      if (leave?.employee?.user_id) {
        const startDate = leave?.start_date ? format(new Date(leave.start_date), 'd MMM', { locale: th }) : '';
        const endDate = leave?.end_date ? format(new Date(leave.end_date), 'd MMM yyyy', { locale: th }) : '';
        console.log(`[แจ้งเตือน] คำขอลาได้รับอนุมัติแล้ว: ${leave.employee.first_name}`);
      }

      toast({
        title: 'อนุมัติสำเร็จ',
        description: result?.message || `อนุมัติการลาของ ${leave?.employee?.first_name || ''} แล้ว`,
      });
      showEmailStatusToast(updatedLeave?.email_notification, 'อนุมัติ');
      fetchLeaveRequests(true);
    } catch (error: any) {
      console.error('Approve error:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'เกิดข้อผิดพลาดในการอนุมัติ',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!selectedLeave?.id || !user?.id) return;

    try {
      const response = await api.post(`/leave-requests/${selectedLeave.id}/reject`, {
        reason: rejectionReason,
      });
      const result = response?.data || {};
      const updatedLeave = result?.data;

      if (updatedLeave?.id) {
        applyLeaveUpdate(selectedLeave.id, updatedLeave);
      }

      // Send notification with null safety
      if (selectedLeave?.employee?.user_id) {
        const startDate = selectedLeave?.start_date ? format(new Date(selectedLeave.start_date), 'd MMM', { locale: th }) : '';
        const endDate = selectedLeave?.end_date ? format(new Date(selectedLeave.end_date), 'd MMM yyyy', { locale: th }) : '';
        console.log(`[แจ้งเตือน] คำขอลาไม่ได้รับอนุมัติ: ${selectedLeave?.employee?.first_name || ''}`);
      }

      toast({
        title: 'ปฏิเสธคำขอลาแล้ว',
      });
      showEmailStatusToast(updatedLeave?.email_notification, 'ปฏิเสธ');
      setIsRejectDialogOpen(false);
      setSelectedLeave(null);
      setRejectionReason('');
      fetchLeaveRequests(true);
    } catch (error: any) {
      console.error('Reject error:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'เกิดข้อผิดพลาดในการปฏิเสธ',
        variant: 'destructive',
      });
    }
  };

  const handleExportCSV = () => {
    try {
      const exportData = filteredRequests.map(req => 
        formatLeaveRequestForExport(req)
      );
      
      const filename = createExportFilename(
        `leave-approvals-${activeTab}`
      );
      
      downloadCSV(exportData, filename);
      
      toast({
        title: 'ส่งออกสำเร็จ',
        description: `ดาวน์โหลด ${filteredRequests.length} รายการ`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถส่งออกข้อมูล',
        variant: 'destructive',
      });
    }
  };

  let filteredRequests = leaveRequests.filter((req) => {
    if (activeTab === 'pending') return req.status === 'pending';
    if (activeTab === 'approved') return req.status === 'approved';
    if (activeTab === 'rejected') return req.status === 'rejected';
    return true;
  });

  // Apply filters
  if (filters.employee_name) {
    filteredRequests = filteredRequests.filter(req =>
      `${req.employee?.first_name} ${req.employee?.last_name}`.toLowerCase().includes((filters.employee_name as string).toLowerCase())
    );
  }

  if (filters.leave_type) {
    filteredRequests = filteredRequests.filter(req => req.leave_type === filters.leave_type);
  }

  // Apply sorting
  if (sort?.column) {
    filteredRequests = [...filteredRequests].sort((a, b) => {
      let aVal: any = a;
      let bVal: any = b;

      if (sort.column === 'employee_name') {
        aVal = `${a.employee?.first_name} ${a.employee?.last_name}`;
        bVal = `${b.employee?.first_name} ${b.employee?.last_name}`;
      } else if (sort.column === 'start_date') {
        aVal = new Date(a.start_date);
        bVal = new Date(b.start_date);
      } else if (sort.column === 'leave_type') {
        aVal = a.leave_type;
        bVal = b.leave_type;
      }

      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;
  const approvedCount = leaveRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = leaveRequests.filter(r => r.status === 'rejected').length;

  return (
    <DashboardLayout
      title="อนุมัติการลา"
      subtitle={`มี ${pendingCount} คำขอรออนุมัติ`}
    >
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="w-4 h-4" />
                รออนุมัติ
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-warning/20 text-warning">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-2">
                <Check className="w-4 h-4" />
                อนุมัติแล้ว ({approvedCount})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-2">
                <X className="w-4 h-4" />
                ไม่อนุมัติ ({rejectedCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <AdvancedTableControls
            columns={[
              { key: 'employee_name', label: 'ชื่อพนักงาน', sortable: true, filterable: true },
              { key: 'leave_type', label: 'ประเภทการลา', sortable: true, filterable: true },
              { key: 'start_date', label: 'วันเริ่มต้น', sortable: true },
            ]}
            sortConfig={sort}
            filters={filters}
            onSortChange={handleSort}
            onFilterChange={handleFilter}
            filterOptions={{
              leave_type: [
                { value: 'vacation', label: 'วันลาธรรมชาติ' },
                { value: 'sick', label: 'วันลาป่วย' },
                { value: 'maternity', label: 'วันลาคลอด' },
                { value: 'other', label: 'อื่น ๆ' },
              ],
            }}
          />
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">ไม่มีคำขอลา{activeTab === 'pending' ? 'รออนุมัติ' : ''}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((leave, index) => (
                <LeaveRequestCard
                  key={leave.id}
                  leave={leave}
                  index={index}
                  onReject={(leave) => {
                    setSelectedLeave(leave);
                    setIsRejectDialogOpen(true);
                  }}
                  onApprove={handleApprove}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ไม่อนุมัติคำขอลา</DialogTitle>
            <DialogDescription>
              {selectedLeave && (
                <>
                  คำขอลาของ {selectedLeave.employee.first_name} {selectedLeave.employee.last_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection_reason">เหตุผล (ไม่บังคับ)</Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="ระบุเหตุผลที่ไม่อนุมัติ..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                ยืนยันไม่อนุมัติ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
