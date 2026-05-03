const parseCsv = (value) => {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeIp = (ip) => {
  if (!ip) {
    return '';
  }
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }
  return ip;
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return normalizeIp(forwarded.split(',')[0].trim());
  }
  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
};

const readTokenFromRequest = (req) => {
  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
    return apiKeyHeader.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
};

const attendanceRateLimitStore = new Map();

export const attendanceApiKeyAuth = (req, res, next) => {
  const configuredTokens = [
    process.env.ATTENDANCE_API_TOKEN,
    ...parseCsv(process.env.ATTENDANCE_API_TOKENS),
  ].filter(Boolean);

  if (!configuredTokens.length) {
    return res.status(500).json({
      success: false,
      error: 'Attendance API token is not configured',
      code: 'ATTENDANCE_TOKEN_NOT_CONFIGURED',
    });
  }

  const providedToken = readTokenFromRequest(req);
  if (!providedToken || !configuredTokens.includes(providedToken)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing API token',
      code: 'UNAUTHORIZED_ATTENDANCE_API',
    });
  }

  return next();
};

export const validateAttendancePayload = (req, res, next) => {
  const payload = req.body;
  const records = Array.isArray(payload) ? payload : [payload];

  if (!records.length) {
    return res.status(400).json({
      success: false,
      error: 'Array ต้องมีอย่างน้อย 1 รายการ',
      code: 'INVALID_PAYLOAD',
    });
  }

  for (let i = 0; i < records.length; i += 1) {
    const item = records[i];

    if (!item || typeof item !== 'object') {
      return res.status(400).json({
        success: false,
        error: `รูปแบบข้อมูลไม่ถูกต้อง (รายการที่ ${i + 1})`,
        code: 'INVALID_PAYLOAD',
      });
    }

    if (!item.employee_id || String(item.employee_id).trim() === '') {
      return res.status(400).json({
        success: false,
        error: `employee_id ห้ามเป็นค่าว่าง (รายการที่ ${i + 1})`,
        code: 'INVALID_PAYLOAD',
      });
    }

    if (!item.access_datetime || String(item.access_datetime).trim() === '') {
      return res.status(400).json({
        success: false,
        error: `access_datetime ห้ามเป็นค่าว่าง (รายการที่ ${i + 1})`,
        code: 'INVALID_PAYLOAD',
      });
    }

    if (item.local_id !== undefined && item.local_id !== null && !Number.isInteger(item.local_id)) {
      return res.status(400).json({
        success: false,
        error: `local_id ต้องเป็น Integer (รายการที่ ${i + 1})`,
        code: 'INVALID_PAYLOAD',
      });
    }
  }

  return next();
};

export const attendanceRateLimit = (req, res, next) => {
  if (process.env.ATTENDANCE_RATE_LIMIT_ENABLED === 'false') {
    return next();
  }

  const maxRequests = Number.parseInt(process.env.ATTENDANCE_RATE_LIMIT_MAX || '120', 10);
  const windowMs = Number.parseInt(process.env.ATTENDANCE_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);

  const now = Date.now();
  const key = `${getClientIp(req)}:${req.path}`;

  if (!attendanceRateLimitStore.has(key)) {
    attendanceRateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const record = attendanceRateLimitStore.get(key);
  if (now > record.resetTime) {
    attendanceRateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
  }

  record.count += 1;
  return next();
};

export const attendanceCorsGuard = (req, res, next) => {
  const allowedOrigins = parseCsv(process.env.ATTENDANCE_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS);
  const allowedIps = parseCsv(process.env.ATTENDANCE_ALLOWED_IPS);

  const origin = req.headers.origin;
  const clientIp = getClientIp(req);

  if (allowedIps.length > 0 && clientIp && allowedIps.includes(clientIp)) {
    return next();
  }

  if (allowedOrigins.length === 0) {
    return next();
  }

  if (!origin) {
    return next();
  }

  if (allowedOrigins.includes(origin)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'CORS - Origin/IP not allowed',
    code: 'CORS_BLOCKED',
  });
};

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attendanceRateLimitStore.entries()) {
    if (now > record.resetTime) {
      attendanceRateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000);
