import {
  LayoutDashboard,
  Search,
  ShieldCheck,
  Activity,
  ClipboardCheck,
  Users,
  FileCode,
  Wand2,
} from 'lucide-react';
import { ADUser, InventoryItem, TrustedPublisher, MachineScan, AppEvent } from './src/shared/types';

export const NAVIGATION = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'SCAN', label: 'Remote Scan', icon: <Search size={20} /> },
  { id: 'RULE_GENERATOR', label: 'Rule Generator', icon: <Wand2 size={20} /> },
  { id: 'POLICY', label: 'Policy Lab', icon: <ShieldCheck size={20} /> },
  { id: 'SOFTWARE_COMPARE', label: 'Software Compare', icon: <FileCode size={20} /> },
  { id: 'EVENTS', label: 'Event Monitor', icon: <Activity size={20} /> },
  { id: 'AD_MANAGEMENT', label: 'AD Manager', icon: <Users size={20} /> },
  { id: 'COMPLIANCE', label: 'Compliance', icon: <ClipboardCheck size={20} /> },
];

export const MOCK_MACHINES: MachineScan[] = [];

export const MOCK_INVENTORY: InventoryItem[] = [];

export const COMMON_PUBLISHERS: TrustedPublisher[] = [
  // Microsoft Products
  { id: 'p1', name: 'Microsoft Windows', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'System', description: 'Core Windows OS components and signed binaries.' },
  { id: 'p13', name: 'Microsoft Office', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'Productivity', description: 'Microsoft Office suite (Word, Excel, PowerPoint, Outlook).' },
  { id: 'p14', name: 'Microsoft Teams', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'Communication', description: 'Microsoft Teams collaboration platform.' },
  { id: 'p15', name: 'Microsoft Visual Studio', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'Development', description: 'Visual Studio IDE and development tools.' },
  { id: 'p16', name: 'Microsoft .NET Framework', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'System', description: '.NET Framework runtime and components.' },
  { id: 'p17', name: 'Microsoft SQL Server', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'Infrastructure', description: 'SQL Server database and management tools.' },
  { id: 'p18', name: 'Microsoft Azure', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'Infrastructure', description: 'Azure CLI and cloud management tools.' },
  
  // Browsers
  { id: 'p2', name: 'Google Chrome', publisherName: 'O=GOOGLE LLC, L=MOUNTAIN VIEW, S=CALIFORNIA, C=US', category: 'Browser', description: 'Google Chrome browser and update services.' },
  { id: 'p4', name: 'Mozilla Corporation', publisherName: 'O=MOZILLA CORPORATION, L=MOUNTAIN VIEW, S=CALIFORNIA, C=US', category: 'Browser', description: 'Firefox browser and maintenance services.' },
  { id: 'p19', name: 'Microsoft Edge', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'Browser', description: 'Microsoft Edge browser.' },
  
  // Communication & Collaboration
  { id: 'p5', name: 'Zoom Video', publisherName: 'O=ZOOM VIDEO COMMUNICATIONS, INC., L=SAN JOSE, S=CALIFORNIA, C=US', category: 'Communication', description: 'Zoom client and meeting components.' },
  { id: 'p7', name: 'Slack Technologies', publisherName: 'O=SLACK TECHNOLOGIES, LLC, L=SAN FRANCISCO, S=CALIFORNIA, C=US', category: 'Communication', description: 'Slack desktop application.' },
  { id: 'p20', name: 'Microsoft Skype', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'Communication', description: 'Skype for Business and consumer Skype.' },
  { id: 'p21', name: 'Webex', publisherName: 'O=CISCO SYSTEMS, INC., L=SAN JOSE, S=CALIFORNIA, C=US', category: 'Communication', description: 'Cisco Webex Meetings and Teams.' },
  { id: 'p22', name: 'Microsoft OneDrive', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'Productivity', description: 'OneDrive sync client.' },
  
  // Productivity & Office
  { id: 'p3', name: 'Adobe Systems', publisherName: 'O=ADOBE SYSTEMS INCORPORATED, L=SAN JOSE, S=CALIFORNIA, C=US', category: 'Productivity', description: 'Acrobat Reader, Creative Cloud, and Photoshop.' },
  { id: 'p23', name: '7-Zip', publisherName: 'O=IGOR PAVLOV, L=IRVINE, S=CALIFORNIA, C=US', category: 'Productivity', description: '7-Zip file archiver utility.' },
  { id: 'p24', name: 'WinRAR', publisherName: 'O=WINRAR GMBH, L=HAMBURG, S=HAMBURG, C=DE', category: 'Productivity', description: 'WinRAR compression utility.' },
  
  // Development Tools
  { id: 'p10', name: 'Oracle Corporation', publisherName: 'O=ORACLE AMERICA, INC., L=REDWOOD CITY, S=CALIFORNIA, C=US', category: 'Development', description: 'Java Runtime and VirtualBox.' },
  { id: 'p25', name: 'JetBrains', publisherName: 'O=JETBRAINS S.R.O., L=PRAGUE, S=PRAGUE, C=CZ', category: 'Development', description: 'IntelliJ IDEA, PyCharm, WebStorm, and other IDEs.' },
  { id: 'p26', name: 'Git for Windows', publisherName: 'O=GIT FOR WINDOWS, L=REDMOND, S=WASHINGTON, C=US', category: 'Development', description: 'Git version control system for Windows.' },
  { id: 'p27', name: 'GitHub', publisherName: 'O=GITHUB, INC., L=SAN FRANCISCO, S=CALIFORNIA, C=US', category: 'Development', description: 'GitHub Desktop and CLI tools.' },
  { id: 'p28', name: 'Docker Inc.', publisherName: 'O=DOCKER INC., L=SAN FRANCISCO, S=CALIFORNIA, C=US', category: 'Development', description: 'Docker Desktop and containerization tools.' },
  { id: 'p29', name: 'Node.js Foundation', publisherName: 'O=NODE.JS FOUNDATION, L=SAN FRANCISCO, S=CALIFORNIA, C=US', category: 'Development', description: 'Node.js runtime and npm package manager.' },
  { id: 'p30', name: 'Python Software Foundation', publisherName: 'O=PYTHON SOFTWARE FOUNDATION, L=BEAVERTON, S=OREGON, C=US', category: 'Development', description: 'Python interpreter and pip package manager.' },
  
  // Infrastructure & Virtualization
  { id: 'p6', name: 'GA-ASI Trusted', publisherName: 'O=GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC., L=POWAY, S=CALIFORNIA, C=US', category: 'Infrastructure', description: 'Internal tools and flight system software.' },
  { id: 'p8', name: 'Cisco Systems', publisherName: 'O=CISCO SYSTEMS, INC., L=SAN JOSE, S=CALIFORNIA, C=US', category: 'Infrastructure', description: 'AnyConnect VPN and Webex components.' },
  { id: 'p9', name: 'VMware Inc.', publisherName: 'O=VMWARE, INC., L=PALO ALTO, S=CALIFORNIA, C=US', category: 'Infrastructure', description: 'VMware Workstation and vSphere tools.' },
  { id: 'p31', name: 'Citrix Systems', publisherName: 'O=CITRIX SYSTEMS, INC., L=FORT LAUDERDALE, S=FLORIDA, C=US', category: 'Infrastructure', description: 'Citrix Workspace and virtualization tools.' },
  { id: 'p32', name: 'Palo Alto Networks', publisherName: 'O=PALO ALTO NETWORKS, INC., L=SANTA CLARA, S=CALIFORNIA, C=US', category: 'Infrastructure', description: 'Palo Alto GlobalProtect VPN client.' },
  { id: 'p33', name: 'F5 Networks', publisherName: 'O=F5 NETWORKS, INC., L=SEATTLE, S=WASHINGTON, C=US', category: 'Infrastructure', description: 'F5 BIG-IP Edge Client and VPN tools.' },
  { id: 'p34', name: 'PuTTY', publisherName: 'O=PUTTY DEVELOPERS, L=UNITED KINGDOM, C=GB', category: 'Infrastructure', description: 'PuTTY SSH and telnet client.' },
  { id: 'p35', name: 'WinSCP', publisherName: 'O=MARTIN PRIKRYL, L=PRAGUE, S=PRAGUE, C=CZ', category: 'Infrastructure', description: 'WinSCP SFTP and FTP client.' },
  
  // Security & Antivirus
  { id: 'p36', name: 'McAfee LLC', publisherName: 'O=MCAFEE, LLC, L=SANTA CLARA, S=CALIFORNIA, C=US', category: 'System', description: 'McAfee antivirus and security products.' },
  { id: 'p37', name: 'Symantec Corporation', publisherName: 'O=SYMANTEC CORPORATION, L=TEMPE, S=ARIZONA, C=US', category: 'System', description: 'Symantec Endpoint Protection and security tools.' },
  { id: 'p38', name: 'Trend Micro', publisherName: 'O=TREND MICRO INCORPORATED, L=TOKYO, S=TOKYO, C=JP', category: 'System', description: 'Trend Micro security products.' },
  { id: 'p39', name: 'CrowdStrike', publisherName: 'O=CROWDSTRIKE, INC., L=AUSTIN, S=TEXAS, C=US', category: 'System', description: 'CrowdStrike Falcon endpoint protection.' },
  { id: 'p40', name: 'Carbon Black', publisherName: 'O=VMWARE, INC., L=PALO ALTO, S=CALIFORNIA, C=US', category: 'System', description: 'VMware Carbon Black security platform.' },
  
  // System & Drivers
  { id: 'p11', name: 'Intel Corporation', publisherName: 'O=INTEL CORPORATION, L=SANTA CLARA, S=CALIFORNIA, C=US', category: 'System', description: 'Chipset drivers and management software.' },
  { id: 'p12', name: 'NVIDIA Corporation', publisherName: 'O=NVIDIA CORPORATION, L=SANTA CLARA, S=CALIFORNIA, C=US', category: 'System', description: 'Graphics drivers and CUDA tools.' },
  { id: 'p41', name: 'AMD', publisherName: 'O=ADVANCED MICRO DEVICES, INC., L=SUNNYVALE, S=CALIFORNIA, C=US', category: 'System', description: 'AMD graphics drivers and chipset software.' },
  { id: 'p42', name: 'Realtek Semiconductor', publisherName: 'O=REALTEK SEMICONDUCTOR CORP., L=HSINCHU, S=HSINCHU, C=TW', category: 'System', description: 'Realtek audio and network drivers.' },
  { id: 'p43', name: 'Logitech', publisherName: 'O=LOGITECH, INC., L=NEWARK, S=CALIFORNIA, C=US', category: 'System', description: 'Logitech device drivers and software.' },
  
  // Engineering & CAD (Aeronautical/Aerospace)
  { id: 'p44', name: 'Autodesk', publisherName: 'O=AUTODESK, INC., L=SAN RAFAEL, S=CALIFORNIA, C=US', category: 'Development', description: 'AutoCAD, Inventor, and engineering CAD software.' },
  { id: 'p45', name: 'Dassault Systemes', publisherName: 'O=DASSAULT SYSTEMES, L=VELIZY-VILLACOUBLAY, S=VELIZY, C=FR', category: 'Development', description: 'CATIA, SOLIDWORKS, and aerospace CAD tools.' },
  { id: 'p46', name: 'ANSYS Inc.', publisherName: 'O=ANSYS, INC., L=CANONSBURG, S=PENNSYLVANIA, C=US', category: 'Development', description: 'ANSYS simulation and analysis software.' },
  { id: 'p47', name: 'MathWorks', publisherName: 'O=THE MATHWORKS, INC., L=NATICK, S=MASSACHUSETTS, C=US', category: 'Development', description: 'MATLAB and Simulink engineering software.' },
  { id: 'p48', name: 'National Instruments', publisherName: 'O=NATIONAL INSTRUMENTS CORPORATION, L=AUSTIN, S=TEXAS, C=US', category: 'Development', description: 'LabVIEW and measurement automation tools.' },
  
  // Database & Data Tools
  { id: 'p49', name: 'MongoDB Inc.', publisherName: 'O=MONGODB, INC., L=NEW YORK, S=NEW YORK, C=US', category: 'Infrastructure', description: 'MongoDB database and tools.' },
  { id: 'p50', name: 'PostgreSQL', publisherName: 'O=POSTGRESQL GLOBAL DEVELOPMENT GROUP, L=UNITED STATES, C=US', category: 'Infrastructure', description: 'PostgreSQL database server and tools.' },
  { id: 'p51', name: 'MySQL', publisherName: 'O=ORACLE AMERICA, INC., L=REDWOOD CITY, S=CALIFORNIA, C=US', category: 'Infrastructure', description: 'MySQL database server and Workbench.' },
  
  // Remote Access & Management
  { id: 'p52', name: 'TeamViewer', publisherName: 'O=TEAMVIEWER GMBH, L=GOPPINGEN, S=BADEN-WURTTEMBERG, C=DE', category: 'Infrastructure', description: 'TeamViewer remote access software.' },
  { id: 'p53', name: 'Remote Desktop', publisherName: 'O=MICROSOFT CORPORATION, L=REDMOND, S=WASHINGTON, C=US', category: 'Infrastructure', description: 'Microsoft Remote Desktop client.' },
  { id: 'p54', name: 'TightVNC', publisherName: 'O=TIGHTVNC PROJECT, L=UNITED STATES, C=US', category: 'Infrastructure', description: 'TightVNC remote desktop software.' },
  
  // Text Editors & Utilities
  { id: 'p55', name: 'Notepad++', publisherName: 'O=NOTEPAD++ TEAM, L=UNITED STATES, C=US', category: 'Development', description: 'Notepad++ text editor.' },
  { id: 'p56', name: 'Sublime HQ', publisherName: 'O=SUBLIME HQ PTY LTD, L=SYDNEY, S=NEW SOUTH WALES, C=AU', category: 'Development', description: 'Sublime Text editor.' },
  
  // Media & Graphics
  { id: 'p57', name: 'VLC Media Player', publisherName: 'O=VIDEOLAN, L=PARIS, S=PARIS, C=FR', category: 'Productivity', description: 'VLC media player.' },
  { id: 'p58', name: 'FFmpeg', publisherName: 'O=FFMPEG PROJECT, L=UNITED STATES, C=US', category: 'Productivity', description: 'FFmpeg multimedia framework.' },
];

export const MOCK_AD_USERS: ADUser[] = [];

export const APPLOCKER_GROUPS = [
  // User Role-Based Groups (matches IPC handlers)
  'AppLocker-Admins',
  'AppLocker-Installers',
  'AppLocker-Developers',
  'AppLocker-Standard-Users',
  'AppLocker-Audit-Only',
];

export const MOCK_EVENTS: AppEvent[] = [];
