import React, { useState, useCallback } from 'react';
import { Activity, Download, Trash2, Calendar, Filter, ExternalLink, Loader2, ShieldAlert, RefreshCw, Save, FolderArchive, Server, CheckSquare } from 'lucide-react';
import { useAppServices } from '../src/presentation/contexts/AppContext';
import { useAsync } from '../src/presentation/hooks/useAsync';
import { useDebounce } from '../src/presentation/hooks/useDebounce';
import { AppEvent } from '../src/shared/types';
import { EventFilter } from '../src/domain/interfaces/IEventRepository';
import { showSaveDialog, showOpenDialog } from '../src/infrastructure/ipc/fileDialog';

const EventsModule: React.FC = () => {
  const { event, machine } = useAppServices();
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'blocked' | 'audit' | 'allowed'>('all');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupProgress, setBackupProgress] = useState<{current: number, total: number, status: string} | null>(null);
  const [selectedBackupSystems, setSelectedBackupSystems] = useState<Set<string>>(new Set());
  const [backupPath, setBackupPath] = useState('C:\\AppLocker-Backups');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch events
  const { data: events, loading: eventsLoading, error: eventsError, refetch: refetchEvents } = useAsync(
    () => event.getAllEvents()
  );

  // Fetch event stats
  const { data: eventStats, loading: statsLoading } = useAsync(
    () => event.getEventStats()
  );

  // Filter events based on search and event type
  const filteredEvents = React.useMemo(() => {
    if (!events) return [];
    
    let filtered = events;
    
    // Filter by event type
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter((e: AppEvent) => {
        switch (eventTypeFilter) {
          case 'blocked': return e.eventId === 8004;
          case 'audit': return e.eventId === 8003;
          case 'allowed': return e.eventId === 8002 || e.eventId === 8001;
          default: return true;
        }
      });
    }
    
    // Apply search filter
    const filter: EventFilter = {
      searchQuery: debouncedSearch || undefined,
    };
    
    return event.filterEvents(filtered, filter);
  }, [events, debouncedSearch, eventTypeFilter, event]);

  // Fetch machines for backup selection
  const { data: machines } = useAsync(() => machine.getAllMachines());

  const handleExportCSV = async () => {
    try {
      if (!events) return;
      const csv = await event.exportToCSV(events);

      // Use file dialog to save
      const filePath = await showSaveDialog({
        title: 'Export Events to CSV',
        defaultPath: `applocker-events-${new Date().toISOString().split('T')[0]}.csv`,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (filePath) {
        // In Electron, write file via IPC
        const electron = (window as any).electron;
        if (electron?.ipc) {
          await electron.ipc.invoke('fs:writeFile', filePath, csv);
          alert(`Events exported successfully to:\n${filePath}`);
        } else {
          // Fallback to browser download
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filePath.split(/[/\\]/).pop() || 'applocker-events.csv';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert(`Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle backup AppLocker events from selected systems
  const handleBackupEvents = useCallback(async () => {
    if (selectedBackupSystems.size === 0) {
      alert('Please select at least one system to backup');
      return;
    }

    const electron = (window as any).electron;
    if (!electron?.ipc) {
      alert('Backup feature requires the Electron app');
      return;
    }

    try {
      const systemsArray = Array.from(selectedBackupSystems);
      const now = new Date();
      const monthFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      setBackupProgress({ current: 0, total: systemsArray.length, status: 'Starting backup...' });

      for (let i = 0; i < systemsArray.length; i++) {
        const systemName = systemsArray[i];
        setBackupProgress({
          current: i + 1,
          total: systemsArray.length,
          status: `Backing up ${systemName}...`
        });

        // Generate unique filename: systemname-date-time
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${systemName}-${timestamp}.evtx`;
        const outputPath = `${backupPath}\\${monthFolder}\\${filename}`;

        try {
          const result = await electron.ipc.invoke('events:backup', {
            systemName,
            outputPath,
            createFolderIfMissing: true
          });

          if (!result.success) {
            console.warn(`Failed to backup ${systemName}:`, result.error);
          }
        } catch (err) {
          console.warn(`Error backing up ${systemName}:`, err);
        }
      }

      setBackupProgress(null);
      setShowBackupModal(false);
      setSelectedBackupSystems(new Set());
      alert(`Backup complete!\n\nBacked up ${systemsArray.length} system(s) to:\n${backupPath}\\${monthFolder}`);
    } catch (error) {
      setBackupProgress(null);
      console.error('Backup failed:', error);
      alert(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [selectedBackupSystems, backupPath]);

  // Toggle system selection for backup
  const toggleBackupSystem = useCallback((hostname: string) => {
    setSelectedBackupSystems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hostname)) {
        newSet.delete(hostname);
      } else {
        newSet.add(hostname);
      }
      return newSet;
    });
  }, []);

  // Select all machines for backup
  const selectAllForBackup = useCallback(() => {
    if (machines) {
      setSelectedBackupSystems(new Set(machines.map(m => m.hostname)));
    }
  }, [machines]);

  if (eventsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="animate-spin text-blue-600" size={32} aria-hidden="true" />
          <span className="sr-only">Loading events</span>
          <span className="text-slate-600 font-medium" aria-hidden="true">Loading events...</span>
        </div>
      </div>
    );
  }

  if (eventsError) {
    return (
      <div role="alert" className="bg-red-50 border-l-4 border-red-500 p-6 rounded-xl">
        <div className="flex items-start">
          <ShieldAlert className="text-red-500 mr-3 mt-0.5 shrink-0" size={20} aria-hidden="true" />
          <div className="flex-1">
            <h3 className="font-bold text-red-800">Unable to load events</h3>
            <p className="text-red-700 text-sm mt-1">{eventsError.message}</p>
            <button 
              onClick={() => refetchEvents()}
              className="mt-3 text-sm font-bold text-red-800 hover:text-red-900 underline flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2 py-1"
              aria-label="Retry loading events"
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Event Monitor</h2>
          <p className="text-slate-500 text-sm">Real-time AppLocker audit event ingestion (8003/8004).</p>
        </div>
        <div className="flex space-x-3">
          <button
            className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-lg hover:bg-slate-50 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Filter events from last 24 hours"
          >
            <Calendar size={18} aria-hidden="true" />
            <span>Last 24 Hours</span>
          </button>
          <button
            onClick={() => setShowBackupModal(true)}
            className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="Backup AppLocker events from systems"
          >
            <FolderArchive size={18} aria-hidden="true" />
            <span>Backup Events</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2.5 rounded-lg hover:bg-slate-800 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Export events to CSV file"
          >
            <Download size={18} aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Backup Events Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-[700px] max-h-[80vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <FolderArchive size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Backup AppLocker Events</h3>
                  <p className="text-xs text-slate-500">Select systems to backup event logs from</p>
                </div>
              </div>
              <button
                onClick={() => { setShowBackupModal(false); setSelectedBackupSystems(new Set()); }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <Trash2 size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Backup Path */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                  Backup Location
                </label>
                <input
                  type="text"
                  value={backupPath}
                  onChange={(e) => setBackupPath(e.target.value)}
                  placeholder="C:\AppLocker-Backups"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Files saved as: [path]\[YYYY-MM]\[hostname]-[date]-[time].evtx</p>
              </div>

              {/* Machine Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Select Systems ({selectedBackupSystems.size} selected)
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={selectAllForBackup}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-bold"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setSelectedBackupSystems(new Set())}
                      className="text-xs text-slate-500 hover:text-slate-700 font-bold"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg max-h-[300px] overflow-y-auto">
                  {machines && machines.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {machines.map((m) => (
                        <label
                          key={m.id}
                          className={`flex items-center p-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                            selectedBackupSystems.has(m.hostname) ? 'bg-emerald-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedBackupSystems.has(m.hostname)}
                            onChange={() => toggleBackupSystem(m.hostname)}
                            className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-2 focus:ring-emerald-500"
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex items-center space-x-2">
                              <Server size={14} className="text-slate-400" />
                              <span className="font-bold text-slate-900 text-sm">{m.hostname}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                m.status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {m.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{m.ou || 'No OU'}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400">
                      <Server size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-bold">No machines available</p>
                      <p className="text-xs mt-1">Run a remote scan first to discover machines</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress */}
              {backupProgress && (
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Loader2 size={16} className="animate-spin text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-800">{backupProgress.status}</span>
                  </div>
                  <div className="w-full bg-emerald-200 rounded-full h-2">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all"
                      style={{ width: `${(backupProgress.current / backupProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-emerald-600 mt-1">
                    {backupProgress.current} of {backupProgress.total} systems
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => { setShowBackupModal(false); setSelectedBackupSystems(new Set()); }}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBackupEvents}
                disabled={selectedBackupSystems.size === 0 || backupProgress !== null}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {backupProgress ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Backing up...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Start Backup</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <EventStatCard 
          label="Total Blocked (8004)" 
          value={eventStats?.totalBlocked.toString() || '0'} 
          color="text-red-600"
          onClick={() => setEventTypeFilter('blocked')}
          active={eventTypeFilter === 'blocked'}
        />
        <EventStatCard 
          label="Total Audit (8003)" 
          value={eventStats?.totalAudit.toString() || '0'} 
          color="text-blue-600"
          onClick={() => setEventTypeFilter('audit')}
          active={eventTypeFilter === 'audit'}
        />
        <EventStatCard 
          label="Total Allowed (8001/8002)" 
          value={eventStats?.totalAllowed?.toString() || '0'} 
          color="text-green-600"
          onClick={() => setEventTypeFilter('allowed')}
          active={eventTypeFilter === 'allowed'}
        />
        <EventStatCard 
          label="Unique Paths" 
          value={eventStats?.uniquePaths.toString() || '0'} 
          color="text-slate-600"
          onClick={() => setEventTypeFilter('all')}
          active={eventTypeFilter === 'all'}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center space-x-4">
          <div className="flex-1 relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              id="events-search"
              placeholder="Filter events..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 min-h-[44px] bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" 
              aria-label="Search and filter events"
            />
          </div>
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="p-3 min-w-[44px] min-h-[44px] text-slate-400 hover:text-red-500 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-label="Clear search"
            >
              <Trash2 size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Machine</th>
                <th className="px-6 py-4">Executable Path</th>
                <th className="px-6 py-4">Publisher</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50 group">
                    <td className="px-6 py-4">
                      <span className={`flex items-center space-x-1.5 font-bold ${
                        event.eventId === 8004 ? 'text-red-600' : 
                        event.eventId === 8003 ? 'text-blue-600' : 
                        'text-green-600'
                      }`}>
                        <Activity size={14} />
                        <span>{event.eventId}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-black ${
                          event.eventId === 8004 ? 'bg-red-100 text-red-700' : 
                          event.eventId === 8003 ? 'bg-blue-100 text-blue-700' : 
                          'bg-green-100 text-green-700'
                        }`}>
                          {event.eventId === 8004 ? 'Blocked' : event.eventId === 8003 ? 'Audit' : 'Allowed'}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{event.timestamp}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{event.machine}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">
                      <div className="max-w-[300px] truncate" title={event.path}>{event.path}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 italic">{event.publisher}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        className="opacity-0 group-hover:opacity-100 text-blue-600 p-3 min-w-[44px] min-h-[44px] hover:bg-blue-50 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        aria-label="View event details"
                      >
                        <ExternalLink size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8">
                    <div className="text-center" role="status">
                      <Activity className="mx-auto text-slate-300 mb-2" size={32} aria-hidden="true" />
                      <p className="text-slate-500 text-sm font-medium">{searchQuery ? 'No events match your search' : 'No events found'}</p>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-bold underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
                          aria-label="Clear search to show all events"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <button 
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest min-h-[44px] px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            aria-label="Load older events"
          >
            Load Older Events
          </button>
        </div>
      </div>
    </div>
  );
};

const EventStatCard: React.FC<{ 
  label: string, 
  value: string, 
  color: string,
  onClick?: () => void,
  active?: boolean 
}> = ({ label, value, color, onClick, active }) => (
  <button 
    onClick={onClick}
    className={`bg-white p-4 rounded-xl shadow-sm border text-left transition-all w-full min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
      active 
        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md' 
        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
    }`}
    aria-pressed={active}
  >
    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">{label}</p>
    <p className={`text-2xl font-black ${color}`}>{value}</p>
  </button>
);

export default EventsModule;
