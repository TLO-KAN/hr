import express from 'express';
import AuthController from '../controllers/AuthController.js';
import passport from 'passport';

const router = express.Router();
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

router.get('/microsoft', passport.authenticate('azure-ad', {
  scope: ['user.read'],
  prompt: 'select_account',
  session: false,
}));

router.get(
  '/microsoft/callback',
  passport.authenticate('azure-ad', {
    failureRedirect: `${frontendUrl}/auth/callback?message=${encodeURIComponent('Authentication failed')}`,
    session: false,
  }),
  async (req, res) => {
    try {
      await AuthController.microsoftCallback(req, res);
    } catch (error) {
      console.error('Route error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

export default router;
