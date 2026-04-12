import express from 'express';
import nodemailer from 'nodemailer';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { getPool } from '../config/db-pool.js';

const router = express.Router();
const pool = getPool();

let notificationSettingsReady = false;

const ensureNotificationSettingsTable = async () => {
  if (notificationSettingsReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      department VARCHAR(100),
      role VARCHAR(50),
      email VARCHAR(255),
      notify_on_leave_request BOOLEAN DEFAULT true,
      notify_on_approval BOOLEAN DEFAULT true,
      notify_on_rejection BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS dept_id UUID,
    ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS to_list TEXT,
    ADD COLUMN IF NOT EXISTS cc_list TEXT,
    ADD COLUMN IF NOT EXISTS bcc_list TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
  `);

  await pool.query(`
    UPDATE notification_settings ns
    SET dept_id = d.id
    FROM departments d
    WHERE ns.dept_id IS NULL
      AND ns.department IS NOT NULL
      AND LOWER(TRIM(ns.department)) = LOWER(TRIM(d.name))
  `);

  await pool.query(`
    UPDATE notification_settings
    SET to_list = COALESCE(NULLIF(TRIM(email), ''), to_list)
    WHERE to_list IS NULL
      AND email IS NOT NULL
  `);

  await pool.query(`
    UPDATE notification_settings
    SET leave_type = COALESCE(NULLIF(TRIM(leave_type), ''), 'vacation')
    WHERE leave_type IS NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notification_settings_dept_leave_type
    ON notification_settings(dept_id, leave_type)
  `);

  notificationSettingsReady = true;
};

router.use(async (_req, _res, next) => {
  try {
    await ensureNotificationSettingsTable();
    next();
  } catch (error) {
    next(error);
  }
});

const createMailTransporter = () => {
  const host = process.env.SMTP_HOST || process.env.OFFICE365_SMTP_HOST || 'smtp.office365.com';
  const port = Number(process.env.SMTP_PORT || process.env.OFFICE365_SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.OFFICE365_EMAIL;
  const pass = process.env.SMTP_PASS || process.env.OFFICE365_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });
};

// Get notification settings
router.get('/', authenticate, authorize(['admin', 'ceo', 'hr']), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         ns.id,
         ns.dept_id,
         COALESCE(d.name, ns.department, 'ไม่ระบุแผนก') as department_name,
         COALESCE(ns.leave_type, 'vacation') as leave_type,
         COALESCE(ns.to_list, ns.email, '') as to_list,
         COALESCE(ns.cc_list, '') as cc_list,
         COALESCE(ns.bcc_list, '') as bcc_list,
         COALESCE(ns.is_active, true) as is_active,
         ns.created_at,
         ns.updated_at
       FROM notification_settings ns
       LEFT JOIN departments d
              ON d.id = ns.dept_id
              OR (ns.dept_id IS NULL
                  AND ns.department IS NOT NULL
                  AND LOWER(TRIM(ns.department)) = LOWER(TRIM(d.name)))
       ORDER BY ns.dept_id, ns.leave_type`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get setting by ID
router.get('/:id', authenticate, authorize(['admin', 'ceo', 'hr']), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         ns.id,
         ns.dept_id,
         COALESCE(d.name, ns.department, 'ไม่ระบุแผนก') as department_name,
         COALESCE(ns.leave_type, 'vacation') as leave_type,
         COALESCE(ns.to_list, ns.email, '') as to_list,
         COALESCE(ns.cc_list, '') as cc_list,
         COALESCE(ns.bcc_list, '') as bcc_list,
         COALESCE(ns.is_active, true) as is_active,
         ns.created_at,
         ns.updated_at
       FROM notification_settings ns
       LEFT JOIN departments d
              ON d.id = ns.dept_id
              OR (ns.dept_id IS NULL
                  AND ns.department IS NOT NULL
                  AND LOWER(TRIM(ns.department)) = LOWER(TRIM(d.name)))
       WHERE ns.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบการตั้งค่าการแจ้งเตือน'
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

// Test send email for a setting (Admin/HR only)
router.post('/test-send/:dept_id/:leave_type',
  authenticate,
  authorize(['admin', 'ceo', 'hr']),
  async (req, res, next) => {
    try {
      const { dept_id, leave_type } = req.params;
      const { to_email } = req.body || {};

      if (!to_email) {
        return res.status(400).json({
          success: false,
          error: 'ต้องระบุอีเมลปลายทางสำหรับทดสอบ',
        });
      }

      const transporter = createMailTransporter();
      if (!transporter) {
        return res.status(503).json({
          success: false,
          error: 'ยังไม่ได้ตั้งค่า SMTP credentials',
        });
      }

      const normalizedDeptId = dept_id === 'null' ? null : dept_id;
      const settingResult = await pool.query(
        `SELECT
           COALESCE(d.name, ns.department, 'ไม่ระบุแผนก') AS department_name,
           COALESCE(ns.leave_type, 'vacation') AS leave_type,
           COALESCE(ns.to_list, ns.email, '') AS to_list,
           COALESCE(ns.cc_list, '') AS cc_list,
           COALESCE(ns.bcc_list, '') AS bcc_list,
           COALESCE(ns.is_active, true) AS is_active
         FROM notification_settings ns
         LEFT JOIN departments d
                ON d.id = ns.dept_id
                OR (ns.dept_id IS NULL
                    AND ns.department IS NOT NULL
                    AND LOWER(TRIM(ns.department)) = LOWER(TRIM(d.name)))
         WHERE (ns.dept_id = $1 OR ($1::uuid IS NULL AND ns.dept_id IS NULL))
           AND COALESCE(ns.leave_type, 'vacation') = $2
         LIMIT 1`,
        [normalizedDeptId, leave_type]
      );

      const setting = settingResult.rows[0];
      if (!setting) {
        return res.status(404).json({
          success: false,
          error: 'ไม่พบการตั้งค่าการแจ้งเตือนสำหรับแผนกและประเภทการลานี้',
        });
      }

      if (!setting.is_active) {
        return res.status(400).json({
          success: false,
          error: 'การตั้งค่านี้ปิดใช้งานอยู่',
        });
      }

      const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.OFFICE365_EMAIL;
      await transporter.sendMail({
        from: senderEmail,
        to: to_email,
        subject: `[TEST] Notification Setting - ${setting.department_name} (${setting.leave_type})`,
        text:
          `This is a test email from HR notification settings.\n` +
          `Department: ${setting.department_name}\n` +
          `Leave Type: ${setting.leave_type}\n` +
          `Configured To: ${setting.to_list || '-'}\n` +
          `Configured CC: ${setting.cc_list || '-'}\n` +
          `Configured BCC: ${setting.bcc_list || '-'}\n`,
      });

      res.json({
        success: true,
        message: `ส่งเมลทดสอบสำเร็จไปยัง ${to_email}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create setting (Admin/HR only)
router.post('/', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const {
        dept_id,
        leave_type,
        to_list,
        cc_list,
        bcc_list,
        is_active = true
      } = req.body;

      if (!dept_id || !leave_type || !to_list) {
        return res.status(400).json({
          success: false,
          error: 'ข้อมูลจำเป็นไม่ครบถ้วน: dept_id, leave_type, และ to_list จำเป็น'
        });
      }

      // Check for duplicate (same dept_id + leave_type)
      const dupCheck = await pool.query(
        `SELECT id FROM notification_settings WHERE dept_id = $1 AND leave_type = $2`,
        [dept_id, leave_type]
      );

      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'การตั้งค่าการแจ้งเตือนสำหรับแผนกและประเภทการลานี้มีอยู่แล้ว'
        });
      }

      const result = await pool.query(
        `INSERT INTO notification_settings (dept_id, leave_type, to_list, cc_list, bcc_list, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [dept_id, leave_type, to_list, cc_list || null, bcc_list || null, is_active]
      );

      res.status(201).json({
        success: true,
        message: 'สร้างการตั้งค่าการแจ้งเตือนสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update setting (Admin/HR only)
router.put('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { dept_id, leave_type, to_list, cc_list, bcc_list, is_active } = req.body;

      if (dept_id !== undefined || leave_type !== undefined) {
        const current = await pool.query(
          'SELECT dept_id, leave_type FROM notification_settings WHERE id = $1',
          [id]
        );

        if (current.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'ไม่พบการตั้งค่าการแจ้งเตือน'
          });
        }

        const targetDeptId = dept_id ?? current.rows[0].dept_id;
        const targetLeaveType = leave_type ?? current.rows[0].leave_type;

        const dupCheck = await pool.query(
          `SELECT id FROM notification_settings
           WHERE dept_id = $1 AND leave_type = $2 AND id <> $3`,
          [targetDeptId, targetLeaveType, id]
        );

        if (dupCheck.rows.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'การตั้งค่าการแจ้งเตือนสำหรับแผนกและประเภทการลานี้มีอยู่แล้ว'
          });
        }
      }

      const result = await pool.query(
        `UPDATE notification_settings 
         SET dept_id = COALESCE($1, dept_id),
             leave_type = COALESCE($2, leave_type),
             to_list = COALESCE($3, to_list),
             cc_list = COALESCE($4, cc_list),
             bcc_list = COALESCE($5, bcc_list),
             is_active = COALESCE($6, is_active),
             updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [dept_id, leave_type, to_list, cc_list, bcc_list, is_active, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'ไม่พบการตั้งค่าการแจ้งเตือน'
        });
      }

      res.json({
        success: true,
        message: 'อัพเดตการตั้งค่าการแจ้งเตือนสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete setting (Admin/HR only)
router.delete('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM notification_settings WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'ไม่พบการตั้งค่าการแจ้งเตือน'
        });
      }

      res.json({
        success: true,
        message: 'ลบการตั้งค่าการแจ้งเตือนสำเร็จ'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;