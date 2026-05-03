/**
 * HR Management System - Backend Server
 * Entry Point
 * 
 * Server runs on Port 3322
 * Database: PostgreSQL (localhost:5432)
 * Email: Office365 SMTP
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Import database and initialization
import { initializeDatabase, getPool } from './config/db.js';
import { configurePassport } from './config/passport.js';
import passport from 'passport';

// Import routes
import authRoutes from './routes/auth.js';
// @ts-ignore
import authRoutesJs from './routes/authRoutes.js';
// @ts-ignore
import { clearRateLimitStore } from './middlewares/rateLimitMiddleware.js';
import leaveRoutes from './routes/leaves.js';
import employeeRoutes from './routes/employeeRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import positionRoutes from './routes/positionRoutes.js';
import holidayRoutes from './routes/holidayRoutes.js';
import leaveRequestRoutes from './routes/leaveRequestRoutes.js';
import leaveEntitlementRoutes from './routes/leaveEntitlementRoutes.js';
import leavePolicyRoutes from './routes/leavePolicyRoutes.js';
import leaveTypeRoutes from './routes/leaveTypeRoutes.js';
import notificationSettingRoutes from './routes/notificationSettingRoutes.js';
import approvalWorkflowRoutes from './routes/approvalWorkflowRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import userRoleRoutes from './routes/userRoleRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
// @ts-ignore
import leaveCalculationRoutes from './routes/leaveCalculationRoutes.js';
// @ts-ignore
import adminCronRoutes from './routes/adminCronRoutes.js';
// @ts-ignore
import { initializeLeaveCronJobs, stopLeaveCronJobs } from './jobs/leaveCronJobs.js';
// @ts-ignore
import { verifyEmailService } from './utils/emailService.js';
// @ts-ignore
import swaggerUi from 'swagger-ui-express';
// @ts-ignore
import { swaggerSpec } from './config/swagger.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT = process.env.BACKEND_PORT || 3322;
const NODE_ENV = process.env.NODE_ENV || 'development';
let cronJobs: any = null;

/**
 * Middleware Setup
 */

// CORS Configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  })
);

// Body parsing
// Keep limit higher than avatar file size because some endpoints still send base64 JSON payloads.
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Also serve under /api/uploads to support reverse-proxy deployments where
// the proxy strips /api but static files are still requested via /api/uploads.
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Swagger API Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'HR System API Docs',
  swaggerOptions: { persistAuthorization: true },
}));
app.get('/api-docs.json', (_req: Request, res: Response) => res.json(swaggerSpec));

// Logging Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

/**
 * Configure Passport OAuth
 */
configurePassport();
app.use(passport.initialize());

// Clear rate limit store on startup
clearRateLimitStore();
console.log(`[${NODE_ENV}] Rate limit store cleared. Rate limiting ${NODE_ENV === 'development' ? 'DISABLED' : 'ENABLED'}.`);

/**
 * Route Handlers
 */

// Health Check Route
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// API Routes
// NOTE: Keep multiple prefixes to survive proxy variations in production.
// - /api/v1/*: preferred canonical path
// - /api/*: legacy path
// - /v1/*: fallback when reverse proxies strip /api
const apiPrefixes = ['/api/v1', '/api', '/v1'];

const mountApiRoutes = (basePrefix: string) => {
  app.use(`${basePrefix}/auth`, authRoutesJs);  // login, register, me, permissions, etc.
  app.use(`${basePrefix}/auth`, authRoutes);    // Microsoft SSO routes
  app.use(`${basePrefix}/leaves`, leaveRoutes);
  app.use(`${basePrefix}/employees`, employeeRoutes);
  app.use(`${basePrefix}/departments`, departmentRoutes);
  app.use(`${basePrefix}/positions`, positionRoutes);
  app.use(`${basePrefix}/holidays`, holidayRoutes);
  app.use(`${basePrefix}/leave-requests`, leaveRequestRoutes);
  app.use(`${basePrefix}/leave-entitlements`, leaveEntitlementRoutes);
  app.use(`${basePrefix}/leave-policies`, leavePolicyRoutes);
  app.use(`${basePrefix}/leave-types`, leaveTypeRoutes);
  app.use(`${basePrefix}/leave-calculation`, leaveCalculationRoutes);  // NEW: Leave calculation services
  app.use(`${basePrefix}/admin/cron`, adminCronRoutes);  // NEW: Admin cron job management
  app.use(`${basePrefix}/notification-settings`, notificationSettingRoutes);
  app.use(`${basePrefix}/approval-workflows`, approvalWorkflowRoutes);
  app.use(`${basePrefix}/notifications`, notificationRoutes);
  app.use(`${basePrefix}/user-roles`, userRoleRoutes);
  app.use(`${basePrefix}/user_roles`, userRoleRoutes);
  app.use(`${basePrefix}/attendance`, attendanceRoutes);
};

apiPrefixes.forEach(mountApiRoutes);

// Extra compatibility for environments that strip both /api and /v1.
app.use('/auth', authRoutesJs);
app.use('/auth', authRoutes);

/**
 * Error Handling Middleware
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'ไฟล์มีขนาดใหญ่เกินกำหนดของระบบ (ไม่เกิน 10MB)',
    });
  }

  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

/**
 * 404 Handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

/**
 * Server Startup
 */
async function startServer(): Promise<void> {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 HR Management System - Backend Server Starting');
    console.log('='.repeat(60));

    // Initialize database
    await initializeDatabase();

    // Verify email service (after dotenv is loaded)
    verifyEmailService();

    // Initialize leave management cron jobs (only in production)
    if (NODE_ENV === 'production') {
      cronJobs = initializeLeaveCronJobs();
      console.log('✅ Leave management cron jobs initialized');
    } else {
      console.log('⏭️  Cron jobs disabled in development mode (can trigger manually via API)');
    }

    // Start Express server — store reference for graceful shutdown
    const server = app.listen(PORT, () => {
      console.log(`\n📍 Server URL: http://localhost:${PORT}`);
      console.log(`🗄️  Database: PostgreSQL (${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432})`);
      console.log(`📧 Email: Office365 SMTP (${process.env.SMTP_HOST || process.env.OFFICE365_SMTP_HOST || 'smtp.office365.com'}:${process.env.SMTP_PORT || process.env.OFFICE365_SMTP_PORT || 587})`);
      console.log(`🔐 OAuth: Azure AD Configured`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log('='.repeat(60) + '\n');
    });

    // Allow nodemon restarts to release the port cleanly
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use. Exiting so nodemon can retry.`);
        process.exit(1);
      } else {
        throw err;
      }
    });

    // Save server for graceful shutdown
    (global as any).__httpServer = server;

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful Shutdown
 */
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Shutting down server (${signal})...`);
  try {
    const httpServer = (global as any).__httpServer;
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      console.log('✅ HTTP server closed');
    }
    if (cronJobs) {
      stopLeaveCronJobs(cronJobs);
    }
    const pool = getPool();
    await pool.end();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the server
startServer();

export default app;
