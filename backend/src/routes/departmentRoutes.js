import express from 'express';
import departmentController from '../controllers/departmentController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes (authenticated)
router.get('/', authenticate, departmentController.getAll);
router.get('/:id', authenticate, departmentController.getById);

// Admin/HR only routes
router.post('/', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  departmentController.create
);

router.put('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  departmentController.update
);

router.delete('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  departmentController.delete
);

export default router;