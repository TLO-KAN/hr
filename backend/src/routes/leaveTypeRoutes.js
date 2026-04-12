import express from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { getPool } from '../config/db-pool.js';

const router = express.Router();
const pool = getPool();

// Get all leave types
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leave_types ORDER BY name'
    );
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get leave type by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leave_types WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบประเภทการลา'
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

// Create leave type (Admin/HR only)
router.post('/', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { code, name, description, color } = req.body;

      if (!code || !name) {
        return res.status(400).json({
          success: false,
          error: 'รหัส และ ชื่อ จำเป็นต้องกรอก'
        });
      }

      const result = await pool.query(
        'INSERT INTO leave_types (code, name, description, color) VALUES ($1, $2, $3, $4) RETURNING *',
        [code, name, description, color]
      );

      res.status(201).json({
        success: true,
        message: 'สร้างประเภทการลาสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update leave type (Admin/HR only)
router.put('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { code, name, description, color } = req.body;
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE leave_types 
         SET code = COALESCE($1, code),
             name = COALESCE($2, name),
             description = COALESCE($3, description),
             color = COALESCE($4, color)
         WHERE id = $5 
         RETURNING *`,
        [code, name, description, color, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Leave type not found'
        });
      }

      res.json({
        success: true,
        message: 'อัพเดตประเภทการลาสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete leave type (Admin/HR only)
router.delete('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM leave_types WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Leave type not found'
        });
      }

      res.json({
        success: true,
        message: 'ลบประเภทการลาสำเร็จ'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;