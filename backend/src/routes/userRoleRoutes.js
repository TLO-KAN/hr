import express from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { getPool } from '../config/db-pool.js';

const router = express.Router();
const pool = getPool();

const ALLOWED_ROLES = new Set(['admin', 'hr', 'manager', 'supervisor', 'employee', 'ceo']);
const PRIVILEGED_ROLES = new Set(['admin', 'ceo']);

router.get('/user/:userId', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, role, 
              (SELECT name FROM role_names WHERE role_names.role_code = user_auth.role) as role_name
       FROM user_auth WHERE id = $1`, 
      [req.params.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบผู้ใช้',
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize(['admin', 'ceo', 'hr']), async (req, res, next) => {
  try {
    const { user_id, role } = req.body;

    if (!user_id || !role) {
      return res.status(400).json({
        success: false,
        error: 'ต้องระบุ user_id และ role',
      });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({
        success: false,
        error: 'role ไม่ถูกต้อง',
      });
    }

    const userId = String(user_id);
    const actorId = String(req.user.id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'user_id ไม่ถูกต้อง',
      });
    }

    if (actorId === userId && PRIVILEGED_ROLES.has(req.user.role) && req.user.role !== role) {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถลดสิทธิ์ระดับผู้ดูแลของตัวเองได้',
      });
    }

    const currentUser = await pool.query('SELECT role FROM user_auth WHERE id = $1', [userId]);
    if (currentUser.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบผู้ใช้',
      });
    }

    const currentRole = currentUser.rows[0].role;
    if (PRIVILEGED_ROLES.has(currentRole) && currentRole !== role) {
      const privilegedCountResult = await pool.query(
        'SELECT COUNT(*)::INT AS count FROM user_auth WHERE role = $1',
        [currentRole]
      );
      const privilegedCount = privilegedCountResult.rows[0]?.count || 0;
      if (privilegedCount <= 1) {
        return res.status(400).json({
          success: false,
          error: `ไม่สามารถลดสิทธิ์ ${currentRole} คนสุดท้ายได้`,
        });
      }
    }

    const updated = await pool.query(
      'UPDATE user_auth SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role',
      [role, userId]
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบผู้ใช้',
      });
    }

    res.json({
      success: true,
      message: 'เพิ่มบทบาทสำเร็จ',
      data: updated.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/', authenticate, authorize(['admin', 'ceo', 'hr']), async (req, res, next) => {
  try {
    const { user_id, role } = req.body;

    if (!user_id || !role) {
      return res.status(400).json({
        success: false,
        error: 'ต้องระบุ user_id และ role',
      });
    }

    const userId = String(user_id);
    const actorId = String(req.user.id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'user_id ไม่ถูกต้อง',
      });
    }

    if (actorId === userId && PRIVILEGED_ROLES.has(req.user.role) && req.user.role === role) {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถลบบทบาทระดับผู้ดูแลของตัวเองได้',
      });
    }

    const current = await pool.query('SELECT id, role FROM user_auth WHERE id = $1', [userId]);
    if (current.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบผู้ใช้',
      });
    }

    if (current.rows[0].role !== role) {
      return res.status(400).json({
        success: false,
        error: 'ผู้ใช้ไม่ได้มีบทบาทนี้',
      });
    }

    if (PRIVILEGED_ROLES.has(role)) {
      const privilegedCountResult = await pool.query(
        'SELECT COUNT(*)::INT AS count FROM user_auth WHERE role = $1',
        [role]
      );
      const privilegedCount = privilegedCountResult.rows[0]?.count || 0;
      if (privilegedCount <= 1) {
        return res.status(400).json({
          success: false,
          error: `ไม่สามารถลบบทบาท ${role} คนสุดท้ายได้`,
        });
      }
    }

    const fallbackRole = 'employee';
    const updated = await pool.query(
      'UPDATE user_auth SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role',
      [fallbackRole, userId]
    );

    res.json({
      success: true,
      message: `ลบบทบาทสำเร็จ (ตั้งค่าเป็น ${fallbackRole})`,
      data: updated.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;