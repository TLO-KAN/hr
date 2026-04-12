/**
 * Authentication Service
 * 
 * Handles:
 * - Email/Password login
 * - Microsoft SSO authentication
 * - JWT token creation
 * - User identity management (Email-based)
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../config/db.js';

interface User {
  id: string;
  email: string;
  role: string;
}

interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

export class AuthService {
  private jwtSecret = process.env.JWT_SECRET || 'default-secret-key-change-me';
  private jwtExpiry: jwt.SignOptions['expiresIn'] = '7d';

  /**
   * Email/Password Login
   */
  async loginWithEmailPassword(email: string, password: string): Promise<{ token: string; user: User }> {
    try {
      // Find user by email
      const result = await query(
        'SELECT id, email, password_hash, role FROM user_auth WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = result.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Create JWT token
      const token = this.createToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      console.error('Email/Password login error:', error);
      throw error;
    }
  }

  /**
   * Microsoft SSO Authentication
   * 
   * Business Rule:
    * - Find user by email from Microsoft profile
    * - Allow login only if email exists in HR system (employees or user_auth)
    * - If employee exists but user_auth is missing, create and link user_auth
   * - Email is the primary user identity
   */
  async loginWithMicrosoft(profile: any): Promise<{ token: string; user: User }> {
    try {
      const email = profile.mail || profile.userPrincipalName;
      const displayName = profile.displayName;

      if (!email) {
        throw new Error('Unable to extract email from Microsoft profile');
      }

      // Find existing auth account by email.
      let result = await query(
        'SELECT id, email, role FROM user_auth WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      let user = result.rows[0];

      if (!result.rows.length) {
        // If no auth account exists, allow only pre-registered employee emails.
        const employeeResult = await query(
          'SELECT id, user_id FROM employees WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [email]
        );

        if (!employeeResult.rows.length) {
          throw new Error('Microsoft account is not allowed. Email is not registered in the system');
        }

        const createdUserResult = await query(
          `INSERT INTO user_auth (email, role, created_at)
           VALUES ($1, $2, NOW())
           RETURNING id, email, role`,
          [email, 'employee']
        );

        user = createdUserResult.rows[0];

        // Link employee record to user_auth when missing.
        await query(
          'UPDATE employees SET user_id = $1 WHERE id = $2 AND (user_id IS NULL OR user_id = $1)',
          [user.id, employeeResult.rows[0].id]
        );

        console.log(`🔗 Linked Microsoft SSO account for employee email: ${email}`);
      }

      // Create JWT token
      const token = this.createToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      console.error('Microsoft SSO error:', error);
      throw error;
    }
  }

  /**
   * Create JWT Token
   */
  private createToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiry,
      algorithm: 'HS256',
    });
  }

  /**
   * Verify JWT Token
   */
  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return decoded;
    } catch (error) {
      console.error('Token verification error:', error);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string): string {
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new Error('Invalid authorization header format');
    }
    return parts[1];
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Register new user with email/password
   */
  async registerUser(
    email: string,
    password: string,
    displayName: string
  ): Promise<{ token: string; user: User }> {
    try {
      // Check if user already exists
      const existingUser = await query(
        'SELECT id FROM user_auth WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create user
      const result = await query(
        `INSERT INTO user_auth (email, password_hash, role, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, email, role`,
        [email, passwordHash, 'employee']
      );

      const user = result.rows[0];

      // Create JWT token
      const token = this.createToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      console.error('User registration error:', error);
      throw error;
    }
  }
}

export default new AuthService();
