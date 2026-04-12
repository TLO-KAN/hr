import pkg from 'pg';
import 'dotenv/config';
import { getDatabaseConfig } from './src/config/database.js';

const { Pool } = pkg;
const pool = new Pool(getDatabaseConfig());

async function checkPasswords() {
  try {
    const result = await pool.query(
      'SELECT email, password_hash, role FROM user_auth ORDER BY email'
    );
    
    console.log('📋 User Auth Table:\n');
    result.rows.forEach(user => {
      const hasHash = user.password_hash ? '✓ has hash' : '✗ NO hash';
      console.log(`  ${user.email}: role=${user.role} ${hasHash}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkPasswords();
