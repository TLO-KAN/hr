import express from 'express';
import multer from 'multer';
import employeeController from '../controllers/employeeController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validateEmployeeCreateRequest } from '../middlewares/validationMiddleware.js';

const router = express.Router();
const MAX_AVATAR_SIZE_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น'));
      return;
    }

    cb(null, true);
  },
});

// Public routes (authenticated)
router.get('/', authenticate, employeeController.getAll);
router.get('/me', authenticate, employeeController.getMe);
router.get('/:id', authenticate, employeeController.getById);
router.post('/upload-avatar', authenticate, upload.single('avatar'), employeeController.uploadAvatar);
router.post('/delete-avatar', authenticate, employeeController.deleteAvatar);

// Admin/HR only routes
router.post('/', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  validateEmployeeCreateRequest,
  employeeController.create
);

router.post('/send-welcome-email',
  authenticate,
  authorize(['admin', 'ceo', 'hr']),
  employeeController.sendWelcomeEmail
);

router.put('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  employeeController.update
);

router.delete('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  employeeController.delete
);

router.post('/:id/reset-password', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  employeeController.resetPassword
);

export default router;