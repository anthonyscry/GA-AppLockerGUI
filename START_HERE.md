# 🚀 GA-AppLocker Dashboard - Quick Start

## ✅ App Status: READY TO RUN (v1.2.8)

All features are implemented and the app is ready to use!

## 🏃 Quick Start

### Step 1: Download & Run (Easiest)

1. Download the portable EXE from GitHub Releases:
   - `GA-AppLocker Dashboard-1.2.8-x64.exe`
2. Run on a **Domain Controller** as a **DC Admin**
3. The app will auto-detect your domain

### Step 2: Development Mode

1. **Start the Vite dev server:**
   ```bash
   npm run dev
   ```

2. **In a separate terminal, start Electron:**
   ```bash
   npm run electron:dev
   ```

### Production Build

1. **Build portable EXE (recommended):**
   ```bash
   npm run electron:build:portable
   ```
   Creates: `release/GA-AppLocker Dashboard-1.2.8-x64.exe`

2. **Or create Windows installer:**
   ```bash
   npm run electron:build:win
   ```

## ✅ Complete Features

### Core Workflow
- ✅ **Dashboard** - Overview of managed systems with real data
- ✅ **Remote Scan** - Collect software inventory via WinRM
- ✅ **Policy Lab** - Design and validate AppLocker policies
- ✅ **Event Monitor** - Real-time 8003/8004 event ingestion
- ✅ **AD Manager** - Manage AppLocker security groups
- ✅ **Compliance** - Generate NIST compliance evidence

### Advanced Features
- ✅ **Domain Auto-Detection** - Auto-detects domain from DC
- ✅ **OU-Based Grouping** - Machines categorized by OU (Workstation/Server/DC)
- ✅ **Deploy to OU** - One-click GPO deployment with OU linking
- ✅ **Phase-Based Enforcement** - Audit (Phase 1-3) → Enforce (Phase 4)
- ✅ **Smart Rule Priority** - Publisher → Hash (Path avoided)
- ✅ **Wildcard Search** - Use `*` for flexible filtering

## 🎯 Typical Workflow

1. **Open Dashboard** - View system overview
2. **Go to Remote Scan** - Domain auto-detected, scan machines
3. **Open Policy Lab** → **Rule Generator** - Import scan artifacts
4. **Click "OU Policies"** - Generate policies per machine type
5. **Click "Deploy to OU"** - Deploy GPO and link to OUs
6. **Monitor Events** - Watch 8003/8004 logs
7. **Generate Compliance** - Create NIST evidence packages

## 📋 Requirements

- Windows 10/11 or Windows Server 2019+
- **Best:** Run on Domain Controller
- **Credentials:** DC Admin for full functionality
- PowerShell 5.1 or 7.x
- WinRM configured for remote scanning

## 🔐 Credential Requirements

| Action | Credential Needed |
|--------|-------------------|
| Scan Workstations | Domain Admin |
| Scan Servers | Domain Admin |
| Scan DCs | DC Admin |
| Deploy GPO | Domain Admin |
| Link to OU | Domain Admin |

**Tip:** Run the app as a DC Admin for full access.

## 📝 Key Files

### Entry Points
- `index.tsx` - React app entry
- `App.tsx` - Main app component
- `electron/main.cjs` - Electron main process

### PowerShell Scripts (in `scripts/`)
- `GA-AppLocker.psm1` - Main module
- `Deploy-AppLockerPolicy.ps1` - GPO deployment with OU linking
- `Get-ComprehensiveScanArtifacts.ps1` - Artifact collection
- `Merge-AppLockerPolicies.ps1` - Policy merging

## 🆘 Troubleshooting

### Build Fails
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
```

### UI Not Styled
- Tailwind CSS is bundled locally
- Check `dist/assets/index-*.css` exists

### IPC Not Working
- Must run in Electron (not browser)
- Check `electron/preload.cjs` is loaded

### Domain Not Detected
- Ensure running on Domain Controller
- Run as DC Admin
- Check AD PowerShell module is available

## 📞 Quick Reference

### Run Commands
```bash
npm run dev                      # Start Vite dev server
npm run electron:dev             # Run Electron app
npm run build                    # Build web assets
npm run electron:build:portable  # Build portable EXE
npm test                         # Run unit tests
```

### Key Directories
- `src/` - Source code (Clean Architecture)
- `components/` - React components
- `electron/` - Electron main process
- `scripts/` - PowerShell scripts
- `dist/` - Build output
- `release/` - Packaged EXE

---

**Version:** 1.2.8  
**Status:** ✅ Vision 100% Complete  
**Last Updated:** 2026-01-13
