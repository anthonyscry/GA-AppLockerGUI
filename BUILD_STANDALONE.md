# 📦 Building Standalone EXE

## Quick Build

To create a standalone portable executable:

```bash
npm run electron:build:portable
```

This will:
1. Build the React app with Vite
2. Package everything with Electron
3. Create a single portable EXE file

## Output

The standalone EXE will be created at:
```
release/GA-AppLocker Dashboard-1.2.4-x64.exe
```

## Features

- ✅ **Portable** - No installation required
- ✅ **Self-contained** - All dependencies bundled
- ✅ **Standalone** - Single EXE file, ready to run
- ✅ **No admin rights needed** - Runs from any location

## Usage

1. Build the EXE: `npm run electron:build:portable`
2. Copy `GA-AppLocker Dashboard-1.2.4-x64.exe` to any location
3. Double-click to run - no installation needed!

## File Size

The portable EXE is typically ~150-200 MB (includes Electron runtime and all dependencies).

## Alternative: Windows Installer

If you prefer an installer instead:

```bash
npm run electron:build:win
```

This creates an NSIS installer that:
- Installs to Program Files
- Creates Start Menu shortcuts
- Creates Desktop shortcut
- Adds uninstaller

---

**Note:** The portable EXE is recommended for standalone deployment where installation is not desired.
