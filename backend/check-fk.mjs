import 'dotenv/config';
import { getPool } from './src/config/db-pool.js';

const pool = getPool();

async function checkFK() {
  try {
    // Check foreign key constraint details
    const result = await pool.query(`
      SELECT constraint_name, table_name, column_name, foreign_table_name, foreign_column_name
      FROM information_schema.key_column_usage
      WHERE constraint_name = 'user_roles_user_id_fkey'
    `);

    console.log('\n🔗 Foreign Key Details:\n');
    const fk = result.rows[0];
    if (fk) {
      console.log(`Constraint: ${fk.constraint_name}`);
      console.log(`Table: ${fk.table_name}.${fk.column_name}`);
      console.log(`References: ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    }

    // Verify user exists in user_auth
    console.log('\n✔️ Checking if user_id exists in user_auth:\n');
    const userCheck = await pool.query(
      'SELECT id, email FROM user_auth WHERE id = $1',
      ['52fd1eed-af4b-4685-aadc-bab933298634']
    );

    if (userCheck.rows.length > 0) {
      console.log(`✅ Found: ${userCheck.rows[0].email} (ID: ${userCheck.rows[0].id})`);
    } else {
      console.log('❌ User not found in user_auth table');
    }

    // List all users in user_auth
    console.log('\n📋 All users in user_auth:\n');
    const allUsers = await pool.query('SELECT id, email FROM user_auth');
    allUsers.rows.forEach(u => {
      console.log(`${u.email}: ${u.id}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkFK();
