import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../uploads/leaves');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png'
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeBase = path
      .basename(file.originalname || 'attachment', ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 40);
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safeBase}${ext}`;
    cb(null, filename);
  }
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExt = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);

  if (!allowedMimeTypes.has(file.mimetype) || !allowedExt.has(ext)) {
    return cb(new Error('รองรับเฉพาะไฟล์ .pdf, .doc, .docx, .jpg, .jpeg, .png'));
  }

  cb(null, true);
}

export const leaveAttachmentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10
  }
});
