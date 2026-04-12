# Office365 Integration - Comprehensive Testing Guide

## 📋 Table of Contents
1. [Pre-Testing Checklist](#pre-testing-checklist)
2. [Environment Setup](#environment-setup)
3. [Test Office365 SMTP](#test-office365-smtp)
4. [Test Office365 OAuth](#test-office365-oauth)
5. [Test Complete Workflow](#test-complete-workflow)
6. [Troubleshooting](#troubleshooting)

---

## Pre-Testing Checklist

Before testing, ensure all materials are prepared:

- [ ] Have Office365 account credentials ready (kanjung@tlogical.com / kanjung)
- [ ] Have Supabase project dashboard open
- [ ] Have HR System app running locally (or staging server)
- [ ] Test email address ready (for receiving test emails)
- [ ] Azure AD app registration details (for OAuth setup)

---

## Environment Setup

### 1. Set Supabase Edge Function Secrets

**Location:** Supabase Dashboard → Project Settings → Edge Functions → Secrets

**Add these variables:**

```
OFFICE365_EMAIL: kanjung@tlogical.com
OFFICE365_PASSWORD: kanjung
APP_URL: http://localhost:5173 (local) or https://your-domain.com (production)
```

### 2. Verify Secrets are Set

In terminal:
```bash
supabase secrets list
```

Expected output:
```
Name                    Value
─────────────────────────────────────────
OFFICE365_EMAIL         kanjung@tlogical.com
OFFICE365_PASSWORD      ••••••••
APP_URL                 http://localhost:5173
```

### 3. Deploy Updated Functions

```bash
cd /path/to/hr-harmony-hub-main\ 2

# Deploy the functions that use Office365
supabase functions deploy create-employee-user
supabase functions deploy reset-user-password

# Wait for deployment to complete
# You should see ✓ Function deployed successfully
```

---

## Test Office365 SMTP

### Test 1: Direct SMTP Connection

**Prepare:** Have your email address ready to receive test email

**Steps:**

1. **Open a Terminal**

```bash
cd /path/to/hr-harmony-hub-main\ 2
```

2. **Run SMTP Test Script**

```bash
deno run --allow-env --allow-net supabase/functions/test-office365-smtp.ts
```

3. **Expected Output:**

```
🔧 Testing Office365 SMTP Configuration...

📋 Configuration Details:
  Server: smtp.office365.com
  Port: 587
  TLS: Enabled
  Username: kanjung@tlogical.com
  Test Email: [your email]

🔌 Connecting to Office365 SMTP...
✅ Connection successful!

📧 Sending test email...
✅ Email sent successfully!

🎉 All tests passed! Office365 SMTP is working correctly.

📋 Next Steps:
  1. Check your email inbox for the test message
  ...
```

4. **Check Email Inbox**

   - Look for email with subject: "🧪 Office365 SMTP Test - ทดสอบการเชื่อมต่อ"
   - Verify email formatting is correct
   - If not in inbox, check spam folder

**Result:** ✅ If email received successfully
**Result:** ❌ If email not received, see [SMTP Troubleshooting](#smtp-troubleshooting)

---

### Test 2: Employee Account Creation with Email

**Prepare:** 
- App must be running (npm run dev)
- You must be logged in as Admin/HR
- Have a test email address

**Steps:**

1. **Navigate to Employees Page**
   - Login to app as Admin/HR
   - Go to "Employees" page
   - Click "Add New Employee"

2. **Create Test Employee**
   - Email: `testemployee001@example.com` (change as needed)
   - First Name: Test
   - Last Name: Employee
   - Employee Code: EMP-TEST-001
   - **Tick checkbox:** "ส่งอีเมล Welcome"

3. **Submit Form**
   - Click "สร้าง" button
   - Wait for success message

4. **Verify in Function Logs**
   - Open Supabase Dashboard
   - Functions → create-employee-user → Logs
   - Look for:
     ```
     📧 Sending welcome email to: testemployee001@example.com
     ✅ Email sent successfully!
     ```

5. **Check Email Inbox**
   - Look for email from: kanjung@tlogical.com
   - Subject: "🎉 ยินดีต้อนรับสู่ระบบ HR"
   - Contains employee credentials and login link

**Result:** ✅ If welcome email received
**Result:** ❌ If email not received, see [SMTP Troubleshooting](#smtp-troubleshooting)

---

## Test Office365 OAuth

### Test 1: OAuth Configuration Validation

**Steps:**

1. **Run Validation Script**

```bash
deno run --allow-env --allow-net supabase/functions/validate-office365-oauth-setup.ts
```

2. **Review Output**
   - Shows configuration checklist
   - Lists setup instructions
   - Provides testing checklist

3. **Complete Azure AD Configuration** (if not already done)
   - Go to portal.azure.com
   - Create App Registration in Azure AD
   - Add Redirect URI: `https://your-domain/auth/callback`
   - Generate Client ID and Secret
   - Add to Supabase Azure provider settings

### Test 2: Office365 OAuth Login Flow

**Prepare:**
- Have Office365 account (user@company.com)
- Employee email must be registered in system first
- App must be running

**Steps:**

1. **Register Employee Email First**
   - If not already registered, create employee record with Office365 email
   - Go to Employees → Add New Employee
   - Use your Office365 email (e.g., testuser@company.com)

2. **Open Auth Page**
   - Go to: `http://localhost:5173/auth` (or your app URL)
   - Click "เข้าสู่ระบบด้วย Office365" button

3. **Login with Office365**
   - You'll be redirected to Office365/Microsoft login
   - Enter your Office365 email and password
   - Authorize app access if prompted

4. **Verify Email Validation**
   - System should check if email exists in employees table
   - If email exists in employees table:
     - ✅ User account created/linked
     - ✅ Redirected to Dashboard
     - ✅ Welcome email sent (check inbox)
   - If email NOT in employees table:
     - ❌ Error message: "อีเมล xxx ไม่มีในระบบ"
     - User is NOT created

5. **Check App Logs**
   - Browser console for frontend errors
   - Supabase function logs for backend operations

**Result:** ✅ If login successful and redirected to dashboard
**Result:** ❌ If login fails, see [OAuth Troubleshooting](#oauth-troubleshooting)

### Test 3: Office365 Email Validation

**Prepare:**
- Have an Office365 account NOT registered in system
- Have an Office365 account that IS registered

**Step 1: Test with Unregistered Email**

1. Try to login with Office365 account that doesn't have matching employee record
2. Expected: Error message "อีเมล xxx ไม่มีในระบบ"
3. Result: ✅ Email validation working correctly

**Step 2: Test with Registered Email**

1. Ensure Office365 email is registered in employees table
2. Try to login with that Office365 account
3. Expected: Success, redirected to dashboard, welcome email sent
4. Result: ✅ Registered user can login

---

## Test Complete Workflow

### Complete User Onboarding Flow

**Scenario:** Admin creates new employee, sends welcome email, employee logs in via Office365

**Steps:**

1. **Admin Creates Employee Account**
   ```
   Email: newemployee@company.com (must be Office365 account)
   First Name: John
   Last Name: Doe
   Employee Code: EMP-2024-001
   ✓ Send Welcome Email
   ```

2. **System Automatically:**
   - Creates user account in Supabase Auth
   - Sends welcome email with temp password
   - Links to employee record
   - Assigns initial role (employee)

3. **Employee Receives Email**
   - Subject: "🎉 ยินดีต้อนรับสู่ระบบ HR"
   - Contains: temp password, login link
   - Check for: proper formatting, readable links

4. **Employee Logs In First Time**
   - Go to Auth page
   - Click "เข้าสู่ระบบด้วย Office365"
   - Login with Office365 credentials
   - System validates email in employees table
   - Redirected to Dashboard

5. **Employee Changes Password** (Optional)
   - Go to Profile page
   - Change password to secure password
   - Logout and login with new password

**Result:** ✅ Complete workflow successful

---

## Troubleshooting

### SMTP Troubleshooting

#### Issue: "Email sending failed"

**Check 1: Verify Secrets are Set**
```bash
supabase secrets list
```
Should show OFFICE365_EMAIL and OFFICE365_PASSWORD

**Check 2: Verify Credentials**
- Username: kanjung@tlogical.com (correct?)
- Password: kanjung (correct?)
- Try testing credentials manually in email client

**Check 3: Network Connectivity**
```bash
# Try to connect to Office365 SMTP
telnet smtp.office365.com 587
```
Should show "220 successful connection"

**Check 4: Function Logs**
- Supabase Dashboard → Functions → create-employee-user → Logs
- Look for specific error message
- Common errors:
  - "Auth failed" = wrong credentials
  - "Connection refused" = firewall blocked
  - "TLS error" = configuration issue

**Solution:** Re-check all environment variables and Office365 account permissions

#### Issue: Emails not arriving in inbox

**Check 1: Spam/Junk Folder**
- Office365 emails sometimes go to spam
- Add kanjung@tlogical.com to safe senders

**Check 2: Email Address**
- Verify recipient email is correct (typo?)
- Test with your own email first

**Check 3: Office365 Account Limits**
- Check if Office365 account has reached sending limits
- Check account security settings
- May need to enable "Less Secure Practices"

**Check 4: Function Execution**
- Verify function completed successfully
- Check logs for actual error messages
- Try with different email address

**Solution:** Check each item above, start from simplest to most complex

---

### OAuth Troubleshooting

#### Issue: "Email not in system" error on Office365 login

**Expected Behavior:** This is actually correct! It means:
- Email validation is working
- Email must be registered in employees table first

**Solution:** Register the email before login
1. Go to Employees page
2. Create employee with that Office365 email
3. Then try to login via Office365

#### Issue: OAuth redirect URI mismatch

**Error Message:** "redirect_uri_mismatch"

**Solution:**
1. Go to Azure Portal → App Registrations
2. Find your app registration
3. Go to "Redirect URIs"
4. Verify URI matches exactly:
   - Local: http://localhost:5173/auth/callback
   - Production: https://your-domain.com/auth/callback
5. Save changes
6. Test again

#### Issue: "Unauthorized OAuth provider"

**Error Message:** "OAuth provider 'azure' not configured"

**Solution:**
1. Supabase Dashboard → Authentication → Providers
2. Find Azure provider
3. Verify it's enabled
4. Check Client ID and Secret are filled in
5. Save changes
6. Redeploy and test

#### Issue: Office365 login loops infinitely

**Problem:** User gets redirected back to login repeatedly

**Solution:**
1. Check browser console for errors
2. Verify APP_URL environment variable
3. Check OAuth redirect configuration
4. Clear cookies and try again
5. Check function logs for validation errors

---

## Post-Testing Verification

After all tests pass, verify:

- [ ] SMTP Test: Email received successfully
- [ ] Employee Creation: Welcome email sent correctly
- [ ] OAuth Login: Office365 login redirects to dashboard
- [ ] Email Validation: Unregistered emails rejected
- [ ] Function Logs: No error messages
- [ ] No Errors: Browser console clean, no errors
- [ ] Performance: Pages load quickly
- [ ] Security: No credentials in logs/console

---

## Next Steps After Testing

1. **Deploy to Production**
   ```bash
   npm run build
   # Deploy frontend to production
   supabase functions deploy create-employee-user
   supabase functions deploy reset-user-password
   ```

2. **Configure Production Secrets**
   - Update APP_URL to production domain
   - Use production Office365 account if desired

3. **Monitor First Week**
   - Watch function logs for errors
   - Monitor email delivery
   - Check for user onboarding issues
   - Resolve any problems immediately

4. **Document Findings**
   - Note any unexpected behavior
   - Document any workarounds needed
   - Update this guide with new findings

---

## Support & Documentation

- 📖 Setup Guide: [OFFICE365_SETUP.md](./OFFICE365_SETUP.md)
- 🔧 Environment Variables: [ENV_SETUP.md](./ENV_SETUP.md)
- 📧 SMTP Test Script: `supabase/functions/test-office365-smtp.ts`
- 🔐 OAuth Validator: `supabase/functions/validate-office365-oauth-setup.ts`

---

**Last Updated:** March 22, 2026
**Status:** Ready for Testing ✅
