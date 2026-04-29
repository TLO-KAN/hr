import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_secure_secret_key';
const LEAVE_APPROVAL_TOKEN_EXPIRY = process.env.LEAVE_APPROVAL_TOKEN_EXPIRY || '7d';

export function createLeaveApprovalLinkToken({ leaveRequestId, employeeId }) {
  const tokenId = randomUUID();
  const token = jwt.sign(
    {
      purpose: 'leave_approval_link',
      tokenId,
      leaveRequestId,
      employeeId,
    },
    JWT_SECRET,
    {
      expiresIn: LEAVE_APPROVAL_TOKEN_EXPIRY,
    }
  );

  const decoded = jwt.decode(token);
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : null;

  return {
    token,
    tokenId,
    expiresAt,
  };
}

export function verifyLeaveApprovalLinkToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);

  if (!payload || payload.purpose !== 'leave_approval_link' || !payload.leaveRequestId) {
    const error = new Error('ลิงก์อนุมัติไม่ถูกต้อง');
    error.statusCode = 400;
    throw error;
  }

  if (!payload.tokenId) {
    const error = new Error('ลิงก์อนุมัติไม่ถูกต้อง');
    error.statusCode = 400;
    throw error;
  }

  return {
    tokenId: payload.tokenId,
    leaveRequestId: payload.leaveRequestId,
    employeeId: payload.employeeId,
  };
}
