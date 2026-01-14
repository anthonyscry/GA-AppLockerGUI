/**
 * Machine Service
 * Business logic for machine operations
 */

import { IMachineRepository, MachineFilter, ScanOptions } from '../../domain/interfaces/IMachineRepository';
import { BatchScanResponse, MachineScan } from '../../shared/types';
import { logger } from '../../infrastructure/logging/Logger';
import { MachineValidator } from '../../infrastructure/validation/validators/MachineValidator';

export class MachineService {
  private readonly validator: MachineValidator;

  constructor(
    private readonly repository: IMachineRepository,
    validator?: MachineValidator
  ) {
    this.validator = validator || new MachineValidator();
  }

  /**
   * Get all machines
   */
  async getAllMachines(): Promise<MachineScan[]> {
    logger.debug('MachineService.getAllMachines called');
    return this.repository.findAll();
  }

  /**
   * Get machine by ID
   */
  async getMachineById(id: string): Promise<MachineScan | null> {
    logger.debug(`MachineService.getMachineById called with id: ${id}`);
    return this.repository.findById(id);
  }

  /**
   * Filter machines based on criteria
   */
  async filterMachines(_machines: MachineScan[], filter: MachineFilter): Promise<MachineScan[]> {
    this.validator.validateFilter(filter);
    return this.repository.findByFilter(filter);
  }

  /**
   * Start a batch scan operation
   */
  async startBatchScan(options: ScanOptions = {}): Promise<BatchScanResponse> {
    this.validator.validateScanOptions(options);
    logger.info('Starting batch scan', { options });
    return this.repository.startScan(options);
  }
}
