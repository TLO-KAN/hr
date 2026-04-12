/**
 * Notification Service
 * 
 * Handles:
 * - Email sending via Office365 SMTP
 * - Template variable substitution
 * - Recipient lookup from notification_settings table
 * - Email notifications for leave requests, approvals, etc.
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { query } from '../config/db.js';

dotenv.config();

interface EmailTemplate {
  subject: string;
  body: string;
  variables?: Record<string, string>;
}

interface NotificationSetting {
  id: string;
  department: string;
  role: string;
  email: string;
  notify_on_leave_request?: boolean;
  notify_on_approval?: boolean;
  notify_on_rejection?: boolean;
}

export class NotificationService {
  private transporter: any;
  private configured = false;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize Office365 SMTP Transporter
   */
  private initializeTransporter(): void {
    try {
      const smtpHost = process.env.SMTP_HOST || process.env.OFFICE365_SMTP_HOST || 'smtp.office365.com';
      const smtpPort = parseInt(process.env.SMTP_PORT || process.env.OFFICE365_SMTP_PORT || '587');
      const smtpUser = process.env.SMTP_USER || process.env.OFFICE365_EMAIL || '';
      const smtpPass = process.env.SMTP_PASS || process.env.OFFICE365_PASSWORD || '';

      if (!smtpUser || !smtpPass) {
        console.warn('⚠️  SMTP credentials not configured - email notifications disabled');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          cipherSuites: 'DEFAULT:!DH', // Required for Office365
        },
      } as any);

      // Verify connection
      this.transporter.verify((error: any, success: any) => {
        if (error) {
          console.error('❌ SMTP connection error:', error);
        } else {
          console.log('✅ SMTP connection verified');
          this.configured = true;
        }
      });
    } catch (error) {
      console.error('❌ SMTP initialization error:', error);
    }
  }

  /**
   * Get notification recipients from notification_settings table
   * 
   * Filters by:
   * - Department (if applicable)
   * - Role (e.g., manager, HR, department head)
   * - Notification type (leave_request, approval, rejection)
   */
  async getNotificationRecipients(
    notificationType: 'leave_request' | 'approval' | 'rejection',
    department?: string,
    role?: string
  ): Promise<string[]> {
    try {
      let query_text = `
        SELECT DISTINCT email FROM notification_settings 
        WHERE 1=1
      `;
      const params: any[] = [];

      // Add filters based on notification type
      if (notificationType === 'leave_request') {
        query_text += ` AND notify_on_leave_request = true`;
      } else if (notificationType === 'approval') {
        query_text += ` AND notify_on_approval = true`;
      } else if (notificationType === 'rejection') {
        query_text += ` AND notify_on_rejection = true`;
      }

      // Filter by department if provided
      if (department) {
        params.push(department);
        query_text += ` AND department = $${params.length}`;
      }

      // Filter by role if provided
      if (role) {
        params.push(role);
        query_text += ` AND role = $${params.length}`;
      }

      const result = await query(query_text, params);
      return result.rows.map((row: any) => row.email);
    } catch (error) {
      console.error('Error fetching notification recipients:', error);
      return [];
    }
  }

  /**
   * Substitute variables in email template
   * 
   * Replaces {variable_name} with actual values
   * Example: "Dear {employee_name}" -> "Dear John Doe"
   */
  private substituteVariables(text: string, variables: Record<string, string>): string {
    let substituted = text;
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`{${key}}`, 'g');
      substituted = substituted.replace(pattern, value || '');
    }
    return substituted;
  }

  /**
   * Send leave request notification
   */
  async notifyLeaveRequest(
    employeeId: string,
    leaveRequest: any,
    employee: any
  ): Promise<boolean> {
    try {
      if (!this.configured) {
        console.warn('⚠️  Email notifications not configured');
        return false;
      }

      // Get notify managers
      const recipients = await this.getNotificationRecipients(
        'leave_request',
        employee.department,
        'manager'
      );

      if (recipients.length === 0) {
        console.warn('No recipients found for leave request notification');
        return false;
      }

      // Prepare email template - use consistent field names
      const employeeName = employee.full_name || 
                           `${employee.first_name || ''} ${employee.last_name || ''}`.trim() ||
                           employee.display_name || 
                           employee.email;

      const variables = {
        employee_name: employeeName,
        employee_email: employee.email || 'unknown',
        leave_type_name: leaveRequest.leave_type_name || leaveRequest.leave_type || '',
        start_date: new Date(leaveRequest.start_date).toLocaleDateString('th-TH'),
        end_date: new Date(leaveRequest.end_date).toLocaleDateString('th-TH'),
        reason: leaveRequest.reason || '-',
        total_days: leaveRequest.total_days || '0',
      };

      const subject = this.substituteVariables(
        '{employee_name} ได้ส่งคำขอลา {leave_type_name}',
        variables
      );

      const body = `
        <h2>แจ้งเตือนการส่งคำขอลา</h2>
        <p>พนักงาน: {employee_name} ({employee_email})</p>
        <p>ประเภทการลา: {leave_type_name}</p>
        <p>จำนวนวัน: {total_days} วัน</p>
        <p>วันเริ่มต้น: {start_date}</p>
        <p>วันสิ้นสุด: {end_date}</p>
        <p>เหตุผล: {reason}</p>
        <p>กรุณาตรวจสอบและอนุมัติในระบบ</p>
      `;

      const htmlBody = this.substituteVariables(body, variables);

      // Send emails to all recipients
      for (const recipient of recipients) {
        await this.transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: recipient,
          subject,
          html: htmlBody,
        });
      }

      console.log(`📧 Leave request notification sent to ${recipients.length} recipient(s)`);
      return true;
    } catch (error) {
      console.error('Error sending leave request notification:', error);
      return false;
    }
  }

  /**
   * Send leave approval notification
   */
  async notifyLeaveApproval(
    employeeId: string,
    leaveRequest: any,
    employee: any,
    approverName: string
  ): Promise<boolean> {
    try {
      if (!this.configured) {
        console.warn('⚠️  Email notifications not configured');
        return false;
      }

      // Send notification to employee
      const variables = {
        employee_name: employee.display_name || employee.email,
        leave_type: leaveRequest.leave_type,
        start_date: new Date(leaveRequest.start_date).toLocaleDateString('th-TH'),
        end_date: new Date(leaveRequest.end_date).toLocaleDateString('th-TH'),
        approver_name: approverName,
      };

      const subject = this.substituteVariables(
        'คำขอลาของ {employee_name} ได้รับการอนุมัติ',
        variables
      );

      const body = `
        <h2>การอนุมัติคำขอลา</h2>
        <p>พนักงาน: {employee_name}</p>
        <p>ประเภทการลา: {leave_type}</p>
        <p>วันเริ่มต้น: {start_date}</p>
        <p>วันสิ้นสุด: {end_date}</p>
        <p>อนุมัติโดย: {approver_name}</p>
        <p>คำขอของคุณได้รับการอนุมัติแล้ว</p>
      `;

      const htmlBody = this.substituteVariables(body, variables);

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: employee.email,
        subject,
        html: htmlBody,
      });

      // Notify other departments if configured
      const otherRecipients = await this.getNotificationRecipients(
        'approval',
        employee.department
      );

      for (const recipient of otherRecipients) {
        if (recipient !== employee.email) {
          await this.transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: recipient,
            subject: `[Approved] ${subject}`,
            html: htmlBody,
          });
        }
      }

      console.log(`📧 Leave approval notification sent`);
      return true;
    } catch (error) {
      console.error('Error sending leave approval notification:', error);
      return false;
    }
  }

  /**
   * Send leave rejection notification
   */
  async notifyLeaveRejection(
    employeeId: string,
    leaveRequest: any,
    employee: any,
    rejectionReason: string,
    approverName: string
  ): Promise<boolean> {
    try {
      if (!this.configured) {
        console.warn('⚠️  Email notifications not configured');
        return false;
      }

      const variables = {
        employee_name: employee.display_name || employee.email,
        leave_type: leaveRequest.leave_type,
        start_date: new Date(leaveRequest.start_date).toLocaleDateString('th-TH'),
        end_date: new Date(leaveRequest.end_date).toLocaleDateString('th-TH'),
        rejection_reason: rejectionReason,
        approver_name: approverName,
      };

      const subject = this.substituteVariables(
        'คำขอลาของ {employee_name} ไม่ได้รับการอนุมัติ',
        variables
      );

      const body = `
        <h2>การปฏิเสธคำขอลา</h2>
        <p>พนักงาน: {employee_name}</p>
        <p>ประเภทการลา: {leave_type}</p>
        <p>วันเริ่มต้น: {start_date}</p>
        <p>วันสิ้นสุด: {end_date}</p>
        <p>เหตุผล: {rejection_reason}</p>
        <p>ปฏิเสธโดย: {approver_name}</p>
      `;

      const htmlBody = this.substituteVariables(body, variables);

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: employee.email,
        subject,
        html: htmlBody,
      });

      console.log(`📧 Leave rejection notification sent to ${employee.email}`);
      return true;
    } catch (error) {
      console.error('Error sending leave rejection notification:', error);
      return false;
    }
  }

  /**
   * Send custom email
   */
  async sendCustomEmail(
    to: string | string[],
    subject: string,
    htmlBody: string,
    variables?: Record<string, string>
  ): Promise<boolean> {
    try {
      if (!this.configured) {
        console.warn('⚠️  Email notifications not configured');
        return false;
      }

      const finalBody = variables ? this.substituteVariables(htmlBody, variables) : htmlBody;

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: Array.isArray(to) ? to.join(',') : to,
        subject,
        html: finalBody,
      });

      console.log(`📧 Custom email sent to ${Array.isArray(to) ? to.length + ' recipients' : to}`);
      return true;
    } catch (error) {
      console.error('Error sending custom email:', error);
      return false;
    }
  }
}

export default new NotificationService();
