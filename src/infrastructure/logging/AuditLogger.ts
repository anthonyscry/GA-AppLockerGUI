/**
 * AuditLogger
 * Tracks sensitive operations for compliance and security auditing
 */

import { Logger } from './Logger';

export enum AuditAction {
  // Policy Operations
  POLICY_CREATED = 'POLICY_CREATED',
  POLICY_MODIFIED = 'POLICY_MODIFIED',
  POLICY_DELETED = 'POLICY_DELETED',
  POLICY_DEPLOYED = 'POLICY_DEPLOYED',
  POLICY_EXPORTED = 'POLICY_EXPORTED',
  POLICY_IMPORTED = 'POLICY_IMPORTED',

  // Rule Operations
  RULE_CREATED = 'RULE_CREATED',
  RULE_MODIFIED = 'RULE_MODIFIED',
  RULE_DELETED = 'RULE_DELETED',

  // AD Operations
  USER_ADDED_TO_GROUP = 'USER_ADDED_TO_GROUP',
  USER_REMOVED_FROM_GROUP = 'USER_REMOVED_FROM_GROUP',
  GROUP_CREATED = 'GROUP_CREATED',
  GROUP_DELETED = 'GROUP_DELETED',

  // Scan Operations
  SCAN_INITIATED = 'SCAN_INITIATED',
  SCAN_COMPLETED = 'SCAN_COMPLETED',
  SCAN_FAILED = 'SCAN_FAILED',

  // System Operations
  APP_STARTED = 'APP_STARTED',
  APP_CLOSED = 'APP_CLOSED',
  CONFIG_CHANGED = 'CONFIG_CHANGED',
  EXPORT_DATA = 'EXPORT_DATA',

  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  CREDENTIAL_USED = 'CREDENTIAL_USED',
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  severity: AuditSeverity;
  user: string;
  machine: string;
  details: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

/**
 * AuditLogger Class
 * Specialized logger for security-sensitive operations
 */
export class AuditLogger {
  private static instance: AuditLogger;
  private logger: Logger;
  private auditLog: AuditEntry[] = [];
  private maxEntries: number = 10000;
  private currentUser: string = 'SYSTEM';
  private currentMachine: string = 'localhost';

  private constructor() {
    this.logger = Logger.getInstance().child({ component: 'AuditLogger' });
    this.detectEnvironment();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Detect current user and machine
   */
  private async detectEnvironment(): Promise<void> {
    try {
      const electron = (window as any)?.electron;
      if (electron?.ipc) {
        const userInfo = await electron.ipc.invoke('system:getUserInfo');
        if (userInfo) {
          this.currentUser = userInfo.username || 'SYSTEM';
          this.currentMachine = userInfo.hostname || 'localhost';
        }
      }
    } catch {
      // Use defaults
    }
  }

  /**
   * Generate unique audit ID
   */
  private generateId(): string {
    return `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get severity for action
   */
  private getSeverityForAction(action: AuditAction): AuditSeverity {
    const criticalActions = [
      AuditAction.POLICY_DEPLOYED,
      AuditAction.POLICY_DELETED,
      AuditAction.GROUP_DELETED,
    ];

    const highActions = [
      AuditAction.POLICY_CREATED,
      AuditAction.POLICY_MODIFIED,
      AuditAction.USER_ADDED_TO_GROUP,
      AuditAction.USER_REMOVED_FROM_GROUP,
      AuditAction.CONFIG_CHANGED,
      AuditAction.LOGIN_FAILED,
    ];

    const mediumActions = [
      AuditAction.RULE_CREATED,
      AuditAction.RULE_MODIFIED,
      AuditAction.RULE_DELETED,
      AuditAction.SCAN_INITIATED,
      AuditAction.EXPORT_DATA,
      AuditAction.CREDENTIAL_USED,
    ];

    if (criticalActions.includes(action)) return AuditSeverity.CRITICAL;
    if (highActions.includes(action)) return AuditSeverity.HIGH;
    if (mediumActions.includes(action)) return AuditSeverity.MEDIUM;
    return AuditSeverity.LOW;
  }

  /**
   * Log an audit event
   */
  log(
    action: AuditAction,
    details: Record<string, unknown>,
    success: boolean = true,
    errorMessage?: string
  ): AuditEntry {
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      action,
      severity: this.getSeverityForAction(action),
      user: this.currentUser,
      machine: this.currentMachine,
      details: this.sanitizeDetails(details),
      success,
      errorMessage,
    };

    // Add to in-memory log
    this.auditLog.push(entry);

    // Trim if exceeds max
    if (this.auditLog.length > this.maxEntries) {
      this.auditLog = this.auditLog.slice(-this.maxEntries);
    }

    // Log to standard logger
    const auditContext = {
      auditId: entry.id,
      severity: entry.severity,
      user: entry.user,
      success,
      ...entry.details,
    };

    if (success) {
      this.logger.info(`[AUDIT] ${action}`, auditContext);
    } else {
      this.logger.error(`[AUDIT] ${action}`, undefined, auditContext);
    }

    return entry;
  }

  /**
   * Sanitize details to remove sensitive information
   */
  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...details };
    const sensitiveKeys = ['password', 'secret', 'token', 'credential', 'key'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get audit log entries
   */
  getEntries(filter?: {
    action?: AuditAction;
    severity?: AuditSeverity;
    user?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
  }): AuditEntry[] {
    let entries = [...this.auditLog];

    if (filter) {
      if (filter.action) {
        entries = entries.filter(e => e.action === filter.action);
      }
      if (filter.severity) {
        entries = entries.filter(e => e.severity === filter.severity);
      }
      if (filter.user) {
        entries = entries.filter(e => e.user === filter.user);
      }
      if (filter.startDate) {
        entries = entries.filter(e => e.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        entries = entries.filter(e => e.timestamp <= filter.endDate!);
      }
      if (filter.success !== undefined) {
        entries = entries.filter(e => e.success === filter.success);
      }
    }

    return entries;
  }

  /**
   * Export audit log to CSV
   */
  exportToCSV(): string {
    const headers = ['ID', 'Timestamp', 'Action', 'Severity', 'User', 'Machine', 'Success', 'Details', 'Error'];
    const rows = this.auditLog.map(entry => [
      entry.id,
      entry.timestamp.toISOString(),
      entry.action,
      entry.severity,
      entry.user,
      entry.machine,
      entry.success.toString(),
      JSON.stringify(entry.details),
      entry.errorMessage || '',
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
  }

  /**
   * Clear audit log (requires confirmation)
   */
  clear(): void {
    this.log(AuditAction.CONFIG_CHANGED, { operation: 'AUDIT_LOG_CLEARED', entriesRemoved: this.auditLog.length });
    this.auditLog = [];
  }

  /**
   * Get audit statistics
   */
  getStats(): {
    total: number;
    byAction: Record<string, number>;
    bySeverity: Record<string, number>;
    successRate: number;
    recentFailures: AuditEntry[];
  } {
    const byAction: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let successCount = 0;

    for (const entry of this.auditLog) {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
      if (entry.success) successCount++;
    }

    const recentFailures = this.auditLog
      .filter(e => !e.success)
      .slice(-10)
      .reverse();

    return {
      total: this.auditLog.length,
      byAction,
      bySeverity,
      successRate: this.auditLog.length > 0 ? (successCount / this.auditLog.length) * 100 : 100,
      recentFailures,
    };
  }
}

/**
 * Default audit logger instance
 */
export const auditLogger = AuditLogger.getInstance();

/**
 * Convenience functions for common audit operations
 */
export const audit = {
  policyDeployed: (policyName: string, targetOU: string, success: boolean, error?: string) =>
    auditLogger.log(AuditAction.POLICY_DEPLOYED, { policyName, targetOU }, success, error),

  policyCreated: (policyName: string, ruleCount: number) =>
    auditLogger.log(AuditAction.POLICY_CREATED, { policyName, ruleCount }),

  userAddedToGroup: (username: string, groupName: string, success: boolean, error?: string) =>
    auditLogger.log(AuditAction.USER_ADDED_TO_GROUP, { username, groupName }, success, error),

  scanInitiated: (targets: string[], scanType: string) =>
    auditLogger.log(AuditAction.SCAN_INITIATED, { targetCount: targets.length, scanType }),

  scanCompleted: (targets: string[], resultsCount: number, duration: number) =>
    auditLogger.log(AuditAction.SCAN_COMPLETED, { targetCount: targets.length, resultsCount, durationMs: duration }),

  dataExported: (exportType: string, recordCount: number, _filePath: string) =>
    auditLogger.log(AuditAction.EXPORT_DATA, { exportType, recordCount, filePath: '[REDACTED]' }),

  appStarted: () =>
    auditLogger.log(AuditAction.APP_STARTED, { version: '1.2.10' }),
};
