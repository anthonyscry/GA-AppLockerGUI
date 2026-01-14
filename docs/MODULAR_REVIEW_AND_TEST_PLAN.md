# Modular Review & Programmatic Test Plan (Phased Scrum)

## Purpose
Establish a repeatable, programmatic review and test plan for each major module of the GA-AppLocker Dashboard. This defines scope, test hooks, and a phased scrum delivery plan that can be executed in sprints.

---

## Module Inventory (UI → IPC → Scripts)
Each module is evaluated across UI behaviors, IPC contracts, and PowerShell/script behavior where applicable.

| Module | UI Entry | IPC Touchpoints (expected) | Script/OS Interactions | Risks to Validate |
| --- | --- | --- | --- | --- |
| Dashboard | `components/Dashboard.tsx` | `event:getStats`, `machine:getAll` | None | Stats shape mismatches, empty states |
| Scan | `components/ScanModule.tsx` | `machine:startScan`, `ad:getOUsWithComputers`, `machine:getAll` | `Start-BatchScan.ps1` | OU discovery reliability, online-only scan, credential mapping |
| Events | `components/EventsModule.tsx` | `events:backup`, `event:getEvents`, `event:getStats` | `wevtutil`, `Get-WinEvent` | Output path correctness, multi-system exports |
| Policy | `components/PolicyModule.tsx` | `policy:*` handlers | `New-AppLockerPolicy`, `Set-AppLockerPolicy` | OU targeting, audit/enforce mode |
| Rule Generator | `components/RuleGeneratorModule.tsx` | `rules:*` handlers | Rule generation scripts | Dedupe, output location, template actions |
| Compliance | `components/ComplianceModule.tsx` | `compliance:*` handlers | Evidence collection scripts | Empty artifact folders, export reliability |
| AD Management | `components/ADManagementModule.tsx` | `ad:*` handlers | AD module | Null-safe user rendering, search stability |
| Inventory Compare | `components/InventoryCompareModule.tsx` | `inventory:*` handlers | Snapshot compare scripts | Diff accuracy, empty datasets |

---

## Programmatic Review Checklist (Per Module)
The following items should be executed for each module and tracked as pass/fail in each sprint.

### 1) UI Rendering & State
- [ ] Initial render succeeds with empty data.
- [ ] Loading and error states are visible and actionable.
- [ ] Inputs accept expected data types and validate errors.
- [ ] Critical actions disabled when prerequisites missing.

### 2) IPC Contract Validation
- [ ] IPC payload shape matches renderer expectations.
- [ ] Required fields are always returned (with safe defaults).
- [ ] Errors are serialized and surfaced in UI.
- [ ] Async calls are cancellable or debounced where needed.

### 3) Script & OS Integration
- [ ] PowerShell script invoked with validated input.
- [ ] Output path is deterministic and user-visible.
- [ ] Expected files created in `C:\AppLocker`.
- [ ] Remote calls are bounded (timeouts, online-only filters).

### 4) Data Integrity
- [ ] De-duplication (rules, artifacts, events) validated.
- [ ] Merge/append paths preserve existing data.
- [ ] Export formats are consistent (CSV/JSON/CLIXML).

---

## Programmatic Test Layers

### Unit Tests (Jest)
**Goal:** Validate data helpers, transformation logic, IPC response mapping.
- Focus on parsing, filtering, and mapping utilities.
- Ensure edge cases: empty arrays, missing properties, malformed inputs.

Run:
```bash
npm test
```

### Integration Tests (Node + IPC mocks)
**Goal:** Validate renderer → IPC contract shapes without OS dependencies.
- Use IPC handler unit tests or renderer tests with mocked IPC bridge.
- Verify response shape parity with repository expectations.

Run:
```bash
npm test
```

### E2E Tests (Playwright)
**Goal:** Validate critical workflows across modules.
- App launch, navigate modules, fill required fields.
- Simulate expected responses via mocks or fixtures.

Run:
```bash
npm run test:e2e
```

---

## Sprint-Based (Phased Scrum) Execution Plan

### Sprint 1 — **Discovery & Contract Alignment**
**Focus:** Make IPC contracts stable and observable.
- Inventory all IPC handlers and expected response shapes.
- Add contract tests for `event:getStats`, `machine:startScan`, `events:backup`.
- Add UI error boundary verification for AD Manager and Scan modules.

**Definition of Done**
- Contract tests added and passing.
- All modules show an explicit error message when IPC fails.

### Sprint 2 — **Reliability & Path Consistency**
**Focus:** Deterministic output locations and online-only behavior.
- Enforce `C:\AppLocker` output defaults for events, evidence, rules.
- Ensure online-only filters are respected in scan workflows.
- Validate WinRM command inputs and credential handling.

**Definition of Done**
- All file output paths displayed to user and created as expected.
- Scan only targets online Windows hosts.

### Sprint 3 — **Rule Generation & Policy Deployment**
**Focus:** Rule creation and deployment workflow.
- Validate dedupe during rule generation.
- Confirm policy merges for workstation/server/DC.
- Confirm OU targeting in audit mode with clear logs.

**Definition of Done**
- Rule generator produces consistent, deduped outputs.
- Policy deployment is logged and visible to the user.

### Sprint 4 — **Compliance & Event Integrity**
**Focus:** Evidence collection and event backup accuracy.
- Validate compliance artifacts are written and non-empty.
- Confirm event backups for local/multi-system modes.
- Ensure summary counts match exported results.

**Definition of Done**
- Compliance evidence exports contain expected artifacts.
- Event backups match expected event counts.

---

## Programmatic QA Gate (Per Sprint)
A sprint is considered complete only if:
- ✅ Unit test suite passes.
- ✅ Critical E2E flows pass.
- ✅ No IPC contract mismatches exist for in-scope modules.
- ✅ Output artifacts are created under `C:\AppLocker`.

---

## Team Review Summary (Cross-Functional)
Documented review expectations for each role during the sprint review and QA gate.

| Role | Focus Areas | Evidence to Capture |
| --- | --- | --- |
| QA | Test results, coverage gaps, flaky tests | Test logs, screenshots, failing cases |
| Debug | Root causes and fixes | Repro steps, patch notes |
| Security | Input validation, permissions, paths | Sanitization notes, blocked paths |
| UX | Error states, flow clarity | UX notes, UI recordings |
| DevOps | CI status, build artifacts | CI run links, build output |

---

## Module Correctness Review (Status Matrix)
Use this matrix to record correctness reviews and functional validation for each module.

| Module | UI Validated | IPC Contract Validated | Script/OS Validated | Notes |
| --- | --- | --- | --- | --- |
| Dashboard | ☐ | ☐ | N/A |  |
| Scan | ☐ | ☐ | ☐ |  |
| Events | ☐ | ☐ | ☐ |  |
| Policy | ☐ | ☐ | ☐ |  |
| Rule Generator | ☐ | ☐ | ☐ |  |
| Compliance | ☐ | ☐ | ☐ |  |
| AD Management | ☐ | ☐ | ☐ |  |
| Inventory Compare | ☐ | ☐ | ☐ |  |

---

## Documentation Conventions
When changes are delivered, record them in this file and in the relevant module README/docs with:
- What changed and why.
- Test coverage performed (unit/integration/E2E).
- Output paths and artifacts created.
- Known gaps or follow-ups for the next sprint.

---

## Recommended Next Actions
1. Add IPC contract tests for `event:getStats`, `machine:startScan`, and `events:backup`.
2. Add fixture-based E2E flow for Scan + Events + Policy modules.
3. Track the checklist above in a sprint board and record pass/fail results.
