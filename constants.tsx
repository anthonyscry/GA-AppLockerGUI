
import React from 'react';
import { 
  LayoutDashboard, 
  Search, 
  ShieldCheck, 
  Activity, 
  ClipboardCheck, 
  Users,
  ShieldAlert,
  Server,
  Terminal,
  FileCode,
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus
} from 'lucide-react';
import { ADUser, InventoryItem, TrustedPublisher, MachineScan, AppEvent } from './types';

export const NAVIGATION = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'SCAN', label: 'Remote Scan', icon: <Search size={20} /> },
  { id: 'POLICY', label: 'Policy Lab', icon: <ShieldCheck size={20} /> },
  { id: 'EVENTS', label: 'Event Monitor', icon: <Activity size={20} /> },
  { id: 'AD_MANAGEMENT', label: 'AD Manager', icon: <Users size={20} /> },
  { id: 'COMPLIANCE', label: 'Compliance', icon: <ClipboardCheck size={20} /> },
];

export const MOCK_MACHINES: MachineScan[] = [];

export const MOCK_INVENTORY: InventoryItem[] = [];

export const COMMON_PUBLISHERS: TrustedPublisher[] = [
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

export const MOCK_AD_USERS: ADUser[] = [];

export const APPLOCKER_GROUPS = [
  'AppLocker-WS-Audit',
  'AppLocker-WS-Enforce',
  'AppLocker-SRV-Audit',
  'AppLocker-SRV-Enforce',
  'AppLocker-Exceptions-Global'
];

export const MOCK_EVENTS: AppEvent[] = [];
