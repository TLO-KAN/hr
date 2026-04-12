import 'dotenv/config';
import { getPool } from './src/config/db-pool.js';

const pool = getPool();

async function checkAll() {
  try {
    console.log('\n📊 ตรวจสอบทั้งหมด:\n');

    const result = await pool.query(`
      SELECT u.id, u.email, u.role as auth_role, 
             e.employee_code, e.first_name, e.last_name,
             (SELECT string_agg(role, ', ') FROM user_roles WHERE user_id = u.id) as user_roles
      FROM user_auth u
      LEFT JOIN employees e ON e.user_id = u.id
      ORDER BY u.created_at DESC
    `);

    result.rows.forEach(u => {
      const finalRole = u.user_roles || u.auth_role || 'ไม่มี';
      console.log(`
Email: ${u.email}
Name: ${u.first_name} ${u.last_name}
Code: ${u.employee_code}
user_id: ${u.id}
auth role: ${u.auth_role}
user_roles: ${u.user_roles || 'empty'}
Final: ${finalRole}
`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAll();
