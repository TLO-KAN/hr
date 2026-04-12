import express from 'express';
import positionController from '../controllers/positionController.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes (authenticated)
router.get('/', authenticate, positionController.getAll);
router.get('/:id', authenticate, positionController.getById);

// Admin/HR only routes
router.post('/', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  positionController.create
);

router.put('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  positionController.update
);

router.delete('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  positionController.delete
);

export default router;