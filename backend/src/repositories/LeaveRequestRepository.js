import { getPool } from '../config/db-pool.js';

const pool = getPool();

class LeaveRequestRepository {
  constructor() {
    this.leaveRequestColumns = null;
  }

  isMissingRelationError(error, relationName) {
    return error?.code === '42P01' && String(error?.message || '').includes(`\"${relationName}\"`);
  }

  async loadAttachments(leaveRequestId) {
    try {
      const attachments = await pool.query(
        `SELECT id, file_name, file_path, file_size, mime_type, uploaded_at
         FROM leave_attachments
         WHERE leave_request_id = $1
         ORDER BY uploaded_at ASC`,
        [leaveRequestId]
      );

      return attachments.rows;
    } catch (error) {
      if (this.isMissingRelationError(error, 'leave_attachments')) {
        return [];
      }

      throw error;
    }
  }

  async getLeaveRequestColumns() {
    if (this.leaveRequestColumns) {
      return this.leaveRequestColumns;
    }

    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'leave_requests'`
    );

    this.leaveRequestColumns = new Set(result.rows.map((row) => row.column_name));
    return this.leaveRequestColumns;
  }

  async findById(leaveRequestId) {
    const result = await pool.query(
      `SELECT lr.*, lt.name as leave_type_name, CONCAT(e.first_name, ' ', e.last_name) as employee_name
       FROM leave_requests lr
       LEFT JOIN leave_types lt ON lr.leave_type = lt.code
       LEFT JOIN employees e ON lr.employee_id = e.id
       WHERE lr.id = $1`,
      [leaveRequestId]
    );
    const leaveRequest = result.rows[0] || null;
    if (!leaveRequest) return null;

    leaveRequest.attachments = await this.loadAttachments(leaveRequestId);
    return leaveRequest;
  }

  async findByEmployeeId(employeeId, filters = {}, limit = 50, offset = 0) {
    let query = `SELECT lr.*, lt.name as leave_type_name
                 FROM leave_requests lr
                 LEFT JOIN leave_types lt ON lr.leave_type = lt.code
                 WHERE lr.employee_id = $1`;
    const params = [employeeId];
    let paramIndex = 2;

    if (filters.status) {
      query += ` AND lr.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.year) {
      query += ` AND EXTRACT(YEAR FROM lr.start_date) = $${paramIndex}`;
      params.push(filters.year);
      paramIndex++;
    }

    // Get total count first
    const countQuery = query.replace(
      /SELECT lr\.\*.*?FROM/s,
      'SELECT COUNT(*) FROM'
    );
    const countResult = await pool.query(countQuery.split('ORDER BY')[0], params.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY lr.created_at DESC, lr.start_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    for (const row of result.rows) {
      row.attachments = await this.loadAttachments(row.id);
    }

    return {
      data: result.rows,
      total
    };
  }

  async getAll(filters = {}, limit = 50, offset = 0) {
    const includeEmployeeMeta = filters.includeEmployeeMeta !== false;
    let query = `SELECT lr.*, 
                        lt.name as leave_type_name,
                        lt.code as leave_type_code,
                        e.id as employee_id,
                        e.employee_code,
                        e.first_name,
                        e.last_name,
                        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                        e.email`;

    if (includeEmployeeMeta) {
      query += `,
                        d.name as department_name,
                        p.name as position_name`;
    }

    query += `
                 FROM leave_requests lr
                 LEFT JOIN leave_types lt ON lr.leave_type = lt.code
                 LEFT JOIN employees e ON lr.employee_id = e.id`;

    if (includeEmployeeMeta) {
      query += `
                 LEFT JOIN departments d ON d.name = e.department
                 LEFT JOIN positions p ON p.id = e.position_id`;
    }

    query += `
                 WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (filters.departmentId) {
      query += ` AND e.department = (SELECT name FROM departments WHERE id = $${paramIndex})`;
      params.push(filters.departmentId);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND lr.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.year) {
      query += ` AND EXTRACT(YEAR FROM lr.start_date) = $${paramIndex}`;
      params.push(filters.year);
      paramIndex++;
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${query.split('ORDER BY')[0]}) as total_query`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY lr.created_at DESC, lr.start_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    for (const row of result.rows) {
      row.attachments = await this.loadAttachments(row.id);
    }

    return {
      data: result.rows,
      total
    };
  }

  async create(data) {
    const {
      employeeId,
      leaveType,
      startDate,
      endDate,
      totalDays,
      reason,
      attachmentUrl,
      status,
      startTime,
      endTime,
      isHalfDay,
      halfDayPeriod
    } = data;

    const columns = await this.getLeaveRequestColumns();

    const insertColumns = [
      'employee_id',
      'leave_type',
      'start_date',
      'end_date',
      'total_days',
      'reason',
      'status'
    ];

    const insertValues = [
      employeeId,
      leaveType,
      startDate,
      endDate,
      totalDays,
      reason,
      status || 'pending'
    ];

    if (columns.has('start_time')) {
      insertColumns.push('start_time');
      insertValues.push(startTime || null);
    }

    if (columns.has('end_time')) {
      insertColumns.push('end_time');
      insertValues.push(endTime || null);
    }

    if (columns.has('is_half_day')) {
      insertColumns.push('is_half_day');
      insertValues.push(Boolean(isHalfDay));
    }

    if (columns.has('half_day_period')) {
      insertColumns.push('half_day_period');
      insertValues.push(halfDayPeriod || null);
    }

    const valuePlaceholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');

    const result = await pool.query(
      `INSERT INTO leave_requests (${insertColumns.join(', ')})
       VALUES (${valuePlaceholders})
       RETURNING *`,
      insertValues
    );
    return result.rows[0];
  }

  async update(leaveRequestId, data) {
    const allowedFields = [
      'leave_type', 'start_date', 'end_date', 'reason',
      'status', 'rejection_reason', 'approver_id', 'approved_at',
      'total_days', 'start_time', 'end_time', 'is_half_day', 'half_day_period'
    ];

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (field in data && data[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        updateValues.push(data[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) return null;

    updateValues.push(leaveRequestId);

    const result = await pool.query(
      `UPDATE leave_requests SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateValues
    );
    return result.rows[0];
  }

  async delete(leaveRequestId) {
    const result = await pool.query(
      'DELETE FROM leave_requests WHERE id = $1 RETURNING id',
      [leaveRequestId]
    );
    return result.rows[0];
  }
}

export default new LeaveRequestRepository();