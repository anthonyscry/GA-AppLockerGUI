# GA-AppLocker Dashboard

A comprehensive administrative dashboard for the GA-AppLocker toolkit, enabling remote scanning, policy generation, event monitoring, and compliance reporting.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## Features

- **Dashboard** - Overview of managed systems, blocked apps, and rule health
- **Remote Scan** - Collect software inventory via WinRM from AD-managed computers
- **Policy Lab** - Design, merge, and validate AppLocker XML policies
- **Event Monitor** - Real-time AppLocker audit event ingestion (8003/8004)
- **AD Manager** - Drag-and-drop user management for AppLocker security groups
- **Compliance** - Generate CORA evidence packages and regulatory reports

## Quick Start

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
npm run electron:build:win
```

This will:
1. Build the React app using Vite
2. Package it with Electron
3. Create an installer in the `release` directory

The output will be:
- `release/GA-AppLocker Dashboard-1.2.4-x64.exe` - NSIS installer
- `release/win-unpacked/` - Unpacked application (for testing)

### Available Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Build web assets only (Vite)
- `npm run electron:dev` - Run Electron in development mode
- `npm run electron:build` - Build for current platform
- `npm run electron:build:win` - Build Windows installer

## Requirements

- Node.js (v18 or higher)
- Windows 10/11 (for building Windows executables)
- npm or yarn

## Application Details

- **Version**: 1.2.4
- **Author**: Tony Tran, ISSO, GA-ASI
- **Built with**: React, TypeScript, Electron, Vite, Tailwind CSS
- **Window Size**: 1400x900 (minimum 1200x700)

## Notes

- The built application is self-contained and doesn't require Node.js to run
- All dependencies are bundled with the application
- The application uses Tailwind CSS via CDN (requires internet connection for styling)

## Troubleshooting

- If the build fails, ensure all dependencies are installed: `npm install`
- For icon issues, you can add an `icon.ico` file to the `assets` directory
- If you encounter module resolution errors, delete `node_modules` and `package-lock.json`, then reinstall

For more detailed build instructions, see [BUILD.md](BUILD.md).