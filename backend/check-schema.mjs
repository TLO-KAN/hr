import 'dotenv/config';
import { getPool } from './src/config/db-pool.js';

const pool = getPool();

async function checkSchema() {
  try {
    // Check user_roles table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_roles'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 user_roles table structure:\n');
    result.rows.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(nullable)'} ${col.column_default ? `DEFAULT: ${col.column_default}` : ''}`);
    });

    // Check constraints
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'user_roles'
    `);

    console.log('\n🔗 Constraints:\n');
    constraints.rows.forEach(c => {
      console.log(`${c.constraint_name}: ${c.constraint_type}`);
    });

    // Check if user_roles table has any rows
    const count = await pool.query('SELECT COUNT(*) FROM user_roles');
    console.log(`\n📊 Current rows in user_roles: ${count.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
