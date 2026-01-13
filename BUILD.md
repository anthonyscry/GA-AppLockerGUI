# Building GA-AppLocker Dashboard

This guide explains how to build the GA-AppLocker Dashboard into a Windows executable.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Windows 10/11 (for building Windows executables)

## Setup

1. Install dependencies:
```bash
npm install
```

## Development

To run in development mode:

1. Start the Vite dev server:
```bash
npm run dev
```

2. In a separate terminal, start Electron:
```bash
npm run electron:dev
```

## Building for Production

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

## Building Options

- `npm run build` - Build only the web assets (Vite)
- `npm run electron:build` - Build for current platform
- `npm run electron:build:win` - Build Windows installer

## Notes

- The built application is self-contained and doesn't require Node.js to run
- All dependencies are bundled with the application
- The application window size is 1400x900 by default (minimum 1200x700)

## Troubleshooting

- If the build fails, ensure all dependencies are installed: `npm install`
- For icon issues, you can add an `icon.ico` file to the `assets` directory
- If you encounter module resolution errors, delete `node_modules` and `package-lock.json`, then reinstall