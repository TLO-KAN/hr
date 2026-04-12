import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required in environment variables');
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const sqlPath = path.resolve(__dirname, '../../init-db.sql');

  const sql = await fs.readFile(sqlPath, 'utf8');
  if (!sql.trim()) {
    throw new Error(`SQL file is empty: ${sqlPath}`);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query(sql);
    console.log(`Database initialized successfully using ${sqlPath}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed to initialize database:', error.message);
  process.exit(1);
});
