 import { useState, useEffect } from 'react';
 import { Plus, Edit, Trash2, ArrowRight, Users, User } from 'lucide-react';
import { Crown } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
 } from '@/components/ui/dialog';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { useToast } from '@/hooks/use-toast';
 import { API_BASE_URL } from '@/config/api';
 
 interface ApprovalWorkflow {
   id: string;
   leave_type: string;
   approval_levels: number;
   min_days: number | null;
   max_days: number | null;
   requires_hr: boolean;
   flow_pattern?: 'supervisor' | 'supervisor_hr' | 'supervisor_hr_ceo' | 'supervisor_ceo' | 'ceo';
   description: string | null;
   created_at: string;
   updated_at: string;
 }

 type FlowPattern = 'supervisor' | 'supervisor_hr' | 'supervisor_hr_ceo' | 'supervisor_ceo' | 'ceo';
 
 export function ApprovalWorkflowSettings() {
   const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
   const [loading, setLoading] = useState(true);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [editingWorkflow, setEditingWorkflow] = useState<ApprovalWorkflow | null>(null);
   const [requiresHR, setRequiresHR] = useState(false);
  const [flowPattern, setFlowPattern] = useState<FlowPattern>('supervisor');
   const { toast } = useToast();

  const deriveFlowPattern = (workflow: ApprovalWorkflow): FlowPattern => {
    if (workflow.flow_pattern) return workflow.flow_pattern;
    if (workflow.approval_levels === 0) return 'ceo';
    if (workflow.approval_levels >= 2 && workflow.requires_hr) return 'supervisor_hr_ceo';
    if (workflow.approval_levels >= 2) return 'supervisor_ceo';
    if (workflow.requires_hr) return 'supervisor_hr';
    return 'supervisor';
  };

  const flowPatternToConfig = (pattern: FlowPattern) => {
    switch (pattern) {
      case 'supervisor_hr':
        return { approval_levels: 1, requires_hr: true };
      case 'supervisor_hr_ceo':
        return { approval_levels: 2, requires_hr: true };
      case 'supervisor_ceo':
        return { approval_levels: 2, requires_hr: false };
      case 'ceo':
        return { approval_levels: 0, requires_hr: false };
      case 'supervisor':
      default:
        return { approval_levels: 1, requires_hr: false };
    }
  };
 
   useEffect(() => {
     fetchWorkflows();
   }, []);
 
   const fetchWorkflows = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/v1/approval-workflows`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const workflowRows = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      setWorkflows(workflowRows as ApprovalWorkflow[]);
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setLoading(false);
    }
  };
 
   const handleSaveWorkflow = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     const formData = new FormData(e.currentTarget);
 
     const minDays = formData.get('min_days') as string;
     const maxDays = formData.get('max_days') as string;
 
    const config = flowPatternToConfig(flowPattern);

    const workflowData = {
      leave_type: 'all',
      approval_levels: config.approval_levels,
       min_days: minDays ? parseInt(minDays) : null,
       max_days: maxDays ? parseInt(maxDays) : null,
      requires_hr: config.requires_hr,
      flow_pattern: flowPattern,
       description: formData.get('description') as string || null,
     };
 
     try {
      const token = localStorage.getItem('token');

      if (editingWorkflow) {
        const res = await fetch(`${API_BASE_URL}/api/v1/approval-workflows/${editingWorkflow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
          body: JSON.stringify(workflowData),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'update failed');
        }
        toast({ title: 'อัพเดตลำดับการอนุมัติสำเร็จ' });
      } else {
        const res = await fetch(`${API_BASE_URL}/api/v1/approval-workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
          body: JSON.stringify(workflowData),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'create failed');
        }
        toast({ title: 'เพิ่มลำดับการอนุมัติสำเร็จ' });
      }

      setIsDialogOpen(false);
      setEditingWorkflow(null);
      setFlowPattern('supervisor');
      fetchWorkflows();
    } catch (error: unknown) {
       toast({
         title: 'เกิดข้อผิดพลาด',
         description: error instanceof Error ? error.message : 'Unknown error',
         variant: 'destructive',
       });
     }
   };
 
   const handleDeleteWorkflow = async (workflow: ApprovalWorkflow) => {
     if (!confirm('คุณแน่ใจหรือไม่ที่จะลบลำดับการอนุมัตินี้?')) return;
 
     try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/v1/approval-workflows/${workflow.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'delete failed');
      }
      toast({ title: 'ลบลำดับการอนุมัติสำเร็จ' });
      fetchWorkflows();
     } catch (error: unknown) {
       toast({
         title: 'เกิดข้อผิดพลาด',
         description: error instanceof Error ? error.message : 'Unknown error',
         variant: 'destructive',
       });
     }
   };
 
   const openEditDialog = (workflow: ApprovalWorkflow) => {
     setEditingWorkflow(workflow);
     setRequiresHR(workflow.requires_hr || false);
    setFlowPattern(deriveFlowPattern(workflow));
     setIsDialogOpen(true);
   };
 
   const openCreateDialog = () => {
     setEditingWorkflow(null);
     setRequiresHR(false);
    setFlowPattern('supervisor');
     setIsDialogOpen(true);
   };
 
   const formatDaysRange = (min: number | null, max: number | null) => {
     if (min === null && max === null) return 'ทุกจำนวนวัน';
     if (min === null) return `≤ ${max} วัน`;
     if (max === null) return `> ${min} วัน`;
     return `${min} - ${max} วัน`;
   };
 
   const renderApprovalFlow = (workflow: ApprovalWorkflow) => {
    const pattern = deriveFlowPattern(workflow);
     const steps = [];

    if (pattern !== 'ceo') {
       steps.push(
         <div key="manager" className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
           <User className="w-4 h-4 text-primary" />
           <span className="text-sm font-medium">หัวหน้างาน</span>
         </div>
       );
     }

    if (pattern === 'supervisor_hr' || pattern === 'supervisor_hr_ceo') {
       if (steps.length > 0) {
         steps.push(
           <ArrowRight key="arrow1" className="w-4 h-4 text-muted-foreground" />
         );
       }
       steps.push(
         <div key="hr" className="flex items-center gap-2 px-3 py-2 bg-warning/10 rounded-lg">
           <Users className="w-4 h-4 text-warning" />
           <span className="text-sm font-medium">HR</span>
         </div>
       );
     }

    if (pattern === 'supervisor_ceo' || pattern === 'supervisor_hr_ceo' || pattern === 'ceo') {
      steps.push(
        <ArrowRight key="arrow2" className="w-4 h-4 text-muted-foreground" />
      );
      steps.push(
        <div key="ceo" className="flex items-center gap-2 px-3 py-2 bg-success/10 rounded-lg">
          <Crown className="w-4 h-4 text-success" />
          <span className="text-sm font-medium">CEO</span>
        </div>
      );
    }
     
     return (
       <div className="flex items-center gap-2">
         {steps.length > 0 ? steps : (
           <span className="text-muted-foreground text-sm">ไม่ต้องอนุมัติ</span>
         )}
       </div>
     );
   };
 
   // Group by leave type
   const groupedWorkflows = workflows.reduce((acc, workflow) => {
     if (!acc[workflow.leave_type]) {
       acc[workflow.leave_type] = [];
     }
     acc[workflow.leave_type].push(workflow);
     return acc;
   }, {} as Record<LeaveType, ApprovalWorkflow[]>);
 
   return (
     <div className="space-y-6">
       <div className="flex justify-between items-center">
         <div>
           <h3 className="text-lg font-semibold">ตั้งค่าลำดับการอนุมัติ</h3>
           <p className="text-sm text-muted-foreground">
             กฎใช้เดียวกันสำหรับทุกประเภทการลา — เลือกตามจำนวนวันที่ลา
           </p>
         </div>
         <Button onClick={openCreateDialog}>
           <Plus className="w-4 h-4 mr-2" />
           เพิ่มเส้นทางอนุมัติ
         </Button>
       </div>

       {loading ? (
         <div className="space-y-4">
           {[...Array(3)].map((_, i) => (
             <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
           ))}
         </div>
       ) : workflows.length === 0 ? (
         <Card>
           <CardContent className="py-12 text-center text-muted-foreground">
             <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
             <p>ยังไม่มีการตั้งค่าลำดับการอนุมัติ</p>
             <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
               <Plus className="w-4 h-4 mr-2" />
               เพิ่มเส้นทางแรก
             </Button>
           </CardContent>
         </Card>
       ) : (
         <Card>
           <CardHeader className="pb-3">
             <CardTitle className="text-base">เส้นทางอนุมัติตามจำนวนวันลา (ใช้กับทุกประเภทการลา)</CardTitle>
           </CardHeader>
           <CardContent>
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>จำนวนวัน</TableHead>
                   <TableHead>เส้นทางอนุมัติ</TableHead>
                   <TableHead>คำอธิบาย</TableHead>
                   <TableHead className="w-[100px]"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {workflows.map((workflow) => (
                   <TableRow key={workflow.id}>
                     <TableCell className="font-medium">
                       {formatDaysRange(workflow.min_days, workflow.max_days)}
                     </TableCell>
                     <TableCell>
                       {renderApprovalFlow(workflow)}
                     </TableCell>
                     <TableCell className="text-muted-foreground text-sm">
                       {workflow.description || '-'}
                     </TableCell>
                     <TableCell>
                       <div className="flex gap-1">
                         <Button variant="ghost" size="icon" onClick={() => openEditDialog(workflow)}>
                           <Edit className="w-4 h-4" />
                         </Button>
                         <Button variant="ghost" size="icon" onClick={() => handleDeleteWorkflow(workflow)}>
                           <Trash2 className="w-4 h-4 text-destructive" />
                         </Button>
                       </div>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </CardContent>
         </Card>
       )}
 
       {/* Info Card */}
       <Card className="bg-muted/30">
         <CardHeader>
           <CardTitle className="text-sm font-medium flex items-center gap-2">
             📋 วิธีการทำงานของลำดับการอนุมัติ
           </CardTitle>
         </CardHeader>
         <CardContent className="text-sm text-muted-foreground space-y-2">
           <p>• กฎใช้ได้กับทุกประเภทการลา (ลาพักร้อน, ลาป่วย, ลากิจ, ลาคลอด เป็นต้น)</p>
           <p>• ระบบเลือกเส้นทางตามจำนวนวันที่ลา (ไม่นับวันหยุด)</p>
           <p>• <strong>หัวหน้างาน:</strong> Role supervisor ในระบบ</p>
           <p>• <strong>HR:</strong> Role hr</p>
           <p>• <strong>CEO:</strong> Role admin</p>
           <p>• หากไม่พบกฎที่ตรงกับจำนวนวัน จะใช้ค่าเริ่มต้น (หัวหน้างานอนุมัติ)
           </p>
         </CardContent>
       </Card>
 
       {/* Dialog */}
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <DialogContent className="max-w-lg">
           <DialogHeader>
             <DialogTitle>
               {editingWorkflow ? 'แก้ไขลำดับการอนุมัติ' : 'เพิ่มลำดับการอนุมัติใหม่'}
             </DialogTitle>
             <DialogDescription>
               กำหนดลำดับการอนุมัติตามประเภทการลาและจำนวนวัน
             </DialogDescription>
           </DialogHeader>
           <form onSubmit={handleSaveWorkflow} className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label htmlFor="min_days">จำนวนวันขั้นต่ำ</Label>
                 <Input
                   label="จำนวนวันขั้นต่ำ"
                   id="min_days"
                   name="min_days"
                   type="number"
                   min="0"
                   defaultValue={editingWorkflow?.min_days ?? ''}
                   placeholder="ว่างไว้ = ไม่จำกัด"
                 />
               </div>
               <div>
                 <Label htmlFor="max_days">จำนวนวันสูงสุด</Label>
                 <Input
                   label="จำนวนวันสูงสุด"
                   id="max_days"
                   name="max_days"
                   type="number"
                   min="0"
                   defaultValue={editingWorkflow?.max_days ?? ''}
                   placeholder="ว่างไว้ = ไม่จำกัด"
                 />
               </div>
             </div>
 
             <div>
               <Label htmlFor="flow_pattern">เส้นทางการอนุมัติ</Label>
               <Select name="flow_pattern" value={flowPattern} onValueChange={(value) => setFlowPattern(value as FlowPattern)}>
                 <SelectTrigger label="เส้นทางการอนุมัติ">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="supervisor">หัวหน้างาน</SelectItem>
                   <SelectItem value="supervisor_hr">หัวหน้างาน → HR</SelectItem>
                   <SelectItem value="supervisor_hr_ceo">หัวหน้างาน → HR → CEO</SelectItem>
                   <SelectItem value="supervisor_ceo">หัวหน้างาน → CEO</SelectItem>
                   <SelectItem value="ceo">CEO</SelectItem>
                 </SelectContent>
               </Select>
             </div>
 
             <div className="flex justify-end gap-3 pt-2">
               <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                 ยกเลิก
               </Button>
               <Button type="submit">
                 {editingWorkflow ? 'บันทึก' : 'เพิ่มเส้นทางอนุมัติ'}
               </Button>
             </div>
           </form>
         </DialogContent>
       </Dialog>
     </div>
   );
 }