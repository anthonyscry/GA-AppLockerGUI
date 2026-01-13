/**
 * Preload script for Electron
 * Exposes secure IPC communication to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the APIs securely via context isolation
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  version: process.versions.electron,
  ipc: {
    /**
     * Invoke an IPC method and wait for response
     */
    invoke: (channel, ...args) => {
      // Whitelist channels for security
      const validChannels = [
        'machine:getAll',
        'machine:getById',
        'machine:startScan',
        'policy:getInventory',
        'policy:getTrustedPublishers',
        'policy:getGroups',
        'policy:createRule',
        'policy:runHealthCheck',
        'policy:generateBaseline',
        'policy:deploy',
        'policy:generateFromInventory',
        'policy:mergePolicies',
        'policy:generateFromArtifacts',
        'policy:importArtifacts',
        'policy:batchGenerateRules',
        'policy:groupByPublisher',
        'policy:detectDuplicates',
        'policy:getIncrementalUpdate',
        'policy:validateRules',
        'policy:getRuleTemplates',
        'policy:generateFromTemplate',
        'event:getAll',
        'event:getStats',
        'event:exportCSV',
        'events:collectAuditLogs',
        'ad:getUsers',
        'ad:getUserById',
        'ad:addToGroup',
        'ad:removeFromGroup',
        'ad:getGroups',
        'ad:getWinRMGPOStatus',
        'ad:toggleWinRMGPO',
        'compliance:getEvidenceStatus',
        'compliance:generateEvidence',
        'compliance:generateReport',
        'compliance:getHistoricalReports',
        'compliance:validateEvidence',
        'system:checkAppLockerService',
        'system:checkPowerShellModules',
        'util:getScriptsDirectory',
      ];
      
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      throw new Error(`Invalid IPC channel: ${channel}`);
    },
    
    /**
     * Listen to IPC events
     */
    on: (channel, callback) => {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    
    /**
     * Remove IPC event listener
     */
    removeListener: (channel, callback) => {
      ipcRenderer.removeListener(channel, callback);
    },
  },
});
