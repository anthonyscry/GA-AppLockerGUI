/**
 * Application Configuration
 * Centralized configuration for the application
 */

const AppConfig = {
  // App metadata
  appName: 'GA-AppLocker Dashboard',
  version: '1.2.5',
  author: 'Tony Tran, ISSO, GA-ASI',
  
  // Window settings (75% of original size for compact UI)
  window: {
    defaultWidth: 1280,
    defaultHeight: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#f1f5f9',
  },
  
  // Development settings
  dev: {
    devToolsInProduction: false, // SECURITY: Never enable in production - allows code injection
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
