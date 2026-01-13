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
        // Machine channels
        'machine:getAll',
        'machine:getById',
        'machine:startScan',
        // Scan channels
        'scan:local',
        // Policy channels
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
        'policy:createPublisherRule',
        'policy:batchCreatePublisherRules',
        'policy:getPolicyXML',
        'policy:createPathRule',
        // Event channels
        'event:getAll',
        'event:getStats',
        'event:exportCSV',
        'events:collectAuditLogs',
        'events:backup',
        // AD channels
        'ad:getUsers',
        'ad:getUserById',
        'ad:addToGroup',
        'ad:removeFromGroup',
        'ad:getGroups',
        'ad:getWinRMGPOStatus',
        'ad:toggleWinRMGPO',
        // Compliance channels
        'compliance:getEvidenceStatus',
        'compliance:generateEvidence',
        'compliance:generateReport',
        'compliance:getHistoricalReports',
        'compliance:validateEvidence',
        // System channels
        'system:checkAppLockerService',
        'system:checkPowerShellModules',
        'system:getUserInfo',
        'system:getDomainInfo',
        // Utility channels
        'util:getScriptsDirectory',
        'dialog:showOpenDialog',
        'dialog:showSaveDialog',
        'dialog:showOpenDirectoryDialog',
        'fs:writeFile',
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
