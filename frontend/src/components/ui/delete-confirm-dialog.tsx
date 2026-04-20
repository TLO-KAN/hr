 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from "@/components/ui/alert-dialog";
 
 interface DeleteConfirmDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   title?: string;
   description?: string;
   onConfirm: () => void;
   isDeleting?: boolean;
  confirmLabel?: string;
  loadingLabel?: string;
 }
 
 export function DeleteConfirmDialog({
   open,
   onOpenChange,
   title = "ยืนยันการลบ",
   description = "คุณแน่ใจหรือไม่ที่จะลบรายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้",
   onConfirm,
   isDeleting = false,
  confirmLabel = "ยืนยันลบ",
  loadingLabel = "กำลังลบ...",
 }: DeleteConfirmDialogProps) {
   return (
     <AlertDialog open={open} onOpenChange={onOpenChange}>
       <AlertDialogContent>
         <AlertDialogHeader>
           <AlertDialogTitle>{title}</AlertDialogTitle>
           <AlertDialogDescription>{description}</AlertDialogDescription>
         </AlertDialogHeader>
         <AlertDialogFooter>
           <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
           <AlertDialogAction
             onClick={onConfirm}
             disabled={isDeleting}
             className="bg-primary text-primary-foreground hover:bg-primary/90"
           >
              {isDeleting ? loadingLabel : confirmLabel}
           </AlertDialogAction>
         </AlertDialogFooter>
       </AlertDialogContent>
     </AlertDialog>
   );
 }