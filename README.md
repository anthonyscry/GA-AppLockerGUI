# GA-AppLocker Dashboard

A comprehensive administrative dashboard for the GA-AppLocker toolkit, enabling remote scanning, policy generation, event monitoring, and compliance reporting.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## Features

- **Dashboard** - Overview of managed systems, blocked apps, and rule health
- **Remote Scan** - Collect software inventory via WinRM from AD-managed computers
- **Local Scan** - Scan the current machine without WinRM setup (v1.2.10)
- **Policy Lab** - Design, merge, and validate AppLocker XML policies (tabbed interface)
- **Event Monitor** - Real-time AppLocker audit event ingestion (8003/8004)
- **Event Backup** - Backup AppLocker events with month folder organization (v1.2.10)
- **AD Manager** - Drag-and-drop user management for AppLocker security groups
- **Compliance** - Generate NIST compliance evidence packages and regulatory reports
- **OU-Based Grouping** - Auto-categorize machines by OU (Workstation/Server/DC)
- **Deploy to OU** - One-click GPO deployment with OU auto-linking
- **Machine Selection** - Checkbox selection for targeted batch scanning (v1.2.10)
- **Portable App** - All artifacts saved relative to app location (v1.2.10)

## Quick Start

**👉 For first-time setup, see [START_HERE.md](./START_HERE.md)**

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

4. In a separate terminal, start Electron:
   ```bash
   npm run electron:dev
   ```

### Building for Production

To build the Windows executable:

```bash
npm run electron:build:portable
```

This will:
1. Build the React app using Vite
2. Package it with Electron
3. Create a portable EXE in the `release` directory

The output will be:
- `release/GA-AppLocker Dashboard-1.2.10-x64.exe` - Portable executable (no install required)
- `release/win-unpacked/` - Unpacked application (for testing)

### Available Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Build web assets only (Vite)
- `npm run electron:dev` - Run Electron in development mode
- `npm run electron:build` - Build for current platform
- `npm run electron:build:portable` - Build portable Windows EXE
- `npm run electron:build:win` - Build Windows installer
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

## Requirements

- Node.js (v18 or higher)
- Windows 10/11 or Windows Server 2019+
- npm or yarn
- **For full functionality:** Run on Domain Controller with DC Admin credentials

## Key Capabilities

### 1. Domain Auto-Detection
When running on a Domain Controller:
- Auto-detects domain name (FQDN)
- Shows "DC Admin Mode" indicator
- Uses current session credentials for WinRM

### 2. OU-Based Machine Grouping
Machines are automatically categorized based on their OU:
- **Workstations** - OU contains "Workstation", "Desktop", "WS"
- **Servers** - OU contains "Server", "SRV"
- **Domain Controllers** - OU="Domain Controllers"

### 3. Phase-Based Deployment
| Phase | Enforcement | Rule Types |
|-------|-------------|------------|
| Phase 1 | Audit Only | EXE only |
| Phase 2 | Audit Only | EXE + Script |
| Phase 3 | Audit Only | EXE + Script + MSI |
| Phase 4 | Enabled | All (including DLL) |

### 4. Smart Rule Generation
- **Publisher rules** - Preferred for signed software
- **Hash rules** - Fallback for unsigned executables
- **Path rules** - Avoided (too restrictive)

## Architecture

The application follows **Clean Architecture** principles with clear separation of concerns:

### Layer Structure

```
┌─────────────────────────────────────┐
│   Presentation Layer                 │
│   - React Components                 │
│   - Hooks (useAppServices, etc.)   │
│   - Contexts (AppProvider)          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Application Layer                 │
│   - Services (Business Logic)       │
│   - Use Cases                       │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Domain Layer                      │
│   - Interfaces (Repositories)      │
│   - Errors                         │
│   - Types                          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Infrastructure Layer              │
│   - Repositories (Data Access)      │
│   - IPC (Communication)            │
│   - Logging                         │
│   - Validation                      │
│   - DI Container                    │
└──────────────────────────────────────┘
```

### Key Features

- **Dependency Injection**: Services are injected via DI container
- **Repository Pattern**: Data access abstracted through repositories
- **Error Handling**: Centralized error hierarchy with custom error types
- **Logging**: Structured logging infrastructure
- **Type Safety**: Full TypeScript support throughout
- **Testing**: Jest test infrastructure with unit and integration tests

### Services

- **MachineService**: Machine inventory and scanning operations
- **PolicyService**: Policy operations, rule generation, health checks
- **EventService**: Event filtering, statistics, exports
- **ADService**: Active Directory operations and group management
- **ComplianceService**: Compliance evidence generation

For detailed API documentation, see [docs/API.md](./docs/API.md).

## PowerShell Scripts

| Script | Purpose |
|--------|---------|
| `GA-AppLocker.psm1` | Main PowerShell module |
| `Deploy-AppLockerPolicy.ps1` | Deploy to GPO with OU linking |
| `Get-ComprehensiveScanArtifacts.ps1` | Full machine artifact scan |
| `Get-AppLockerAuditLogs.ps1` | Collect 8003/8004 events |
| `Merge-AppLockerPolicies.ps1` | Combine multiple policies |
| `Test-RuleHealth.ps1` | Validate policy rules |
| `Generate-RulesFromArtifacts.ps1` | Smart rule generation |

## Application Details

- **Version**: 1.2.10
- **Author**: Tony Tran, ISSO, GA-ASI
- **Built with**: React, TypeScript, Electron, Vite, Tailwind CSS
- **Architecture**: Clean Architecture with Dependency Injection
- **Window Size**: 1000x700 (minimum 800x550)
- **App Icon**: 4-pointed diamond (GA-ASI branding)

## Recent Changes (v1.2.10)

### New Features
- **Local Scan** - Scan local machine without WinRM (queries registry + file system)
- **Machine Selection** - Checkbox-based selection for targeted batch scanning
- **Event Backup** - Backup AppLocker events to `.\backups\events\YYYY-MM\` with unique filenames
- **Relative Paths** - All artifacts saved relative to app location for portability

### Bug Fixes
- **GPO Modal** - Fixed modal cutoff by using fixed positioning
- **Rule Health Score** - Shows "N/A" when no rules configured
- **Connection Status** - Shows Domain/Host format (domain\hostname or workgroup)

### UI Improvements
- Reduced app window size (1000x700 from 1200x800)
- Rules Builder as inline tab instead of modal (fixes scrolling)
- New 4-pointed diamond app icon
- Enhanced Help section with deployment phases and Event IDs

### Artifact Paths
| Artifact | Default Path |
|----------|--------------|
| Scan Results | `.\scans\` |
| Policies | `.\policies\` |
| Compliance | `.\compliance\` |
| Event Backups | `.\backups\events\` |

## Notes

- The built application is self-contained and doesn't require Node.js to run
- All dependencies are bundled with the application
- The application uses Tailwind CSS bundled locally (fully standalone, no internet required)
- Designed to run on Domain Controller with DC Admin privileges

## Troubleshooting

- If the build fails, ensure all dependencies are installed: `npm install`
- For icon issues, you can add an `icon.ico` file to the `assets` directory
- If you encounter module resolution errors, delete `node_modules` and `package-lock.json`, then reinstall

For more detailed build instructions, see [BUILD.md](BUILD.md).

## Vision Complete ✅

This application fully implements the vision:
1. ✅ Scan AD for hosts (with domain auto-detection)
2. ✅ Scan hosts for artifacts (via WinRM)
3. ✅ Ingest artifacts seamlessly (multi-format)
4. ✅ Auto-create rules (best practices)
5. ✅ Group by machine type (OU-based)
6. ✅ Merge policies (conflict resolution)
7. ✅ Create policy (validated XML)
8. ✅ Deploy to OUs (with auto-linking and phases)

See [VISION_STATUS_REPORT.md](./VISION_STATUS_REPORT.md) for details.
