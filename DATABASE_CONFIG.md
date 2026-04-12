# � Database Configuration Guide

## Overview

ระบบฐานข้อมูลของ HR Management ใช้ **PostgreSQL** กับ **Connection Pooling** เพื่อประสิทธิภาพสูง

### Architecture

```
┌─────────────────────────────────────────┐
│  .env Configuration File                 │
│  (DB_HOST, DB_USER, DB_PASSWORD, ...)    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  src/config/database.js                  │
│  (getDatabaseConfig helper function)     │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  src/config/db-pool.js  ✨ NEW           │
│  (Singleton Connection Pool)             │
│  - getPool()                             │
│  - query()                               │
│  - testConnection()                      │
│  - getPoolStats()                        │
└────────────────┬────────────────────────┘
                 │
         ┌───────┼───────┬──────────┐
         ▼       ▼       ▼          ▼
    server.js scripts  routes    utilities
    (API)      (test)
```

---

## 🔧 Configuration Setup

### .env File

Create `.env` in `/Applications/HR/backend/`:

```env
# Backend Configuration
BACKEND_PORT=3002

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=YOUR_SECURE_PASSWORD_HERE
DB_SSL=false

# Node Environment
NODE_ENV=development

# Office365 Email Configuration
OFFICE365_SMTP_HOST=smtp.office365.com
OFFICE365_SMTP_PORT=587
OFFICE365_EMAIL=your_email@tlogical.com
OFFICE365_PASSWORD=your_app_password
OFFICE365_TLS_ENABLED=true
APP_URL=http://localhost:5173
```

---

## 📦 Component Files

### 1. src/config/database.js
Helper functions for database configuration:
- `getDatabaseConfig()` - Returns connection config object
- `getDatabaseConnectionString()` - Returns full connection string
- `logDatabaseConfig()` - Logs configuration for debugging

### 2. src/config/db-pool.js ✨ NEW
Centralized Connection Pool (Singleton Pattern):
- `getPool()` - Get pool instance
- `query(sql, params)` - Execute query directly
- `testConnection()` - Test database connection
- `closePool()` - Close all connections
- `getPoolStats()` - Get pool statistics

---

## 💡 Usage Examples

### Recommended: Use Centralized Pool

```javascript
import { getPool, query } from './src/config/db-pool.js';

// Method 1: Get pool instance
const pool = getPool();
const result = await pool.query('SELECT * FROM employees');

// Method 2: Use helper function
const result = await query('SELECT * FROM employees WHERE id = $1', [1]);

// Method 3: Test connection
await testConnection();
```

### Old Pattern (DEPRECATED)
```javascript
// ❌ DO NOT USE - Hardcoded credentials
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'localhost',
  password: 'K@n50280754'
});
```

---

## ✅ Refactored Files

All these files now use centralized db-pool:
- ✅ server.js (API server)
- ✅ create-admin.js
- ✅ check-user-roles.js
- ✅ check-all-users.mjs
- ✅ check-roles.mjs
- ✅ check-schema.mjs
- ✅ check-fk.mjs
- ✅ check-tables.mjs
- ✅ test-role-insert.mjs
- ✅ fix-fk.mjs
- ✅ assign-roles.mjs
- ✅ assign-roles-byid.mjs
- ✅ fix-user.js
- ✅ check-passwords.mjs
- ✅ set-test-passwords.mjs

---

## 🧪 Testing

### Test 1: PostgreSQL Connection
```bash
cd /Applications/HR/backend
node check-postgres.js
```

### Test 2: Check Tables
```bash
node check-tables.mjs
```

### Test 3: Start API Server
```bash
node server.js
```

---

## 🔐 Security

### ✅ Best Practices
- Never hardcode credentials
- Store secrets in `.env`
- Add `.env` to `.gitignore`
- Use strong passwords
- Rotate credentials regularly

### .gitignore Entry
```
.env
.env.local
.env.*.local
```

---

## 🛠️ Environment Variables

| Variable | Default | Required |
|----------|---------|----------|
| `DB_HOST` | localhost | ✅ |
| `DB_PORT` | 5432 | ❌ |
| `DB_NAME` | postgres | ✅ |
| `DB_USER` | postgres | ✅ |
| `DB_PASSWORD` | - | ✅ |
| `DB_SSL` | false | ❌ |
| `JWT_SECRET` | - | ✅ |
| `BACKEND_PORT` | 3002 | ❌ |

---

## 📊 Pool Statistics

```javascript
import { getPoolStats } from './src/config/db-pool.js';

const stats = getPoolStats();
console.log(stats);
// {
//   totalCount: 10,    // Total connections in pool
//   idleCount: 8,      // Available connections
//   waitingCount: 0    // Queries waiting for connection
// }
```

---

## ⚠️ Troubleshooting

### Cannot connect to PostgreSQL
```bash
# Check if PostgreSQL is running
psql --version

# Test connection
node check-postgres.js
```

### Module not found error
```bash
# Verify file exists
ls src/config/db-pool.js

# Check import path in your file
```

### Connection pool exhausted
```javascript
// Monitor pool usage
console.log(getPoolStats());
// If waitingCount is high, code isn't releasing connections
```

---

Last Updated: 2026-03-29

### ตัวเลือกที่ 1: node-postgres (pg)

```bash
npm install pg
```

```typescript
import { Client } from 'pg';
import { getDatabaseConfig } from '@/config/database';

const config = getDatabaseConfig();
const client = new Client(config);

await client.connect();
const result = await client.query('SELECT * FROM employees');
console.log(result.rows);
await client.end();
```

### ตัวเลือกที่ 2: pg + Connection Pooling

```typescript
import { Pool } from 'pg';
import { getDatabaseConnectionString } from '@/config/database';

const connectionString = getDatabaseConnectionString();
const pool = new Pool({ connectionString });

const result = await pool.query('SELECT * FROM employees');
console.log(result.rows);
```

### ตัวเลือกที่ 3: Prisma ORM

```bash
npm install @prisma/client
npx prisma init
```

**prisma/.env:**
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hr_management"
```

**prisma/schema.prisma:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const employees = await prisma.employees.findMany();
console.log(employees);
```

### ตัวเลือกที่ 4: Drizzle ORM

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit
```

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { getDatabaseConfig } from '@/config/database';

const config = getDatabaseConfig();
const client = new Client(config);

const db = drizzle(client);
const employees = await db.query.employees.findMany();
console.log(employees);
```

---

## 📂 ไฟล์ที่สร้าง

| ไฟล์ | ประเภท | ใช้งาน |
|------|--------|--------|
| `.env` | Configuration | ✅ อัปเดตแล้ว |
| `.env.example` | Template | ✅ สร้างแล้ว |
| `src/config/database.ts` | Helper | ✅ สร้างแล้ว |

---

## 🧪 ทดสอบการเชื่อมต่อ

### ใช้ psql (PostgreSQL CLI)

```bash
psql -h localhost -U postgres -d hr_management -c "SELECT version();"
```

ผลลัพธ์ที่คาดหวัง:
```
PostgreSQL 14.x...
```

### ใช้ Node.js

```bash
node -e "
const config = require('./src/config/database').getDatabaseConfig();
console.log('Database Config:', config);
"
```

---

## 🔐 ข้อควรระวัง

### ⚠️ Credentials ใน .env

- `.env` มี username/password จริง
- **ไม่ควร commit** `.env` ไปยัง git
- ใช้ `.env.example` สำหรับ template

### ✅ วิธีการปลอดภัย

1. **เพิ่ม .env ในไฟล์ .gitignore** (ซ้ำแล้ว)
   ```
   .env
   .env.local
   ```

2. **ใช้ .env.example**
   - Copy `.env.example` เป็น `.env`
   - แก้ไข credentials ตามต้องการ
   - Shareผู้อื่น `.env.example` แทน `.env`

3. **สำหรับ Production**
   - ใช้ Environment Variables จากระบบ
   - ไม่เก็บ hardcoded credentials

---

## 🔧 ปรับแต่ง Credentials

เมื่อต้องการเปลี่ยน username/password:

1. **เปิด:** `.env`
2. **แก้ไข:**
   ```env
   DB_USER="new_user"
   DB_PASSWORD="new_password"
   ```
3. **Restart** แอปพลิเคชัน

---

## 📋 ข้อมูล Default

| ตัวแปร | ค่า Default | ที่ตั้ง |
|------|------------|--------|
| DB_HOST | localhost | .env |
| DB_PORT | 5432 | .env |
| DB_NAME | hr_management | .env |
| DB_USER | postgres | .env |
| DB_PASSWORD | postgres | .env |
| DATABASE_URL | สร้างอัตโนมัติ | .env |

---

## 🚀 ขั้นตอนถัดไป

1. **ตรวจสอบ PostgreSQL** ทำงานอยู่บน localhost:5432
2. **สร้าง Database** (ถ้ายังไม่มี)
   ```bash
   createdb -U postgres hr_management
   ```
3. **ใช้ helper function**
   ```typescript
   import { getDatabaseConnectionString } from '@/src/config/database';
   ```
4. **Connect กับ Backend**
   - API routes
   - Database queries
   - Migration scripts

---

## 📞 การแก้ไขปัญหา

### ❌ "Cannot connect to database"

```bash
# ตรวจสอบว่า PostgreSQL ทำงาน
psql -V

# ลอง connect
psql -h localhost -U postgres
```

### ❌ "Database hr_management does not exist"

```bash
# สร้าง database
createdb -U postgres hr_management
```

### ❌ "Authentication failed for user"

```bash
# ตรวจสอบ .env
cat .env | grep DB_

# เปลี่ยน password ใน PostgreSQL
ALTER USER postgres WITH PASSWORD 'new_password';
```

---

## ✅ สถานะ

- ✅ PostgreSQL Configuration ตั้งค่า
- ✅ .env updated
- ✅ .env.example created
- ✅ Database helper created
- ✅ ตัวอย่างการใช้งาน

**Next:** Connect กับ backend แล้ว query database! 🚀
