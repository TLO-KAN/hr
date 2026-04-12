import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { getEmailConfig } from "./config/email-config.ts";

/**
 * Office365 SMTP Connection Test
 * This test script verifies Office365 SMTP connectivity and email sending capability
 * 
 * Run with: deno run --allow-env --allow-net test-office365-smtp.ts
 */

async function testOffice365SMTP() {
  console.log("🔧 Testing Office365 SMTP Configuration...\n");

  const config = getEmailConfig();

  console.log("📋 Configuration Details:");
  console.log(`  Server: ${config.smtpHost}`);
  console.log(`  Port: ${config.smtpPort}`);
  console.log(`  TLS: ${config.tlsEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Username: ${config.smtpUsername}`);
  console.log(`  Test Email: ${config.appUrl}\n`);

  try {
    console.log("🔌 Connecting to Office365 SMTP...");
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

    await client.connect();
    console.log("✅ Connection successful!\n");

    console.log("📧 Sending test email...");
    const testHtmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #0078D4; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">🧪 Office365 SMTP Test</h1>
        </div>
        <div style="background-color: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>สวัสดี</p>
          <p>นี่คือการทดสอบการเชื่อมต่อ Office365 SMTP</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0078D4;">
            <h3 style="margin-top: 0; color: #0078D4;">✅ Test Result</h3>
            <p>
              <strong>⏰ Time:</strong> ${new Date().toISOString()}<br>
              <strong>📧 From:</strong> ${smtpUsername}<br>
              <strong>📮 To:</strong> ${testEmail}
            </p>
            <p style="margin-top: 15px; font-size: 12px; color: #666;">
              ✅ Office365 SMTP is working correctly!
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
              If you received this email, Office365 SMTP integration is ready for production use.
            </p>
          </div>

          <div style="border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #666;">
            <p>HR System - Office365 Integration Test<br>
            <code style="background-color: #f0f0f0; padding: 5px 10px; border-radius: 4px;">test-office365-smtp.ts</code></p>
          </div>
        </div>
      </div>
    `;

    await client.send({
      from: config.smtpUsername,
      to: config.smtpUsername,
      subject: "🧪 Office365 SMTP Test - ทดสอบการเชื่อมต่อ",
      html: testHtmlContent,
      headers: new Map([
        ["X-Service", "HR-System-Test"],
      ]),
    });

    console.log("✅ Email sent successfully!\n");

    await client.close();
    console.log("🎉 All tests passed! Office365 SMTP is working correctly.\n");

    console.log("📋 Next Steps:");
    console.log("  1. Check your email inbox for the test message");
    console.log("  2. If received, Office365 SMTP is ready for production");
    console.log("  3. Deploy the functions to Supabase:");
    console.log("     - supabase functions deploy create-employee-user");
    console.log("     - supabase functions deploy reset-user-password");
    console.log("  4. Test the system with actual employee account creation\n");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error("\n🔍 Troubleshooting:");
    console.error("  - Check Office365 credentials in config/email-config.ts");
    console.error("  - Verify network allows outbound SMTP");
    console.error("  - Ensure TLS is enabled for port 587");
    console.error("  - Check if account has mail sending permissions");
    console.error("\n  Error Details:", error);
  }
}

// Run test
testOffice365SMTP();
