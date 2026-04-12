import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path} - ${err.message}`);

  let statusCode = err.statusCode || err.status || 500;
  let errorMessage = err.message || 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์';
  let errorCode = err.code || 'INTERNAL_ERROR';

  // Handle PostgreSQL errors
  if (err.code === '23505') {
    statusCode = 409;
    errorMessage = 'ข้อมูลนี้มีอยู่แล้วในระบบ';
    errorCode = 'DUPLICATE_ENTRY';
  } else if (err.code === '23503') {
    statusCode = 400;
    errorMessage = 'ข้อมูลที่อ้างอิงไม่พบในระบบ';
    errorCode = 'FOREIGN_KEY_ERROR';
  } else if (err.code === '23502') {
    statusCode = 400;
    errorMessage = 'ข้อมูลจำเป็นไม่ครบถ้วน';
    errorCode = 'NOT_NULL_VIOLATION';
  }

  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    code: errorCode,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    })
  });
};

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};