import pg from 'pg';
import 'dotenv/config';
import logger from '../utils/logger.js';

const { Pool } = pg;

let pool = null;

export const initializePool = () => {
  if (pool) {
    return pool;
  }

  // Use DATABASE_URL if available, otherwise fallback to individual vars
  const poolConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'hr_system',
      };

  pool = new Pool({
    ...poolConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    logger.error(`Unexpected error on idle client: ${err.message}`);
  });

  pool.on('connect', () => {
    logger.debug('New client connected to database');
  });

  return pool;
};

export const getPool = () => {
  if (!pool) {
    return initializePool();
  }
  return pool;
};

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
};