# Credentials Management Guide

## 🔐 Current Architecture

Your application now has **centralized configuration management** for both database and email:

### 📍 Single Source of Truth for Each Service

| Service | Config File | Credentials Used | Purpose |
|---------|------------|------------------|---------|
| **Email (Office365)** | `supabase/functions/config/email-config.ts` | `OFFICE365_EMAIL` `OFFICE365_PASSWORD` | SMTP for transactional emails |
| **Database (PostgreSQL)** | `src/config/database.ts` | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | Local development database |

---

## 🎯 Why Centralized Config?

### Before ❌
```
Multiple files with hardcoded credentials:
├── create-employee-user/index.ts    → Deno.env.get("OFFICE365_PASSWORD")
├── reset-user-password/index.ts     → Deno.env.get("OFFICE365_PASSWORD")
├── utils/office365-email.ts         → Deno.env.get("OFFICE365_PASSWORD")
└── test-office365-smtp.ts           → Deno.env.get("OFFICE365_PASSWORD")

Problem: Change email password once = 4 files to update ❌
```

### After ✅
```
Single config file imported everywhere:
├── supabase/functions/config/email-config.ts    → getEmailConfig()
│   └── Used by 4 functions (all import same source)
├── src/config/database.ts                        → getDatabaseConfig()
│   └── Available for all backend services

Benefit: Change password once = 1 file to update ✅
```

---

## 🔄 Updating Credentials

### 📧 Update Email Credentials

#### Method 1️⃣: Edit Environment File

```bash
# File: .env
OFFICE365_EMAIL="newemail@company.com"
OFFICE365_PASSWORD="newpassword123"
OFFICE365_SMTP_HOST="smtp.office365.com"
OFFICE365_SMTP_PORT="587"
```

**Impact:** Changes all functions automatically ✅

#### Method 2️⃣: Update Supabase Secrets

If using Supabase Edge Functions:

```bash
# Terminal
supabase secrets set OFFICE365_EMAIL "newemail@company.com"
supabase secrets set OFFICE365_PASSWORD "newpassword123"
```

❌ Then redeploy functions:
```bash
supabase functions deploy create-employee-user
supabase functions deploy reset-user-password
supabase functions deploy utils/office365-email
```

---

### 🗄️ Update Database Credentials

#### Method 1️⃣: Edit Environment File

```bash
# File: .env
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="hr_management"
DB_USER="postgres"
DB_PASSWORD="newdbpassword"
```

**Impact:** Changes all database connections ✅

#### Method 2️⃣: Update Connection String

```bash
# Alternative approach
DATABASE_URL="postgresql://newuser:newpass@newhost:5432/newdb"
```

---

## 🛡️ Security Best Practices

### 1. **Never Commit Credentials**
```bash
# File: .gitignore (already configured)
.env                    ← Keep local only
.env.local              ← Never commit
```

### 2. **Use .env.example as Template**
```bash
# For new developers / CI/CD environments
cp .env.example .env
# Then customize values
```

### 3. **Rotate Credentials Regularly**
```
When to rotate:
- Employee with password access leaves
- Suspected credential breach
- Regular security audit (quarterly)
- Major system changes
```

### 4. **Different Credentials per Environment**
```bash
# Development .env
OFFICE365_EMAIL="dev-test@company.com"
DB_HOST="localhost"

# Production .env (or Supabase Secrets)
OFFICE365_EMAIL="production@company.com"
DB_HOST="prod-db.company.com"
```

---

## 📊 Current Credentials Status

### Email Configuration
```typescript
// Location: supabase/functions/config/email-config.ts
OFFICE365_EMAIL="allsolution@tlogical.com"
OFFICE365_PASSWORD="RA28d8Jj"
OFFICE365_SMTP_HOST="smtp.office365.com"
OFFICE365_SMTP_PORT="587"
OFFICE365_TLS_ENABLED="true"
```

✅ **Centralized** - All functions use getEmailConfig()

### Database Configuration
```typescript
// Location: src/config/database.ts
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="hr_management"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_SSL="false"
```

✅ **Centralized** - Helper functions getDatabaseConfig()

---

## 🔍 Verify Credentials

### Email Credentials
```bash
# Run SMTP test
deno run --allow-env --allow-net supabase/functions/test-office365-smtp.ts

# Check what config is being used
cat supabase/functions/config/email-config.ts | grep -E "OFFICE365|APP_URL"
```

### Database Credentials
```bash
# Run DB connection test
bash test-db-connection.sh

# Or with Node.js
npm install pg
node test-db-connection.js
```

---

## 📋 Credential Update Checklist

When updating any credential:

- [ ] Update in `.env` file locally
- [ ] Test with `test-db-connection.js` or `test-office365-smtp.ts`
- [ ] If using Supabase, run `supabase secrets set KEY "value"`
- [ ] Redeploy affected functions: `supabase functions deploy <function-name>`
- [ ] Test in staging environment first
- [ ] Document change (date, what was changed, why)
- [ ] Notify team members if shared credentials
- [ ] Monitor logs for 24 hours after update

---

## 🚨 Credential Emergency Procedures

### 🔴 If Credentials Are Compromised

1. **IMMEDIATELY** rotate the compromised credential
   ```bash
   # Change password in Office365 / Database
   # Update in .env
   # Deploy new values to Supabase
   ```

2. **Audit** who had access
   ```bash
   # Check git history
   git log --all --full-history -- ".env"
   
   # Review function execution logs
   # Supabase Dashboard → Functions → Logs (OFFICE365_PASSWORD was never in logs ✅)
   ```

3. **Regenerate** if needed
   - Create new Office365 app password
   - Reset database user password
   - Update all dependent systems

### 🟡 If Credential Lost

1. **Recover** from password manager / secure backup
2. **Test** immediately with connection scripts
3. **Request new** from admin if unable to recover
4. **Document** incident

---

## 📞 Files Reference

### Config Files
- [Email Config](./supabase/functions/config/email-config.ts)
- [Database Config](./src/config/database.ts)

### Documentation
- [DATABASE_CONFIG.md](./DATABASE_CONFIG.md)
- [EMAIL_CONFIG_GUIDE.md](./EMAIL_CONFIG_GUIDE.md)
- [OFFICE365_README.md](./OFFICE365_README.md)

### Test Scripts
- [test-db-connection.sh](./test-db-connection.sh) - Bash test
- [test-db-connection.js](./test-db-connection.js) - Node.js test

---

## ✅ Summary

| Task | Status | How |
|------|--------|-----|
| Change Email Password | ✅ Easy | Update `OFFICE365_PASSWORD` in `.env` |
| Change Database Password | ✅ Easy | Update `DB_PASSWORD` in `.env` |
| Verify Email Works | ✅ Easy | Run `test-office365-smtp.ts` |
| Verify Database Works | ✅ Easy | Run `test-db-connection.js` |
| Use New Credentials | ✅ Auto | Restart app (reads from `.env`) |
| Deploy to Supabase | ⚠️ Manual | Run `supabase secrets set` then `deploy` |

---

**Last Updated:** 2025-01-29
**Architecture:** Centralized config management
**Credentials Locations:** 2 files (email-config.ts, database.ts)
