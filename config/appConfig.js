/**
 * Application Configuration
 * Centralized configuration for the application
 */

const AppConfig = {
  // App metadata
  appName: 'GA-AppLocker Dashboard',
  version: '1.2.4',
  author: 'Tony Tran, ISSO, GA-ASI',
  
  // Window settings
  window: {
    defaultWidth: 1400,
    defaultHeight: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#f1f5f9',
  },
  
  // Development settings
  dev: {
    devToolsInProduction: true, // Enable for debugging compiled code - set to false before final release
    hotReload: true,
  },
  
  // API/Service settings
  services: {
    scanTimeout: 2000, // milliseconds
    gpoPropagationDelay: 3000, // milliseconds
    adScanDelay: 1500, // milliseconds
  },
  
  // UI settings
  ui: {
    debounceDelay: 300, // milliseconds for search inputs
    animationDuration: 500, // milliseconds
  },
  
  // Policy settings
  policy: {
    healthCheckFormula: {
      criticalPenalty: 20,
      warningPenalty: 5,
      infoPenalty: 1,
      baseScore: 100,
    },
    requiredAuditDays: 14,
  },
  
  // File paths
  paths: {
    output: './output',
    evidence: './output/CORA-Evidence',
  },
};

module.exports = { AppConfig };
