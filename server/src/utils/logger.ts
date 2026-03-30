import winston from 'winston';
import { Request, Response, NextFunction } from 'express';

// Decide log level based on env
const envLevel = process.env.LOG_LEVEL as string | undefined;
const isProd = process.env.NODE_ENV === 'production';
const defaultLevel = envLevel ?? (isProd ? 'info' : 'warn');

// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  const upperLevel = String(level).toUpperCase();

  // Only show stack traces for errors
  if (stack && level === 'error') {
    return `${timestamp} ${upperLevel}: ${stack}`;
  }

  return `${timestamp} ${upperLevel}: ${message}`;
});

// Create the main logger instance
export const logger = winston.createLogger({
  level: defaultLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [new winston.transports.Console()],
});

// Optional helper if you ever want to tweak at runtime
export const setLogLevel = (level: string) => {
  logger.level = level;
};

// Middleware function to log every request (at debug level)
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const { method, url, ip } = req;
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    if (logger.isLevelEnabled('debug')) {
      logger.debug(`HTTP ${method} ${url} ${statusCode} - ${duration}ms - IP: ${ip}`);
    }
  });

  next();
};