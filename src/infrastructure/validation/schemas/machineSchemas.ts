/**
 * Machine Validation Schemas
 * Using Zod for runtime validation
 */

import { z } from 'zod';

export const MachineFilterSchema = z.object({
  searchQuery: z.string().optional(),
  ouPath: z.string().optional(),
  status: z.enum(['All', 'Online', 'Offline', 'Scanning']).optional(),
  riskLevel: z.enum(['All', 'Low', 'Medium', 'High']).optional(),
});

export const ScanOptionsSchema = z.object({
  targetOUs: z.array(z.string()).optional(),
  timeout: z.number().positive().optional(),
});

export type MachineFilterInput = z.infer<typeof MachineFilterSchema>;
export type ScanOptionsInput = z.infer<typeof ScanOptionsSchema>;
