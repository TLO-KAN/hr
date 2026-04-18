import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getPool } from '../config/db-pool.js';
import UserRepository from '../repositories/UserRepository.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../utils/emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_secure_secret_key';
const pool = getPool();

class AuthService {
  async register(email, password, fullName) {
    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      const error = new Error('Email already registered');
      error.statusCode = 409;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await UserRepository.create(email, hashedPassword, 'employee');
    
    return this.generateToken(user);
  }

  async login(email, password) {
    if (!email || !password) {
      const error = new Error('Email and password are required');
      error.statusCode = 400;
      throw error;
    }

    const user = await UserRepository.findByEmail(email);
    
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    return this.generateToken(user);
  }

  async forgotPassword(email) {
    const user = await UserRepository.findByEmail(email);
    
    if (!user) {
      return { message: 'หากอีเมลอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตให้' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    try {
      await sendPasswordResetEmail(user.email, rawToken);
    } catch (error) {
      console.warn('Failed to send reset email:', error.message);
    }

    return { message: 'หากอีเมลอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตให้' };
  }

  async resetPassword(token, newPassword) {
    if (!token || !newPassword) {
      const error = new Error('Token and new password are required');
      error.statusCode = 400;
      throw error;
    }

    if (newPassword.length < 6) {
      const error = new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      error.statusCode = 400;
      throw error;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      `SELECT id, user_id, expires_at, used_at 
       FROM password_reset_tokens 
       WHERE token_hash = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      const error = new Error('ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุ');
      error.statusCode = 400;
      throw error;
    }

    const resetToken = result.rows[0];
    if (resetToken.used_at) {
      const error = new Error('ลิงก์รีเซ็ตนี้ถูกใช้งานแล้ว');
      error.statusCode = 400;
      throw error;
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      const error = new Error('ลิงก์รีเซ็ตหมดอายุแล้ว');
      error.statusCode = 400;
      throw error;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await UserRepository.updatePassword(resetToken.user_id, newHash);
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [resetToken.id]
    );

    return { message: 'รีเซ็ตรหัสผ่านสำเร็จ' };
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      const error = new Error('Current and new password are required');
      error.statusCode = 400;
      throw error;
    }

    if (newPassword.length < 6) {
      const error = new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      error.statusCode = 400;
      throw error;
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      const error = new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      error.statusCode = 401;
      throw error;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    return await UserRepository.updatePassword(userId, newHash);
  }

  generateToken(user) {
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        roles: [user.role] 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { 
      success: true,
      token, 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        roles: [user.role]
      }
    };
  }

  async getMe(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const empResult = await pool.query(
      `SELECT e.*, d.name as department_name,
              p.name as position_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id OR d.name = e.department
       LEFT JOIN positions p ON p.id = e.position_id
       WHERE e.user_id = $1`,
      [userId]
    );

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        roles: [user.role],
        employee: empResult.rows[0] || null
      }
    };
  }
}

export default new AuthService();