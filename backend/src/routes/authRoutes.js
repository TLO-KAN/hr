import express from 'express';
import authController from '../controllers/authControllerLegacy.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateEmail, validatePassword } from '../middlewares/validationMiddleware.js';
import { rateLimit } from '../middlewares/rateLimitMiddleware.js';

const router = express.Router();

// Rate limiting for auth endpoints
// Development: disabled | Production: 30 requests per 15 minutes
const authLimiter = rateLimit(30, 15 * 60 * 1000);

router.post('/register', authLimiter, validateEmail, validatePassword, authController.register);
router.post('/login', authLimiter, validateEmail, validatePassword, authController.login);
router.post('/forgot-password', authLimiter, validateEmail, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/change-password', authenticate, authController.changePassword);
router.get('/me', authenticate, authController.getMe);
router.get('/permissions', authenticate, authController.getPermissions);

export default router;