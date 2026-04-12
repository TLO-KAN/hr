import logger from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    const logMessage = `${req.method} ${req.path} - ${statusCode} (${duration}ms)`;
    
    if (statusCode >= 400) {
      logger.warn(logMessage);
    } else {
      logger.info(logMessage);
    }

    originalSend.call(this, data);
  };

  next();
};