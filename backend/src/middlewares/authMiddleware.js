import jwt from 'jsonwebtoken';
import { getPool } from '../config/db-pool.js';

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_secure_secret_key';
const pool = getPool();

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized - Token not provided',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    
    const userResult = await pool.query(
      'SELECT id, email, role FROM user_auth WHERE id = $1',
      [payload.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'ไม่พบผู้ใช้',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      roles: payload.roles || [payload.role],
      ...userResult.rows[0]
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'โทเคนไม่ถูกต้อง',
        code: 'INVALID_TOKEN'
      });
    }

    res.status(401).json({ 
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        code: 'NO_USER'
      });
    }

    const userRoles = req.user.roles || [req.user.role];
    const hasPermission = userRoles.some(role => allowedRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'ไม่มีสิทธิ์ในการดำเนินการนี้',
        code: 'PERMISSION_DENIED',
        userRoles,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = jwt.verify(token, JWT_SECRET);
      
      const userResult = await pool.query(
        'SELECT id, email, role FROM user_auth WHERE id = $1',
        [payload.id]
      );

      if (userResult.rows.length > 0) {
        req.user = {
          id: payload.id,
          email: payload.email,
          roles: payload.roles || [payload.role],
          ...userResult.rows[0]
        };
      }
    }

    next();
  } catch (error) {
    next();
  }
};