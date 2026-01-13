/**
 * Dependency Injection Setup
 * Configures all services and their dependencies
 */

import { container } from './Container';
import { MachineRepository } from '../repositories/MachineRepository';
import { PolicyRepository } from '../repositories/PolicyRepository';
import { EventRepository } from '../repositories/EventRepository';
import { ADRepository } from '../repositories/ADRepository';
import { ComplianceRepository } from '../repositories/ComplianceRepository';
import { MachineService } from '../../application/services/MachineService';
import { PolicyService } from '../../application/services/PolicyService';
import { EventService } from '../../application/services/EventService';
import { ADService } from '../../application/services/ADService';
import { ComplianceService } from '../../application/services/ComplianceService';

/**
 * Setup dependency injection container
 * Call this once at application startup
 */
export function setupContainer(): void {
  // Register Repositories
  container.register('IMachineRepository', MachineRepository);
  container.register('IPolicyRepository', PolicyRepository);
  container.register('IEventRepository', EventRepository);
  container.register('IADRepository', ADRepository);
  container.register('IComplianceRepository', ComplianceRepository);

  // Register Services with dependencies
  container.register('MachineService', MachineService, {
    dependencies: ['IMachineRepository'],
  });

  container.register('PolicyService', PolicyService, {
    dependencies: ['IPolicyRepository'],
  });

  container.register('EventService', EventService, {
    dependencies: ['IEventRepository'],
  });

  container.register('ADService', ADService, {
    dependencies: ['IADRepository'],
  });

  container.register('ComplianceService', ComplianceService, {
    dependencies: ['IComplianceRepository'],
  });
}
