/**
 * Database Configuration & Connection Pool
 * เชื่อมต่อ PostgreSQL Database
 * 
 * ใช้ได้ใน: Node.js Backend, API Routes
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

/**
 * Database Pool Configuration
 */
const poolConfig = process.env.DATABASE_URL 
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'hr_system',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Test database connection on startup
 */
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

pool.on('connect', () => {
  console.log('✅ Database connection established');
});

/**
 * Initialize database connection and log status
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      console.log(`🗄️  PostgreSQL Database Connected: ${result.rows[0].now}`);

      // Keep legacy/local databases compatible with leave settings workflow CRUD.
      await client.query(`
        CREATE TABLE IF NOT EXISTS approval_workflows (
          id SERIAL PRIMARY KEY,
          leave_type VARCHAR(50) NOT NULL DEFAULT 'all',
          approval_levels INTEGER NOT NULL DEFAULT 1,
          min_days INTEGER,
          max_days INTEGER,
          requires_hr BOOLEAN DEFAULT false,
          flow_pattern VARCHAR(50) DEFAULT 'supervisor',
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        ALTER TABLE approval_workflows
        ADD COLUMN IF NOT EXISTS flow_pattern VARCHAR(50) DEFAULT 'supervisor',
        ADD COLUMN IF NOT EXISTS min_days INTEGER,
        ADD COLUMN IF NOT EXISTS max_days INTEGER,
        ADD COLUMN IF NOT EXISTS requires_hr BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);

      await client.query(`
        ALTER TABLE approval_workflows
        ALTER COLUMN approval_levels TYPE INTEGER
        USING CASE
          WHEN TRIM(approval_levels::TEXT) ~ '^[0-9]+$' THEN TRIM(approval_levels::TEXT)::INTEGER
          ELSE 1
        END
      `);

      // Keep legacy/local employee schema compatible with UUID-based employee CRUD.
      await client.query(`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50),
        ADD COLUMN IF NOT EXISTS prefix VARCHAR(20),
        ADD COLUMN IF NOT EXISTS position_id UUID,
        ADD COLUMN IF NOT EXISTS end_date DATE,
        ADD COLUMN IF NOT EXISTS start_date DATE,
        ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_employees_employee_code ON employees(employee_code)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_employees_position_id ON employees(position_id)
      `);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Database Connection Error:', error);
    process.exit(1);
  }
}

/**
 * Get database pool instance
 */
export function getPool(): pg.Pool {
  return pool;
}

/**
 * Query helper with prepared statements
 */
export async function query(
  text: string,
  params?: any[]
): Promise<pg.QueryResult> {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('🔌 Database pool closed');
}

export default pool;
