import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Edit, Trash2, Briefcase, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { TableSkeleton } from '@/components/ui/skeleton-loaders';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api';

interface Department {
  id: string;
  name: string;
  description?: string;
  employee_count?: number;
  position_count?: number;
}

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/departments');
      const payload = response?.data;
      const data = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      setDepartments(data);
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'ไม่สามารถโหลดข้อมูลแผนกได้',
        variant: 'destructive',
      });
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);

    const departmentData = {
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
    };

    try {
      const url = editingDepartment
        ? `/departments/${editingDepartment.id}`
        : '/departments';

      const method = editingDepartment ? 'put' : 'post';
      if (method === 'put') {
        await api.put(url, departmentData);
      } else {
        await api.post(url, departmentData);
      }

      toast({
        title: editingDepartment ? 'อัพเดตแผนกสำเร็จ' : 'เพิ่มแผนกสำเร็จ',
      });

      setIsDialogOpen(false);
      setEditingDepartment(null);
      fetchDepartments();
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'บันทึกข้อมูลไม่สำเร็จ',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);

    try {
      try {
        await api.delete(`/departments/${deletingId}`);
        toast({ title: 'ลบแผนกสำเร็จ' });
        fetchDepartments();
        setDeleteDialogOpen(false);
        setDeletingId(null);
      } catch (apiError: any) {
        throw apiError;
      }
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'ลบแผนกไม่สำเร็จ',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout
      title="จัดการแผนก"
      subtitle={`ทั้งหมด ${departments.length} แผนก`}
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingDepartment(null)}>
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มแผนก
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDepartment ? 'แก้ไขแผนก' : 'เพิ่มแผนกใหม่'}
              </DialogTitle>
              <DialogDescription>กรอกข้อมูลแผนก</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                {/* <Label htmlFor="name">ชื่อแผนก *</Label> */}
                <Input
                  label="ชื่อแผนก *"
                  id="name"
                  name="name"
                  defaultValue={editingDepartment?.name || ''}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">รายละเอียด</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingDepartment?.description || ''}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {loading ? (
          <TableSkeleton rows={5} />
        ) : departments?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>ยังไม่มีแผนก</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>ชื่อแผนก</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead className="text-center">
                    <span className="flex items-center justify-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      ตำแหน่ง
                    </span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="flex items-center justify-center gap-1">
                      <Users className="w-4 h-4" />
                      พนักงาน
                    </span>
                  </TableHead>
                  <TableHead className="text-right">การกระทำ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {dept.description || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium text-sm dark:bg-blue-900 dark:text-blue-200">
                        {dept.position_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium text-sm dark:bg-green-900 dark:text-green-200">
                        {dept.employee_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingDepartment(dept);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeletingId(dept.id);
                          setDeleteDialogOpen(true);
                        }}
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
      </motion.div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="ลบแผนก"
        description="คุณแน่ใจหรือไม่ที่จะลบแผนกนี้? ข้อมูลจะไม่สามารถกู้คืนได้"
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </DashboardLayout>
  );
}
