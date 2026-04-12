import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { getPool } from '../config/db-pool.js';

const router = express.Router();
const pool = getPool();

let notificationsTableReady = false;

const ensureNotificationsTable = async () => {
  if (notificationsTableReady) return;

  const legacyTypeResult = await pool.query(
    `SELECT data_type
     FROM information_schema.columns
     WHERE table_name = 'notifications' AND column_name = 'user_id'
     LIMIT 1`
  );

  if (legacyTypeResult.rows[0]?.data_type === 'integer') {
    await pool.query('DROP TABLE IF EXISTS notifications CASCADE');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES user_auth(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      is_read BOOLEAN DEFAULT false,
      link VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)');
  notificationsTableReady = true;
};

router.use(async (_req, _res, next) => {
  try {
    await ensureNotificationsTable();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, title, message, type, is_read, link, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { user_id, title, message, type = 'info', link = null } = req.body;
    const requesterRoles = req.user.roles || [req.user.role];
    const canCreateForOthers = requesterRoles.some((role) => ['admin', 'ceo', 'hr', 'manager'].includes(role));

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'ต้องระบุ title และ message',
      });
    }

    const targetUserId = user_id ? String(user_id) : String(req.user.id);
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'user_id ไม่ถูกต้อง',
      });
    }

    if (!canCreateForOthers && targetUserId !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'ไม่มีสิทธิ์สร้างการแจ้งเตือนให้ผู้ใช้อื่น',
      });
    }

    const inserted = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, title, message, type, is_read, link, created_at`,
      [targetUserId, title, message, type, link]
    );

    res.status(201).json({
      success: true,
      message: 'สร้างการแจ้งเตือนสำเร็จ',
      data: inserted.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = true, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบการแจ้งเตือน',
      });
    }

    res.json({
      success: true,
      message: 'อัปเดตสถานะการแจ้งเตือนแล้ว',
    });
  } catch (error) {
    next(error);
  }
});

router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = true, updated_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'อ่านการแจ้งเตือนทั้งหมดแล้ว',
      updated: result.rowCount,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบการแจ้งเตือน',
      });
    }

    res.json({
      success: true,
      message: 'ลบการแจ้งเตือนแล้ว',
    });
  } catch (error) {
    next(error);
  }
});

export default router;