import express from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { getPool } from '../config/db-pool.js';

const router = express.Router();
const pool = getPool();

// Get all holidays
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { year } = req.query;
    let query = 'SELECT * FROM holidays WHERE 1=1';
    const params = [];

    if (year) {
      query += ' AND EXTRACT(YEAR FROM holiday_date) = $1';
      params.push(parseInt(year));
    }

    query += ' ORDER BY holiday_date';

    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get holiday by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM holidays WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบวันหยุด'
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

// Create holiday (Admin/HR only)
router.post('/', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const holidayDate = req.body?.holiday_date || req.body?.date;
      const { name, description } = req.body;

      if (!holidayDate || !name) {
        return res.status(400).json({
          success: false,
          error: 'วันที่ และ ชื่อ วันหยุด เป็นสิ่งจำเป็น'
        });
      }

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
        return res.status(400).json({
          success: false,
          error: 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD'
        });
      }

      const result = await pool.query(
        'INSERT INTO holidays (holiday_date, name, description) VALUES ($1, $2, $3) RETURNING *',
        [holidayDate, name, description]
      );

      res.status(201).json({
        success: true,
        message: 'สร้างวันหยุดสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      if (error?.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'วันหยุดนี้มีอยู่ในระบบแล้ว'
        });
      }
      next(error);
    }
  }
);

// Update holiday (Admin/HR only)
router.put('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const holidayDate = req.body?.holiday_date || req.body?.date;
      const { name, description } = req.body;

      const result = await pool.query(
        `UPDATE holidays 
         SET holiday_date = COALESCE($1, holiday_date),
             name = COALESCE($2, name),
             description = COALESCE($3, description)
         WHERE id = $4
         RETURNING *`,
        [holidayDate, name, description, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'ไม่พบวันหยุด'
        });
      }

      res.json({
        success: true,
        message: 'อัพเดตวันหยุดสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      if (error?.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'วันหยุดนี้มีอยู่ในระบบแล้ว'
        });
      }
      next(error);
    }
  }
);

// Delete holiday (Admin/HR only)
router.delete('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM holidays WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'ไม่พบวันหยุด'
        });
      }

      res.json({
        success: true,
        message: 'ลบวันหยุดสำเร็จ'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;