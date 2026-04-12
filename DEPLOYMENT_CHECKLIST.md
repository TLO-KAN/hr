# 🚀 Deployment Checklist

Complete this checklist before deploying updated functions to production.

---

## 📋 Pre-Deployment

### ✅ Local Environment Check

- [ ] PostgreSQL running locally
  ```bash
  psql -h localhost -U postgres -d hr_management -c "SELECT 1"
  ```

- [ ] .env file updated with all credentials
  ```bash
  grep -E "OFFICE365|DB_" .env | wc -l
  # Should show at least 8 variables
  ```

- [ ] No .env changes in git
  ```bash
  git status | grep ".env"
  # Should show nothing (file not tracked)
  ```

### ✅ Configuration Verification

- [ ] Email Config imports working
  ```bash
  grep -l "getEmailConfig" supabase/functions/**/*.ts
  # Should show: config/email-config.ts, create-employee-user/index.ts, 
  #             reset-user-password/index.ts, utils/office365-email.ts, 
  #             test-office365-smtp.ts
  ```

- [ ] Database Config helper exists
  ```bash
  test -f "src/config/database.ts" && echo "✅ File exists"
  ```

---

## 🧪 Testing Phase

### ✅ Email Configuration Test

```bash
# Test Office365 SMTP connection
deno run --allow-env --allow-net supabase/functions/test-office365-smtp.ts

# ✅ Expected Result:
# ✓ Configuration loaded successfully
# ✓ SMTP connection successful
# ✓ Test email sent successfully
# Check inbox: allsolution@tlogical.com for test email
```

- [ ] SMTP test passes
- [ ] Email received in inbox
- [ ] Email contains proper branding/templates

### ✅ Database Configuration Test

```bash
# Test PostgreSQL connection
bash test-db-connection.sh

# ✅ Expected Result:
# ✓ PostgreSQL running on localhost:5432
# ✓ Database: hr_management
# ✓ User: postgres
# ✓ Connection successful
# ✓ Tables listed
```

Alternative Node.js test:
```bash
npm install pg
node test-db-connection.js
```

- [ ] Database connection test passes
- [ ] All required tables exist
- [ ] Can query existing data

### ✅ Function Changes Verification

```bash
# Verify create-employee-user imports config
grep "import.*getEmailConfig" supabase/functions/create-employee-user/index.ts

# Verify reset-user-password imports config
grep "import.*getEmailConfig" supabase/functions/reset-user-password/index.ts

# Verify office365-email uses config
grep "getEmailConfig" supabase/functions/utils/office365-email.ts
```

- [ ] create-employee-user uses getEmailConfig()
- [ ] reset-user-password uses getEmailConfig()
- [ ] office365-email uses getEmailConfig()
- [ ] test-office365-smtp uses getEmailConfig()

---

## 🔄 Deployment Steps

### Step 1: Backup Current Functions

```bash
# Create timestamp backup
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup current functions
cp -r supabase/functions/* "$BACKUP_DIR/"

# Commit to git (for rollback if needed)
git add "$BACKUP_DIR"
git commit -m "Backup functions before config update - $(date +%Y-%m-%d)"
```

- [ ] Backup created in `backups/` directory
- [ ] Backup committed to git

### Step 2: Set Supabase Secrets

If using Supabase Edge Functions in production:

```bash
# Verify which environment
supabase status

# Set email secrets (if not already set)
supabase secrets set OFFICE365_EMAIL "allsolution@tlogical.com"
supabase secrets set OFFICE365_PASSWORD "RA28d8Jj"
supabase secrets set OFFICE365_SMTP_HOST "smtp.office365.com"
supabase secrets set OFFICE365_SMTP_PORT "587"
supabase secrets set OFFICE365_TLS_ENABLED "true"
supabase secrets set APP_URL "https://yourdomain.com" # or your production URL
```

✅ Verify secrets set:
```bash
supabase secrets list
```

- [ ] All OFFICE365_* secrets set
- [ ] APP_URL set correctly for production
- [ ] Verified with `supabase secrets list`

### Step 3: Deploy Functions

```bash
# Deploy in order (dependencies first)
supabase functions deploy config/email-config

# Deploy functions that use config
supabase functions deploy create-employee-user
supabase functions deploy reset-user-password
supabase functions deploy utils/office365-email
supabase functions deploy test-office365-smtp

# Verify deployment
supabase functions list
```

- [ ] config/email-config deployed ✅
- [ ] create-employee-user deployed ✅
- [ ] reset-user-password deployed ✅
- [ ] utils/office365-email deployed ✅
- [ ] test-office365-smtp deployed ✅

---

## ✅ Post-Deployment Testing

### ✅ Smoke Test in Production

1. **Test Create Employee**
   ```bash
   # Create test employee via API/UI
   # Check that welcome email is sent
   # Verify email arrives in Office365 inbox
   ```
   - [ ] Function executes without error
   - [ ] Welcome email received
   - [ ] Email contains correct template

2. **Test Password Reset**
   ```bash
   # Trigger password reset for test employee
   # Check for password reset email
   # Click link and verify password reset works
   ```
   - [ ] Function executes without error
   - [ ] Password reset email received
   - [ ] Reset link works
   - [ ] New password accepted

3. **Test Remote SMTP** (Optional, if using Supabase Edge Functions)
   ```bash
   # Run test function from Supabase dashboard
   # Or via curl: curl -X POST https://your-project.supabase.co/functions/v1/test-office365-smtp
   ```
   - [ ] Remote test passes
   - [ ] Email sent from production environment

### ✅ Logs Review

```bash
supabase functions logs create-employee-user
supabase functions logs reset-user-password
```

Check for:
- ✅ No errors in execution
- ✅ Configuration logged correctly
- ✅ Email sent successfully
- ✅ Any warnings addressed

- [ ] No error logs
- [ ] Configuration loaded in logs
- [ ] Email delivery confirmed

---

## 🔀 Rollback Plan

If deployment fails or issues arise:

### Quick Rollback (Git-based)

```bash
# Restore from backup
cp -r "backups/2025MMDD_HHMMSS"/* supabase/functions/

# Verify restored
git status supabase/functions

# Redeploy old version
supabase functions deploy create-employee-user
supabase functions deploy reset-user-password
```

### Complete Rollback

```bash
# Revert git commits related to config changes
git revert <commit-hash>
git push

# Redeploy functions
supabase functions deploy create-employee-user
supabase functions deploy reset-user-password
```

- [ ] Have backup location ready
- [ ] Know git commit to revert to
- [ ] Can execute rollback in <5 minutes

---

## 📊 Deployment Record

Record deployment details:

```
Deployment Date: 2025-01-29
Deployed By: [Your Name]
Functions: create-employee-user, reset-user-password, config/email-config
Changes: Centralized email config, replaced hardcoded credentials
Testing: ✅ SMTP test passed, ✅ DB test passed, ✅ Functions tested
Status: ✅ DEPLOYED SUCCESSFULLY
Issues: [None / List any issues found]
Rollback Plan: Backup in backups/20250129_HHMMSS/
```

---

## 🔐 Credentials Security During Deployment

### ✅ Verify Credentials NOT in Code

Before deploying, ensure NO credentials in source:

```bash
# Search for hardcoded credentials in git changes
git diff --name-only HEAD~1 | xargs grep -l "RA28d8Jj\|@tlogical.com\|postgres"

# Should return: NOTHING ✅ (credentials only in .env, not committed)
```

### ✅ Verify .env NOT Committed

```bash
# Check git tracking
git ls-files | grep ".env"

# Should return: NOTHING ✅ (only .env.example)

# If .env is tracked (BAD):
git rm --cached .env
git commit -m "Remove .env from git tracking"
git push
```

- [ ] No credentials in git diff
- [ ] .env not tracked in git
- [ ] Only .env.example in repository

---

## ✅ Final Pre-Production Checklist

- [ ] All tests passing locally
- [ ] All secrets set in Supabase
- [ ] Backup created and committed
- [ ] Functions deployed
- [ ] Smoke tests passed
- [ ] Logs reviewed and clean
- [ ] Credentials verified not in git
- [ ] Team notified of deployment
- [ ] Rollback plan documented
- [ ] Deployment record completed

---

## 📞 Support Contacts

If deployment fails:

1. **Check Supabase Logs**: Dashboard → Functions → [Function Name] → Logs
2. **Review Secrets**: Dashboard → Settings → Secrets
3. **Verify Credentials**: Check .env values match Supabase secrets
4. **Test Manually**: Run test-office365-smtp.ts with Supabase environment

### Debug Commands

```bash
# Check what environment variables are being used
supabase secrets list | grep -E "OFFICE365|DB_"

# View function logs
supabase functions logs create-employee-user --limit 100

# Check function deployment status
supabase functions describe create-employee-user

# Verify function can be called
curl -X GET https://your-project.supabase.co/functions/v1/test-office365-smtp
```

---

**Template Version:** 1.0
**Last Updated:** 2025-01-29
**Status:** Ready for Production
