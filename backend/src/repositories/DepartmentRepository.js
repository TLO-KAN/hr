import { getPool } from '../config/db-pool.js';

const pool = getPool();

class DepartmentRepository {
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

  async buildCountsQuery() {
    const hasEmployees = await this.tableExists('employees');
    const hasPositions = await this.tableExists('positions');
    const employeeColumns = hasEmployees ? await this.getEmployeeColumns() : new Set();

    let employeeCountExpr = '0::INT';
    if (hasEmployees && employeeColumns.has('department')) {
      employeeCountExpr = `(SELECT COUNT(DISTINCT e.id) FROM employees e WHERE e.department = d.name)::INT`;
    } else if (hasEmployees && employeeColumns.has('department_id')) {
      employeeCountExpr = `(SELECT COUNT(DISTINCT e.id) FROM employees e WHERE e.department_id = d.id)::INT`;
    }

    const positionCountExpr = hasPositions
      ? `(SELECT COUNT(DISTINCT p.id) FROM positions p WHERE p.department_id = d.id)::INT`
      : '0::INT';

    return { employeeCountExpr, positionCountExpr };
  }

  async findById(departmentId) {
    const { employeeCountExpr, positionCountExpr } = await this.buildCountsQuery();
    const result = await pool.query(
      `SELECT d.*,
              ${employeeCountExpr} AS employee_count,
              ${positionCountExpr} AS position_count
       FROM departments d
       WHERE d.id = $1`,
      [departmentId]
    );
    return result.rows[0] || null;
  }

  async findByName(name) {
    const result = await pool.query(
      'SELECT * FROM departments WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    return result.rows[0] || null;
  }

  async getAll(limit = 100, offset = 0) {
    const { employeeCountExpr, positionCountExpr } = await this.buildCountsQuery();
    const result = await pool.query(
      `SELECT d.*,
              ${employeeCountExpr} AS employee_count,
              ${positionCountExpr} AS position_count
       FROM departments d
       ORDER BY d.name
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  async create(name, description = null) {
    const result = await pool.query(
      'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return result.rows[0];
  }

  async update(departmentId, data) {
    const { name, description } = data;
    const result = await pool.query(
      'UPDATE departments SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
      [name, description, departmentId]
    );
    return result.rows[0];
  }

  async delete(departmentId) {
    const result = await pool.query(
      'DELETE FROM departments WHERE id = $1 RETURNING id',
      [departmentId]
    );
    return result.rows[0];
  }

  async count() {
    const result = await pool.query('SELECT COUNT(*)::INT as count FROM departments');
    return result.rows[0]?.count || 0;
  }
}

export default new DepartmentRepository();