# Environment Variables Setup Guide

## Quick Setup Instructions

### 1. Set Supabase Edge Function Secrets

Go to your Supabase Dashboard:
1. Navigate to: **Project Settings** → **Edge Functions** → **Secrets**
2. Click **Add Secret**
3. Add each of these variables:

```
Name: OFFICE365_EMAIL
Value: kanjung@tlogical.com

Name: OFFICE365_PASSWORD
Value: kanjung

Name: APP_URL
Value: https://your-domain.com
(For local testing: http://localhost:5173)
```

### 2. Verify Variables in Supabase CLI

If you're using Supabase CLI, you can also set variables:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref <your-project-ref>

# Set environment variables
supabase secrets set OFFICE365_EMAIL=kanjung@tlogical.com
supabase secrets set OFFICE365_PASSWORD=kanjung
supabase secrets set APP_URL=https://your-domain.com

# List all secrets
supabase secrets list
```

### 3. Local Development (.env.local)

For local development with Edge Functions emulator:

Create `.env.local` in your project root:
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=eyJ... (from supabase start output)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (from supabase start output)
OFFICE365_EMAIL=kanjung@tlogical.com
OFFICE365_PASSWORD=kanjung
APP_URL=http://localhost:5173
```

Start local Supabase:
```bash
supabase start
```

## Variable Descriptions

| Variable | Value | Purpose |
|----------|-------|---------|
| `OFFICE365_EMAIL` | `kanjung@tlogical.com` | Office365 SMTP username for sending emails |
| `OFFICE365_PASSWORD` | `kanjung` | Office365 SMTP password for authentication |
| `APP_URL` | `https://your-domain.com` | Base URL for email links (login, reset password) |

## Verification Steps

### Test in Supabase Edge Function Console

1. Go to Supabase Dashboard → `create-employee-user` function
2. Click **Test**
3. In the request body, send:
```json
{
  "email": "test@example.com",
  "firstName": "Test",
  "lastName": "User",
  "employeeCode": "TEST001",
  "send_email": true
}
```

4. Check the function logs to verify:
   - ✅ SMTP connection successful
   - ✅ Email sent
   - ✅ No errors in logs

### Test Email Delivery

1. Create a test employee account from the app
2. Check your email inbox for welcome email
3. Click the login link in the email
4. Verify you can login to the system

## Troubleshooting

### "Environment variable not found" error

**Problem:** Functions can't access OFFICE365_EMAIL or OFFICE365_PASSWORD

**Solution:**
1. Go to Supabase Dashboard → Project Settings
2. Verify Edge Function Secrets are set (not Environment Variables)
3. Wait a few minutes after setting for changes to propagate
4. Redeploy the functions:
```bash
supabase functions deploy create-employee-user
supabase functions deploy reset-user-password
```

### "SMTP connection failed" error

**Problem:** Can't connect to smtp.office365.com

**Possible Causes:**
- Firewall blocking port 587
- Wrong credentials (username/password)
- Office365 account doesn't have SMTP enabled
- TLS not properly configured

**Solution:**
- Verify credentials are correct in secrets
- Check network connectivity to smtp.office365.com:587
- Enable SMTP in Office365 account settings
- Ensure TLS is enabled (port 587, not 465)

### Emails not sending but no error

**Problem:** Function succeeds but emails don't arrive

**Solution:**
1. Check email address is correct
2. Check spam/junk folder
3. Verify APP_URL is correct (needed for login links)
4. Check Office365 account sending limits
5. Enable less secure apps if needed
6. Check function logs for silent failures

## Security Best Practices

✅ **DO:**
- Store credentials in Supabase Secrets
- Use environment variables, not hardcoded values
- Rotate Office365 password periodically
- Limit Office365 account permissions to SMTP sending only
- Monitor all email sending for suspicious activity

❌ **DON'T:**
- Commit credentials to git repository
- Send credentials through chat/email
- Use generic/shared email accounts if possible
- Enable unnecessary permissions on Office365 account
- Test with real employee emails without permission

## For Production Deployment

When deploying to production:

1. **Update APP_URL to production domain:**
   ```bash
   supabase secrets set APP_URL=https://hr-production.com
   ```

2. **Use production Office365 account** (recommended):
   - Create dedicated service account: hr-notifications@company.com
   - Enable only SMTP plugin
   - Set strong password
   - Update secrets

3. **Enable email verification:**
   - All Office365 logins require email in employees table
   - Test with real Office365 accounts
   - Monitor first week for issues

4. **Deploy and test:**
   ```bash
   supabase functions deploy create-employee-user
   supabase functions deploy reset-user-password
   npm run build
   # Deploy frontend to production
   ```

5. **Post-deployment checks:**
   - [ ] Test employee account creation with email
   - [ ] Test password reset with email
   - [ ] Test Office365 OAuth login
   - [ ] Verify email validation for Office365
   - [ ] Monitor function logs for errors
   - [ ] Check email spam folder for deliverability issues
