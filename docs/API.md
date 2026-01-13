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
- [AuditLogger](#auditlogger)

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

## AuditLogger

Security audit logging for compliance and tracking sensitive operations.

### `audit.policyDeployed(policyName, targetOU, success, error?)`

Logs a policy deployment event.

**Parameters:**
- `policyName` (string): Name of the deployed policy
- `targetOU` (string): Target Organizational Unit
- `success` (boolean): Whether deployment succeeded
- `error` (string, optional): Error message if failed

**Example:**
```typescript
import { audit } from '../src/infrastructure/logging';

audit.policyDeployed('Workstation-Policy', 'OU=Workstations,DC=corp,DC=local', true);
```

---

### `audit.userAddedToGroup(username, groupName, success, error?)`

Logs a user group membership change.

**Parameters:**
- `username` (string): User being modified
- `groupName` (string): Target security group
- `success` (boolean): Whether operation succeeded
- `error` (string, optional): Error message if failed

---

### `audit.scanInitiated(targets, scanType)`

Logs the start of a scan operation.

**Parameters:**
- `targets` (string[]): Target machines
- `scanType` (string): Type of scan being performed

---

### `audit.scanCompleted(targets, resultsCount, duration)`

Logs scan completion.

**Parameters:**
- `targets` (string[]): Target machines
- `resultsCount` (number): Number of results found
- `duration` (number): Duration in milliseconds

---

### `auditLogger.getEntries(filter?)`

Gets audit log entries with optional filtering.

**Parameters:**
- `filter` (object, optional): Filter criteria
  - `action` (AuditAction): Filter by action type
  - `severity` (AuditSeverity): Filter by severity
  - `user` (string): Filter by user
  - `startDate` (Date): Start date range
  - `endDate` (Date): End date range
  - `success` (boolean): Filter by success/failure

**Returns:** Array of audit entries

**Example:**
```typescript
import { auditLogger, AuditAction, AuditSeverity } from '../src/infrastructure/logging';

// Get all critical failures
const failures = auditLogger.getEntries({
  severity: AuditSeverity.CRITICAL,
  success: false
});
```

---

### `auditLogger.exportToCSV()`

Exports audit log to CSV format.

**Returns:** CSV string

---

### `auditLogger.getStats()`

Gets audit statistics.

**Returns:** Statistics object with:
- `total`: Total entries
- `byAction`: Count by action type
- `bySeverity`: Count by severity
- `successRate`: Percentage of successful operations
- `recentFailures`: Last 10 failed operations

---

### Audit Actions

| Action | Severity | Description |
|--------|----------|-------------|
| `POLICY_DEPLOYED` | CRITICAL | Policy deployed to GPO |
| `POLICY_DELETED` | CRITICAL | Policy deleted |
| `POLICY_CREATED` | HIGH | New policy created |
| `POLICY_MODIFIED` | HIGH | Policy modified |
| `USER_ADDED_TO_GROUP` | HIGH | User added to security group |
| `USER_REMOVED_FROM_GROUP` | HIGH | User removed from security group |
| `SCAN_INITIATED` | MEDIUM | Scan started |
| `SCAN_COMPLETED` | LOW | Scan finished |
| `EXPORT_DATA` | MEDIUM | Data exported |
| `APP_STARTED` | LOW | Application started |

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

*Last Updated: January 2026 (v1.2.10)*
