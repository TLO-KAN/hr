import { useState, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl, resolveAssetUrl } from '@/config/api';

const MAX_AVATAR_SIZE_BYTES = 10 * 1024 * 1024;

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  firstName: string;
  lastName: string;
  onAvatarUpdate: (newUrl: string | null) => void;
}

export function AvatarUpload({ 
  userId, 
  currentAvatarUrl, 
  firstName, 
  lastName,
  onAvatarUpdate 
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getInitials = () => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  const parseApiError = async (response: Response) => {
    if (response.status === 413) {
      return 'ไฟล์มีขนาดใหญ่เกินกำหนดของระบบ (ไม่เกิน 10MB)';
    }

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const resetInput = () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'ไฟล์ไม่ถูกต้อง',
        description: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น',
        variant: 'destructive',
      });
      resetInput();
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast({
        title: 'ไฟล์ใหญ่เกินไป',
        description: 'กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 10MB',
        variant: 'destructive',
      });
      resetInput();
      return;
    }

    setUploading(true);

    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('ไม่สามารถขอ Token ได้ กรุณา login ใหม่');
      }

      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // Upload using multipart/form-data
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(buildApiUrl('/employees/upload-avatar'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const message = await parseApiError(response);
        throw new Error(message || 'เกิดข้อผิดพลาดในการอัปโหลด');
      }

      const result = await response.json();
      const newAvatarUrl = resolveAssetUrl(result?.data?.avatar_url) || objectUrl;

      setPreviewUrl(null);
      onAvatarUpdate(newAvatarUrl);
      
      toast({
        title: 'อัปโหลดสำเร็จ',
        description: 'รูปโปรไฟล์ของคุณได้รับการอัปเดตแล้ว',
      });
      
      // Reset file input
      resetInput();
    } catch (error: any) {
      console.error('Error processing file:', error);
      setPreviewUrl(null);
      resetInput();
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถประมวลผลไฟล์ได้',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentAvatarUrl) return;

    setUploading(true);

    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('ไม่สามารถขอ Token ได้ กรุณา login ใหม่');
      }

      // Call backend delete avatar endpoint
      const response = await fetch(buildApiUrl('/employees/delete-avatar'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await parseApiError(response);
        throw new Error(message || 'เกิดข้อผิดพลาดในการลบรูป');
      }

      await response.json();

      setPreviewUrl(null);
      onAvatarUpdate(null);

      toast({
        title: 'ลบรูปโปรไฟล์สำเร็จ',
        description: 'รูปโปรไฟล์ของคุณได้ถูกลบแล้ว',
      });
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถลบรูปภาพได้',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = previewUrl || resolveAssetUrl(currentAvatarUrl);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
          <AvatarImage key={displayUrl || 'empty-avatar'} src={displayUrl || undefined} alt="Profile" />
          <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Upload button */}
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute -bottom-1 -right-1 rounded-full w-8 h-8 shadow-md"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="w-4 h-4" />
        </Button>

        {/* Remove button */}
        {displayUrl && !uploading && (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute -top-1 -right-1 rounded-full w-6 h-6 shadow-md"
            onClick={handleRemoveAvatar}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="text-xs text-muted-foreground text-center">
        คลิกที่ไอคอนกล้องเพื่อเปลี่ยนรูปโปรไฟล์<br />
        รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 10MB
      </p>
    </div>
  );
}
