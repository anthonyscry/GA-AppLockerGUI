/**
 * Logger Utility
 * Provides centralized logging with sanitization for production
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogData {
  [key: string]: any;
}

/**
 * Sanitize log data to remove sensitive information
 * @param data - Data to sanitize
 * @returns Sanitized data
 */
function sanitizeLogData(data: LogData): LogData {
  if (typeof data !== 'object' || data === null) return data;
  
  const sanitized = { ...data };
  const sensitiveKeys = ['path', 'url', 'navigationUrl', 'password', 'token', 'secret', 'key', 'apiKey'];
  
  sensitiveKeys.forEach(key => {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Logger class for application-wide logging
 */
class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Log error message
   * @param message - Error message
   * @param data - Optional error data
   */
  error(message: string, data?: LogData): void {
    const sanitized = data ? sanitizeLogData(data) : undefined;
    console.error(`[ERROR] ${message}`, sanitized || '');
    
    // In production, could send to error tracking service
    if (!this.isDevelopment) {
      // TODO: Send to error tracking service (e.g., Sentry, LogRocket)
    }
  }

  /**
   * Log warning message
   * @param message - Warning message
   * @param data - Optional warning data
   */
  warn(message: string, data?: LogData): void {
    if (this.isDevelopment) {
      const sanitized = data ? sanitizeLogData(data) : undefined;
      console.warn(`[WARN] ${message}`, sanitized || '');
    }
  }

  /**
   * Log info message
   * @param message - Info message
   * @param data - Optional info data
   */
  info(message: string, data?: LogData): void {
    if (this.isDevelopment) {
      const sanitized = data ? sanitizeLogData(data) : undefined;
      console.info(`[INFO] ${message}`, sanitized || '');
    }
  }

  /**
   * Log debug message (development only)
   * @param message - Debug message
   * @param data - Optional debug data
   */
  debug(message: string, data?: LogData): void {
    if (this.isDevelopment) {
      const sanitized = data ? sanitizeLogData(data) : undefined;
      console.debug(`[DEBUG] ${message}`, sanitized || '');
    }
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;
