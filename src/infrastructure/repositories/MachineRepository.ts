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
      const machines = await ipcClient.invoke<MachineScan[]>(IPCChannels.MACHINE.GET_ALL);
      logger.info(`Retrieved ${machines?.length || 0} machines`);
      return machines || [];
    } catch (error) {
      // Gracefully handle browser mode - return empty array instead of throwing
      if (!ipcClient.isAvailable()) {
        logger.warn('IPC not available (browser mode), returning empty machines list');
        return [];
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
      const matchesSearch = !filter.searchQuery ||
        machine.hostname.toLowerCase().includes(filter.searchQuery.toLowerCase());
      const matchesStatus = !filter.status || filter.status === 'All' ||
        machine.status === filter.status;
      const matchesRisk = !filter.riskLevel || filter.riskLevel === 'All' ||
        machine.riskLevel === filter.riskLevel;
      const matchesOU = !filter.ouPath ||
        machine.hostname.toLowerCase().includes(filter.ouPath.toLowerCase());
      return matchesSearch && matchesStatus && matchesRisk && matchesOU;
    });
  }
}
