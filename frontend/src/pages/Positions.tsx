import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Plus, Edit, Trash2, Users } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface Position {
  id: string;
  name: string;
  department_id?: string | null;
  department_name?: string;
  description?: string;
  employee_count?: number;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

export default function Positions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('none');
  const [showDepartmentValidation, setShowDepartmentValidation] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (editingPosition?.department_id) {
      setSelectedDepartmentId(String(editingPosition.department_id));
    } else {
      setSelectedDepartmentId('none');
    }
  }, [editingPosition]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [positionsRes, departmentsRes] = await Promise.all([
        api.get('/positions'),
        api.get('/departments'),
      ]);

      const positionsPayload = positionsRes?.data;
      const departmentsPayload = departmentsRes?.data;

      const positionsData = Array.isArray(positionsPayload)
        ? positionsPayload
        : Array.isArray(positionsPayload?.data)
          ? positionsPayload.data
          : [];
      const departmentsData = Array.isArray(departmentsPayload)
        ? departmentsPayload
        : Array.isArray(departmentsPayload?.data)
          ? departmentsPayload.data
          : [];

      setPositions(positionsData);
      setDepartments(departmentsData);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'ไม่สามารถโหลดข้อมูลตำแหน่งและแผนกได้',
        variant: 'destructive',
      });
      setPositions([]);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowDepartmentValidation(true);

    if (selectedDepartmentId === 'none') {
      toast({
        title: 'กรุณาเลือกแผนก',
        description: 'ต้องระบุแผนกก่อนบันทึกตำแหน่ง',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const formData = new FormData(e.currentTarget);

    const positionData = {
      name: formData.get('name') as string,
      departmentId: selectedDepartmentId !== 'none' ? selectedDepartmentId : null,
      description: (formData.get('description') as string) || null,
    };

    try {
      const url = editingPosition
        ? `/positions/${editingPosition.id}`
        : '/positions';
      const method = editingPosition ? 'put' : 'post';
      if (method === 'put') {
        await api.put(url, positionData);
      } else {
        await api.post(url, positionData);
      }

      toast({
        title: editingPosition ? 'อัพเดตตำแหน่งสำเร็จ' : 'เพิ่มตำแหน่งสำเร็จ',
      });

      setIsDialogOpen(false);
      setEditingPosition(null);
      fetchData();
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
        await api.delete(`/positions/${deletingId}`);
        toast({ title: 'ลบตำแหน่งสำเร็จ' });
        fetchData();
        setDeleteDialogOpen(false);
        setDeletingId(null);
      } catch (apiError: any) {
        throw apiError;
      }
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'ลบตำแหน่งไม่สำเร็จ',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout
      title="จัดการตำแหน่ง"
      subtitle={`ทั้งหมด ${positions.length} ตำแหน่ง`}
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingPosition(null);
              setSelectedDepartmentId('none');
              setShowDepartmentValidation(false);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มตำแหน่ง
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPosition ? 'แก้ไขตำแหน่ง' : 'เพิ่มตำแหน่งใหม่'}
              </DialogTitle>
              <DialogDescription>กรอกข้อมูลตำแหน่ง</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                {/* <Label htmlFor="name">ชื่อตำแหน่ง *</Label> */}
                <Input
                  label="ชื่อตำแหน่ง"
                  id="name"
                  name="name"
                  defaultValue={editingPosition?.name || ''}
                  required
                />
              </div>
              <div>
                {/* <Label htmlFor="department_id">แผนก *</Label> */}
                <Select
                  value={selectedDepartmentId}
                  onValueChange={(value) => setSelectedDepartmentId(value)}
                >
                  <SelectTrigger label="แผนก *" className={showDepartmentValidation && selectedDepartmentId === 'none' ? 'border-destructive' : ''}>
                    <SelectValue placeholder="เลือกแผนก" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  name="department_id"
                  value={selectedDepartmentId === 'none' ? '' : selectedDepartmentId}
                />
                {showDepartmentValidation && selectedDepartmentId === 'none' && (
                  <p className="text-xs text-destructive mt-1">⚠️ กรุณาเลือกแผนก</p>
                )}
              </div>
              <div>
                <Label htmlFor="description">รายละเอียด</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingPosition?.description || ''}
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
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>ยังไม่มีตำแหน่ง</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>ชื่อตำแหน่ง</TableHead>
                  <TableHead>แผนก</TableHead>
                  <TableHead>รายละเอียด</TableHead>
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
                {positions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell className="font-medium">{pos.name}</TableCell>
                    <TableCell>{pos.department_name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {pos.description || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm">
                        {pos.employee_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPosition(pos);
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
                          setDeletingId(pos.id);
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
        title="ลบตำแหน่ง"
        description="คุณแน่ใจหรือไม่ที่จะลบตำแหน่งนี้? ข้อมูลจะไม่สามารถกู้คืนได้"
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </DashboardLayout>
  );
}
