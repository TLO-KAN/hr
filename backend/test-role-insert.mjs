import 'dotenv/config';
import { getPool } from './src/config/db-pool.js';

const pool = getPool();

async function checkFK() {
  try {
    // Verify user exists in user_auth
    console.log('\n✔️ Checking if user_id exists in user_auth:\n');
    const userCheck = await pool.query(
      'SELECT id, email FROM user_auth WHERE id = $1',
      ['52fd1eed-af4b-4685-aadc-bab933298634']
    );

    if (userCheck.rows.length > 0) {
      console.log(`✅ Found: ${userCheck.rows[0].email} (ID: ${userCheck.rows[0].id})`);
      
      // Try to insert role
      console.log('\n➡️ Attempting to insert role...\n');
      await pool.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        ['52fd1eed-af4b-4685-aadc-bab933298634', 'supervisor']
      );
      console.log('✅ Role inserted successfully!');
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
    console.error(error.detail || '');
  } finally {
    await pool.end();
  }
}

checkFK();
