/**
 * Email Configuration
 * จัดการตั้งค่า Office365 Email ที่ใช้ร่วมกันในทั้ง Edge Functions
 * 
 * ⚠️ แก้ไข credentials เพียงที่ไฟล์นี้เท่านั้น
 */

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  tlsEnabled: boolean;
  appUrl: string;
}

/**
 * ดึงค่า configuration สำหรับ email
 */
export function getEmailConfig(): EmailConfig {
  return {
    // SMTP Server Configuration
    smtpHost: process.env.OFFICE365_SMTP_HOST || "smtp.office365.com",
    smtpPort: parseInt(process.env.OFFICE365_SMTP_PORT || "587", 10),
    smtpUsername: process.env.OFFICE365_EMAIL || "allsolution@tlogical.com",
    smtpPassword: process.env.OFFICE365_PASSWORD || "Y2GqrhqdH0ZUMp9",
    tlsEnabled: process.env.OFFICE365_TLS_ENABLED !== "false", // default true
    
    // Application URL for email links
    appUrl: process.env.APP_URL || "http://localhost:5173",
  };
}

/**
 * ตัวอย่างการแสดง configuration (สำหรับ debug)
 */
export function logEmailConfig(): void {
  const config = getEmailConfig();
  console.log("📧 Email Configuration:");
  console.log(`  SMTP Host: ${config.smtpHost}`);
  console.log(`  SMTP Port: ${config.smtpPort}`);
  console.log(`  Username: ${config.smtpUsername}`);
  console.log(`  TLS: ${config.tlsEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  App URL: ${config.appUrl}`);
}
