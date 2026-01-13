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
      logger.info(`Retrieved ${machines.length} machines`);
      return machines || [];
    } catch (error) {
      logger.error('Failed to fetch machines', error as Error);
      throw new ExternalServiceError('Machine Service', 'Failed to fetch machines', error as Error);
    }
  }

  async findById(id: string): Promise<MachineScan | null> {
    try {
      logger.debug(`MachineRepository.findById called with id: ${id}`);
      const machine = await ipcClient.invoke<MachineScan | null>(IPCChannels.MACHINE.GET_BY_ID, id);
      if (!machine) {
        throw new NotFoundError('Machine', id);
      }
      return machine;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
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
