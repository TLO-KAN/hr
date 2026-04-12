import { getPool } from '../config/db-pool.js';

const pool = getPool();

class EmployeeRepository {
  constructor() {
    this.employeeColumnsCache = null;
    this.tableExistsCache = new Map();
  }

  async getEmployeeColumns() {
    if (this.employeeColumnsCache) return this.employeeColumnsCache;

    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'employees'`
    );

    this.employeeColumnsCache = new Set(result.rows.map((row) => row.column_name));
    return this.employeeColumnsCache;
  }

  async tableExists(tableName) {
    if (this.tableExistsCache.has(tableName)) {
      return this.tableExistsCache.get(tableName);
    }

    const result = await pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS exists`,
      [tableName]
    );

    const exists = Boolean(result.rows[0]?.exists);
    this.tableExistsCache.set(tableName, exists);
    return exists;
  }

  buildNameExpression(columns) {
    if (columns.has('first_name') && columns.has('last_name')) {
      return `TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')))`;
    }
    if (columns.has('display_name')) {
      return `COALESCE(e.display_name, '')`;
    }
    if (columns.has('email')) {
      return `COALESCE(e.email, '')`;
    }
    return `''`;
  }

  buildDepartmentJoin(columns, hasDepartmentsTable) {
    if (!hasDepartmentsTable) {
      return `LEFT JOIN (SELECT NULL::uuid as id, NULL::text as name) d ON 1=0`;
    }
    if (columns.has('department')) {
      return `LEFT JOIN departments d ON d.name = e.department`;
    }
    if (columns.has('department_id')) {
      return `LEFT JOIN departments d ON d.id = e.department_id`;
    }
    return `LEFT JOIN departments d ON 1=0`;
  }

  buildPositionJoin(columns, hasPositionsTable) {
    if (!hasPositionsTable) {
      return `LEFT JOIN (SELECT NULL::uuid as id, NULL::text as name) p ON 1=0`;
    }
    if (columns.has('position_id')) {
      return `LEFT JOIN positions p ON p.id = e.position_id`;
    }
    if (columns.has('position')) {
      return `LEFT JOIN positions p ON p.name = e.position`;
    }
    return `LEFT JOIN positions p ON 1=0`;
  }

  async findById(employeeId) {
    const columns = await this.getEmployeeColumns();
    const hasDepartmentsTable = await this.tableExists('departments');
    const hasPositionsTable = await this.tableExists('positions');
    const nameExpression = this.buildNameExpression(columns);
    const positionNameExpression = hasPositionsTable
      ? `p.name`
      : (columns.has('position') ? `e.position` : `NULL`);
    const result = await pool.query(
      `SELECT e.*, 
              d.name as department_name, 
              ${positionNameExpression} as position_name,
              ${nameExpression} as full_name
       FROM employees e
       ${this.buildDepartmentJoin(columns, hasDepartmentsTable)}
       ${this.buildPositionJoin(columns, hasPositionsTable)}
       WHERE e.id = $1`,
      [employeeId]
    );
    return result.rows[0] || null;
  }

  async findByUserId(userId) {
    const columns = await this.getEmployeeColumns();
    if (!columns.has('user_id')) return null;

    const hasDepartmentsTable = await this.tableExists('departments');
    const hasPositionsTable = await this.tableExists('positions');
    const nameExpression = this.buildNameExpression(columns);
    const positionNameExpression = hasPositionsTable
      ? `p.name`
      : (columns.has('position') ? `e.position` : `NULL`);
    const result = await pool.query(
      `SELECT e.*, 
              d.name as department_name, 
              ${positionNameExpression} as position_name,
              ${nameExpression} as full_name
       FROM employees e
       ${this.buildDepartmentJoin(columns, hasDepartmentsTable)}
       ${this.buildPositionJoin(columns, hasPositionsTable)}
       WHERE e.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async findByEmail(email) {
    const columns = await this.getEmployeeColumns();
    const selectedUserId = columns.has('user_id') ? 'user_id' : 'NULL::uuid as user_id';

    const result = await pool.query(
      `SELECT id, ${selectedUserId}, email FROM employees WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    return result.rows[0] || null;
  }

  async getAll(filters = {}, limit = 100, offset = 0) {
    const columns = await this.getEmployeeColumns();
    const hasDepartmentsTable = await this.tableExists('departments');
    const hasPositionsTable = await this.tableExists('positions');
    const nameExpression = this.buildNameExpression(columns);
    const positionNameExpression = hasPositionsTable
      ? `p.name`
      : (columns.has('position') ? `e.position` : `NULL`);

    let query = `SELECT e.*, 
                        d.name as department_name, 
                        ${positionNameExpression} as position_name,
                        ${nameExpression} as full_name
                 FROM employees e
                 ${this.buildDepartmentJoin(columns, hasDepartmentsTable)}
                 ${this.buildPositionJoin(columns, hasPositionsTable)}
                 WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (filters.departmentId) {
      if (columns.has('department_id')) {
        query += ` AND e.department_id = $${paramIndex}`;
      } else if (columns.has('department') && hasDepartmentsTable) {
        query += ` AND e.department = (SELECT name FROM departments WHERE id = $${paramIndex} LIMIT 1)`;
      } else if (columns.has('department')) {
        query += ` AND e.department = $${paramIndex}`;
      }
      params.push(filters.departmentId);
      paramIndex++;
    }

    if (filters.status) {
      if (columns.has('status')) {
        query += ` AND e.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }
    }

    if (filters.search) {
      const searchConditions = [];
      if (columns.has('employee_code')) {
        searchConditions.push(`e.employee_code ILIKE $${paramIndex}`);
      }
      searchConditions.push(`${nameExpression} ILIKE $${paramIndex}`);
      query += ` AND (${searchConditions.join(' OR ')})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const orderBy = columns.has('employee_code') ? 'e.employee_code' : 'e.created_at DESC';
    query += ` ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  async create(data) {
    const columns = await this.getEmployeeColumns();
    const hasDepartmentsTable = await this.tableExists('departments');
    const hasPositionsTable = await this.tableExists('positions');

    const {
      userId, employeeCode, firstName, lastName, email, phone,
      departmentId, positionId, startDate, status, employeeType
    } = data;

    let departmentName = null;
    let positionName = null;

    if (departmentId && columns.has('department') && !columns.has('department_id') && hasDepartmentsTable) {
      const depResult = await pool.query('SELECT name FROM departments WHERE id = $1 LIMIT 1', [departmentId]);
      departmentName = depResult.rows[0]?.name || null;
    }

    if (positionId && columns.has('position') && !columns.has('position_id') && hasPositionsTable) {
      const posResult = await pool.query('SELECT name FROM positions WHERE id = $1 LIMIT 1', [positionId]);
      positionName = posResult.rows[0]?.name || null;
    }

    const insertFields = [];
    const insertValues = [];
    const placeholders = [];
    let paramIndex = 1;

    const pushValue = (field, value) => {
      insertFields.push(field);
      placeholders.push(`$${paramIndex}`);
      insertValues.push(value);
      paramIndex++;
    };

    if (columns.has('user_id')) pushValue('user_id', userId || null);
    if (columns.has('employee_code')) pushValue('employee_code', employeeCode || null);
    if (columns.has('first_name')) pushValue('first_name', firstName || null);
    if (columns.has('last_name')) pushValue('last_name', lastName || null);
    if (columns.has('display_name') && (!columns.has('first_name') || !columns.has('last_name'))) {
      pushValue('display_name', `${firstName || ''} ${lastName || ''}`.trim() || null);
    }
    if (columns.has('email')) pushValue('email', email || null);
    if (columns.has('phone')) pushValue('phone', phone || null);
    if (columns.has('department_id')) pushValue('department_id', departmentId || null);
    if (columns.has('department')) pushValue('department', departmentName || null);
    if (columns.has('position_id')) pushValue('position_id', positionId || null);
    if (columns.has('position')) pushValue('position', positionName || null);
    if (columns.has('start_date')) pushValue('start_date', startDate || null);
    if (columns.has('employment_date')) pushValue('employment_date', startDate || null);
    if (columns.has('status')) pushValue('status', status || 'active');
    if (columns.has('employee_type')) pushValue('employee_type', employeeType || 'permanent');

    if (insertFields.length === 0) {
      throw new Error('employees table has no writable columns for create operation');
    }

    const result = await pool.query(
      `INSERT INTO employees 
       (${insertFields.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      insertValues
    );
    return result.rows[0];
  }

  async update(employeeId, data) {
    const columns = await this.getEmployeeColumns();
    const hasDepartmentsTable = await this.tableExists('departments');
    const hasPositionsTable = await this.tableExists('positions');

    const allowedFields = [
      'employee_code', 'first_name', 'last_name', 'email', 'phone',
      'department_id', 'position_id', 'start_date', 'end_date', 'status',
      'address', 'avatar_url', 'employee_type'
    ];

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const fieldMap = {
      start_date: columns.has('start_date') ? 'start_date' : (columns.has('employment_date') ? 'employment_date' : null),
      department_id: columns.has('department_id') ? 'department_id' : (columns.has('department') ? 'department' : null),
      position_id: columns.has('position_id') ? 'position_id' : (columns.has('position') ? 'position' : null),
    };

    for (const field of allowedFields) {
      const targetField = fieldMap[field] ?? field;
      if (!targetField || !columns.has(targetField)) continue;

      if (field in data && data[field] !== undefined) {
        let value = data[field];

        if (field === 'department_id' && targetField === 'department' && value) {
          if (hasDepartmentsTable) {
            const depResult = await pool.query('SELECT name FROM departments WHERE id = $1 LIMIT 1', [value]);
            value = depResult.rows[0]?.name || null;
          } else {
            value = null;
          }
        }

        if (field === 'position_id' && targetField === 'position' && value) {
          if (hasPositionsTable) {
            const posResult = await pool.query('SELECT name FROM positions WHERE id = $1 LIMIT 1', [value]);
            value = posResult.rows[0]?.name || null;
          } else {
            value = null;
          }
        }

        updateFields.push(`${targetField} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) return null;

    updateValues.push(employeeId);

    const result = await pool.query(
      `UPDATE employees SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateValues
    );
    return result.rows[0];
  }

  async delete(employeeId) {
    const result = await pool.query(
      'DELETE FROM employees WHERE id = $1 RETURNING id',
      [employeeId]
    );
    return result.rows[0];
  }

  async count() {
    const result = await pool.query('SELECT COUNT(*)::INT as count FROM employees');
    return result.rows[0]?.count || 0;
  }
}

export default new EmployeeRepository();