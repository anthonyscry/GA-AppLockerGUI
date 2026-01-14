import React, { useState, useMemo, useCallback } from 'react';
import { 
  Search, 
  RefreshCw, 
  Server, 
  ShieldCheck, 
  X, 
  ChevronDown, 
  ShieldAlert, 
  Globe, 
  ToggleLeft, 
  ToggleRight, 
  Loader2,
  MapPin,
  Key,
  User,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAppServices } from '../src/presentation/contexts/AppContext';
import { useAsync } from '../src/presentation/hooks/useAsync';
import { BatchScanSummary, getMachineTypeFromOU, groupMachinesByOU } from '../src/shared/types';
import { MachineFilter } from '../src/domain/interfaces/IMachineRepository';
import { NotFoundError, ExternalServiceError } from '../src/domain/errors';

const ScanModule: React.FC = () => {
  const { machine, ad } = useAppServices();
  const [searchQuery, setSearchQuery] = useState('');
  const [ouPath, setOuPath] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [riskFilter, setRiskFilter] = useState<string>('All');

  // WinRM GPO State
  const [gpoStatus, setGpoStatus] = useState<'Enabled' | 'Disabled' | 'Processing'>('Enabled');
  const [showGpoConfirm, setShowGpoConfirm] = useState(false);

  // Domain Info (auto-detected from DC)
  const [domainInfo, setDomainInfo] = useState({
    domain: '',
    isDC: false,
    currentUser: '',
  });

  // Credential State
  const [showCredentials, setShowCredentials] = useState(false);
  const [useCurrentUser, setUseCurrentUser] = useState(true);
  const [scanUsername, setScanUsername] = useState('');
  const [scanPassword, setScanPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [scanInProgress, setScanInProgress] = useState(false);
  const [scanSummary, setScanSummary] = useState<BatchScanSummary | null>(null);

  // Selected machines for targeted scanning
  const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set());

  // Available OUs from AD
  const [availableOUs, setAvailableOUs] = useState<Array<{
    path: string;
    name: string;
    computerCount: number;
    type: string;
  }>>([]);
  const [ousLoading, setOusLoading] = useState(false);
  const [ouError, setOuError] = useState<string | null>(null);

  // Auto-detect domain on mount
  React.useEffect(() => {
    const detectDomain = async () => {
      try {
        const electron = (window as any).electron;
        if (electron?.ipc) {
          const info = await electron.ipc.invoke('system:getDomainInfo');
          if (info) {
            setDomainInfo({
              domain: info.DomainName || info.DomainNetBIOS || 'WORKGROUP',
              isDC: info.IsDomainController || false,
              currentUser: `${info.UserDomain || info.DomainNetBIOS}\\${info.UserName}`,
            });
          }
        }
      } catch (error) {
        console.warn('Could not detect domain:', error);
      }
    };
    detectDomain();
  }, []);

  const fetchOUs = useCallback(async () => {
    setOusLoading(true);
    setOuError(null);
    try {
      const electron = (window as any).electron;
      if (electron?.ipc) {
        const result = await electron.ipc.invoke('ad:getOUsWithComputers');
        if (result.success && Array.isArray(result.ous)) {
          setAvailableOUs(result.ous);
          return;
        }
        setAvailableOUs([]);
        setOuError(result?.error || 'Failed to load OUs from Active Directory.');
        return;
      }
      setAvailableOUs([]);
      setOuError('Active Directory integration is unavailable in browser mode.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setOuError(message);
      console.warn('Could not fetch OUs:', error);
    } finally {
      setOusLoading(false);
    }
  }, []);

  // Fetch available OUs on mount
  React.useEffect(() => {
    fetchOUs();
  }, [fetchOUs]);

  // Fetch machines
  const { data: machines, loading: machinesLoading, error: machinesError, refetch: refetchMachines } = useAsync(
    () => machine.getAllMachines()
  );

  // Fetch GPO status
  const { data: gpoStatusData, refetch: refetchGPO } = useAsync(
    () => ad.getWinRMGPOStatus()
  );

  // Update local GPO status when data changes
  React.useEffect(() => {
    if (gpoStatusData) {
      setGpoStatus(gpoStatusData.status);
    }
  }, [gpoStatusData]);

  // Handle targeted scan of selected machines or all filtered machines
  const runBatchScan = useCallback(async (overrideTargets?: string[]) => {
    try {
      setScanInProgress(true);
      const scanOptions: any = {};

      // Add credentials if not using current user
      if (!useCurrentUser && scanUsername) {
        scanOptions.credentials = {
          username: scanUsername,
          password: scanPassword,
          domain: domainInfo.domain,
          useCurrentUser: false
        };
      } else {
        scanOptions.credentials = {
          useCurrentUser: true
        };
      }

      // Add OU filter if specified
      if (ouPath) {
        scanOptions.targetOUs = [ouPath];
      }

      if (overrideTargets && overrideTargets.length > 0) {
        scanOptions.computerNames = overrideTargets;
      } else if (selectedMachines.size > 0) {
        // If specific machines are selected, scan only those
        scanOptions.computerNames = Array.from(selectedMachines);
      }

      const response = await machine.startBatchScan(scanOptions);
      if (response?.summary) {
        setScanSummary(response.summary);
      }
      setSelectedMachines(new Set()); // Clear selection after scan
      await refetchMachines();
    } catch (error) {
      console.error('Failed to start scan:', error);
      alert(`Failed to start scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setScanInProgress(false);
    }
  }, [machine, refetchMachines, useCurrentUser, scanUsername, scanPassword, domainInfo.domain, ouPath, selectedMachines]);

  const handleScan = useCallback(async () => {
    await runBatchScan();
  }, [runBatchScan]);

  const failedScanTargets = useMemo(() => {
    if (!scanSummary) return [];
    return scanSummary.results.filter(result => result.status !== 'Success');
  }, [scanSummary]);

  const handleRetryFailed = useCallback(async () => {
    if (failedScanTargets.length === 0) return;
    await runBatchScan(failedScanTargets.map(result => result.computerName));
  }, [failedScanTargets, runBatchScan]);

  // Toggle machine selection
  const toggleMachineSelection = useCallback((machineId: string) => {
    setSelectedMachines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(machineId)) {
        newSet.delete(machineId);
      } else {
        newSet.add(machineId);
      }
      return newSet;
    });
  }, []);

  // Select all filtered machines
  const selectAllFiltered = useCallback(() => {
    if (filteredMachines.length > 0) {
      setSelectedMachines(new Set(filteredMachines.map(m => m.id)));
    }
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedMachines(new Set());
  }, []);

  const toggleWinRMGPO = useCallback(async () => {
    try {
      setGpoStatus('Processing');
      setShowGpoConfirm(false);
      const enable = gpoStatus === 'Disabled';
      await ad.toggleWinRMGPO(enable);
      await refetchGPO();
    } catch (error) {
      console.error('Failed to toggle WinRM GPO:', error);
      setGpoStatus(gpoStatus === 'Enabled' ? 'Enabled' : 'Disabled');
    }
  }, [ad, gpoStatus, refetchGPO]);

  const filteredMachines = useMemo(() => {
    if (!machines) return [];
    
    const filter: MachineFilter = {
      searchQuery: searchQuery || undefined,
      ouPath: ouPath || undefined,
      status: statusFilter !== 'All' ? statusFilter : undefined,
      riskLevel: riskFilter !== 'All' ? riskFilter : undefined,
    };
    
    return machine.filterMachines(machines, filter);
  }, [machines, searchQuery, ouPath, statusFilter, riskFilter, machine]);

  const clearFilters = () => {
    setSearchQuery('');
    setOuPath('');
    setStatusFilter('All');
    setRiskFilter('All');
  };

  const hasActiveFilters = statusFilter !== 'All' || riskFilter !== 'All' || searchQuery !== '' || ouPath !== '';

  // Auto-group machines by OU-derived type
  const machineGroups = useMemo(() => {
    if (!machines) return { workstations: [], servers: [], domainControllers: [], unknown: [] };
    return groupMachinesByOU(machines);
  }, [machines]);

  if (machinesLoading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="animate-spin text-blue-600" size={32} aria-hidden="true" />
          <span className="sr-only">Loading machines</span>
          <span className="text-slate-600 font-medium" aria-hidden="true">Loading machines...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      {machinesError && (
        <div role="alert" className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl">
          <div className="flex items-start">
            <ShieldAlert className="text-red-500 mr-3 mt-0.5 shrink-0" size={18} aria-hidden="true" />
            <div className="flex-1">
              <h3 className="font-bold text-red-800 text-sm">Unable to load machines</h3>
              <p className="text-red-700 text-xs mt-1">{machinesError.message}</p>
              <button 
                onClick={() => refetchMachines()}
                className="mt-2 text-xs font-bold text-red-800 hover:text-red-900 underline flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2 py-1"
                aria-label="Retry loading machines"
              >
                <RefreshCw size={12} aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Remote Software Scan</h2>
          <p className="text-slate-500 text-sm font-medium">Collect inventory via WinRM from AD-managed computers.</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCredentials(!showCredentials)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all font-bold text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              showCredentials
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            aria-label="Configure scan credentials"
          >
            <Key size={18} aria-hidden="true" />
            <span>Credentials</span>
          </button>
          <button
            onClick={async () => {
              await refetchMachines();
              await fetchOUs();
            }}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all font-bold text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 bg-slate-600 hover:bg-slate-700 text-white"
            aria-label="Detect systems from Active Directory"
          >
            <RefreshCw size={18} aria-hidden="true" />
            <span>Detect Systems</span>
          </button>
        </div>
      </div>

      {/* Credentials Card */}
      {showCredentials && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Key className="text-blue-600" size={20} aria-hidden="true" />
              <h3 className="font-bold text-slate-900">Scan Credentials</h3>
              {domainInfo.isDC && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase rounded">
                  DC Admin Mode
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCredentials(false)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
              aria-label="Close credentials panel"
            >
              <X size={18} />
            </button>
          </div>
          
          {/* Auto-detected Domain Info */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Auto-Detected Domain</p>
                <p className="text-lg font-black text-blue-900">{domainInfo.domain || 'Detecting...'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Current Session</p>
                <p className="text-sm font-medium text-slate-700">{domainInfo.currentUser || 'Loading...'}</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="use-current-user"
                checked={useCurrentUser}
                onChange={(e) => setUseCurrentUser(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="use-current-user" className="text-sm font-medium text-slate-700 cursor-pointer">
                Use current session credentials (recommended for DC Admin)
              </label>
            </div>
            
            {!useCurrentUser && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label htmlFor="scan-username" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                    Admin Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      id="scan-username"
                      value={scanUsername}
                      onChange={(e) => setScanUsername(e.target.value)}
                      placeholder={`${domainInfo.domain}\\administrator`}
                      className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500 text-sm font-medium"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Domain: {domainInfo.domain} (auto-detected)</p>
                </div>
                
                <div>
                  <label htmlFor="scan-password" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="scan-password"
                      value={scanPassword}
                      onChange={(e) => setScanPassword(e.target.value)}
                      placeholder="Admin password"
                      className="w-full pl-9 pr-10 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500 text-sm font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                {useCurrentUser 
                  ? `Using current session: ${domainInfo.currentUser || 'detecting...'}. Ensure you're logged in as a Domain Admin or have delegated WinRM permissions.`
                  : `Enter Domain Admin credentials for ${domainInfo.domain}. Credentials are used securely via WinRM and not stored.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* WinRM GPO Management Card */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start space-x-4">
            <div className={`p-3 rounded-xl ${gpoStatus === 'Enabled' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              <Globe size={24} />
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-white font-bold tracking-tight">Domain WinRM GPO Management</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                  gpoStatus === 'Enabled' ? 'bg-green-500 text-white' : 
                  gpoStatus === 'Disabled' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {gpoStatus}
                </span>
              </div>
              <p className="text-slate-400 text-xs max-w-lg leading-relaxed font-medium">
                Automate domain-wide configuration of WinRM listeners and firewall rules. This creates or modifies the 
                <span className="text-blue-400 font-mono mx-1">"Enable-WinRM"</span> GPO linked to the root domain.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {gpoStatus === 'Processing' ? (
              <div className="flex items-center space-x-2 text-amber-400 text-sm font-bold animate-pulse">
                <Loader2 size={18} className="animate-spin" />
                <span>Propagating...</span>
              </div>
            ) : (
              <button
                onClick={() => setShowGpoConfirm(true)}
                disabled={!domainInfo.isDC}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all min-h-[36px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  !domainInfo.isDC
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600'
                    : gpoStatus === 'Enabled'
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20'
                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-900/20'
                }`}
                aria-label={!domainInfo.isDC ? 'Requires Domain Controller' : gpoStatus === 'Enabled' ? 'Decommission WinRM GPO' : 'Deploy WinRM GPO'}
                title={!domainInfo.isDC ? 'Run this app on a Domain Controller to manage GPOs' : ''}
              >
                {gpoStatus === 'Enabled' ? <ToggleRight size={16} aria-hidden="true" /> : <ToggleLeft size={16} aria-hidden="true" />}
                <span>{!domainInfo.isDC ? 'Requires DC' : gpoStatus === 'Enabled' ? 'Disable WinRM' : 'Deploy WinRM GPO'}</span>
              </button>
            )}
          </div>
        </div>


        <div className="absolute -right-16 -bottom-16 opacity-[0.03] text-white">
          <Globe size={240} />
        </div>
      </div>

      {ouError && (
        <div role="alert" className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-xl text-xs text-amber-800">
          <div className="flex items-center justify-between">
            <span>OU filter unavailable: {ouError}</span>
            <button
              onClick={fetchOUs}
              className="text-[10px] font-bold uppercase tracking-widest text-amber-700 hover:text-amber-900"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar - Compact */}
      <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 flex flex-wrap items-center gap-2">
        {/* Hostname Search */}
        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
          <input
            type="text"
            id="hostname-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hostname..."
            className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Search machines by hostname"
          />
        </div>

        {/* OU Filter Dropdown */}
        <div className="relative flex-1 min-w-[140px]">
          <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" size={12} />
          <select
            id="ou-filter"
            value={ouPath}
            onChange={(e) => setOuPath(e.target.value)}
            className="w-full appearance-none pl-7 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold cursor-pointer outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Filter by OU"
            disabled={ousLoading}
          >
            <option value="">All OUs ({availableOUs.reduce((sum, ou) => sum + ou.computerCount, 0)})</option>
            {availableOUs.map((ou, index) => (
              <option key={index} value={ou.path}>{ou.name} ({ou.computerCount})</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={10} />
        </div>

        {/* Status Dropdown */}
        <div className="relative min-w-[90px]">
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full appearance-none bg-slate-50 border border-slate-200 text-[10px] rounded pl-2 pr-6 py-1.5 cursor-pointer font-bold outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Filter by status"
          >
            <option value="All">All Status</option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
            <option value="Scanning">Scanning</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={10} />
        </div>

        {/* Risk Level Dropdown */}
        <div className="relative min-w-[80px]">
          <select
            id="risk-filter"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="w-full appearance-none bg-slate-50 border border-slate-200 text-[10px] rounded pl-2 pr-6 py-1.5 cursor-pointer font-bold outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Filter by risk"
          >
            <option value="All">All Risk</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={10} />
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
            title="Clear filters"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {ouError && (
        <div role="alert" className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-lg flex items-start space-x-2 text-amber-900 text-xs font-semibold">
          <ShieldAlert className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
          <span>{ouError}</span>
        </div>
      )}

      {/* OU-Based Auto-Grouping Summary - Compact */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-2">
          <div className="p-1.5 bg-blue-50 rounded text-blue-600">
            <Server size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">Workstations</p>
            <p className="text-sm font-black text-slate-900">{machineGroups.workstations.length}</p>
          </div>
        </div>
        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-2">
          <div className="p-1.5 bg-purple-50 rounded text-purple-600">
            <Server size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">Servers</p>
            <p className="text-sm font-black text-slate-900">{machineGroups.servers.length}</p>
          </div>
        </div>
        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-2">
          <div className="p-1.5 bg-amber-50 rounded text-amber-600">
            <ShieldCheck size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">DCs</p>
            <p className="text-sm font-black text-slate-900">{machineGroups.domainControllers.length}</p>
          </div>
        </div>
        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-2">
          <div className="p-1.5 bg-slate-50 rounded text-slate-500">
            <Server size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">Unclassified</p>
            <p className="text-sm font-black text-slate-900">{machineGroups.unknown.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Selection Controls */}
        {filteredMachines.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="select-all"
                checked={selectedMachines.size === filteredMachines.length && filteredMachines.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedMachines(new Set(filteredMachines.map(m => m.id)));
                  } else {
                    setSelectedMachines(new Set());
                  }
                }}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="select-all" className="text-xs font-bold text-slate-600 cursor-pointer">
                {selectedMachines.size > 0 ? `${selectedMachines.size} selected` : 'Select all'}
              </label>
            </div>
            {selectedMachines.size > 0 && (
              <button
                onClick={() => setSelectedMachines(new Set())}
                className="text-xs text-slate-500 hover:text-slate-700 font-bold"
              >
                Clear selection
              </button>
            )}
          </div>
        )}
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-widest font-black">
            <tr>
              <th className="px-3 py-4 w-10"></th>
              <th className="px-4 py-4">Computer / AD Context</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">Risk Level</th>
              <th className="px-4 py-4">Inventory</th>
              <th className="px-4 py-4">Last Sync</th>
              <th className="px-4 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredMachines.length > 0 ? (
              filteredMachines.map((m) => (
                <tr
                  key={m.id}
                  className={`hover:bg-slate-50/50 group transition-colors cursor-pointer ${
                    selectedMachines.has(m.id) ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => toggleMachineSelection(m.id)}
                >
                  <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedMachines.has(m.id)}
                      onChange={() => toggleMachineSelection(m.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${m.status === 'Online' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`} aria-hidden="true">
                        <Server size={18} />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="font-bold text-slate-900 leading-none">{m.hostname}</p>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            getMachineTypeFromOU(m.ou) === 'Workstation' ? 'bg-blue-100 text-blue-700' :
                            getMachineTypeFromOU(m.ou) === 'Server' ? 'bg-purple-100 text-purple-700' :
                            getMachineTypeFromOU(m.ou) === 'DomainController' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {getMachineTypeFromOU(m.ou)}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest truncate max-w-[200px]" title={m.ou}>
                          {m.ou || 'OU not available'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          m.status === 'Online' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' :
                          m.status === 'Scanning' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
                        }`}
                        aria-label={`Machine status: ${m.status}`}
                      />
                      <span className="font-bold text-slate-700">{m.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      m.riskLevel === 'Low' ? 'bg-green-100 text-green-700' :
                      m.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {m.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-500 text-xs font-bold">{m.appCount}</td>
                  <td className="px-4 py-4 text-slate-400 text-xs font-medium">{m.lastScan}</td>
                  <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="text-blue-600 hover:text-blue-800 font-black text-[10px] uppercase tracking-widest px-2 py-1.5 min-h-[36px] rounded-lg hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      aria-label={`View scan results for ${m.hostname}`}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-16">
                  <div className="flex flex-col items-center justify-center space-y-3" role="status">
                    <div className="p-4 bg-slate-50 rounded-full">
                      <Search size={32} className="text-slate-200" aria-hidden="true" />
                    </div>
                    {machines && machines.length > 0 ? (
                      // Have machines but filters are hiding them
                      <div className="space-y-1 text-center">
                        <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">No machines matched filters</p>
                        <p className="text-xs text-slate-500 font-medium">Try adjusting your search query or OU path scoping.</p>
                        <button
                          onClick={clearFilters}
                          className="text-blue-600 text-xs font-black uppercase tracking-widest hover:underline pt-2 min-h-[44px] px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                          aria-label="Reset all filters"
                        >
                          Reset All Filters
                        </button>
                      </div>
                    ) : (
                      // No machines loaded at all
                      <div className="space-y-3 text-center">
                        <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">No systems detected</p>
                        <p className="text-xs text-slate-500 font-medium max-w-md">
                          {domainInfo.isDC
                            ? 'Click "Detect Systems" to query Active Directory for domain-joined computers.'
                            : 'This feature requires the app to run on a Domain Controller with Active Directory access.'}
                        </p>
                        <div className="flex items-center justify-center space-x-3 pt-2">
                          <button
                            onClick={() => refetchMachines()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            aria-label="Detect systems from Active Directory"
                          >
                            <div className="flex items-center space-x-2">
                              <RefreshCw size={14} />
                              <span>Detect Systems</span>
                            </div>
                          </button>
                        </div>
                        {!domainInfo.isDC && (
                          <p className="text-[10px] text-amber-600 font-bold">
                            Note: Running on non-DC - AD queries may fail or return limited results.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {scanSummary && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Latest Scan Results</h3>
              <p className="text-xs text-slate-500 font-medium">
                Per-host status from the most recent batch scan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                Total: {scanSummary.totalMachines}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                Success: {scanSummary.successful}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                Failed: {scanSummary.failed}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                Skipped: {scanSummary.skipped}
              </span>
              <button
                onClick={handleRetryFailed}
                disabled={failedScanTargets.length === 0 || scanInProgress}
                className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scanInProgress ? 'Retrying...' : `Retry Failed (${failedScanTargets.length})`}
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {scanSummary.results.map((result) => (
              <div key={`${result.computerName}-${result.status}`} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900">{result.computerName}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                      result.status === 'Success'
                        ? 'bg-green-100 text-green-700'
                        : result.status === 'Failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {result.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {result.operatingSystem ? `OS: ${result.operatingSystem} • ` : ''}
                    {result.pingStatus ? `Ping: ${result.pingStatus} • ` : ''}
                    {result.winRMStatus ? `WinRM: ${result.winRMStatus}` : ''}
                  </p>
                  {result.error && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{result.error}</p>
                  )}
                </div>
                {result.outputPath && (
                  <div className="text-[11px] text-slate-500 font-mono break-all max-w-md">
                    {result.outputPath}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="bg-[#002868] p-8 rounded-2xl text-white relative overflow-hidden shadow-xl shadow-blue-900/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h3 className="text-2xl font-black flex items-center space-x-2 tracking-tight">
              <ShieldCheck className="text-blue-300" />
              <span>Inventory Intelligence</span>
            </h3>
            <p className="text-blue-100 leading-relaxed font-medium text-sm">
              Use the OU filter to focus on specific high-risk containers or developer enclaves. 
              Comprehensive scans ensure that edge cases don't become vulnerabilities in Phase 4.
            </p>
          </div>
          <button className="bg-white text-[#002868] px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all whitespace-nowrap shadow-lg">
            Toolkit Docs (F1)
          </button>
        </div>
        <div className="absolute -right-20 -bottom-20 opacity-10">
          <Server size={300} />
        </div>
      </div>

      {/*
        GPO Confirmation Modal
        ----------------------
        Uses fixed positioning (z-50) to ensure the modal displays above all other content
        and is not clipped by parent containers with overflow:hidden.

        Previous implementation used absolute positioning within the WinRM card which caused
        the modal content to be cut off when the card had limited height.

        Design:
        - Full-screen backdrop with blur effect (bg-slate-900/80 backdrop-blur-sm)
        - Centered modal card with dark theme to match the WinRM management card
        - animate-in fade-in for smooth appearance
        - Accessible with proper aria-labels and focus management

        @since v1.2.10 - Fixed from absolute to fixed positioning
        @see toggleWinRMGPO() for the action handler
      */}
      {showGpoConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl border border-slate-700">
            <ShieldAlert size={48} className="text-amber-500 mx-auto" />
            <div className="space-y-2">
              <h4 className="text-white font-bold text-xl tracking-tight">Confirm GPO Change</h4>
              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                You are about to {gpoStatus === 'Enabled' ? 'disable' : 'enable'} WinRM domain-wide.
                This will affect the network and may take time to fully propagate via GPUpdate.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => setShowGpoConfirm(false)}
                className="px-6 py-3 min-h-[44px] rounded-xl text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-white hover:bg-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800"
                aria-label="Cancel GPO change"
              >
                Cancel
              </button>
              <button
                onClick={toggleWinRMGPO}
                className="px-6 py-3 min-h-[44px] bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800"
                aria-label="Confirm and proceed with GPO change"
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Scan Bar */}
      {(selectedMachines.size > 0 || filteredMachines.length > 0) && (
        <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-slate-200 shadow-lg p-4 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {selectedMachines.size > 0 ? (
                <span className="font-bold">{selectedMachines.size} machine(s) selected for scanning</span>
              ) : (
                <span>{filteredMachines.length} machine(s) available</span>
              )}
            </div>
            <button
              onClick={handleScan}
              disabled={filteredMachines.length === 0 || scanInProgress}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-all font-bold shadow-lg shadow-blue-500/20 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={selectedMachines.size > 0 ? `Scan ${selectedMachines.size} selected machines` : "Scan all machines"}
            >
              <RefreshCw size={18} aria-hidden="true" />
              <span>
                {scanInProgress
                  ? 'Scanning...'
                  : selectedMachines.size > 0
                    ? `Scan Selected (${selectedMachines.size})`
                    : 'Scan All for Artifacts'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanModule;
