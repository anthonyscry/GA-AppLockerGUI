# API Documentation
## GA-AppLocker Dashboard Services API

This document describes the service layer API for the GA-AppLocker Dashboard application.

---

## Table of Contents

- [MachineService](#machineservice)
- [PolicyService](#policyservice)
- [EventService](#eventservice)
- [ADService](#adservice)
- [ComplianceService](#complianceservice)

---

## MachineService

### `getAllMachines(): Promise<MachineScan[]>`

Fetches all machines from the repository.

**Returns:** Array of machine scan objects

**Example:**
```typescript
const machines = await machineService.getAllMachines();
```

---

### `getMachineById(id: string): Promise<MachineScan | null>`

Fetches a single machine by ID.

**Parameters:**
- `id` (string): Machine identifier

**Returns:** Machine scan object or null if not found

**Example:**
```typescript
const machine = await machineService.getMachineById('machine-1');
```

---

### `filterMachines(machines: MachineScan[], filter: MachineFilter): Promise<MachineScan[]>`

Filters machines based on criteria.

**Parameters:**
- `machines` (MachineScan[]): Array of machines to filter
- `filter` (MachineFilter): Filter criteria

**Returns:** Filtered array of machines

**Example:**
```typescript
const filtered = await machineService.filterMachines(machines, {
  status: 'Online',
  riskLevel: 'Low'
});
```

---

### `startBatchScan(options?: ScanOptions): Promise<void>`

Starts a batch scan operation.

**Parameters:**
- `options` (ScanOptions, optional): Scan configuration

**Example:**
```typescript
await machineService.startBatchScan({
  targetOUs: ['OU=Workstations'],
  timeout: 30000
});
```

---

## PolicyService

### `getInventory(): Promise<InventoryItem[]>`

Fetches all inventory items.

**Returns:** Array of inventory items

---

### `getTrustedPublishers(): Promise<TrustedPublisher[]>`

Fetches all trusted publishers.

**Returns:** Array of trusted publisher objects

---

### `runHealthCheck(phase: PolicyPhase): Promise<HealthCheckResult>`

Runs a policy health check for the specified phase.

**Parameters:**
- `phase` (PolicyPhase): Deployment phase

**Returns:** Health check results with critical, warning, info counts and score

---

### `createRule(options: RuleCreationOptions): Promise<PolicyRule>`

Creates a new policy rule.

**Parameters:**
- `options` (RuleCreationOptions): Rule configuration

**Returns:** Created policy rule

---

### `batchGenerateRules(items: InventoryItem[], outputPath: string, options?): Promise<{success: boolean, outputPath?: string, error?: string}>`

Batch generates rules for multiple inventory items.

**Parameters:**
- `items` (InventoryItem[]): Items to generate rules for
- `outputPath` (string): Output file path
- `options` (object, optional): Generation options

**Returns:** Result object with success status

---

### `groupByPublisher(items: InventoryItem[]): Record<string, InventoryItem[]>`

Groups inventory items by publisher.

**Parameters:**
- `items` (InventoryItem[]): Items to group

**Returns:** Object mapping publisher names to item arrays

---

### `detectDuplicates(items: InventoryItem[]): DuplicateReport`

Detects duplicate entries in inventory items.

**Parameters:**
- `items` (InventoryItem[]): Items to check

**Returns:** Duplicate detection report

---

## EventService

### `getAllEvents(): Promise<AppEvent[]>`

Fetches all AppLocker events.

**Returns:** Array of event objects

---

### `filterEvents(events: AppEvent[], filter: EventFilter): Promise<AppEvent[]>`

Filters events based on criteria.

**Parameters:**
- `events` (AppEvent[]): Events to filter
- `filter` (EventFilter): Filter criteria

**Returns:** Filtered array of events

---

### `getEventStats(): Promise<EventStats>`

Gets event statistics.

**Returns:** Statistics object with totals and breakdowns

---

### `exportToCSV(events: AppEvent[]): Promise<string>`

Exports events to CSV file.

**Parameters:**
- `events` (AppEvent[]): Events to export

**Returns:** Path to exported CSV file

---

## ADService

### `getAllUsers(): Promise<ADUser[]>`

Fetches all Active Directory users.

**Returns:** Array of AD user objects

---

### `getUserById(id: string): Promise<ADUser | null>`

Fetches a user by ID.

**Parameters:**
- `id` (string): User identifier

**Returns:** User object or null

---

### `addUserToGroup(userId: string, groupName: string): Promise<void>`

Adds a user to an AppLocker security group.

**Parameters:**
- `userId` (string): User identifier
- `groupName` (string): Group name

---

### `removeUserFromGroup(userId: string, groupName: string): Promise<void>`

Removes a user from an AppLocker security group.

**Parameters:**
- `userId` (string): User identifier
- `groupName` (string): Group name

---

### `getAppLockerGroups(): Promise<string[]>`

Fetches available AppLocker groups.

**Returns:** Array of group names

---

## ComplianceService

### `getEvidenceStatus(): Promise<EvidenceStatus>`

Gets evidence readiness status.

**Returns:** Status object with policy definitions, audit logs, and snapshot status

---

### `generateEvidencePackage(): Promise<string>`

Generates a CORA evidence package.

**Returns:** Path to generated package

---

### `getHistoricalReports(): Promise<ComplianceReport[]>`

Fetches historical compliance reports.

**Returns:** Array of report objects

---

### `validateEvidenceCompleteness(): Promise<ValidationResult>`

Validates evidence completeness.

**Returns:** Validation result with missing items and warnings

---

## Usage in Components

All services are available through the `useAppServices()` hook:

```typescript
import { useAppServices } from '../src/presentation/contexts/AppContext';

const MyComponent = () => {
  const { machine, policy, event, ad, compliance } = useAppServices();
  
  // Use services...
};
```

---

## Error Handling

All services throw domain-specific errors:
- `ValidationError`: Invalid input
- `NotFoundError`: Resource not found
- `ExternalServiceError`: IPC or external service failure

Handle errors appropriately:

```typescript
try {
  await service.performAction();
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
  } else if (error instanceof NotFoundError) {
    // Handle not found
  }
}
```

---

*Last Updated: 2024*
