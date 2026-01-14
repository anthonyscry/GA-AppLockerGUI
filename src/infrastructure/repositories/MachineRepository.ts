/**
 * Machine Repository Implementation
 * Handles machine data access via IPC
 */

import { IMachineRepository, MachineFilter, ScanOptions } from '../../domain/interfaces/IMachineRepository';
import { MachineScan } from '../../shared/types';
import { ipcClient } from '../ipc/ipcClient';
import { IPCChannels } from '../ipc/channels';
import { logger } from '../logging/Logger';
import { NotFoundError, ExternalServiceError } from '../../domain/errors';

export class MachineRepository implements IMachineRepository {
  async findAll(): Promise<MachineScan[]> {
    try {
      logger.debug('MachineRepository.findAll called');
      const result = await ipcClient.invoke<MachineScan[] | { error: string; errorType?: string }>(IPCChannels.MACHINE.GET_ALL);

      // Check if the result is an error response from PowerShell
      if (result && typeof result === 'object' && 'error' in result) {
        const errorMsg = (result as { error: string }).error;
        const errorType = (result as { errorType?: string }).errorType || 'Unknown';
        logger.error(`AD query failed: ${errorMsg} (${errorType})`);
        throw new ExternalServiceError('Active Directory', errorMsg, new Error(errorMsg));
      }

      const machines = result as MachineScan[];
      logger.info(`Retrieved ${machines?.length || 0} machines`);
      return machines || [];
    } catch (error) {
      // Gracefully handle browser mode - return empty array instead of throwing
      if (!ipcClient.isAvailable()) {
        logger.warn('IPC not available (browser mode), returning empty machines list');
        return [];
      }
      // Re-throw ExternalServiceError as-is
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      logger.error('Failed to fetch machines', error as Error);
      throw new ExternalServiceError('Machine Service', 'Failed to fetch machines', error as Error);
    }
  }

  async findById(id: string): Promise<MachineScan | null> {
    try {
      logger.debug(`MachineRepository.findById called with id: ${id}`);
      const machine = await ipcClient.invoke<MachineScan | null>(IPCChannels.MACHINE.GET_BY_ID, id);
      if (!machine) {
        if (ipcClient.isAvailable()) {
          throw new NotFoundError('Machine', id);
        }
        return null; // Browser mode - return null instead of throwing
      }
      return machine;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      if (!ipcClient.isAvailable()) {
        logger.warn('IPC not available (browser mode), returning null');
        return null;
      }
      logger.error(`Failed to find machine ${id}`, error as Error);
      throw new ExternalServiceError('Machine Service', `Failed to find machine ${id}`, error as Error);
    }
  }

  async findByFilter(filter: MachineFilter): Promise<MachineScan[]> {
    const all = await this.findAll();
    return this.filterMachines(all, filter);
  }

  async startScan(options: ScanOptions = {}): Promise<void> {
    try {
      logger.info('Starting batch scan', { options });
      await ipcClient.invoke(IPCChannels.MACHINE.START_SCAN, options);
      logger.info('Batch scan started successfully');
    } catch (error) {
      logger.error('Failed to start scan', error as Error);
      throw new ExternalServiceError('Machine Service', 'Failed to start scan', error as Error);
    }
  }

  private filterMachines(machines: MachineScan[], filter: MachineFilter): MachineScan[] {
    return machines.filter((machine) => {
      // Null-safe property access to prevent crashes on undefined properties
      const hostname = machine?.hostname || '';
      const status = machine?.status || '';
      const riskLevel = machine?.riskLevel || '';
      const searchQuery = filter?.searchQuery?.toLowerCase() || '';
      const ouPath = filter?.ouPath?.toLowerCase() || '';

      const matchesSearch = !searchQuery ||
        hostname.toLowerCase().includes(searchQuery);
      const matchesStatus = !filter.status || filter.status === 'All' ||
        status === filter.status;
      const matchesRisk = !filter.riskLevel || filter.riskLevel === 'All' ||
        riskLevel === filter.riskLevel;
      const matchesOU = !ouPath ||
        hostname.toLowerCase().includes(ouPath);
      return matchesSearch && matchesStatus && matchesRisk && matchesOU;
    });
  }
}
