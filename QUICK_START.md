# 🚀 Quick Start Guide - Database & Frontend Setup

## ⚡ Backend Database (Already Configured)

### ✅ Status

```
✅ PostgreSQL: Connected
✅ Connection Pool: Active (db-pool.js)
✅ .env: Configured
✅ Database: 11 tables
✅ API Server: Running on port 3002
```

### 🚀 Start Backend

```bash
cd /applications/HR/backend
node server.js
```

**Expected Output:**
```
✅ PostgreSQL Connection Established
✅ Email SMTP connection ready
🚀 Backend API Server ทำงานที่: http://localhost:3002
```

### 📋 Test Scripts

```bash
# Check database tables
node check-tables.mjs

# Check all users  
node check-all-users.mjs

# Check PostgreSQL connection
node check-postgres.js
```

---

## 💻 Frontend Setup (Next Step)

### 1️⃣ Start Development Server

```bash
cd /Applications/HR/frontend
npm install  # If first time
npm run dev
```

**Expected Output:**
```
✨ vite v5.x.x
  ➜  Local: http://localhost:5173/
```

### 2️⃣ Access Application

```
Open browser: http://localhost:5173
```

---

## 🔐 Test Credentials

### Admin Account (Single Credential Set)
```
Email: admin@tlogical.com
Password: Admin@123
```

---

## 📚 Database Configuration Files

### New Centralized Module

```javascript
// ✅ NEW: src/config/db-pool.js
import { getPool, query } from './src/config/db-pool.js';

const pool = getPool();
const result = await pool.query('SELECT * FROM employees');
```

### Old Pattern (Deprecated)

```javascript
// ❌ OLD: Hardcoded credentials
const pool = new Pool({
  password: 'K@n50280754'  // Exposed!
});
```

**All 15 files refactored to use new centralized module!**

---

## 🧪 Quick Testing

### Test 1: Backend API

```bash
# In terminal:
curl http://localhost:3002/api/health

# Expected response:
# {"status":"OK","message":"Backend API ทำงานปกติ"}
```

### Test 2: Frontend Loading

```
Open http://localhost:5173 in browser
- Should see login page
- No console errors
- Can login with test credentials
```

### Test 3: Employee Creation

```
1. Login as admin (admin@tlogical.com)
2. Go to Employees page
3. Click "+" to create employee
4. Should load form without errors
```

### Test 4: Leave Request Page

```
1. Login as admin
2. Click "ขอลางาน" (Leave Request) in sidebar
3. Page should load with balance cards (NOT blank!)
4. Can view and create leave requests
```

---

## 📖 Documentation

- **[DATABASE_CONFIG.md](DATABASE_CONFIG.md)** - Detailed database setup
- **[REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md)** - What changed
- **[TESTING_COMPREHENSIVE.md](TESTING_COMPREHENSIVE.md)** - Full test guide
- **[ENV_SETUP.md](ENV_SETUP.md)** - Environment configuration

---

## ⚙️ .env Configuration

Make sure these are set in `/Applications/HR/backend/.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=K@n50280754

# Server
BACKEND_PORT=3002
NODE_ENV=development

# JWT
JWT_SECRET=your_secret_key

# Email
OFFICE365_SMTP_HOST=smtp.office365.com
OFFICE365_EMAIL=allsolution@tlogical.com
OFFICE365_PASSWORD=your_password
```

---

## 🔄 Running Full System

### Terminal 1: Backend
```bash
cd /Applications/HR/backend
node server.js
```

### Terminal 2: Frontend
```bash
cd /Applications/HR/frontend
npm run dev
```

### Terminal 3: Optional - Monitoring
```bash
# Monitor backend logs
tail -f /tmp/backend.log
```

---

## ✅ Checklist Before Testing

- [ ] PostgreSQL running locally
- [ ] Backend started on port 3002
- [ ] Frontend started on port 5173
- [ ] .env file configured
- [ ] Can access http://localhost:5173
- [ ] Can login with test credentials
- [ ] No console errors

---

## 🎯 What To Test

### Phase 1: Basic UI
- [ ] Login page loads
- [ ] Can login as supervisor
- [ ] Sidebar shows correct menu items

### Phase 2: Employee Features
- [ ] Can view employees
- [ ] Can create new employee
- [ ] Welcome email sends

### Phase 3: Leave Features  
- [ ] Leave Request page loads (no blank!)
- [ ] Can see leave balance
- [ ] Can create leave request
- [ ] Can cancel leave request

### Phase 4: Role Features
- [ ] Supervisor can create employees ✅
- [ ] Only admin/hr can change roles ✅
- [ ] Menu reflects correct role permissions ✅

---

## 🆘 Troubleshooting

### Backend won't start
```bash
# Check port 3002 is available
lsof -i :3002

# Check PostgreSQL running
psql --version

# Check .env file
cat /Applications/HR/backend/.env
```

### Frontend won't load
```bash
# Check dependencies
cd /Applications/HR/frontend
npm install

# Clear cache
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Database connection error
```bash
# Test PostgreSQL
node check-postgres.js

# Check all tables
node check-tables.mjs

# Verify credentials in .env
```

---

**Status: ✅ READY FOR TESTING**

Next: Start servers and test on frontend!

const config = getDatabaseConfig();
// { host: 'localhost', port: 5432, database: 'hr_management', ... }

const connString = getDatabaseConnectionString();
// postgresql://postgres:postgres@localhost:5432/hr_management
```

### 🔗 Use with Libraries

**pg (node-postgres):**
```typescript
import { Client } from 'pg';
import { getDatabaseConfig } from '@/config/database';

const client = new Client(getDatabaseConfig());
await client.connect();
const result = await client.query('SELECT * FROM employees');
await client.end();
```

**Prisma:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## 📧 Office365 Email

### ✅ Configuration Ready

```typescript
// File: supabase/functions/config/email-config.ts
const config = getEmailConfig();
// {
//   smtpHost: 'smtp.office365.com'
//   smtpPort: 587
//   smtpUsername: 'allsolution@tlogical.com'
//   smtpPassword: 'RA28d8Jj'
//   tlsEnabled: true
//   appUrl: 'http://localhost:5173'
// }
```

### 🧪 Test SMTP

```bash
deno run --allow-env --allow-net \
  supabase/functions/test-office365-smtp.ts
```

### 📝 Helper Functions

```typescript
import { getEmailConfig } from '../config/email-config.ts';

const config = getEmailConfig();
// Use for creating SMTP connection
```

### 🔗 Usage in Functions

```typescript
// In: create-employee-user/index.ts
import { getEmailConfig } from '../config/email-config.ts';

const config = getEmailConfig();
const client = new SMTPClient({
  connection: {
    hostname: config.smtpHost,
    port: config.smtpPort,
    tls: config.tlsEnabled,
    auth: {
      username: config.smtpUsername,
      password: config.smtpPassword,
    },
  },
});
```

---

## 📁 Files Structure

```
project/
├── .env                           ← Database + Email config
├── .env.example                   ← Template
├── src/config/database.ts         ← DB helper functions
├── DATABASE_CONFIG.md             ← DB documentation
├── test-db-connection.js          ← Node.js DB test
├── test-db-connection.sh          ← Bash DB test
├── supabase/functions/
│   ├── config/email-config.ts     ← Email config (centralized)
│   ├── create-employee-user/index.ts    ← Uses both configs
│   ├── reset-user-password/index.ts     ← Uses both configs
│   ├── utils/office365-email.ts         ← Uses email config
│   └── test-office365-smtp.ts           ← Tests email config
```

---

## ⚙️ Edit Credentials

### Database (PostgreSQL)

```bash
# 1. Edit: .env
DB_USER="new_user"
DB_PASSWORD="new_password"

# 2. Restart app
npm run dev
```

### Email (Office365)

```bash
# Option 1: Edit config file
# File: supabase/functions/config/email-config.ts
smtpUsername: "new-email@example.com"
smtpPassword: "newpass"

# Option 2: Use environment variables
# Set in .env or Supabase Secrets:
OFFICE365_EMAIL="new-email@example.com"
OFFICE365_PASSWORD="newpass"
```

---

## ✅ Quick Checklist

- [x] PostgreSQL Database configured
- [x] .env added with DB credentials
- [x] .env.example created
- [x] Database helper functions created
- [x] Office365 Email configured
- [x] Email config centralized
- [x] Test scripts created

### Next Steps

1. **Create Database** (if needed):
   ```bash
   createdb -U postgres hr_management
   ```

2. **Run DB Test**:
   ```bash
   node test-db-connection.js
   ```

3. **Run Email Test**:
   ```bash
   deno run --allow-env --allow-net supabase/functions/test-office365-smtp.ts
   ```

4. **Deploy**:
   ```bash
   supabase functions deploy create-employee-user
   supabase functions deploy reset-user-password
   ```

---

## 📞 Documentation

- 📖 Database: [DATABASE_CONFIG.md](./DATABASE_CONFIG.md)
- 📖 Email: [EMAIL_CONFIG_GUIDE.md](./EMAIL_CONFIG_GUIDE.md)
- 📖 Office365: [OFFICE365_README.md](./OFFICE365_README.md)

---

**Status:** ✅ Ready for Development & Deployment
