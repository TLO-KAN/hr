import 'dotenv/config';
import { getPool } from './src/config/db-pool.js';

const pool = getPool();

async function assignRolesById() {
  try {
    console.log('\n🔧 กำหนดสิทธิ์ (Roles) ให้กับผู้ใช้...\n');

    // ตัวอย่าง: กำหนด supervisor role ให้ kan@tlogical.com
    const assignments = [
      { user_id: '52fd1eed-af4b-4685-aadc-bab933298634', email: 'kan@tlogical.com', role: 'supervisor' },
      // เพิ่มอื่นๆ ตามต้องการ
    ];

    for (const { user_id, email, role } of assignments) {
      try {
        // ลบ role เก่าออก
        await pool.query('DELETE FROM user_roles WHERE user_id = $1', [user_id]);

        // เพิ่ม role ใหม่
        await pool.query(
          'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
          [user_id, role]
        );

        console.log(`✅ ${email} → ${role}`);
      } catch (err) {
        console.log(`❌ ${email}: ${err.message}`);
      }
    }

    // แสดงผลสะสม
    console.log('\n📊 สถานะปัจจุบัน:\n');
    const result = await pool.query(`
      SELECT u.id, u.email, u.role as auth_role, 
             e.first_name, e.last_name,
             (SELECT string_agg(role, ', ') FROM user_roles WHERE user_id = u.id) as user_roles
      FROM user_auth u
      LEFT JOIN employees e ON e.user_id = u.id
      ORDER BY u.created_at DESC
    `);

    result.rows.forEach(u => {
      const finalRole = u.user_roles || u.auth_role || 'ไม่มี';
      console.log(`${u.email} (${u.first_name} ${u.last_name}): ${finalRole}`);
    });

    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

assignRolesById();
