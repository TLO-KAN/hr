import 'dotenv/config';
import { getPool } from './src/config/db-pool.js';

const pool = getPool();

async function checkRoles() {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.role as auth_role, 
             e.first_name, e.last_name,
             (SELECT string_agg(role, ', ') FROM user_roles WHERE user_id = u.id) as assigned_roles
      FROM user_auth u
      LEFT JOIN employees e ON e.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT 15
    `);
    
    console.log('\n📊 ตรวจสอบ Role Mapping:\n');
    result.rows.forEach(u => {
      const final_role = u.assigned_roles || u.auth_role || 'ไม่มี';
      console.log(`✉️  ${u.email}`);
      console.log(`   👤 ${u.first_name || 'N/A'} ${u.last_name || 'N/A'}`);
      console.log(`   🔐 user_auth.role: ${u.auth_role}`);
      console.log(`   👨‍💼 user_roles table: ${u.assigned_roles || 'empty'}`);
      console.log(`   ✅ Final role: ${final_role}\n`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRoles();
