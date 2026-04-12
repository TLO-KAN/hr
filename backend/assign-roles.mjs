import 'dotenv/config';
import { getPool } from './src/config/db-pool.js';

const pool = getPool();

async function assignRoles() {
  try {
    console.log('\n📋 กำหนดสิทธิ์ (Roles) ให้กับผู้ใช้...\n');

    // ตัวอย่าง: กำหนด supervisor role ให้ kan@tlogical.com
    const users = [
      { email: 'kan@tlogical.com', role: 'supervisor' },
      // เพิ่มเพิ่มอีกคนตามที่ต้องการ
      // { email: 'user2@example.com', role: 'hr' },
      // { email: 'user3@example.com', role: 'admin' },
    ];

    for (const { email, role } of users) {
      // หา user_id จากอีเมล
      const userRes = await pool.query(
        'SELECT id FROM user_auth WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (userRes.rows.length === 0) {
        console.log(`❌ ไม่พบผู้ใช้: ${email}`);
        continue;
      }

      const userId = userRes.rows[0].id;

      // ลบ role เก่าออก
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

      // เพิ่ม role ใหม่
      await pool.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [userId, role]
      );

      console.log(`✅ ${email} → ${role}`);
    }

    // แสดงผลสะสม
    console.log('\n📊 สถานะปัจจุบัน:\n');
    const result = await pool.query(`
      SELECT u.id, u.email, u.role as auth_role, 
             (SELECT string_agg(role, ', ') FROM user_roles WHERE user_id = u.id) as user_roles
      FROM user_auth u
      ORDER BY u.created_at DESC
    `);

    result.rows.forEach(u => {
      const finalRole = u.user_roles || u.auth_role || 'ไม่มี';
      console.log(`${u.email}: ${finalRole}`);
    });

    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

assignRoles();
