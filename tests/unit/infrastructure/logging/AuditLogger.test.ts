/**
 * AuditLogger Tests
 */

import { AuditLogger, AuditAction, AuditSeverity, audit } from '../../../../src/infrastructure/logging/AuditLogger';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    // Get fresh instance for each test
    auditLogger = AuditLogger.getInstance();
    auditLogger.clear();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AuditLogger.getInstance();
      const instance2 = AuditLogger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('log', () => {
    it('should log audit entry with correct properties', () => {
      const entry = auditLogger.log(
        AuditAction.POLICY_CREATED,
        { policyName: 'TestPolicy', ruleCount: 5 },
        true
      );

      expect(entry.id).toMatch(/^AUD-\d+-[a-z0-9]+$/);
      expect(entry.action).toBe(AuditAction.POLICY_CREATED);
      expect(entry.severity).toBe(AuditSeverity.HIGH);
      expect(entry.success).toBe(true);
      expect(entry.details).toEqual({ policyName: 'TestPolicy', ruleCount: 5 });
    });

    it('should log failed operations with error message', () => {
      const entry = auditLogger.log(
        AuditAction.POLICY_DEPLOYED,
        { policyName: 'TestPolicy' },
        false,
        'Connection timeout'
      );

      expect(entry.success).toBe(false);
      expect(entry.errorMessage).toBe('Connection timeout');
      expect(entry.severity).toBe(AuditSeverity.CRITICAL);
    });

    it('should sanitize sensitive data in details', () => {
      const entry = auditLogger.log(
        AuditAction.CREDENTIAL_USED,
        { username: 'admin', password: 'secret123', token: 'abc123' },
        true
      );

      expect(entry.details.username).toBe('admin');
      expect(entry.details.password).toBe('[REDACTED]');
      expect(entry.details.token).toBe('[REDACTED]');
    });
  });

  describe('getEntries', () => {
    beforeEach(() => {
      // Add test entries
      auditLogger.log(AuditAction.POLICY_CREATED, { name: 'Policy1' }, true);
      auditLogger.log(AuditAction.POLICY_DEPLOYED, { name: 'Policy1' }, false, 'Error');
      auditLogger.log(AuditAction.SCAN_INITIATED, { targets: 5 }, true);
    });

    it('should return all entries when no filter', () => {
      const entries = auditLogger.getEntries();
      expect(entries.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by action', () => {
      const entries = auditLogger.getEntries({ action: AuditAction.POLICY_CREATED });
      expect(entries.every(e => e.action === AuditAction.POLICY_CREATED)).toBe(true);
    });

    it('should filter by success', () => {
      const failures = auditLogger.getEntries({ success: false });
      expect(failures.every(e => !e.success)).toBe(true);
    });

    it('should filter by severity', () => {
      const critical = auditLogger.getEntries({ severity: AuditSeverity.CRITICAL });
      expect(critical.every(e => e.severity === AuditSeverity.CRITICAL)).toBe(true);
    });
  });

  describe('exportToCSV', () => {
    it('should export entries as CSV', () => {
      auditLogger.log(AuditAction.APP_STARTED, { version: '1.0' }, true);

      const csv = auditLogger.exportToCSV();

      expect(csv).toContain('ID,Timestamp,Action,Severity,User,Machine,Success,Details,Error');
      expect(csv).toContain('APP_STARTED');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      auditLogger.log(AuditAction.POLICY_CREATED, {}, true);
      auditLogger.log(AuditAction.POLICY_CREATED, {}, true);
      auditLogger.log(AuditAction.POLICY_DEPLOYED, {}, false, 'Error');
    });

    it('should return correct statistics', () => {
      const stats = auditLogger.getStats();

      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.byAction[AuditAction.POLICY_CREATED]).toBeGreaterThanOrEqual(2);
      expect(stats.recentFailures.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate success rate', () => {
      const stats = auditLogger.getStats();
      expect(stats.successRate).toBeGreaterThan(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
    });
  });

  describe('severity assignment', () => {
    it('should assign CRITICAL to policy deployments', () => {
      const entry = auditLogger.log(AuditAction.POLICY_DEPLOYED, {}, true);
      expect(entry.severity).toBe(AuditSeverity.CRITICAL);
    });

    it('should assign HIGH to policy creation', () => {
      const entry = auditLogger.log(AuditAction.POLICY_CREATED, {}, true);
      expect(entry.severity).toBe(AuditSeverity.HIGH);
    });

    it('should assign MEDIUM to scans', () => {
      const entry = auditLogger.log(AuditAction.SCAN_INITIATED, {}, true);
      expect(entry.severity).toBe(AuditSeverity.MEDIUM);
    });

    it('should assign LOW to app events', () => {
      const entry = auditLogger.log(AuditAction.APP_STARTED, {}, true);
      expect(entry.severity).toBe(AuditSeverity.LOW);
    });
  });
});

describe('audit convenience functions', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    auditLogger = AuditLogger.getInstance();
    auditLogger.clear();
  });

  it('policyDeployed should log deployment', () => {
    const entry = audit.policyDeployed('TestPolicy', 'OU=Test', true);
    expect(entry.action).toBe(AuditAction.POLICY_DEPLOYED);
    expect(entry.details.policyName).toBe('TestPolicy');
    expect(entry.details.targetOU).toBe('OU=Test');
  });

  it('userAddedToGroup should log membership change', () => {
    const entry = audit.userAddedToGroup('jdoe', 'AppLocker-Admins', true);
    expect(entry.action).toBe(AuditAction.USER_ADDED_TO_GROUP);
    expect(entry.details.username).toBe('jdoe');
    expect(entry.details.groupName).toBe('AppLocker-Admins');
  });

  it('scanInitiated should log scan start', () => {
    const entry = audit.scanInitiated(['PC1', 'PC2'], 'Full');
    expect(entry.action).toBe(AuditAction.SCAN_INITIATED);
    expect(entry.details.targetCount).toBe(2);
    expect(entry.details.scanType).toBe('Full');
  });

  it('scanCompleted should log scan completion', () => {
    const entry = audit.scanCompleted(['PC1', 'PC2'], 50, 5000);
    expect(entry.action).toBe(AuditAction.SCAN_COMPLETED);
    expect(entry.details.resultsCount).toBe(50);
    expect(entry.details.durationMs).toBe(5000);
  });

  it('dataExported should log export with redacted path', () => {
    const entry = audit.dataExported('CSV', 100, 'C:\\data\\export.csv');
    expect(entry.action).toBe(AuditAction.EXPORT_DATA);
    expect(entry.details.filePath).toBe('[REDACTED]');
  });

  it('appStarted should log application start', () => {
    const entry = audit.appStarted();
    expect(entry.action).toBe(AuditAction.APP_STARTED);
    expect(entry.details.version).toBe('1.2.10');
  });
});
