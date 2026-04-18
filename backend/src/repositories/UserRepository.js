import { getPool } from '../config/db-pool.js';

const pool = getPool();

class UserRepository {
  async findById(userId) {
    const result = await pool.query(
      'SELECT id, email, password_hash, role, created_at FROM user_auth WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async findByEmail(email) {
    const result = await pool.query(
      `SELECT ua.id, ua.email, ua.password_hash, ua.role, ua.created_at,
              e.status AS employee_status, e.employment_status
       FROM user_auth ua
       LEFT JOIN employees e ON e.user_id = ua.id
       WHERE LOWER(ua.email) = LOWER($1)`,
      [email]
    );
    return result.rows[0] || null;
  }

  async create(email, passwordHash, role = 'employee') {
    const result = await pool.query(
      'INSERT INTO user_auth (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
      [email, passwordHash, role]
    );
    return result.rows[0];
  }

  async updateRole(userId, newRole) {
    const result = await pool.query(
      'UPDATE user_auth SET role = $1 WHERE id = $2 RETURNING id, email, role',
      [newRole, userId]
    );
    return result.rows[0];
  }

  async updatePassword(userId, passwordHash) {
    const result = await pool.query(
      'UPDATE user_auth SET password_hash = $1 WHERE id = $2 RETURNING id, email',
      [passwordHash, userId]
    );
    return result.rows[0];
  }

  async getAll(limit = 100, offset = 0) {
    const result = await pool.query(
      'SELECT id, email, role, created_at FROM user_auth ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  }

  async delete(userId) {
    const result = await pool.query(
      'DELETE FROM user_auth WHERE id = $1 RETURNING id',
      [userId]
    );
    return result.rows[0];
  }
}

export default new UserRepository();