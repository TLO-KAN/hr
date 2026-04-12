import 'dotenv/config';
import { getPool } from './src/config/db-pool.js';

const pool = getPool();

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📋 Tables in database:\n');
    result.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
