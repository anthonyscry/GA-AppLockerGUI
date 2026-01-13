/**
 * Shared Constants
 */

import React from 'react';
import { 
  LayoutDashboard, 
  Search, 
  ShieldCheck, 
  Activity, 
  ClipboardCheck, 
  Users,
} from 'lucide-react';
import { AppView } from '../types';

export const NAVIGATION = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'SCAN', label: 'Remote Scan', icon: <Search size={20} /> },
  { id: 'POLICY', label: 'Policy Lab', icon: <ShieldCheck size={20} /> },
  { id: 'EVENTS', label: 'Event Monitor', icon: <Activity size={20} /> },
  { id: 'AD_MANAGEMENT', label: 'AD Manager', icon: <Users size={20} /> },
  { id: 'COMPLIANCE', label: 'Compliance', icon: <ClipboardCheck size={20} /> },
];

export const APPLOCKER_GROUPS = [
  'AppLocker-WS-Audit',
  'AppLocker-WS-Enforce',
  'AppLocker-SRV-Audit',
  'AppLocker-SRV-Enforce',
  'AppLocker-Exceptions-Global'
];
