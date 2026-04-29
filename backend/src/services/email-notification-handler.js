// ===== Email Notification Handler =====
// Centralized handler for all leave-related email notifications
// Includes: leave submission, approval, rejection, reminders

const nodemailer = require('nodemailer');
const { getPool } = require('./src/config/db-pool.js');

const pool = getPool();

// Email transporter (reuse from server.js)
const transporter = nodemailer.createTransport({
  host: process.env.OFFICE365_SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.OFFICE365_SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.OFFICE365_EMAIL || 'allsolution@tlogical.com',
    pass: process.env.OFFICE365_PASSWORD || 'Y2GqrhqdH0ZUMp9',
  },
  tls: {
    ciphers: 'SSLv3',
  },
});

/**
 * Log email attempt to database
 */
async function logEmailAttempt(recipientEmail, subject, leaveRequestId, status, errorMessage = null) {
  try {
    await pool.query(
      `INSERT INTO email_logs (recipient_email, subject, leave_request_id, status, error_message, sent_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [recipientEmail, subject, leaveRequestId, status, errorMessage]
    );
  } catch (error) {
    console.error('🚨 Failed to log email attempt:', error.message);
  }
}

/**
 * Resolve dynamic email tags to actual email addresses
 */
async function resolveDynamicEmails(tags, employeeId) {
  const emailMap = {};

  try {
    // Get employee info
    const empRes = await pool.query(
      `SELECT manager_id, department_id FROM employees WHERE id = $1`,
      [employeeId]
    );

    if (empRes.rows.length === 0) return emailMap;

    const employee = empRes.rows[0];

    // Get manager email
    if (employee.manager_id) {
      const managerRes = await pool.query(
        `SELECT COALESCE(u.email, e.email) as email
         FROM employees e
         LEFT JOIN user_auth u ON u.id = e.user_id
         WHERE e.id = $1`,
        [employee.manager_id]
      );
      if (managerRes.rows.length > 0) {
        emailMap.manager_email = managerRes.rows[0].email;
      }
    }

    // Get HR emails (from notification_settings default)
    const hrRes = await pool.query(
      `SELECT DISTINCT to_list FROM notification_settings WHERE department_id IS NULL LIMIT 1`
    );
    if (hrRes.rows.length > 0 && hrRes.rows[0].to_list) {
      emailMap.hr_email = hrRes.rows[0].to_list.split(',')[0].trim();
    }

    // Get department head
    if (employee.department_id || employee.department) {
      const deptFilter = employee.department_id
        ? `e.department = (SELECT name FROM departments WHERE id = $1::uuid LIMIT 1)`
        : `e.department = $1`;
      const deptParam = employee.department_id || employee.department;
      const deptHeadRes = await pool.query(
        `SELECT COALESCE(u.email, e.email) as email FROM user_auth u
         RIGHT JOIN employees e ON e.user_id = u.id
         WHERE ${deptFilter} AND e.position ILIKE '%head%' LIMIT 1`,
        [deptParam]
      );
      if (deptHeadRes.rows.length > 0) {
        emailMap.dept_head_email = deptHeadRes.rows[0].email;
      }
    }
  } catch (error) {
    console.error('🚨 Error resolving dynamic emails:', error.message);
  }

  return emailMap;
}

/**
 * Replace dynamic tags in email list with actual emails
 */
function replaceTags(emailList, tagMap) {
  if (!emailList) return [];

  return emailList
    .split(',')
    .map(email => email.trim())
    .map(email => {
      let resolved = email;
      Object.keys(tagMap).forEach(tag => {
        resolved = resolved.replace(`{${tag}}`, tagMap[tag] || '');
      });
      return resolved;
    })
    .filter(email => email && email.includes('@'));
}

/**
 * Generate leave request email body with HTML template
 */
function generateLeaveRequestEmail(leaveData, actionType = 'submit') {
  const { employeeName, leaveType, startDate, endDate, reason, managerName, approvalLink } = leaveData;

  const statusColor = actionType === 'submit' ? '#FFA500' : actionType === 'approved' ? '#28A745' : '#DC3545';
  const statusText = actionType === 'submit' ? 'รอการพิจารณา' : actionType === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';

  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 4px 4px 0 0; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .section { margin: 15px 0; }
          .label { font-weight: bold; color: #667eea; }
          .status { background: ${statusColor}; color: white; padding: 10px; border-radius: 4px; text-align: center; font-weight: bold; margin: 10px 0; }
          .button-group { margin: 20px 0; text-align: center; }
          .btn { display: inline-block; padding: 12px 30px; margin: 5px; border-radius: 4px; text-decoration: none; font-weight: bold; }
          .btn-approve { background: #28A745; color: white; }
          .btn-reject { background: #DC3545; color: white; }
          .footer { text-align: center; font-size: 12px; color: #999; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📋 ระบบการลา - แจ้งเตือนใบลาใหม่</h2>
          </div>
          <div class="content">
            <div class="section">
              <p>สวัสดี${managerName ? ' ' + managerName : ''},</p>
              <p>${employeeName} ได้ส่งใบลา${leaveType}เพื่อขออนุมัติ</p>
            </div>

            <div class="status">${statusText}</div>

            <div class="section">
              <div><span class="label">👤 ชื่อพนักงาน:</span> ${employeeName}</div>
              <div><span class="label">🏷️ ประเภทการลา:</span> ${leaveType}</div>
              <div><span class="label">📅 วันเริ่ม:</span> ${startDate}</div>
              <div><span class="label">📅 วันสิ้นสุด:</span> ${endDate}</div>
              <div><span class="label">💬 เหตุผล:</span> ${reason}</div>
            </div>

            ${actionType === 'submit' ? `
              <div class="button-group">
                <a href="${approvalLink}?action=approve" class="btn btn-approve">✓ อนุมัติ</a>
                <a href="${approvalLink}?action=reject" class="btn btn-reject">✗ ปฏิเสธ</a>
              </div>
            ` : ''}

            ${actionType === 'approved' ? `
              <div class="section" style="background: #d4edda; padding: 10px; border-radius: 4px; border-left: 4px solid #28A745;">
                <p style="color: #155724; margin: 0;">✓ ใบลานี้ได้รับการอนุมัติแล้ว</p>
              </div>
            ` : actionType === 'rejected' ? `
              <div class="section" style="background: #f8d7da; padding: 10px; border-radius: 4px; border-left: 4px solid #DC3545;">
                <p style="color: #721c24; margin: 0;">✗ ใบลานี้ถูกปฏิเสธ</p>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>นี่คือเมลโดยอัตโนมัติจากระบบการลา กรุณาอย่าตอบกลับเมลนี้</p>
            <p>สำหรับความช่วยเหลือ โปรดติดต่อแผนกทรัพยากรบุคคล</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Send email notification when leave is submitted
 */
async function sendLeaveSubmitionNotification(leaveRequestId, employeeId, leaveData) {
  try {
    console.log(`📧 Sending leave submission notification for request ${leaveRequestId}`);

    // Get employee info
    const empRes = await pool.query(
      `SELECT COALESCE(u.email, e.email) as employee_email, e.first_name, e.last_name,
              e.manager_id, e.department_id, e.department
       FROM employees e
       LEFT JOIN user_auth u ON e.user_id = u.id
       WHERE e.id = $1`,
      [employeeId]
    );

    if (empRes.rows.length === 0) {
      console.error(`❌ Employee ${employeeId} not found`);
      return false;
    }

    const employee = empRes.rows[0];
    const employeeName = `${employee.first_name} ${employee.last_name}`;

    // Get notification settings for this department
    const settingsRes = await pool.query(
      `SELECT to_list, cc_list, bcc_list FROM notification_settings
       WHERE department_id = $1 OR department_id IS NULL
       ORDER BY department_id DESC LIMIT 1`,
      [employee.department_id]
    );

    if (settingsRes.rows.length === 0) {
      console.warn(`⚠️ No notification settings found for department ${employee.department_id}`);
      await logEmailAttempt(
        process.env.OFFICE365_EMAIL,
        `Leave Submission: ${employeeName}`,
        leaveRequestId,
        'failed',
        'No notification settings configured'
      );
      return false;
    }

    const settings = settingsRes.rows[0];
    const tagMap = await resolveDynamicEmails({}, employeeId);

    // Get actual email addresses
    const toEmails = replaceTags(settings.to_list, tagMap);
    const ccEmails = replaceTags(settings.cc_list, tagMap);
    const bccEmails = replaceTags(settings.bcc_list, tagMap);

    if (toEmails.length === 0) {
      console.warn(`⚠️ No valid recipient emails configured`);
      await logEmailAttempt(
        'UNKNOWN',
        `Leave Submission: ${employeeName}`,
        leaveRequestId,
        'failed',
        'No valid recipient emails'
      );
      return false;
    }

    // Get manager name
    let managerName = '';
    if (employee.manager_id) {
      const mgrRes = await pool.query(
        `SELECT first_name, last_name FROM employees WHERE id = $1`,
        [employee.manager_id]
      );
      if (mgrRes.rows.length > 0) {
        managerName = `${mgrRes.rows[0].first_name} ${mgrRes.rows[0].last_name}`;
      }
    }

    // Generate email content
    const mailOptions = {
      from: process.env.OFFICE365_EMAIL,
      to: toEmails.join(','),
      cc: ccEmails.join(',') || undefined,
      bcc: bccEmails.join(',') || undefined,
      subject: `📋 ใบลาใหม่จาก ${employeeName}`,
      html: generateLeaveRequestEmail(
        { ...leaveData, employeeName, managerName, approvalLink: `${process.env.APP_URL}/leave/approval` },
        'submit'
      ),
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    // Log successful email
    for (const email of toEmails) {
      await logEmailAttempt(email, mailOptions.subject, leaveRequestId, 'sent');
    }

    console.log(`✅ Leave submission email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`🚨 Error sending leave submission notification:`, error.message);
    await logEmailAttempt(
      'ERROR',
      `Leave Submission Notification`,
      leaveRequestId,
      'error',
      error.message
    );
    return false;
  }
}

/**
 * Send email notification for approval/rejection
 */
async function sendApprovalNotification(leaveRequestId, employeeId, leaveData, approvalStatus, rejectionReason = null) {
  try {
    console.log(`📧 Sending ${approvalStatus} notification for request ${leaveRequestId}`);

    // Get employee email
    const empRes = await pool.query(
      `SELECT COALESCE(u.email, e.email) as email, e.first_name, e.last_name FROM employees e
       LEFT JOIN user_auth u ON e.user_id = u.id WHERE e.id = $1`,
      [employeeId]
    );

    if (empRes.rows.length === 0) return false;

    const employee = empRes.rows[0];
    const employeeName = `${employee.first_name} ${employee.last_name}`;

    // Send email to employee
    const htmlContent = generateLeaveRequestEmail(
      { ...leaveData, employeeName, managerName: '' },
      approvalStatus === 'approved' ? 'approved' : 'rejected'
    );

    const subjectPrefix = approvalStatus === 'approved' ? '✓ อนุมัติ' : '✗ ปฏิเสธ';

    const mailOptions = {
      from: process.env.OFFICE365_EMAIL,
      to: employee.email,
      subject: `${subjectPrefix}: ${leaveData.leaveType}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    await logEmailAttempt(employee.email, mailOptions.subject, leaveRequestId, 'sent');

    // If rejected, also notify HR/CC
    if (approvalStatus === 'rejected') {
      const settingsRes = await pool.query(
        `SELECT cc_list FROM notification_settings WHERE department_id IS NULL LIMIT 1`
      );
      if (settingsRes.rows.length > 0 && settingsRes.rows[0].cc_list) {
        const hrEmails = replaceTags(settingsRes.rows[0].cc_list, {});
        if (hrEmails.length > 0) {
          const hrMailOptions = {
            from: process.env.OFFICE365_EMAIL,
            to: hrEmails.join(','),
            subject: `📋 ใบลาถูกปฏิเสธ: ${employeeName}`,
            html: `<p>ใบลา${leaveData.leaveType}ของ ${employeeName} ได้ถูกปฏิเสธ</p>
                   <p><strong>เหตุผล:</strong> ${rejectionReason || 'ไม่มี'}</p>`,
          };
          await transporter.sendMail(hrMailOptions);
          await logEmailAttempt(hrEmails[0], hrMailOptions.subject, leaveRequestId, 'sent');
        }
      }
    }

    console.log(`✅ Approval notification email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`🚨 Error sending approval notification:`, error.message);
    await logEmailAttempt('ERROR', `${approvalStatus} Notification`, leaveRequestId, 'error', error.message);
    return false;
  }
}

module.exports = {
  sendLeaveSubmitionNotification,
  sendApprovalNotification,
  logEmailAttempt,
  resolveDynamicEmails,
  generateLeaveRequestEmail,
};
