import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, '../../logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const getTimestamp = () => {
  return new Date().toISOString();
};

const formatLog = (level, message) => {
  return `[${getTimestamp()}] [${level}] ${message}`;
};

class Logger {
  info(message) {
    const log = formatLog('INFO', message);
    console.log(log);
    this.writeToFile('info.log', log);
  }

  warn(message) {
    const log = formatLog('WARN', message);
    console.warn(log);
    this.writeToFile('warn.log', log);
  }

  error(message) {
    const log = formatLog('ERROR', message);
    console.error(log);
    this.writeToFile('error.log', log);
  }

  debug(message) {
    if (process.env.NODE_ENV === 'development') {
      const log = formatLog('DEBUG', message);
      console.log(log);
      this.writeToFile('debug.log', log);
    }
  }

  writeToFile(filename, message) {
    const filepath = path.join(logsDir, filename);
    fs.appendFileSync(filepath, message + '\n');
  }
}

export default new Logger();