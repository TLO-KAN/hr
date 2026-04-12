import { getPool } from '../config/db-pool.js';
import logger from './logger.js';

const pool = getPool();

export const initDatabaseSchema = async () => {
  try {
    logger.info('🗄️ Initializing database schema...');

    // Create user_auth table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_auth (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create departments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create positions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create employees table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES user_auth(id) ON DELETE SET NULL,
        employee_code VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
        position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        status VARCHAR(50) DEFAULT 'active',
        employee_type VARCHAR(50) DEFAULT 'permanent',
        address TEXT,
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create leave_types table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_types (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        color VARCHAR(7),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Backward-compatible column migration for existing leave_types tables
    await pool.query(`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);

    // Upsert leave types from business requirements
    const leaveTypeSeeds = [
      {
        code: 'unpaid',
        name: 'ลากิจไม่รับค่าจ้าง',
        description: 'ลากิจไม่รับค่าจ้าง',
        color: '#6b7280',
        is_active: true,
      },
      {
        code: 'personal',
        name: 'ลากิจได้รับค่าจ้าง',
        description: 'ลากิจได้รับค่าจ้าง',
        color: '#10b981',
        is_active: true,
      },
      {
        code: 'sick',
        name: 'ลาป่วย',
        description: 'ลาป่วย',
        color: '#f59e0b',
        is_active: true,
      },
      {
        code: 'vacation',
        name: 'ลาพักผ่อน',
        description: 'ลาพักผ่อนประจำปี',
        color: '#0ea5e9',
        is_active: true,
      },
      {
        code: 'emergency',
        name: 'ลาฉุกเฉิน',
        description: 'ลาฉุกเฉิน (สามารถยื่นได้ทันที)',
        color: '#ef4444',
        is_active: true,
      },
    ];

    for (const lt of leaveTypeSeeds) {
      await pool.query(
        `INSERT INTO leave_types (code, name, description, color, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code)
         DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           color = EXCLUDED.color,
           is_active = EXCLUDED.is_active,
           updated_at = CURRENT_TIMESTAMP`,
        [lt.code, lt.name, lt.description, lt.color, lt.is_active]
      );
    }

    await pool.query(
      `UPDATE leave_types
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE code NOT IN ('unpaid', 'personal', 'sick', 'vacation', 'emergency')`
    );

    // Create leave_policies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_policies (
        id SERIAL PRIMARY KEY,
        employee_type VARCHAR(50) NOT NULL,
        employee_status VARCHAR(50),
        min_years_of_service INT DEFAULT 0,
        max_years_of_service INT,
        annual_leave_quota INT DEFAULT 6,
        sick_leave_quota INT DEFAULT 30,
        personal_leave_quota INT DEFAULT 3,
        maternity_leave_quota INT DEFAULT 120,
        paternity_leave_quota INT DEFAULT 15,
        is_prorated_first_year BOOLEAN DEFAULT true,
        is_prorated BOOLEAN DEFAULT false,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create approval_workflows table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS approval_workflows (
        id SERIAL PRIMARY KEY,
        leave_type VARCHAR(50) NOT NULL,
        approval_levels VARCHAR(255),
        min_days INT,
        max_days INT,
        requires_hr BOOLEAN DEFAULT false,
        flow_pattern VARCHAR(50) DEFAULT 'supervisor',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create leave_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        leave_type VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_days INT NOT NULL,
        reason TEXT,
        attachment_url VARCHAR(500),
        start_time TIME,
        end_time TIME,
        is_half_day BOOLEAN DEFAULT false,
        half_day_period VARCHAR(20),
        status VARCHAR(50) DEFAULT 'pending',
        workflow_status VARCHAR(50),
        supervisor_approved_by INTEGER,
        supervisor_approved_at TIMESTAMP,
        hr_approved_by INTEGER,
        hr_approved_at TIMESTAMP,
        ceo_approved_by INTEGER,
        ceo_approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Backward-compatible column migration for existing leave_requests tables
    await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS start_time TIME`);
    await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS end_time TIME`);
    await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS half_day_period VARCHAR(20)`);
    await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approver_id UUID`);
    await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
    // Drop FK constraint on approver_id if it references employees (approver can be any user_auth)
    await pool.query(`ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_approver_id_fkey`);

    // Create leave_attachments table (multi-file support)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_attachments (
        id SERIAL PRIMARY KEY,
        leave_request_id INTEGER REFERENCES leave_requests(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create employee_leave_balances table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_leave_balances (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        year INT NOT NULL,
        leave_type VARCHAR(50) NOT NULL,
        entitled_days INT NOT NULL,
        used_days INT DEFAULT 0,
        remaining_days INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, year, leave_type)
      )
    `);

    // Create holidays table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id SERIAL PRIMARY KEY,
        holiday_date DATE NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create password_reset_tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES user_auth(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create notification_settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id SERIAL PRIMARY KEY,
        dept_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
        leave_type VARCHAR(50) NOT NULL,
        to_list TEXT NOT NULL,
        cc_list TEXT,
        bcc_list TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_auth_email ON user_auth(LOWER(email))');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON employee_leave_balances(employee_id, year)');

    logger.info('✅ Database schema initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize database schema: ${error.message}`);
    throw error;
  }
};