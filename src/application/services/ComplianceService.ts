/**
 * Compliance Service
 * Business logic for compliance operations
 */

import { IComplianceRepository, EvidenceStatus, ComplianceReport } from '../../domain/interfaces/IComplianceRepository';
import { logger } from '../../infrastructure/logging/Logger';

export class ComplianceService {
  constructor(private readonly repository: IComplianceRepository) {}

  /**
   * Get evidence readiness status
   */
  async getEvidenceStatus(): Promise<EvidenceStatus> {
    return this.repository.getEvidenceStatus();
  }

  /**
   * Generate CORA evidence package
   */
  async generateEvidencePackage(): Promise<string> {
    logger.info('Generating CORA evidence package');
    return this.repository.generateEvidencePackage();
  }

  /**
   * Get historical compliance reports
   */
  async getHistoricalReports(): Promise<ComplianceReport[]> {
    return this.repository.getHistoricalReports();
  }

  /**
   * Validate evidence completeness
   */
  async validateEvidenceCompleteness(): Promise<{
    isValid: boolean;
    missingItems: string[];
    warnings: string[];
  }> {
    logger.info('Validating evidence completeness');
    return this.repository.validateEvidenceCompleteness();
  }
}
