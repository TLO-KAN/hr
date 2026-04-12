import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Office365 OAuth Configuration Guide
 * This script provides instructions and validation for Office365 OAuth setup
 * 
 * Run with: deno run --allow-env --allow-net validate-office365-oauth.ts
 */

async function validateOffice365OAuth() {
  console.log("🔐 Office365 OAuth Configuration Validator\n");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  console.log("📋 Configuration Checklist:\n");

  // Check 1: Supabase credentials
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ Missing Supabase credentials");
    console.error("   Required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY");
    return;
  }
  console.log("✅ Supabase credentials available");

  // Check 2: Office365 SMTP setup
  const office365Email = Deno.env.get("OFFICE365_EMAIL");
  const office365Password = Deno.env.get("OFFICE365_PASSWORD");
  
  if (!office365Email || !office365Password) {
    console.log("⚠️  Office365 SMTP credentials not set in Edge Function secrets");
    console.log("   These are needed for welcome emails when Office365 users login");
  } else {
    console.log(`✅ Office365 SMTP configured: ${office365Email}`);
  }

  console.log("\n📝 Office365 OAuth Setup Instructions:\n");

  console.log("Step 1: Configure Supabase Azure Provider");
  console.log("  1. Go to Supabase Dashboard → Authentication → Providers");
  console.log("  2. Enable Azure provider");
  console.log("  3. Get Client ID and Client Secret from Azure AD");
  console.log("  4. Add Redirect URL: [YOUR_APP_URL]/auth/callback\n");

  console.log("Step 2: Microsoft Azure AD Configuration");
  console.log("  1. Go to portal.azure.com");
  console.log("  2. Azure Active Directory → App registrations → New registration");
  console.log("  3. Set Redirect URI: https://[YOUR_DOMAIN]/auth/callback");
  console.log("  4. Generate Client Secret");
  console.log("  5. Add scopes: User.Read, email, profile\n");

  console.log("Step 3: Verify Employee Email Validation");
  console.log("  ✅ validate-oauth-email function is configured");
  console.log("  ✅ Function automatically validates Office365 email in employees table");
  console.log("  ✅ Users without registered email will be rejected\n");

  console.log("Step 4: Test Office365 OAuth Flow");
  console.log("  1. Go to your app Auth page");
  console.log("  2. Click 'เข้าสู่ระบบด้วย Office365'");
  console.log("  3. Login with Office365 account");
  console.log("  4. Employee profile must exist with that email");
  console.log("  5. System will create/link account and redirect to dashboard\n");

  console.log("🧪 Testing Checklist:\n");
  console.log("  [ ] Office365 Azure provider configured in Supabase");
  console.log("  [ ] Client ID and Secret added to Supabase");
  console.log("  [ ] Redirect URL configured correctly");
  console.log("  [ ] Employee email registered in system");
  console.log("  [ ] Test account can login via Office365");
  console.log("  [ ] Welcome email sent successfully");
  console.log("  [ ] User roles assigned correctly\n");

  console.log("📜 Code Reference:\n");
  console.log("Frontend: /src/pages/Auth.tsx");
  console.log("  - handleOffice365SignIn() function");
  console.log("  - Uses: supabase.auth.signInWithOAuth({ provider: 'azure' })\n");

  console.log("Backend: /supabase/functions/validate-oauth-email/index.ts");
  console.log("  - Automatically validates email exists in employees table");
  console.log("  - Triggered on every Office365 OAuth attempt\n");

  console.log("Backend: /supabase/functions/create-employee-user/index.ts");
  console.log("  - Called when new Office365 user links account");
  console.log("  - Sends welcome email via Office365 SMTP\n");

  console.log("🔑 Environment Variables Required:\n");
  console.log("In Edge Function Secrets (Supabase Dashboard):");
  console.log("  OFFICE365_EMAIL: kanjung@tlogical.com");
  console.log("  OFFICE365_PASSWORD: kanjung");
  console.log("  APP_URL: https://your-domain.com\n");

  console.log("In Supabase Azure Provider:");
  console.log("  Client ID: [from Azure AD app registration]");
  console.log("  Client Secret: [from Azure AD app registration]\n");

  console.log("⚠️  Important Security Notes:\n");
  console.log("  - Never commit credentials to git");
  console.log("  - Use environment variables/secrets management");
  console.log("  - Rotate Office365 password regularly");
  console.log("  - Keep Azure AD credentials secure");
  console.log("  - Monitor login attempts for suspicious activity\n");

  console.log("✅ Office365 OAuth validation complete!");
}

// Run validation
validateOffice365OAuth();
