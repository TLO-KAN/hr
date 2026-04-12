import 'dotenv/config';
import { getPool } from './src/config/db-pool.js';

const pool = getPool();

async function fixFK() {
  try {
    console.log('\n🔧 Fixing Foreign Key Constraint...\n');

    // Drop old constraint
    await pool.query(
      'ALTER TABLE user_roles DROP CONSTRAINT user_roles_user_id_fkey'
    );
    console.log('✅ Dropped old FK constraint');

    // Add new constraint pointing to user_auth
    await pool.query(
      'ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_auth(id) ON DELETE CASCADE'
    );
    console.log('✅ Added new FK constraint (user_auth)');

    // Now try to insert role
    console.log('\n➡️ Testing role insertion...\n');
    await pool.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
      ['52fd1eed-af4b-4685-aadc-bab933298634', 'supervisor']
    );
    console.log('✅ Role inserted successfully!');

    // Verify
    const result = await pool.query(`
      SELECT u.id, u.email, u.role as auth_role, 
             (SELECT string_agg(role, ', ') FROM user_roles WHERE user_id = u.id) as user_roles
      FROM user_auth u
      WHERE u.id = '52fd1eed-af4b-4685-aadc-bab933298634'
    `);

    if (result.rows[0]) {
      const u = result.rows[0];
      console.log(`\n${u.email}: ${u.user_roles || u.auth_role}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixFK();
