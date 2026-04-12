import pkg from 'pg';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { getPool } from './src/config/db-pool.js';

const createAdmin = async () => {
  const pool = getPool();

  const email = 'admin@tlogical.com';
  const password = 'admin123'; // เปลี่ยนต่อไป

  try {
    console.log('🔐 สร้าง Admin User...\n');

    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into user_auth table
    const result = await pool.query(
      'INSERT INTO user_auth (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hashedPassword, 'admin']
    );

    const userId = result.rows[0].id;

    // Ensure user exists in users table for user_roles FK
    await pool.query(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
      [userId, email, hashedPassword]
    );

    await pool.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, 'admin']
    );

    console.log('✅ Admin User สร้างสำเร็จ:');
    console.log(`   📧 Email: ${result.rows[0].email}`);
    console.log(`   🔑 Password: ${password}`);
    console.log(`   👤 Role: ${result.rows[0].role}`);
    console.log(`   🆔 User ID: ${result.rows[0].id}`);
    console.log('\n⚠️  กรุณาเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบ!\n');

  } catch (error) {
    if (error.code === '23505') {
      console.warn('⚠️ อีเมลนี้ถูกใช้แล้ว: admin@tlogical.com (พยายามอัปเดต role)');
      const existingUser = await pool.query('SELECT id, email, password_hash, role FROM user_auth WHERE LOWER(email) = LOWER($1)', [email]);
      if (existingUser.rows.length > 0) {
        const existingId = existingUser.rows[0].id;
        const existingPasswordHash = existingUser.rows[0].password_hash;

        await pool.query(
          `INSERT INTO users (id, email, password_hash)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
          [existingId, email, existingPasswordHash]
        );

        await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING', [existingId, 'admin']);
        console.log('✅ อัปเดตสิทธิ์ admin ให้กับผู้ใช้แล้ว:', existingUser.rows[0].email);
      }
    } else {
      console.error('❌ เกิดข้อผิดพลาด:', error.message);
    }
  } finally {
    await pool.end();
  }
};

createAdmin();
