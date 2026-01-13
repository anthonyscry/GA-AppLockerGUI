/**
 * ComplianceService Unit Tests
 */

import { ComplianceService } from '../../../../src/application/services/ComplianceService';
import { IComplianceRepository } from '../../../../src/domain/interfaces/IComplianceRepository';
import { EvidenceStatus, ComplianceReport } from '../../../../src/domain/interfaces/IComplianceRepository';

describe('ComplianceService', () => {
  let service: ComplianceService;
  let mockRepository: jest.Mocked<IComplianceRepository>;

  beforeEach(() => {
    mockRepository = {
      getEvidenceStatus: jest.fn(),
      generateEvidencePackage: jest.fn(),
      getHistoricalReports: jest.fn(),
      validateEvidenceCompleteness: jest.fn(),
    } as any;

    service = new ComplianceService(mockRepository);
  });

  describe('getEvidenceStatus', () => {
    it('should return evidence status', async () => {
      const mockStatus: EvidenceStatus = {
        policyDefinitions: 'COMPLETE',
        auditLogs: 'SYNCED',
        systemSnapshots: 'SYNCED',
        lastUpdate: new Date(),
      };

      mockRepository.getEvidenceStatus.mockResolvedValue(mockStatus);

      const result = await service.getEvidenceStatus();

      expect(result).toEqual(mockStatus);
      expect(mockRepository.getEvidenceStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateEvidencePackage', () => {
    it('should generate evidence package', async () => {
      const mockPath = 'C:\\evidence\\package.zip';
      mockRepository.generateEvidencePackage.mockResolvedValue(mockPath);

      const result = await service.generateEvidencePackage();

      expect(result).toBe(mockPath);
      expect(mockRepository.generateEvidencePackage).toHaveBeenCalledTimes(1);
    });
  });

  describe('getHistoricalReports', () => {
    it('should return historical reports', async () => {
      const mockReports: ComplianceReport[] = [
        {
          id: '1',
          name: 'Report 1',
          createdAt: new Date(),
          path: 'C:\\reports\\report1.pdf',
        },
        {
          id: '2',
          name: 'Report 2',
          createdAt: new Date(),
          path: 'C:\\reports\\report2.pdf',
        },
      ];

      mockRepository.getHistoricalReports.mockResolvedValue(mockReports);

      const result = await service.getHistoricalReports();

      expect(result).toEqual(mockReports);
    });
  });

  describe('validateEvidenceCompleteness', () => {
    it('should validate evidence completeness', async () => {
      const mockValidation = {
        isValid: true,
        missingItems: [],
        warnings: [],
      };

      mockRepository.validateEvidenceCompleteness.mockResolvedValue(mockValidation);

      const result = await service.validateEvidenceCompleteness();

      expect(result).toEqual(mockValidation);
    });

    it('should detect missing items', async () => {
      const mockValidation = {
        isValid: false,
        missingItems: ['Policy Definitions', 'Audit Logs'],
        warnings: ['System snapshots are stale'],
      };

      mockRepository.validateEvidenceCompleteness.mockResolvedValue(mockValidation);

      const result = await service.validateEvidenceCompleteness();

      expect(result.isValid).toBe(false);
      expect(result.missingItems).toHaveLength(2);
    });
  });
});
