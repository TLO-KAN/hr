# 🚀 Quick Start Guide - Refactored Backend

## 1️⃣ Install Dependencies

```bash
cd /Applications/HR/backend
npm install
```

Expected packages installed:
- express, pg, jsonwebtoken, bcrypt, dotenv, cors, multer
- passport, passport-oauth2, axios, nodemailer
- tsx, typescript (for development)

---

## 2️⃣ Configure Environment Variables

Edit `.env` file and update these required values:

```bash
# Strict Configuration (Don't Change)
BACKEND_PORT=3322
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=hr_system

SMTP_HOST=smtp.office365.com
SMTP_PORT=587

# Update with Your Values
JWT_SECRET=your_secure_key_minimum_32_characters
SMTP_USER=your-office365-email@company.com
SMTP_PASS=your-office365-app-password
SMTP_FROM=noreply@company.com

# Azure AD OAuth (Get from Azure Portal)
AZURE_AD_CLIENT_ID=your-client-id-here
AZURE_AD_CLIENT_SECRET=your-client-secret-here
AZURE_AD_TENANT_ID=your-tenant-id-here
AZURE_AD_REDIRECT_URI=http://localhost:3322/auth/microsoft/callback
```

---

## 3️⃣ Create PostgreSQL Database

### Option A: Using psql (command line)
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hr_system OWNER postgres;

# Verify
\l
```

### Option B: Using pgAdmin (GUI)
1. Open pgAdmin
2. Right-click "Databases" → Create → Database
3. Name: `hr_system`, Owner: `postgres`

---

## 4️⃣ Create Database Tables

Create file: `backend/src/scripts/init-database.ts`

```typescript
import { query } from '../config/db.js';

async function initializeDatabase() {
  try {
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        display_name VARCHAR(255),
        employee_id UUID,
        role VARCHAR(50) DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create employees table
    await query(`
      CREATE TABLE IF NOT EXISTS employees (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255),
        display_name VARCHAR(255),
        employment_date DATE NOT NULL,
        employment_status VARCHAR(50) DEFAULT 'probation',
        annual_leave_days INTEGER DEFAULT 15,
        department VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create leave_requests table
    await query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        employee_id UUID NOT NULL REFERENCES employees(id),
        leave_type VARCHAR(50),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create notification_settings table
    await query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        department VARCHAR(100),
        role VARCHAR(50),
        email VARCHAR(255),
        notify_on_leave_request BOOLEAN DEFAULT true,
        notify_on_approval BOOLEAN DEFAULT true,
        notify_on_rejection BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Database tables created successfully');

    // Seed notification_settings (Example)
    await query(`
      INSERT INTO notification_settings (department, role, email, notify_on_leave_request, notify_on_approval, notify_on_rejection)
      VALUES 
        ('HR', 'manager', 'hr-manager@company.com', true, true, true),
        ('IT', 'manager', 'it-manager@company.com', true, true, false),
        ('Finance', 'manager', 'finance-manager@company.com', true, true, true)
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ Notification settings seeded');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  }
}

initializeDatabase();
```

Then run:
```bash
npm run db:init
```

---

## 5️⃣ Start Development Server

```bash
npm run dev
```

Expected output:
```
============================================================
🚀 HR Management System - Backend Server Starting
============================================================
✅ Database connection established
🗄️ PostgreSQL Database Connected: [timestamp]
📍 Server URL: http://localhost:3322
🗄️  Database: PostgreSQL (localhost:5432)
📧 Email: Office365 SMTP (smtp.office365.com:587)
🔐 OAuth: Azure AD Configured
🌍 Environment: development
============================================================
```

---

## 6️⃣ Verify Server is Running

### Health Check
```bash
curl http://localhost:3322/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-02T10:00:00.000Z",
  "environment": "development"
}
```

---

## 7️⃣ Test Authentication Flow

### Test 1: User Registration
```bash
curl -X POST http://localhost:3322/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@company.com",
    "password": "SecurePassword123!",
    "displayName": "Test User"
  }'
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "test@company.com",
      "display_name": "Test User",
      "role": "employee"
    }
  }
}
```

### Test 2: User Login
```bash
curl -X POST http://localhost:3322/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@company.com",
    "password": "SecurePassword123!"
  }'
```

### Test 3: Verify Token
```bash
curl -X POST http://localhost:3322/auth/verify-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your_jwt_token}"
```

---

## 8️⃣ Test Leave Endpoints

### Create Leave Request
```bash
curl -X POST http://localhost:3322/leaves/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {jwt_token}" \
  -d '{
    "leaveType": "annual",
    "startDate": "2026-04-15",
    "endDate": "2026-04-17",
    "reason": "Personal leave"
  }'
```

### Get Leave Balance
```bash
curl -X GET http://localhost:3322/leaves/balance \
  -H "Authorization: Bearer {jwt_token}"
```

---

## 🔧 Troubleshooting

### Error: "Cannot find module"
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Error: "Connection refused"
```bash
# Check PostgreSQL is running
# macOS: brew services list
# Linux: sudo systemctl status postgresql
# Windows: Check Services
```

### Error: "Database hr_system does not exist"
```bash
# Create database
psql -U postgres -c "CREATE DATABASE hr_system OWNER postgres;"
```

### Error: "SMTP connection error"
- Verify Office365 credentials in .env
- Use app-specific password (not regular password)
- Check SMTP_PORT=587 (not 465)

### Error: "JWT verification failed"
- Ensure JWT_SECRET in .env is long enough (32+ chars)
- Token might be expired (7-day expiry)
- Use fresh token from login

---

## 📁 Project Structure Check

Verify you have all these files:
```
backend/
├── src/
│   ├── config/
│   │   ├── db.ts ✅
│   │   └── passport.ts ✅
│   ├── controllers/
│   │   ├── AuthController.ts ✅
│   │   └── LeaveController.ts ✅
│   ├── routes/
│   │   ├── auth.ts ✅
│   │   └── leaves.ts ✅
│   ├── services/
│   │   ├── AuthService.ts ✅
│   │   ├── LeaveService.ts ✅
│   │   └── NotificationService.ts ✅
│   ├── scripts/
│   │   └── init-database.ts (to create)
│   └── index.ts ✅
├── .env ✅ (with your values)
├── .env.example ✅
├── package.json ✅
├── tsconfig.json ✅
└── BACKEND_REFACTOR_GUIDE.md ✅
```

---

## 📝 Next Steps

1. ✅ Install dependencies
2. ✅ Configure .env (your values)
3. ✅ Create PostgreSQL database
4. ✅ Create database tables (run init script)
5. ✅ Start development server
6. ✅ Test health endpoint
7. ✅ Test auth endpoints
8. ✅ Test leave endpoints
9. ⏳ Integrate with frontend
10. ⏳ Deploy to production

---

## 🎯 Key Features Summary

| Feature | Status | Port | Details |
|---------|--------|------|---------|
| Express Server | ✅ | 3322 | TypeScript + ES Modules |
| PostgreSQL | ✅ | 5432 | Connection Pool (20 connections) |
| JWT Auth | ✅ | N/A | 7-day expiry |
| Microsoft SSO | ✅ | N/A | OAuth2 via Passport |
| Leave Service | ✅ | N/A | Pro-rate + 119-day probation |
| Email (M365) | ✅ | 587 | TLS enabled |
| Notifications | ✅ | N/A | Template variable substitution |

---

## 🚀 Ready to Go!

Your refactored backend is ready for:
- ✅ Development and testing
- ✅ Frontend integration
- ✅ Production deployment

For more details, see: `BACKEND_REFACTOR_GUIDE.md`

