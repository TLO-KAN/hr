/**
 * Email template generator for leave request notifications
 * Used to create HTML emails sent to notified recipients when a leave request is submitted
 */

export interface LeaveRequestEmailData {
  employeeName: string;
  employeeEmail: string;
  departmentName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  requesterEmail?: string;
  approvalLink?: string;
  rejectLink?: string;
}

export function generateLeaveRequestEmailHTML(data: LeaveRequestEmailData): string {
  const {
    employeeName,
    employeeEmail,
    departmentName,
    leaveType,
    startDate,
    endDate,
    totalDays,
    reason,
    approvalLink,
    rejectLink,
  } = data;

  const hasApprovalButtons = approvalLink && rejectLink;

  return `
<!DOCTYPE html>
<html lang="th" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ใบขอลา</title>
    <style type="text/css">
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            padding: 30px 20px;
            text-align: center;
        }
        
        .email-header h1 {
            font-size: 28px;
            margin-bottom: 5px;
            font-weight: 600;
        }
        
        .email-header p {
            font-size: 14px;
            opacity: 0.9;
        }
        
        .email-body {
            padding: 30px 20px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 20px;
            color: #222;
        }
        
        .greeting strong {
            color: #667eea;
        }
        
        .info-section {
            background-color: #f9f9f9;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
            border-radius: 3px;
        }
        
        .info-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #efefef;
        }
        
        .info-row:last-child {
            border-bottom: none;
        }
        
        .info-label {
            font-weight: 600;
            color: #555;
            width: 120px;
            min-width: 120px;
        }
        
        .info-value {
            color: #333;
            flex: 1;
            word-break: break-word;
        }
        
        .reason-section {
            margin: 20px 0;
            padding: 15px;
            background-color: #fafafa;
            border-radius: 3px;
        }
        
        .reason-label {
            font-weight: 600;
            color: #555;
            margin-bottom: 8px;
            display: block;
        }
        
        .reason-text {
            color: #333;
            line-height: 1.6;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .action-section {
            margin: 30px 0;
            text-align: center;
        }
        
        .button {
            display: inline-block;
            padding: 12px 24px;
            margin: 0 10px;
            border-radius: 4px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .button-approve {
            background-color: #22c55e;
            color: #ffffff;
        }
        
        .button-approve:hover {
            background-color: #16a34a;
        }
        
        .button-reject {
            background-color: #ef4444;
            color: #ffffff;
        }
        
        .button-reject:hover {
            background-color: #dc2626;
        }
        
        .divider {
            height: 1px;
            background-color: #efefef;
            margin: 20px 0;
        }
        
        .email-footer {
            background-color: #f9f9f9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #efefef;
        }
        
        .footer-text {
            margin: 5px 0;
        }
        
        .highlight {
            background-color: #fef3c7;
            padding: 2px 4px;
            border-radius: 2px;
        }
        
        @media (max-width: 600px) {
            .email-container {
                border-radius: 0;
            }
            
            .info-row {
                flex-direction: column;
            }
            
            .info-label {
                width: 100%;
                margin-bottom: 5px;
            }
            
            .button {
                display: block;
                margin: 10px 0;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="email-header">
            <h1>📋 ใบขอลา</h1>
            <p>Leave Request Notification</p>
        </div>
        
        <!-- Body -->
        <div class="email-body">
            <p class="greeting">
                สวัสดีครับ/ค่ะ<br>
                <strong>มีการขอลาใหม่เข้ามา</strong> ที่ต้องการการตรวจสอบ
            </p>
            
            <!-- Employee Information -->
            <div class="info-section">
                <div class="info-row">
                    <span class="info-label">👤 พนักงาน:</span>
                    <span class="info-value"><strong>${employeeName}</strong></span>
                </div>
                <div class="info-row">
                    <span class="info-label">📧 อีเมล:</span>
                    <span class="info-value">${employeeEmail}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">🏢 ฝ่าย:</span>
                    <span class="info-value">${departmentName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">🎯 ประเภทลา:</span>
                    <span class="info-value"><span class="highlight">${leaveType}</span></span>
                </div>
                <div class="info-row">
                    <span class="info-label">📅 วันที่ขอ:</span>
                    <span class="info-value">${startDate} ถึง ${endDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">⏱️ จำนวนวัน:</span>
                    <span class="info-value"><strong>${totalDays} วัน</strong></span>
                </div>
            </div>
            
            <!-- Reason -->
            ${
              reason
                ? `
            <div class="reason-section">
                <span class="reason-label">📝 เหตุผล:</span>
                <div class="reason-text">${escapeHtml(reason)}</div>
            </div>
            `
                : ''
            }
            
            <!-- Action Buttons -->
            ${
              hasApprovalButtons
                ? `
            <div class="action-section">
                <p style="margin-bottom: 15px; color: #666; font-size: 14px;">
                    กรุณากดปุ่มด้านล่างเพื่ออนุมัติหรือปฏิเสธการขอลา
                </p>
                <a href="${approvalLink}" class="button button-approve">✓ อนุมัติ</a>
                <a href="${rejectLink}" class="button button-reject">✗ ปฏิเสธ</a>
            </div>
            `
                : ''
            }
            
            <div class="divider"></div>
            
            <p style="font-size: 13px; color: #666; line-height: 1.6;">
                📌 <strong>หมายเหตุ:</strong> นี่คือการแจ้งเตือนโดยอัตโนมัติจากระบบจัดการการลา 
                กรุณาตอบสนองต่อคำขอนี้ภายในเวลาที่กำหนด หากคุณมีคำถาม 
                โปรดติดต่อฝ่ายทรัพยากรบุคคล
            </p>
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
            <p class="footer-text">
                <strong>ระบบจัดการการลา (HR Leave Management System)</strong>
            </p>
            <p class="footer-text">
                © ${new Date().getFullYear()} All rights reserved.
            </p>
            <p class="footer-text" style="margin-top: 10px; color: #999;">
                This is an automated email. Please do not reply to this address.
            </p>
        </div>
    </div>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML special characters to prevent injection
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Generate plain text version of the email
 */
export function generateLeaveRequestEmailText(data: LeaveRequestEmailData): string {
  return `
สวัสดีครับ/ค่ะ

มีการขอลาใหม่เข้ามา ที่ต้องการการตรวจสอบ

─────────────────────────────────────
📋 รายละเอียดการขอลา
─────────────────────────────────────

👤 พนักงาน: ${data.employeeName}
📧 อีเมล: ${data.employeeEmail}
🏢 ฝ่าย: ${data.departmentName}
🎯 ประเภทลา: ${data.leaveType}
📅 วันที่ขอ: ${data.startDate} ถึง ${data.endDate}
⏱️ จำนวนวัน: ${data.totalDays} วัน

${data.reason ? `📝 เหตุผล:\n${data.reason}\n` : ''}

─────────────────────────────────────

📌 หมายเหตุ: นี่คือการแจ้งเตือนโดยอัตโนมัติจากระบบจัดการการลา
กรุณาตอบสนองต่อคำขอนี้ภายในเวลาที่กำหนด 
หากคุณมีคำถาม โปรดติดต่อฝ่ายทรัพยากรบุคคล

─────────────────────────────────────
ระบบจัดการการลา (HR Leave Management System)
© ${new Date().getFullYear()} All rights reserved.
─────────────────────────────────────

This is an automated email. Please do not reply to this address.
  `.trim();
}
