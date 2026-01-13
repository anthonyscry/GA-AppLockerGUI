# Project Structure

## Directory Organization

```
GA-AppLockerGUI/
│
├── agents/                    # AI agent prompts for Cursor
│   ├── 01-project-lead.md
│   ├── 02-code-validator.md
│   └── ...
│
├── assets/                     # Static assets (logos, images)
│   ├── ga-logo.svg
│   └── general_atomics_logo.jpg
│
├── components/                 # React UI components
│   ├── Dashboard.tsx
│   ├── ScanModule.tsx
│   ├── PolicyModule.tsx
│   ├── EventsModule.tsx
│   ├── ADManagementModule.tsx
│   ├── ComplianceModule.tsx
│   ├── InventoryCompareModule.tsx
│   ├── Sidebar.tsx
│   └── ErrorBoundary.tsx
│
├── config/                     # Application configuration
│   └── appConfig.cjs           # Main config (CommonJS)
│
├── docs/                       # Documentation
│   ├── AUTOMATION_FEATURES_PROPOSAL.md
│   ├── DEBUGGING_RUNBOOK.md
│   ├── GA-ASI_APPLOCKER_IMPLEMENTATION_GUIDE.md
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── QUICK_REFERENCE.md
│   ├── PROJECT_STRUCTURE.md    # This file
│   └── CLEANUP_SUMMARY.md
│
├── electron/                   # Electron main process
│   ├── main.cjs                # Entry point
│   ├── appLifecycle.cjs        # App lifecycle handlers
│   ├── windowManager.cjs       # Window management
│   ├── security.cjs            # Security configuration
│   ├── preload.cjs             # Preload script
│   ├── constants.cjs          # Constants
│   └── ipc/                    # Inter-process communication
│       ├── ipcHandlers.cjs     # Main IPC handlers
│       ├── powerShellHandler.cjs
│       ├── setup.ts
│       └── handlers/           # TypeScript handler modules
│           ├── adHandlers.ts
│           ├── complianceHandlers.ts
│           ├── eventHandlers.ts
│           ├── machineHandlers.ts
│           └── policyHandlers.ts
│
├── hooks/                      # Legacy hooks (kept for docs)
│   ├── useAsync.ts
│   ├── useDebounce.ts
│   ├── useFiltering.ts
│   └── useModal.ts
│
├── scripts/                    # PowerShell scripts
│   ├── GA-AppLocker.psm1      # Main PowerShell module
│   ├── Deploy-AppLockerPolicy.ps1
│   ├── Generate-BatchRules.ps1
│   ├── Generate-RulesFromArtifacts.ps1
│   ├── Get-ComprehensiveScanArtifacts.ps1
│   ├── Get-IncrementalPolicyUpdate.ps1
│   ├── Detect-DuplicateRules.ps1
│   ├── Merge-AppLockerPolicies.ps1
│   ├── New-RulesFromInventory.ps1
│   ├── Test-RuleHealth.ps1
│   ├── setup.ps1
│   ├── verify-startup.js
│   └── templates/              # Policy templates
│       ├── baseline-policy-template.xml
│       └── inventory-template.csv
│
├── services/                   # Legacy services (kept for docs)
│   ├── ADService.ts
│   ├── ComplianceService.ts
│   ├── EventService.ts
│   ├── MachineService.ts
│   └── PolicyService.ts
│
├── src/                        # Main source code (Clean Architecture)
│   ├── application/            # Application layer (business logic)
│   │   └── services/
│   │       ├── ADService.ts
│   │       ├── ComplianceService.ts
│   │       ├── EventService.ts
│   │       ├── MachineService.ts
│   │       └── PolicyService.ts
│   │
│   ├── domain/                 # Domain layer (core business)
│   │   ├── errors/             # Custom error types
│   │   └── interfaces/          # Repository interfaces
│   │
│   ├── infrastructure/         # Infrastructure layer
│   │   ├── di/                 # Dependency injection
│   │   ├── ipc/                # IPC client
│   │   ├── logging/            # Logging
│   │   ├── repositories/       # Data access
│   │   └── validation/        # Validation schemas
│   │
│   ├── presentation/           # Presentation layer (UI)
│   │   ├── contexts/           # React contexts
│   │   └── hooks/              # React hooks
│   │
│   └── shared/                 # Shared code
│       ├── constants/          # Shared constants
│       └── types/              # TypeScript types (canonical)
│
├── utils/                      # Utility functions
│   ├── filterUtils.ts
│   ├── formatUtils.ts
│   ├── logger.ts
│   └── validationUtils.ts
│
├── App.tsx                      # Root React component
├── index.tsx                    # React entry point
├── index.html                   # HTML template
├── constants.tsx                # UI constants
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript config
├── tsconfig.node.json          # TypeScript config for Node
├── package.json                # NPM dependencies
└── README.md                   # Main documentation
```

## Key Files

### Entry Points
- **Electron:** `electron/main.cjs` (package.json main field)
- **React:** `index.tsx`
- **HTML:** `index.html`

### Configuration
- **App Config:** `config/appConfig.cjs`
- **Vite:** `vite.config.ts`
- **TypeScript:** `tsconfig.json`, `tsconfig.node.json`

### Documentation
- **Main:** `README.md`
- **Quick Start:** `START_HERE.md`
- **Implementation:** `IMPLEMENTATION_COMPLETE.md`
- **Features:** `docs/AUTOMATION_FEATURES_PROPOSAL.md`

## Architecture

### Clean Architecture Layers

1. **Presentation Layer** (`src/presentation/`)
   - React components (in `components/`)
   - React hooks (`src/presentation/hooks/`)
   - React contexts (`src/presentation/contexts/`)

2. **Application Layer** (`src/application/`)
   - Business logic services
   - Use cases
   - Application-specific types

3. **Domain Layer** (`src/domain/`)
   - Core business entities
   - Repository interfaces
   - Domain errors

4. **Infrastructure Layer** (`src/infrastructure/`)
   - Repository implementations
   - IPC communication
   - Logging
   - Dependency injection

### Electron Architecture

- **Main Process:** `electron/main.cjs` (Node.js)
- **Renderer Process:** React app (browser-like)
- **IPC:** Secure communication between processes
- **Preload:** `electron/preload.cjs` (exposes safe APIs)

## File Naming Conventions

- **TypeScript:** `.ts`, `.tsx` (React components)
- **JavaScript:** `.cjs` (CommonJS for Electron), `.js` (legacy, being phased out)
- **PowerShell:** `.ps1` (scripts), `.psm1` (modules)
- **Documentation:** `.md` (Markdown)

## Import Paths

### Current (Preferred)
```typescript
// Types
import { AppView } from '../src/shared/types';

// Services
import { MachineService } from '../src/application/services/MachineService';

// Hooks
import { useAsync } from '../src/presentation/hooks/useAsync';
```

### Legacy (Deprecated)
```typescript
// Old (may still work but not preferred)
import { AppView } from '../types';
import { MachineService } from '../services';
import { useAsync } from '../hooks';
```

## Notes

- **Legacy directories** (`services/`, `hooks/`) are kept for documentation examples but actual code uses `src/` structure
- **All Electron files** use `.cjs` extension (CommonJS)
- **Type definitions** are centralized in `src/shared/types/index.ts`
