// Preload script for Electron
// This runs in a context that has access to both DOM APIs and Node.js APIs
const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// the APIs securely
contextBridge.exposeInMainWorld('electron', {
  // Add any IPC methods here if needed in the future
  platform: process.platform,
  version: process.versions.electron
});