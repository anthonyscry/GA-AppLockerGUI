/**
 * Electron Constants
 * Mock data for development (will be replaced with real data in production)
 */

const { MachineScan, InventoryItem, TrustedPublisher, ADUser, AppEvent } = require('../src/shared/types');

// Mock machines - in production, this would come from PowerShell/AD queries
const MOCK_MACHINES = [
  { id: '1', hostname: 'WKST-QA-01', lastScan: '2024-05-15 09:30', status: 'Online', riskLevel: 'Low', appCount: 142 },
  { id: '2', hostname: 'WKST-QA-02', lastScan: '2024-05-15 10:15', status: 'Online', riskLevel: 'Medium', appCount: 215 },
  { id: '3', hostname: 'SRV-PROD-SQL', lastScan: '2024-05-14 23:00', status: 'Offline', riskLevel: 'Low', appCount: 45 },
  { id: '4', hostname: 'WKST-DEV-09', lastScan: '2024-05-16 08:45', status: 'Scanning', riskLevel: 'High', appCount: 567 },
  { id: '5', hostname: 'WKST-SALES-01', lastScan: '2024-05-10 14:20', status: 'Online', riskLevel: 'Low', appCount: 89 },
];

const MOCK_INVENTORY = [
  { id: 'inv1', name: 'Visual Studio Code', publisher: 'Microsoft Corporation', path: 'C:\\Program Files\\VSCode\\Code.exe', version: '1.85.1', type: 'EXE' },
  { id: 'inv2', name: 'Google Chrome', publisher: 'Google LLC', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', version: '120.0.6099.110', type: 'EXE' },
  { id: 'inv3', name: 'Custom Internal Tool', publisher: 'GA-ASI', path: 'C:\\GA-ASI\\Tools\\Scanner.exe', version: '2.1.0', type: 'EXE' },
  { id: 'inv4', name: 'Slack', publisher: 'Slack Technologies', path: 'C:\\Users\\User\\AppData\\Local\\slack\\slack.exe', version: '4.35.121', type: 'EXE' },
  { id: 'inv5', name: 'PowerShell 7', publisher: 'Microsoft Corporation', path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', version: '7.4.0', type: 'EXE' },
];

const COMMON_PUBLISHERS = [
  { id: 'p1', name: 'Microsoft Windows', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'System', description: 'Core Windows OS components and signed binaries.' },
  { id: 'p2', name: 'Google Chrome', publisherName: 'O=GOOGLE LLC, L=MOUNTAIN VIEW, S=CALIFORNIA, C=US', category: 'Browser', description: 'Google Chrome browser and update services.' },
  { id: 'p3', name: 'Adobe Systems', publisherName: 'O=ADOBE SYSTEMS INCORPORATED, L=SAN JOSE, S=CALIFORNIA, C=US', category: 'Productivity', description: 'Acrobat Reader, Creative Cloud, and Photoshop.' },
  { id: 'p4', name: 'Mozilla Corporation', publisherName: 'O=MOZILLA CORPORATION, L=MOUNTAIN VIEW, S=CALIFORNIA, C=US', category: 'Browser', description: 'Firefox browser and maintenance services.' },
  { id: 'p5', name: 'Zoom Video', publisherName: 'O=ZOOM VIDEO COMMUNICATIONS, INC., L=SAN JOSE, S=CALIFORNIA, C=US', category: 'Communication', description: 'Zoom client and meeting components.' },
  { id: 'p6', name: 'GA-ASI Trusted', publisherName: 'O=GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC., L=POWAY, S=CALIFORNIA, C=US', category: 'Infrastructure', description: 'Internal tools and flight system software.' },
  { id: 'p7', name: 'Slack Technologies', publisherName: 'O=SLACK TECHNOLOGIES, LLC, L=SAN FRANCISCO, S=CALIFORNIA, C=US', category: 'Communication', description: 'Slack desktop application.' },
  { id: 'p8', name: 'Cisco Systems', publisherName: 'O=CISCO SYSTEMS, INC., L=SAN JOSE, S=CALIFORNIA, C=US', category: 'Infrastructure', description: 'AnyConnect VPN and Webex components.' },
  { id: 'p9', name: 'VMware Inc.', publisherName: 'O=VMWARE, INC., L=PALO ALTO, S=CALIFORNIA, C=US', category: 'Infrastructure', description: 'VMware Workstation and vSphere tools.' },
  { id: 'p10', name: 'Oracle Corporation', publisherName: 'O=ORACLE AMERICA, INC., L=REDWOOD CITY, S=CALIFORNIA, C=US', category: 'Development', description: 'Java Runtime and VirtualBox.' },
  { id: 'p11', name: 'Intel Corporation', publisherName: 'O=INTEL CORPORATION, L=SANTA CLARA, S=CALIFORNIA, C=US', category: 'System', description: 'Chipset drivers and management software.' },
  { id: 'p12', name: 'NVIDIA Corporation', publisherName: 'O=NVIDIA CORPORATION, L=SANTA CLARA, S=CALIFORNIA, C=US', category: 'System', description: 'Graphics drivers and CUDA tools.' },
];

const MOCK_AD_USERS = [
  { id: 'u1', samAccountName: 'ttran', displayName: 'Tony Tran', department: 'ISSO', groups: ['Domain Admins', 'AppLocker-Admin-Group'] },
  { id: 'u2', samAccountName: 'jdoe', displayName: 'John Doe', department: 'QA', groups: ['Domain Users', 'QA-Team'] },
  { id: 'u3', samAccountName: 'asmith', displayName: 'Alice Smith', department: 'Engineering', groups: ['Domain Users', 'Dev-Team'] },
];

const APPLOCKER_GROUPS = [
  'AppLocker-WS-Audit',
  'AppLocker-WS-Enforce',
  'AppLocker-SRV-Audit',
  'AppLocker-SRV-Enforce',
  'AppLocker-Exceptions-Global'
];

const MOCK_EVENTS = [
  { id: 'e1', timestamp: '2024-05-16 11:02:15', machine: 'WKST-QA-02', path: 'C:\\Users\\Public\\malicious.ps1', publisher: 'None', eventId: 8004, action: 'Blocked' },
  { id: 'e2', timestamp: '2024-05-16 11:05:00', machine: 'WKST-DEV-09', path: 'C:\\Program Files\\VSCode\\Code.exe', publisher: 'Microsoft Corporation', eventId: 8003, action: 'Audit-Allow' },
  { id: 'e3', timestamp: '2024-05-16 11:10:45', machine: 'WKST-QA-01', path: 'C:\\Temp\\installer.exe', publisher: 'Unknown', eventId: 8004, action: 'Blocked' },
  { id: 'e4', timestamp: '2024-05-16 11:12:30', machine: 'WKST-QA-02', path: 'C:\\Windows\\System32\\cmd.exe', publisher: 'Microsoft Corporation', eventId: 8003, action: 'Audit-Allow' },
  { id: 'e5', timestamp: '2024-05-16 11:15:10', machine: 'WKST-DEV-09', path: '%AppData%\\Local\\Temp\\update.vbs', publisher: 'None', eventId: 8004, action: 'Blocked' },
];

module.exports = {
  MOCK_MACHINES,
  MOCK_INVENTORY,
  COMMON_PUBLISHERS,
  MOCK_AD_USERS,
  APPLOCKER_GROUPS,
  MOCK_EVENTS,
};
