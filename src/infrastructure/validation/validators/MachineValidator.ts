/**
 * Machine Validator
 * Validates machine-related inputs
 */

import { MachineFilterSchema, ScanOptionsSchema } from '../schemas/machineSchemas';
import { ValidationError } from '../../../domain/errors';
import { MachineFilter, ScanOptions } from '../../../domain/interfaces/IMachineRepository';

export class MachineValidator {
  validateFilter(filter: unknown): asserts filter is MachineFilter {
    try {
      MachineFilterSchema.parse(filter);
    } catch (error) {
      throw new ValidationError('Invalid machine filter', undefined, error as Error, { filter });
    }
  }

  validateScanOptions(options: unknown): asserts options is ScanOptions {
    try {
      ScanOptionsSchema.parse(options);
    } catch (error) {
      throw new ValidationError('Invalid scan options', undefined, error as Error, { options });
    }
  }
}
