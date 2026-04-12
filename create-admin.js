import pkg from 'pg';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { getDatabaseConfig } from './backend/src/config/database.js';

const { Pool } = pkg;

const createAdmin = async () => {
  const dbConfig = getDatabaseConfig();
  const pool = new Pool(dbConfig);

  try {
    console.log('🔐 สร้าง Admin User...\n');

    const email = 'admin@tlogical.com';
    const password = 'admin123'; // เปลี่ยนต่อไป
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into user_auth table
    const result = await pool.query(
      'INSERT INTO user_auth (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hashedPassword, 'admin']
    );

    console.log('✅ Admin User สร้างสำเร็จ:');
    console.log(`   📧 Email: ${result.rows[0].email}`);
    console.log(`   🔑 Password: ${password}`);
    console.log(`   👤 Role: ${result.rows[0].role}`);
    console.log(`   🆔 User ID: ${result.rows[0].id}`);
    console.log('\n⚠️  กรุณาเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบ!\n');

  } catch (error) {
    if (error.code === '23505') {
      console.error('❌ อีเมลนี้ถูกใช้แล้ว: admin@tlogical.com');
    } else {
      console.error('❌ เกิดข้อผิดพลาด:', error.message);
    }
  } finally {
    await pool.end();
  }
};

createAdmin();
