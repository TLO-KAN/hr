import express from 'express';
import employeeController from '../controllers/employeeController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validateEmployeeCreateRequest } from '../middlewares/validationMiddleware.js';

const router = express.Router();

// Public routes (authenticated)
router.get('/', authenticate, employeeController.getAll);
router.get('/me', authenticate, employeeController.getMe);
router.get('/:id', authenticate, employeeController.getById);
router.post('/upload-avatar', authenticate, employeeController.uploadAvatar);

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