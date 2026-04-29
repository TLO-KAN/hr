import express from 'express';
import leaveRequestController from '../controllers/leaveRequestController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validateLeaveRequestCreate } from '../middlewares/validationMiddleware.js';
import { leaveAttachmentUpload } from '../middlewares/leaveAttachmentUpload.js';

const router = express.Router();

// Employee routes
router.get('/my-requests', authenticate, leaveRequestController.getMyRequests);
router.post('/', 
  authenticate, 
  leaveAttachmentUpload.array('attachments', 10),
  validateLeaveRequestCreate,
  leaveRequestController.create
);
router.put('/:id', authenticate, leaveAttachmentUpload.array('attachments', 10), leaveRequestController.update);
router.post('/:id/cancel', authenticate, leaveRequestController.cancel);
router.delete('/:id/attachments/:attachmentId', authenticate, leaveRequestController.removeAttachment);

// Admin/HR routes
router.get('/', authenticate, authorize(['admin', 'ceo', 'hr', 'manager', 'supervisor']), leaveRequestController.getAll);
router.get('/approval-link/resolve', authenticate, authorize(['admin', 'ceo', 'hr', 'manager', 'supervisor']), leaveRequestController.resolveApprovalLink);
router.get('/:id', authenticate, leaveRequestController.getById);

// Bulk operations
router.post('/bulk-approve', 
  authenticate, 
  authorize(['admin', 'hr', 'manager', 'supervisor', 'ceo']),
  leaveRequestController.bulkApprove
);
router.post('/bulk-reject', 
  authenticate, 
  authorize(['admin', 'hr', 'manager', 'supervisor', 'ceo']),
  leaveRequestController.bulkReject
);

router.post('/:id/approve', 
  authenticate, 
  authorize(['admin', 'hr', 'manager', 'supervisor', 'ceo']), 
  leaveRequestController.approve
);
router.post('/:id/reject', 
  authenticate, 
  authorize(['admin', 'hr', 'manager', 'supervisor', 'ceo']), 
  leaveRequestController.reject
);

export default router;