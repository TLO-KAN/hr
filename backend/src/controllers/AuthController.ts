/**
 * Authentication Controller
 * 
 * Handles:
 * - Email/Password login
 * - Microsoft SSO callback
 * - User registration
 * - Logout
 */

import { Request, Response } from 'express';
import AuthService from '../services/AuthService.js';

interface AuthRequest extends Request {
  user?: any;
}

export class AuthController {
  /**
   * POST /auth/register
   * Register new user with email and password
   */
  async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, password, displayName } = req.body;

      if (!email || !password || !displayName) {
        res.status(400).json({
          success: false,
          error: 'Email, password, and displayName are required',
        });
        return;
      }

      const result = await AuthService.registerUser(email, password, displayName);

      res.status(201).json({
        success: true,
        data: {
          token: result.token,
          user: result.user,
        },
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /auth/login
   * Login with email and password
   */
  async login(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
        return;
      }

      const result = await AuthService.loginWithEmailPassword(email, password);

      res.status(200).json({
        success: true,
        data: {
          token: result.token,
          user: result.user,
        },
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /auth/microsoft
   * Redirect to Microsoft OAuth login page
   */
  async microsoftLogin(req: AuthRequest, res: Response): Promise<void> {
    // This would be handled by Passport middleware
    res.json({
      success: false,
      error: 'Redirect to Microsoft OAuth (handled by Passport)',
    });
  }

  /**
   * GET /auth/microsoft/callback
   * Microsoft OAuth callback handler
   */
  async microsoftCallback(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication failed',
        });
        return;
      }

      // Use Microsoft profile to login/create user
      const result = await AuthService.loginWithMicrosoft(req.user);

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
    } catch (error: any) {
      console.error('Microsoft callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?message=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * GET /auth/me
   * Get current authenticated user
   */
  async getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error: any) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /auth/verify-token
   * Verify JWT token validity
   */
  async verifyToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          success: false,
          error: 'Missing authorization header',
        });
        return;
      }

      const token = AuthService.extractTokenFromHeader(authHeader);
      const payload = AuthService.verifyToken(token);

      res.status(200).json({
        success: true,
        data: {
          valid: true,
          payload,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /auth/logout
   * Logout (client-side JWT invalidation)
   */
  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new AuthController();
