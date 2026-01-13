/**
 * Compliance Repository Interface
 */

export interface EvidenceStatus {
  policyDefinitions: 'COMPLETE' | 'INCOMPLETE' | 'STALE';
  auditLogs: 'SYNCED' | 'STALE' | 'MISSING';
  systemSnapshots: 'SYNCED' | 'STALE' | 'MISSING';
  lastUpdate?: Date;
}

export interface ComplianceReport {
  id: string;
  name: string;
  createdAt: Date;
  path: string;
}

export interface IComplianceRepository {
  getEvidenceStatus(): Promise<EvidenceStatus>;
  generateEvidencePackage(): Promise<string>;
  getHistoricalReports(): Promise<ComplianceReport[]>;
  validateEvidenceCompleteness(): Promise<{
    isValid: boolean;
    missingItems: string[];
    warnings: string[];
  }>;
}
