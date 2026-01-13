/**
 * Compliance Repository Implementation
 */

import { IComplianceRepository, EvidenceStatus, ComplianceReport } from '../../domain/interfaces/IComplianceRepository';
import { ipcClient } from '../ipc/ipcClient';
import { IPCChannels } from '../ipc/channels';
import { logger } from '../logging/Logger';
import { ExternalServiceError } from '../../domain/errors';

export class ComplianceRepository implements IComplianceRepository {
  async getEvidenceStatus(): Promise<EvidenceStatus> {
    try {
      const status = await ipcClient.invoke<EvidenceStatus>(IPCChannels.COMPLIANCE.GET_EVIDENCE_STATUS);
      return status || {
        policyDefinitions: 'INCOMPLETE',
        auditLogs: 'MISSING',
        systemSnapshots: 'MISSING',
      };
    } catch (error) {
      logger.error('Failed to get evidence status', error as Error);
      throw new ExternalServiceError('Compliance Service', 'Failed to get evidence status', error as Error);
    }
  }

  async generateEvidencePackage(): Promise<string> {
    try {
      logger.info('Generating evidence package');
      const path = await ipcClient.invoke<string>(IPCChannels.COMPLIANCE.GENERATE_EVIDENCE);
      logger.info('Evidence package generated successfully', { path });
      return path;
    } catch (error) {
      logger.error('Failed to generate evidence package', error as Error);
      throw new ExternalServiceError('Compliance Service', 'Failed to generate evidence package', error as Error);
    }
  }

  async getHistoricalReports(): Promise<ComplianceReport[]> {
    try {
      const reports = await ipcClient.invoke<ComplianceReport[]>(IPCChannels.COMPLIANCE.GET_HISTORICAL_REPORTS);
      return reports || [];
    } catch (error) {
      logger.error('Failed to get historical reports', error as Error);
      throw new ExternalServiceError('Compliance Service', 'Failed to get historical reports', error as Error);
    }
  }

  async validateEvidenceCompleteness(): Promise<{
    isValid: boolean;
    missingItems: string[];
    warnings: string[];
  }> {
    try {
      const result = await ipcClient.invoke<{
        isValid: boolean;
        missingItems: string[];
        warnings: string[];
      }>(IPCChannels.COMPLIANCE.VALIDATE_EVIDENCE);
      return result || { isValid: false, missingItems: [], warnings: [] };
    } catch (error) {
      logger.error('Failed to validate evidence completeness', error as Error);
      throw new ExternalServiceError('Compliance Service', 'Failed to validate evidence completeness', error as Error);
    }
  }
}
