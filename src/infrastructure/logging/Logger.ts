/**
 * Logger
 * Centralized logging infrastructure
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableFile?: boolean;
  filePath?: string;
}

/**
 * Logger Class
 * Provides structured logging with levels and context
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig = {
    minLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
    enableConsole: true,
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Configure logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.logInternal(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.logInternal(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.logInternal(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.logInternal(LogLevel.ERROR, message, {
      ...context,
      error: error?.message,
      stack: error?.stack,
    });
  }

  /**
   * Internal log method
   */
  private logInternal(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.config.minLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
    };

    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Future: Add file logging, remote logging, etc.
    if (this.config.enableFile && this.config.filePath) {
      // TODO: Implement file logging
    }
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = LogLevel[entry.level].padEnd(5);
    const timestamp = entry.timestamp.toISOString();
    const contextStr = entry.context ? JSON.stringify(entry.context, null, 2) : '';

    const logMethod = entry.level === LogLevel.ERROR ? console.error :
                     entry.level === LogLevel.WARN ? console.warn :
                     entry.level === LogLevel.DEBUG ? console.debug :
                     console.log;

    logMethod(`[${prefix}] ${timestamp} - ${entry.message}`, contextStr || '');
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    const childLogger = new (class extends Logger {
      private parentContext: Record<string, unknown>;

      constructor(parentContext: Record<string, unknown>) {
        super();
        this.parentContext = parentContext;
      }

      protected logInternal(level: LogLevel, message: string, ctx?: Record<string, unknown>): void {
        super.logInternal(level, message, { ...this.parentContext, ...ctx });
      }
    })(context);

    // Copy config from parent
    childLogger.config = { ...this.config };
    
    return childLogger;
  }
}

/**
 * Default logger instance
 */
export const logger = Logger.getInstance();
