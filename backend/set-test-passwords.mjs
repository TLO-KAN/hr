import pkg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getDatabaseConnectionString } from './src/config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const REQUIRED_ENV = [
  'TEST_ADMIN_EMAIL',
  'TEST_ADMIN_PASSWORD',
];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const { Pool } = pkg;
const pool = new Pool({ connectionString: getDatabaseConnectionString() });

async function setPassword(email, password, role = 'employee') {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const normalizedEmail = email.toLowerCase().trim();

    const result = await pool.query(
      `INSERT INTO user_auth (email, password_hash, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
       RETURNING id, email, role`,
      [normalizedEmail, passwordHash, role]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Password set for ${email}`);
      return true;
    }

    console.log(`❌ Could not set password for: ${email}`);
    return false;
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔐 Setting test passwords...\n');

  // Single credential set for all test/login docs.
  await setPassword(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD, 'admin');

  console.log('\n✅ Passwords set successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
