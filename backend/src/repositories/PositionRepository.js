import { getPool } from '../config/db-pool.js';

const pool = getPool();

class PositionRepository {
  constructor() {
    this.employeeColumnsCache = null;
    this.tableExistsCache = new Map();
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

  async getFallbackPositions(limit, offset) {
    const hasEmployees = await this.tableExists('employees');
    if (!hasEmployees) return [];

    const employeeColumns = await this.getEmployeeColumns();
    if (!employeeColumns.has('position')) return [];

    const result = await pool.query(
      `SELECT
         (
           substr(md5(e.position), 1, 8) || '-' ||
           substr(md5(e.position), 9, 4) || '-' ||
           substr(md5(e.position), 13, 4) || '-' ||
           substr(md5(e.position), 17, 4) || '-' ||
           substr(md5(e.position), 21, 12)
         )::uuid AS id,
         e.position AS name,
         NULL::text AS description,
         NULL::uuid AS department_id,
         NULL::text AS department_name,
         COUNT(e.id)::INT AS employee_count
       FROM employees e
       WHERE e.position IS NOT NULL AND e.position <> ''
       GROUP BY e.position
       ORDER BY e.position
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  async findById(positionId) {
    const hasPositions = await this.tableExists('positions');
    if (!hasPositions) return null;

    const hasEmployees = await this.tableExists('employees');
    const employeeColumns = hasEmployees ? await this.getEmployeeColumns() : new Set();
    const employeeCountExpr = (hasEmployees && employeeColumns.has('position_id'))
      ? `(SELECT COUNT(e.id) FROM employees e WHERE e.position_id = p.id)::INT`
      : '0::INT';

    const result = await pool.query(
      `SELECT p.*,
              d.name AS department_name,
              ${employeeCountExpr} AS employee_count
       FROM positions p
       LEFT JOIN departments d ON d.id = p.department_id
       WHERE p.id = $1`,
      [positionId]
    );
    return result.rows[0] || null;
  }

  async getAll(limit = 100, offset = 0) {
    const hasPositions = await this.tableExists('positions');
    if (!hasPositions) {
      return await this.getFallbackPositions(limit, offset);
    }

    const hasEmployees = await this.tableExists('employees');
    const employeeColumns = hasEmployees ? await this.getEmployeeColumns() : new Set();
    const employeeCountExpr = (hasEmployees && employeeColumns.has('position_id'))
      ? `(SELECT COUNT(e.id) FROM employees e WHERE e.position_id = p.id)::INT`
      : '0::INT';

    const result = await pool.query(
      `SELECT p.*,
              d.name AS department_name,
              ${employeeCountExpr} AS employee_count
       FROM positions p
       LEFT JOIN departments d ON d.id = p.department_id
       ORDER BY p.name
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  async create(name, description = null, departmentId = null) {
    const hasPositions = await this.tableExists('positions');
    if (!hasPositions) {
      throw new Error('positions table is not available. Please run database migration.');
    }

    const result = await pool.query(
      'INSERT INTO positions (name, description, department_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, departmentId]
    );
    return result.rows[0];
  }

  async update(positionId, data) {
    const hasPositions = await this.tableExists('positions');
    if (!hasPositions) {
      throw new Error('positions table is not available. Please run database migration.');
    }

    const { name, description, departmentId } = data;
    const result = await pool.query(
      'UPDATE positions SET name = COALESCE($1, name), description = COALESCE($2, description), department_id = COALESCE($3, department_id) WHERE id = $4 RETURNING *',
      [name, description, departmentId, positionId]
    );
    return result.rows[0];
  }

  async delete(positionId) {
    const hasPositions = await this.tableExists('positions');
    if (!hasPositions) {
      throw new Error('positions table is not available. Please run database migration.');
    }

    const result = await pool.query(
      'DELETE FROM positions WHERE id = $1 RETURNING id',
      [positionId]
    );
    return result.rows[0];
  }

  async count() {
    const hasPositions = await this.tableExists('positions');
    if (!hasPositions) {
      const hasEmployees = await this.tableExists('employees');
      if (!hasEmployees) return 0;

      const employeeColumns = await this.getEmployeeColumns();
      if (!employeeColumns.has('position')) return 0;

      const result = await pool.query(
        `SELECT COUNT(DISTINCT e.position)::INT as count
         FROM employees e
         WHERE e.position IS NOT NULL AND e.position <> ''`
      );
      return result.rows[0]?.count || 0;
    }

    const result = await pool.query('SELECT COUNT(*)::INT as count FROM positions');
    return result.rows[0]?.count || 0;
  }
}

export default new PositionRepository();