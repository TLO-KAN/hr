import express from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { getPool } from '../config/db-pool.js';

const router = express.Router();
const pool = getPool();

const getPolicyTableColumns = async () => {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'leave_policies'`
  );

  return new Set(result.rows.map((row) => row.column_name));
};

const normalizePolicyRow = (row) => {
  const hasTenureFrom = row.tenure_year_from !== null && row.tenure_year_from !== undefined;
  const hasTenureTo = row.tenure_year_to !== null && row.tenure_year_to !== undefined;

  return {
    ...row,
    min_years_of_service:
      hasTenureFrom ? row.tenure_year_from : (row.min_years_of_service ?? 0),
    max_years_of_service:
      hasTenureTo ? row.tenure_year_to : (row.max_years_of_service ?? null),
    is_prorated:
      row.is_prorated ?? row.is_prorated_first_year ?? true,
    active:
      row.active ?? row.is_active ?? true,
  };
};

const toInsertPayload = (input, columns) => {
  const payload = {};

  const minYears = input.min_years_of_service ?? 0;
  const maxYears = input.max_years_of_service ?? null;

  if (columns.has('employee_type')) payload.employee_type = input.employee_type;
  if (columns.has('employee_status')) payload.employee_status = input.employee_status || 'active';

  if (columns.has('min_years_of_service')) payload.min_years_of_service = minYears;
  if (columns.has('max_years_of_service')) payload.max_years_of_service = maxYears;
  if (columns.has('tenure_year_from')) payload.tenure_year_from = minYears;
  if (columns.has('tenure_year_to')) payload.tenure_year_to = maxYears;

  if (columns.has('annual_leave_quota')) payload.annual_leave_quota = input.annual_leave_quota ?? 6;
  if (columns.has('sick_leave_quota')) payload.sick_leave_quota = input.sick_leave_quota ?? 30;
  if (columns.has('personal_leave_quota')) payload.personal_leave_quota = input.personal_leave_quota ?? 3;
  if (columns.has('maternity_leave_quota')) payload.maternity_leave_quota = input.maternity_leave_quota ?? 120;
  if (columns.has('paternity_leave_quota')) payload.paternity_leave_quota = input.paternity_leave_quota ?? 15;

  if (columns.has('is_prorated')) payload.is_prorated = !!input.is_prorated;
  if (columns.has('is_prorated_first_year')) {
    payload.is_prorated_first_year =
      input.is_prorated_first_year ?? input.is_prorated ?? true;
  }

  if (columns.has('description')) payload.description = input.description ?? null;

  if (columns.has('active')) payload.active = true;
  if (columns.has('is_active')) payload.is_active = true;

  return payload;
};

const toUpdatePayload = (input, columns) => {
  const payload = {};

  if ('employee_type' in input && columns.has('employee_type')) payload.employee_type = input.employee_type;
  if ('employee_status' in input && columns.has('employee_status')) payload.employee_status = input.employee_status;

  if ('min_years_of_service' in input) {
    if (columns.has('min_years_of_service')) payload.min_years_of_service = input.min_years_of_service;
    if (columns.has('tenure_year_from')) payload.tenure_year_from = input.min_years_of_service;
  }

  if ('max_years_of_service' in input) {
    if (columns.has('max_years_of_service')) payload.max_years_of_service = input.max_years_of_service;
    if (columns.has('tenure_year_to')) payload.tenure_year_to = input.max_years_of_service;
  }

  if ('annual_leave_quota' in input && columns.has('annual_leave_quota')) payload.annual_leave_quota = input.annual_leave_quota;
  if ('sick_leave_quota' in input && columns.has('sick_leave_quota')) payload.sick_leave_quota = input.sick_leave_quota;
  if ('personal_leave_quota' in input && columns.has('personal_leave_quota')) payload.personal_leave_quota = input.personal_leave_quota;
  if ('maternity_leave_quota' in input && columns.has('maternity_leave_quota')) payload.maternity_leave_quota = input.maternity_leave_quota;
  if ('paternity_leave_quota' in input && columns.has('paternity_leave_quota')) payload.paternity_leave_quota = input.paternity_leave_quota;
  if ('description' in input && columns.has('description')) payload.description = input.description;

  if ('is_prorated' in input) {
    if (columns.has('is_prorated')) payload.is_prorated = input.is_prorated;
    if (columns.has('is_prorated_first_year')) payload.is_prorated_first_year = input.is_prorated;
  }

  if ('is_prorated_first_year' in input && columns.has('is_prorated_first_year')) {
    payload.is_prorated_first_year = input.is_prorated_first_year;
  }

  if ('active' in input) {
    if (columns.has('active')) payload.active = input.active;
    if (columns.has('is_active')) payload.is_active = input.active;
  }

  if ('is_active' in input) {
    if (columns.has('active')) payload.active = input.is_active;
    if (columns.has('is_active')) payload.is_active = input.is_active;
  }

  if (columns.has('updated_at')) payload.updated_at = new Date();

  return payload;
};

// Get all policies
router.get('/', authenticate, async (req, res, next) => {
  try {
    const columns = await getPolicyTableColumns();
    const activeClause = columns.has('active')
      ? 'active = true'
      : columns.has('is_active')
        ? 'is_active = true'
        : 'true';

    const orderColumn = columns.has('min_years_of_service')
      ? 'min_years_of_service'
      : columns.has('tenure_year_from')
        ? 'tenure_year_from'
        : 'id';

    const result = await pool.query(
      `SELECT * FROM leave_policies WHERE ${activeClause} ORDER BY employee_type, ${orderColumn}, id`
    );

    const normalized = result.rows.map(normalizePolicyRow);
    res.json({
      success: true,
      data: normalized
    });
  } catch (error) {
    next(error);
  }
});

// Get policy by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leave_policies WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    res.json({
      success: true,
      data: normalizePolicyRow(result.rows[0])
    });
  } catch (error) {
    next(error);
  }
});

// Create policy (Admin/HR only)
router.post('/', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const columns = await getPolicyTableColumns();
      const {
        employee_type,
        employee_status,
        min_years_of_service = 0,
        max_years_of_service,
        annual_leave_quota = 6,
        sick_leave_quota = 30,
        personal_leave_quota = 3,
        maternity_leave_quota = 120,
        paternity_leave_quota = 15,
        is_prorated_first_year = true,
        is_prorated,
        description = null
      } = req.body;

      if (!employee_type) {
        return res.status(400).json({
          success: false,
          error: 'employee_type is required'
        });
      }

      const payload = toInsertPayload(
        {
          employee_type,
          employee_status,
          min_years_of_service,
          max_years_of_service,
          annual_leave_quota,
          sick_leave_quota,
          personal_leave_quota,
          maternity_leave_quota,
          paternity_leave_quota,
          is_prorated_first_year,
          is_prorated,
          description,
        },
        columns
      );

      const insertColumns = Object.keys(payload);
      const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`);
      const values = Object.values(payload);

      const result = await pool.query(
        `INSERT INTO leave_policies (${insertColumns.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values
      );

      res.status(201).json({
        success: true,
        message: 'สร้างนโยบายการลาสำเร็จ',
        data: normalizePolicyRow(result.rows[0])
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update policy (Admin/HR only)
router.put('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body || {};
      const columns = await getPolicyTableColumns();
      const payload = toUpdatePayload(updates, columns);

      const updateColumns = Object.keys(payload);
      if (updateColumns.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update',
        });
      }

      let query = 'UPDATE leave_policies SET ';
      const values = Object.values(payload);
      query += updateColumns.map((column, idx) => `${column} = $${idx + 1}`).join(', ');
      query += ` WHERE id = $${updateColumns.length + 1} RETURNING *`;
      values.push(id);

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Policy not found'
        });
      }

      res.json({
        success: true,
        message: 'อัพเดตนโยบายการลาสำเร็จ',
        data: normalizePolicyRow(result.rows[0])
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete policy (Admin/HR only)
router.delete('/:id', 
  authenticate, 
  authorize(['admin', 'ceo', 'hr']), 
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM leave_policies WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Policy not found'
        });
      }

      res.json({
        success: true,
        message: 'ลบนโยบายการลาสำเร็จ'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;