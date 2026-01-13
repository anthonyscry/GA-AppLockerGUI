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
  MapPin
} from 'lucide-react';
import { useAppServices } from '../src/presentation/contexts/AppContext';
import { useAsync } from '../src/presentation/hooks/useAsync';
import { MachineScan } from '../src/shared/types';
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

  const handleScan = useCallback(async () => {
    try {
      await machine.startBatchScan({});
      await refetchMachines();
    } catch (error) {
      console.error('Failed to start scan:', error);
    }
  }, [machine, refetchMachines]);

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

  if (machinesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (machinesError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-600 font-bold">Error loading machines</p>
        <p className="text-red-500 text-sm mt-2">{machinesError.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Remote Software Scan</h2>
          <p className="text-slate-500 text-sm font-medium">Collect inventory via WinRM from AD-managed computers.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleScan}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all font-bold shadow-lg shadow-blue-500/20 text-sm"
          >
            <RefreshCw size={18} />
            <span>Start Batch Scan</span>
          </button>
        </div>
      </div>

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
                <span>Propagating Changes...</span>
              </div>
            ) : (
              <button 
                onClick={() => setShowGpoConfirm(true)}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  gpoStatus === 'Enabled' 
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20' 
                  : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-900/20'
                }`}
              >
                {gpoStatus === 'Enabled' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                <span>{gpoStatus === 'Enabled' ? 'Decommission WinRM' : 'Deploy WinRM GPO'}</span>
              </button>
            )}
          </div>
        </div>

        {/* GPO Confirmation Dialog Overlay */}
        {showGpoConfirm && (
          <div className="absolute inset-0 z-20 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="max-w-md w-full text-center space-y-4">
              <ShieldAlert size={48} className="text-amber-500 mx-auto" />
              <div className="space-y-2">
                <h4 className="text-white font-bold text-lg tracking-tight">Confirm GPO Change</h4>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                  You are about to {gpoStatus === 'Enabled' ? 'disable' : 'enable'} WinRM domain-wide. 
                  This will affect 500+ machines and may take 90-120 minutes to fully propagate via GPUpdate.
                </p>
              </div>
              <div className="flex items-center justify-center space-x-3 pt-2">
                <button 
                  onClick={() => setShowGpoConfirm(false)}
                  className="px-6 py-2 rounded-xl text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={toggleWinRMGPO}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20"
                >
                  Confirm & Proceed
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="absolute -right-16 -bottom-16 opacity-[0.03] text-white">
          <Globe size={240} />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Hostname Search */}
        <div className="md:col-span-4 relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hostname..." 
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-bold"
          />
        </div>

        {/* OU Filter */}
        <div className="md:col-span-3 relative group">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input 
            type="text" 
            value={ouPath}
            onChange={(e) => setOuPath(e.target.value)}
            placeholder="OU Path (e.g. Workstations)..." 
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs font-bold"
          />
        </div>

        {/* Status Dropdown */}
        <div className="md:col-span-2 relative">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-lg pl-3 pr-8 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-bold h-full"
          >
            <option value="All">All Statuses</option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
            <option value="Scanning">Scanning</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
        </div>

        {/* Risk Level Dropdown */}
        <div className="md:col-span-2 relative">
          <select 
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-lg pl-3 pr-8 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-bold h-full"
          >
            <option value="All">All Risk Levels</option>
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
        </div>

        {/* Reset Button */}
        <div className="md:col-span-1 flex items-center justify-center">
          {hasActiveFilters && (
            <button 
              onClick={clearFilters}
              className="text-slate-400 hover:text-red-500 transition-colors p-2"
              title="Clear all filters"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-widest font-black">
            <tr>
              <th className="px-6 py-4">Computer / AD Context</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Risk Level</th>
              <th className="px-6 py-4">Inventory Size</th>
              <th className="px-6 py-4">Last Sync</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredMachines.length > 0 ? (
              filteredMachines.map((machine) => (
                <tr key={machine.id} className="hover:bg-slate-50/50 group transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${machine.status === 'Online' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                        <Server size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 leading-none mb-1">{machine.hostname}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest truncate max-w-[180px]">
                          OU=Workstations,DC=GA-ASI,DC=CORP
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${
                        machine.status === 'Online' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 
                        machine.status === 'Scanning' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
                      }`} />
                      <span className="font-bold text-slate-700">{machine.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      machine.riskLevel === 'Low' ? 'bg-green-100 text-green-700' :
                      machine.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {machine.riskLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500 text-xs font-bold">{machine.appCount} items</td>
                  <td className="px-6 py-4 text-slate-400 text-xs font-medium">{machine.lastScan}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100">
                      View Results
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="p-4 bg-slate-50 rounded-full">
                      <Search size={32} className="text-slate-200" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">No machines matched filters</p>
                      <p className="text-xs text-slate-500 font-medium">Try adjusting your search query or OU path scoping.</p>
                    </div>
                    <button 
                      onClick={clearFilters} 
                      className="text-blue-600 text-xs font-black uppercase tracking-widest hover:underline pt-2"
                    >
                      Reset All Filters
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
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
    </div>
  );
};

export default ScanModule;
