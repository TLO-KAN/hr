/**
 * Database Configuration Helper
 * ใช้สำหรับการเชื่อมต่อ PostgreSQL Database (hr_management)
 * 
 * ใช้ได้ใน:
 * - Node.js Backend
 * - API Routes
 * - Database Queries
 */

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

/**
 * ดึงค่า Database Configuration จาก .env
 */
export function getDatabaseConfig(): DatabaseConfig {
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "5432");
  const database = process.env.DB_NAME || "postgres";
  const user = process.env.DB_USER || "postgres";
  const password = process.env.DB_PASSWORD || "K@n50280754";
  const ssl = process.env.DB_SSL?.toLowerCase() === "true";

  return {
    host,
    port,
    database,
    user,
    password,
    ssl,
  };
}

/**
 * ดึง Connection String จาก .env
 */
export function getDatabaseConnectionString(): string {
  return (
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || "postgres"}:${
      process.env.DB_PASSWORD || "K@n50280754"
    }@${process.env.DB_HOST || "localhost"}:${
      process.env.DB_PORT || "5432"
    }/${process.env.DB_NAME || "postgres"}`
  );
}

/**
 * ตัวอย่างการใช้กับ pg (node-postgres)
 * 
 * npm install pg
 * 
 * @example
 * const { Client } = require('pg');
 * const config = getDatabaseConfig();
 * 
 * const client = new Client(config);
 * await client.connect();
 * const result = await client.query('SELECT * FROM employees');
 * console.log(result.rows);
 * await client.end();
 */

/**
 * ตัวอย่างการใช้กับ Pool (Connection Pooling)
 * 
 * const { Pool } = require('pg');
 * const connectionString = getDatabaseConnectionString();
 * 
 * const pool = new Pool({ connectionString });
 * const result = await pool.query('SELECT * FROM employees');
 * console.log(result.rows);
 */

/**
 * Log Configuration สำหรับ Debug
 */
export function logDatabaseConfig(): void {
  const config = getDatabaseConfig();
  console.log("📊 Database Configuration:");
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  User: ${config.user}`);
  console.log(`  SSL: ${config.ssl ? "Enabled" : "Disabled"}`);
}

/**
 * ตัวอย่างเต็ม: สร้างการเชื่อมต่อ
 */
export async function createDatabaseConnection() {
  try {
    // ถ้าใช้ node-postgres (pg)
    // const { Client } = require('pg');
    // const config = getDatabaseConfig();
    // const client = new Client(config);
    // await client.connect();
    // console.log('✅ Database connected successfully!');
    // return client;

    // หรือสำหรับ Prisma
    // const { PrismaClient } = require('@prisma/client');
    // const prisma = new PrismaClient();
    // await prisma.$connect();
    // console.log('✅ Prisma connected successfully!');
    // return prisma;

    console.log("✅ Database configuration loaded successfully");
  } catch (error) {
    console.error("❌ Database connection error:", error);
    throw error;
  }
}

/**
 * ตัวอย่างการใช้งาน
 */
if (require.main === module) {
  logDatabaseConfig();
  console.log("\n📝 Connection String:");
  console.log(getDatabaseConnectionString());
}
