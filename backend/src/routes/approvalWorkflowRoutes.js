import express from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { getPool } from '../config/db-pool.js';

const router = express.Router();
const pool = getPool();

const normalizeApprovalLevels = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
    return null;
  }

  return parsed;
};

// Get all workflows
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM approval_workflows ORDER BY leave_type'
    );
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get workflow by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM approval_workflows WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
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

// Create workflow (Admin/HR only)
router.post('/', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const {
        leave_type,
        approval_levels,
        min_days,
        max_days,
        requires_hr = false,
        flow_pattern = 'supervisor',
        description
      } = req.body;

      const normalizedApprovalLevels = normalizeApprovalLevels(approval_levels);

      if (!leave_type || normalizedApprovalLevels === null) {
        return res.status(400).json({
          success: false,
          error: 'leave_type และ approval_levels เป็นสิ่งจำเป็น'
        });
      }

      const result = await pool.query(
        `INSERT INTO approval_workflows 
         (leave_type, approval_levels, min_days, max_days, requires_hr, flow_pattern, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [leave_type, normalizedApprovalLevels, min_days, max_days, requires_hr, flow_pattern, description]
      );

      res.status(201).json({
        success: true,
        message: 'สร้างขั้นตอนอนุมัติสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update workflow (Admin/HR only)
router.put('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        leave_type,
        approval_levels,
        min_days,
        max_days,
        requires_hr,
        flow_pattern,
        description
      } = req.body;

      const normalizedApprovalLevels = approval_levels === undefined
        ? undefined
        : normalizeApprovalLevels(approval_levels);

      if (approval_levels !== undefined && normalizedApprovalLevels === null) {
        return res.status(400).json({
          success: false,
          error: 'approval_levels ต้องเป็นตัวเลขจำนวนเต็มตั้งแต่ 0 ถึง 10'
        });
      }

      const result = await pool.query(
        `UPDATE approval_workflows 
         SET leave_type = COALESCE($1, leave_type),
             approval_levels = COALESCE($2, approval_levels),
             min_days = COALESCE($3, min_days),
             max_days = COALESCE($4, max_days),
             requires_hr = COALESCE($5, requires_hr),
             flow_pattern = COALESCE($6, flow_pattern),
             description = COALESCE($7, description),
             updated_at = NOW()
         WHERE id = $8
         RETURNING *`,
        [leave_type, normalizedApprovalLevels, min_days, max_days, requires_hr, flow_pattern, description, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
      }

      res.json({
        success: true,
        message: 'อัพเดตขั้นตอนอนุมัติสำเร็จ',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete workflow (Admin/HR only)
router.delete('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM approval_workflows WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
      }

      res.json({
        success: true,
        message: 'ลบขั้นตอนอนุมัติสำเร็จ'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;