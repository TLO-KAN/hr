import nodemailer from 'nodemailer';
import logger from './logger.js';

function formatDateOnly(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function buildLeavePeriodLabel(data) {
  const startDate = formatDateOnly(data.startDate);
  const endDate = formatDateOnly(data.endDate);
  const startTime = normalizeTimeLabel(data.startTime, '08:30');
  const endTime = normalizeTimeLabel(data.endTime, '17:30');
  const slot = String(data.slotLabel || 'เต็มวัน').replace(/\s*\(.*\)\s*$/, '');

  return `${startDate} - ${endDate} (${slot} ${startTime} - ${endTime} )`;
}

function normalizeTimeLabel(timeValue, fallback = null) {
  if (!timeValue) return fallback;
  const str = String(timeValue);
  const hhmm = str.slice(0, 5);
  return hhmm;
}

// Lazy transporter: created on first use so that dotenv has already loaded
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const smtpHost = process.env.SMTP_HOST || process.env.OFFICE365_SMTP_HOST || 'smtp.office365.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || process.env.OFFICE365_SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER || process.env.OFFICE365_EMAIL;
  const smtpPass = process.env.SMTP_PASS || process.env.OFFICE365_PASSWORD;

  _transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
  });

  return _transporter;
}

// Export for use by index.ts startup check
export function verifyEmailService() {
  getTransporter().verify((error) => {
    if (error) {
      logger.warn(`Email service not available: ${error.message}`);
    } else {
      logger.info('✉️ Email service ready');
    }
  });
}

function getFrom() {
  const smtpUser = process.env.SMTP_USER || process.env.OFFICE365_EMAIL;
  return process.env.SMTP_FROM || smtpUser || 'noreply@hr-system.local';
}

function normalizeApprovalLink(data) {
  if (data?.approvalLink) return data.approvalLink;
  const normalizedAppUrl = String(data?.appUrl || 'http://localhost:5173').replace(/\/$/, '');
  return `${normalizedAppUrl}/leave/approval`;
}

const emailTemplates = {
  welcome: (data) => ({
    subject: 'ยินดีต้อนรับเข้าสู่ระบบ People Management System (PMS)',
    html: `
      <h2>ยินดีต้อนรับ ${data.firstName} ${data.lastName}</h2>
      <p>บัญชีผู้ใช้ของคุณได้ถูกสร้างขึ้นแล้ว</p>
      <p><strong>ชื่อผู้ใช้:</strong> ${data.username}</p>
      <p><strong>รหัสผ่าน:</strong> ${data.password}</p>
      <p><strong>บทบาท:</strong> ${data.role}</p>
      <p><a href="${data.appUrl}">เข้าสู่ระบบ</a></p>
      <p><em>โปรดเปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งแรก</em></p>
    `
  }),

  resetPassword: (data) => ({
    subject: 'รีเซ็ตรหัสผ่าน People Management System (PMS)',
    html: `
      <h2>รีเซ็ตรหัสผ่านของคุณ</h2>
      <p>คลิกลิงก์นี้เพื่อรีเซ็ตรหัสผ่าน:</p>
      <p><a href="${data.resetLink}">รีเซ็ตรหัสผ่าน</a></p>
      <p>ลิงก์นี้จะหมดอายุใน 30 นาที</p>
    `
  }),

  leaveRequestApproval: (data) => ({
    subject: `[ขออนุมัติลา] ${data.employeeName} - ${data.leaveType} (People Management System (PMS))`,
    text: [
      'เรียน ผู้อนุมัติ,',
      '',
      'พนักงานได้ส่งคำขอลางานเข้ามาในระบบ กรุณาตรวจสอบรายละเอียดด้านล่างและดำเนินการอนุมัติ',
      '',
      `พนักงาน: ${data.employeeName}`,
      `ประเภทการลา: ${data.leaveType}`,
      `ช่วงเวลา: ${buildLeavePeriodLabel(data)}`,
      `รายละเอียดการลา: ${data.reason || '-'}`,
      '',
      `ตรวจสอบและอนุมัติได้ที่: ${normalizeApprovalLink(data)}`,
      `เลขที่ใบลา: ${data.leaveRequestId}`
    ].join('\n'),
    html: `
      <div style="font-family: 'Sarabun', Tahoma, sans-serif; line-height: 1.6; color: #1f2937;">
        <p>เรียน ผู้อนุมัติ,</p>
        <p>พนักงานได้ส่งคำขอลางานเข้ามาในระบบ กรุณาตรวจสอบรายละเอียดด้านล่างและดำเนินการอนุมัติ</p>

        <p><strong>พนักงาน:</strong> ${data.employeeName}</p>
        <p><strong>ประเภทการลา:</strong> ${data.leaveType}</p>
        <p><strong>ช่วงเวลา:</strong> ${buildLeavePeriodLabel(data)}</p>
        <p><strong>รายละเอียดการลา:</strong> ${data.reason || '-'}</p>
        <p>
          <a
            href="${normalizeApprovalLink(data)}"
            style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-weight: 600;"
          >
            อนุมัติใบลา
          </a>
        </p>
        <p style="font-size: 12px; color: #6b7280;">หากยังไม่ได้เข้าสู่ระบบ ระบบจะพาไปหน้าเข้าสู่ระบบก่อน และกลับมาหน้าอนุมัติใบลาให้อัตโนมัติ</p>
      </div>
    `
  }),

  leaveRequestApproved: (data) => ({
    subject: `ใบลาได้รับการอนุมัติ: ${data.leaveType}`,
    html: `
      <h2>ใบลาของคุณได้รับการอนุมัติแล้ว</h2>
      <p><strong>ประเภทการลา:</strong> ${data.leaveType}</p>
      <p><strong>วันเริ่มต้น:</strong> ${data.startDate}</p>
      <p><strong>วันสิ้นสุด:</strong> ${data.endDate}</p>
      <p><strong>จำนวนวัน:</strong> ${data.totalDays}</p>
      <p>ขอให้มีวันที่ดีขึ้น!</p>
    `
  }),

  leaveRequestRejected: (data) => ({
    subject: `ใบลาถูกปฏิเสธ: ${data.leaveType}`,
    html: `
      <h2>ใบลาของคุณถูกปฏิเสธ</h2>
      <p><strong>ประเภทการลา:</strong> ${data.leaveType}</p>
      <p><strong>วันเริ่มต้น:</strong> ${data.startDate}</p>
      <p><strong>วันสิ้นสุด:</strong> ${data.endDate}</p>
      <p><strong>เหตุผล:</strong> ${data.reason || 'ไม่ระบุ'}</p>
      <p>โปรดติดต่อแผนกทรัพยากรบุคคลสำหรับข้อมูลอื่นเพิ่มเติม</p>
    `
  })
};

export const sendWelcomeEmail = async (data) => {
  try {
    const template = emailTemplates.welcome(data);
    await getTransporter().sendMail({
      from: getFrom(),
      to: data.email,
      ...template
    });
    logger.info(`Welcome email sent to ${data.email}`);
  } catch (error) {
    logger.error(`Failed to send welcome email: ${error.message}`);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const template = emailTemplates.resetPassword({ resetLink });
    
    await getTransporter().sendMail({
      from: getFrom(),
      to: email,
      ...template
    });
    logger.info(`Password reset email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send password reset email: ${error.message}`);
    throw error;
  }
};

export const sendLeaveRequestEmail = async (type, data) => {
  try {
    const template = emailTemplates[type];
    if (!template) {
      throw new Error(`Unknown email template: ${type}`);
    }

    const emailContent = template(data);
    await getTransporter().sendMail({
      from: getFrom(),
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      attachments: Array.isArray(data.attachments) && data.attachments.length > 0
        ? data.attachments
        : undefined,
      ...emailContent
    });
    
    logger.info(`Leave request email (${type}) sent to ${data.to}`);
  } catch (error) {
    logger.error(`Failed to send leave request email: ${error.message}`);
    throw error;
  }
};

export default {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendLeaveRequestEmail,
  verifyEmailService
};