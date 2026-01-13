/**
 * IPC Channels
 * Type-safe channel definitions for Electron IPC communication
 */

export const IPCChannels = {
  MACHINE: {
    GET_ALL: 'machine:getAll',
    GET_BY_ID: 'machine:getById',
    START_SCAN: 'machine:startScan',
  },
  POLICY: {
    GET_INVENTORY: 'policy:getInventory',
    GET_TRUSTED_PUBLISHERS: 'policy:getTrustedPublishers',
    GET_GROUPS: 'policy:getGroups',
    CREATE_RULE: 'policy:createRule',
    RUN_HEALTH_CHECK: 'policy:runHealthCheck',
    MERGE_POLICIES: 'policy:mergePolicies',
    GENERATE_FROM_ARTIFACTS: 'policy:generateFromArtifacts',
    IMPORT_ARTIFACTS: 'policy:importArtifacts',
    BATCH_GENERATE_RULES: 'policy:batchGenerateRules',
    GROUP_BY_PUBLISHER: 'policy:groupByPublisher',
    DETECT_DUPLICATES: 'policy:detectDuplicates',
    GET_INCREMENTAL_UPDATE: 'policy:getIncrementalUpdate',
    VALIDATE_RULES: 'policy:validateRules',
    GET_RULE_TEMPLATES: 'policy:getRuleTemplates',
    GENERATE_FROM_TEMPLATE: 'policy:generateFromTemplate',
  },
  EVENT: {
    GET_ALL: 'event:getAll',
    GET_STATS: 'event:getStats',
    EXPORT_CSV: 'event:exportCSV',
  },
  AD: {
    GET_USERS: 'ad:getUsers',
    GET_USER_BY_ID: 'ad:getUserById',
    ADD_TO_GROUP: 'ad:addToGroup',
    REMOVE_FROM_GROUP: 'ad:removeFromGroup',
    GET_GROUPS: 'ad:getGroups',
    GET_WINRM_GPO_STATUS: 'ad:getWinRMGPOStatus',
    TOGGLE_WINRM_GPO: 'ad:toggleWinRMGPO',
  },
  COMPLIANCE: {
    GET_EVIDENCE_STATUS: 'compliance:getEvidenceStatus',
    GENERATE_EVIDENCE: 'compliance:generateEvidence',
    GET_HISTORICAL_REPORTS: 'compliance:getHistoricalReports',
    VALIDATE_EVIDENCE: 'compliance:validateEvidence',
  },
} as const;

export type IPCChannel = typeof IPCChannels[keyof typeof IPCChannels][keyof typeof IPCChannels[keyof typeof IPCChannels]];
