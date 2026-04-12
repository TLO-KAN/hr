# 🚀 Complete Backend Setup Guide

Your backend refactoring is complete! Now let's get it running. Here's the complete setup process.

---

## 📋 Prerequisites

- Node.js 18+ (already installed ✅)
- npm (already installed ✅)
- PostgreSQL 12+ (need to set up)
- TypeScript dependencies (already installed ✅)

---

## 🗄️ Step 1: Set Up PostgreSQL

### Option A: macOS with Homebrew (Recommended)

```bash
# 1. Install PostgreSQL
brew install postgresql@15

# 2. Start PostgreSQL
brew services start postgresql@15

# 3. Verify it's running
brew services list | grep postgres
# Should see: postgresql@15 started

# 4. Connect to PostgreSQL
psql -U postgres

# You should see the psql prompt: postgres=#
```

### Option B: macOS with Docker

```bash
# 1. Pull and run PostgreSQL container
docker run --name postgres-hr \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hr_system \
  -p 5432:5432 \
  -d postgres:15

# 2. Verify it's running
docker ps | grep postgres-hr

# 3. Connect (password: postgres)
psql -h localhost -U postgres
```

### Option C: Linux (Ubuntu/Debian)

```bash
# 1. Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# 2. Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 3. Connect as postgres user
sudo -u postgres psql
```

---

## 🏗️ Step 2: Create Database & User

Once you're in the PostgreSQL console (`postgres=#` prompt):

```sql
-- 1. Create the database
CREATE DATABASE hr_system;

-- 2. Create or verify the user
CREATE USER postgres WITH PASSWORD 'postgres';

-- 3. Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE hr_system TO postgres;

-- 4. Exit PostgreSQL
\q
```

**If you get errors, that's OK!** It means these already exist. You can safely ignore the errors.

---

## 🔑 Step 3: Verify Connection

Test the connection from your terminal:

```bash
psql -h localhost -U postgres -d hr_system -c "SELECT NOW();"
```

**Expected output**: A timestamp like `2026-04-02 10:30:45.123456+00`

If you get errors, check:
- Is PostgreSQL running? (`brew services list`)
- Did you create the database `hr_system`?
- Is the password correct in the connection string?

---

## 📊 Step 4: Create Database Tables

Option 1: Using the SQL file (easiest)

```bash
cd /Applications/HR/backend
psql -h localhost -U postgres -d hr_system -f init-db.sql
```

Option 2: Manual setup in psql

```bash
psql -h localhost -U postgres -d hr_system
# Then paste the contents of init-db.sql
```

**Verify tables were created**:
```bash
psql -h localhost -U postgres -d hr_system -c "\dt"
```

Expected output:
```
            List of relations
 Schema |        Name        | Type  | Owner
--------+--------------------+-------+--------
 public | employees          | table | postgres
 public | leave_requests     | table | postgres
 public | notification_settings | table | postgres
 public | users              | table | postgres
```

---

## 🔧 Step 5: Configure Environment Variables

Edit `/Applications/HR/backend/.env`:

```env
# ===== SERVER CONFIGURATION =====
NODE_ENV=development
BACKEND_PORT=3322
FRONTEND_URL=http://localhost:5173

# ===== DATABASE CONFIGURATION =====
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=hr_system

# ===== JWT CONFIGURATION =====
JWT_SECRET=your_super_secure_secret_key_minimum_32_characters_long_here_12345

# ===== EMAIL CONFIGURATION (Optional for now) =====
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@company.com

# ===== AZURE AD OAuth CONFIGURATION (Optional) =====
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_REDIRECT_URI=http://localhost:3322/auth/microsoft/callback

# ===== CORS CONFIGURATION =====
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# ===== LOG LEVEL =====
LOG_LEVEL=info

# ===== FEATURE FLAGS =====
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_LEAVE_SCHEDULER=true
```

⚠️ **Important**: Change `JWT_SECRET` to something long and random (32+ characters)

---

## 🚀 Step 6: Start the Development Server

```bash
cd /Applications/HR/backend
npm run dev
```

**Expected output**:
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

🎉 **Server is running!** Leave this terminal open.

---

## ✅ Step 7: Verify Server is Running

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:3322/health
```

**Expected response**:
```json
{
  "status": "ok",
  "timestamp": "2026-04-02T10:35:00.000Z",
  "environment": "development"
}
```

---

## 🧪 Step 8: Test Authentication

### Test User Registration

```bash
curl -X POST http://localhost:3322/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@company.com",
    "password": "SecurePassword123!",
    "displayName": "Test User"
  }'
```

**Expected response** (with JWT token):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid-here",
      "email": "test@company.com",
      "display_name": "Test User",
      "role": "employee"
    }
  }
}
```

### Test User Login

```bash
curl -X POST http://localhost:3322/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@company.com",
    "password": "SecurePassword123!"
  }'
```

---

## 📅 Step 9: Test Leave Endpoints

Save the JWT token from the login response, then:

```bash
# Get leave balance
curl -X GET http://localhost:3322/leaves/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Create leave request
curl -X POST http://localhost:3322/leaves/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "leaveType": "annual",
    "startDate": "2026-04-15",
    "endDate": "2026-04-17",
    "reason": "Personal leave"
  }'
```

---

## 🐛 Troubleshooting

### Issue: "password authentication failed"

**Solution**: PostgreSQL credentials are wrong in `.env`

```bash
# Check what user/password PostgreSQL uses
psql -h localhost -U postgres -c "\l"

# Update .env with correct credentials
# DB_USER=postgres
# DB_PASSWORD=postgres  (or your password)
```

### Issue: "database does not exist"

**Solution**: Create the database

```bash
psql -h localhost -U postgres -c "CREATE DATABASE hr_system;"
```

### Issue: "tables do not exist"

**Solution**: Run the schema initialization

```bash
psql -h localhost -U postgres -d hr_system -f /Applications/HR/backend/init-db.sql
```

### Issue: "txs: command not found"

**Solution**: Install TypeScript dependencies

```bash
cd /Applications/HR/backend
npm install --save-dev tsx typescript @types/node
```

### Issue: "Cannot find module"

**Solution**: Install all dependencies

```bash
cd /Applications/HR/backend
npm install
```

---

## 📁 Project Structure

```
/Applications/HR/backend/
├── src/
│   ├── config/           (db.ts, passport.ts)
│   ├── controllers/      (auth, leave)
│   ├── routes/          (auth, leaves)
│   ├── services/        (auth, leave, notification)
│   └── index.ts         (Express server)
├── .env                 (Configuration - EDIT THIS)
├── package.json         (Dependencies)
├── init-db.sql         (Database schema - RUN THIS)
├── QUICK_START.md      (Quick reference)
└── BACKEND_REFACTOR_GUIDE.md (Full API docs)
```

---

## 🎯 Checklist

- [ ] PostgreSQL installed and running
- [ ] Database `hr_system` created
- [ ] Database tables created (`init-db.sql` run)
- [ ] `.env` file configured with correct credentials
- [ ] `npm install` completed
- [ ] `npm run dev` started successfully
- [ ] Health endpoint returns 200 (curl test)
- [ ] Can register new user
- [ ] Can login with email/password
- [ ] Can get leave balance

---

## 🚀 Next Steps

1. ✅ Complete setup above
2. ⏳ Test all endpoints thoroughly
3. ⏳ Configure Office365 SMTP (if needed)
4. ⏳ Configure Azure AD OAuth (if needed)
5. ⏳ Integrate with frontend
6. ⏳ Deploy to production

---

## 📚 Documentation

- `QUICK_START.md` - Quick reference
- `BACKEND_REFACTOR_GUIDE.md` - Complete API docs
- `POSTGRES_SETUP.md` - PostgreSQL troubleshooting
- `IMPLEMENTATION_CHECKLIST.md` - Implementation status

---

**Status**: Backend ready, waiting for PostgreSQL setup ✅

Once PostgreSQL is set up and running, your hrmanagement system backend will be fully operational!

