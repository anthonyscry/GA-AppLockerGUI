/**
 * Event Monitor Module
 *
 * Displays AppLocker audit events (8001-8004) from Windows Event Viewer.
 * Provides filtering, search, export, and backup capabilities.
 *
 * Event ID Reference:
 * - 8001: AppLocker policy applied successfully
 * - 8002: Application allowed (matched allow rule)
 * - 8003: Application would have been blocked (audit mode warning)
 * - 8004: Application blocked (enforcement mode)
 *
 * @module EventsModule
 * @since v1.2.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Activity,
  Download,
  Trash2,
  Calendar,
  Filter,
  ExternalLink,
  Loader2,
  ShieldAlert,
  RefreshCw,
  Save,
  FolderArchive,
  AlertCircle,
  X
} from 'lucide-react';
import { useAppServices } from '../src/presentation/contexts/AppContext';
import { useAsync } from '../src/presentation/hooks/useAsync';
import { useDebounce } from '../src/presentation/hooks/useDebounce';
import { AppEvent } from '../src/shared/types';
import { showSaveDialog } from '../src/infrastructure/ipc/fileDialog';

/**
 * Safe accessor for event properties
 * Returns empty string for null/undefined values to prevent crashes
 */
const safeString = (value: string | null | undefined): string => {
  return value ?? '';
};

/**
 * Event stat card component with click-to-filter functionality
 */
const EventStatCard: React.FC<{
  label: string;
  value: string;
  color: string;
  onClick?: () => void;
  active?: boolean;
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

/**
 * Single event row component for the events table
 * Handles null/undefined properties safely
 */
const EventRow: React.FC<{ event: AppEvent; onView: (event: AppEvent) => void }> = ({ event, onView }) => {
  const eventId = event?.eventId ?? 0;
  const timestamp = safeString(event?.timestamp);
  const machine = safeString(event?.machine);
  const path = safeString(event?.path);
  const publisher = safeString(event?.publisher);

  // Determine status color based on event ID
  const statusClass = eventId === 8004 ? 'text-red-600' :
                      eventId === 8003 ? 'text-blue-600' :
                      'text-green-600';

  const badgeClass = eventId === 8004 ? 'bg-red-100 text-red-700' :
                     eventId === 8003 ? 'bg-blue-100 text-blue-700' :
                     'bg-green-100 text-green-700';

  const statusLabel = eventId === 8004 ? 'Blocked' :
                      eventId === 8003 ? 'Audit' :
                      'Allowed';

  return (
    <tr className="hover:bg-slate-50 group">
      <td className="px-6 py-4">
        <span className={`flex items-center space-x-1.5 font-bold ${statusClass}`}>
          <Activity size={14} />
          <span>{eventId}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-black ${badgeClass}`}>
            {statusLabel}
          </span>
        </span>
      </td>
      <td className="px-6 py-4 text-slate-500">{timestamp || 'N/A'}</td>
      <td className="px-6 py-4 font-semibold text-slate-800">{machine || 'Unknown'}</td>
      <td className="px-6 py-4 font-mono text-xs text-slate-600">
        <div className="max-w-[300px] truncate" title={path}>{path || 'N/A'}</div>
      </td>
      <td className="px-6 py-4 text-slate-500 italic">{publisher || 'Unknown'}</td>
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => onView(event)}
          className="opacity-0 group-hover:opacity-100 text-blue-600 p-3 min-w-[44px] min-h-[44px] hover:bg-blue-50 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="View event details"
        >
          <ExternalLink size={16} aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
};

/**
 * Main Event Monitor component
 */
const EventsModule: React.FC = () => {
  const { event } = useAppServices();
  const defaultBackupRoot = 'C:\\AppLocker\\backups\\events';

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'blocked' | 'audit' | 'allowed'>('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Backup modal state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupProgress, setBackupProgress] = useState<{current: number; total: number; status: string} | null>(null);
  const [backupPath, setBackupPath] = useState(defaultBackupRoot);
  const [lastBackupPath, setLastBackupPath] = useState<string | null>(null);
  const [backupTargets, setBackupTargets] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);

  // Error state for component-level error handling
  const [componentError, setComponentError] = useState<string | null>(null);

  // Fetch events with error handling
  const {
    data: rawEvents,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents
  } = useAsync(() => event.getAllEvents());

  // Fetch event stats
  const {
    data: eventStats,
    loading: statsLoading
  } = useAsync(() => event.getEventStats());

  // Normalize events to ensure we always have an array with valid objects
  const events = useMemo(() => {
    try {
      if (!rawEvents) return [];
      if (!Array.isArray(rawEvents)) {
        console.warn('Events data is not an array:', typeof rawEvents);
        return [];
      }
      // Filter out any null/undefined entries and ensure each has required fields
      return rawEvents.filter((e): e is AppEvent => {
        return e != null && typeof e === 'object';
      });
    } catch (err) {
      console.error('Error normalizing events:', err);
      setComponentError('Failed to process events data');
      return [];
    }
  }, [rawEvents]);

  // Safe filtering with comprehensive null checks
  const filteredEvents = useMemo(() => {
    try {
      if (!events || events.length === 0) return [];

      let filtered = [...events];

      // Filter by event type
      if (eventTypeFilter !== 'all') {
        filtered = filtered.filter((e) => {
          const eventId = e?.eventId;
          if (eventId == null) return false;

          switch (eventTypeFilter) {
            case 'blocked': return eventId === 8004;
            case 'audit': return eventId === 8003;
            case 'allowed': return eventId === 8002 || eventId === 8001;
            default: return true;
          }
        });
      }

      // Apply search filter with null-safe property access
      if (debouncedSearch && debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase().trim();
        filtered = filtered.filter((e) => {
          const machineMatch = safeString(e?.machine).toLowerCase().includes(query);
          const pathMatch = safeString(e?.path).toLowerCase().includes(query);
          const publisherMatch = safeString(e?.publisher).toLowerCase().includes(query);
          return machineMatch || pathMatch || publisherMatch;
        });
      }

      return filtered;
    } catch (err) {
      console.error('Error filtering events:', err);
      return [];
    }
  }, [events, debouncedSearch, eventTypeFilter]);

  // Safe stats with defaults
  const safeStats = useMemo(() => ({
    totalBlocked: eventStats?.totalBlocked ?? 0,
    totalAudit: eventStats?.totalAudit ?? 0,
    totalAllowed: eventStats?.totalAllowed ?? 0,
    uniquePaths: eventStats?.uniquePaths ?? 0,
  }), [eventStats]);

  // Export to CSV with error handling
  const handleExportCSV = useCallback(async () => {
    try {
      if (!events || events.length === 0) {
        alert('No events to export');
        return;
      }

      const csv = await event.exportToCSV(events);

      const filePath = await showSaveDialog({
        title: 'Export Events to CSV',
        defaultPath: `applocker-events-${new Date().toISOString().split('T')[0]}.csv`,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (filePath) {
        const electron = (window as any).electron;
        if (electron?.ipc) {
          const writeResult = await electron.ipc.invoke('fs:writeFile', filePath, csv);
          if (writeResult?.success) {
            alert(`Events exported successfully to:\n${writeResult.filePath || filePath}`);
          } else {
            alert(`Failed to export CSV:\n${writeResult?.error || 'Unknown error'}`);
          }
        } else {
          // Browser fallback
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
  }, [events, event]);

  // Backup events handler - creates a single combined log file
  const handleBackupEvents = useCallback(async () => {
    const electron = (window as any).electron;
    if (!electron?.ipc) {
      alert('Backup feature requires the Electron app');
      return;
    }

    try {
      const trimmedBackupPath = backupPath.trim();
      if (!trimmedBackupPath) {
        alert('Please enter a backup location.');
        return;
      }

      const effectiveBasePath = trimmedBackupPath;
      const now = new Date();
      const monthFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');

      const systems = backupTargets
        .split(/[,;]+/)
        .map(value => value.trim())
        .filter(Boolean);
      const label = systems.length === 1
        ? systems[0].replace(/[^\w.-]+/g, '-')
        : systems.length > 1
          ? 'multi'
          : 'local';

      // Create a single log file for the selected systems
      const filename = `${label}-${dateStr}-${timeStr}.evtx`;
      const outputPath = `${effectiveBasePath}\\${monthFolder}\\${filename}`;

      setBackupProgress({ current: 0, total: 1, status: 'Backing up AppLocker events...' });
      setLastBackupPath(null);

      try {
        // Backup as a single combined file
        const result = await electron.ipc.invoke('events:backup', {
          systems,
          outputPath,
          createFolderIfMissing: true
        });

        setBackupProgress({ current: 1, total: 1, status: 'Complete!' });

        if (!result?.success) {
          console.warn('Failed to backup:', result?.error);
          alert(`Backup failed: ${result?.error || 'Unknown error'}`);
        } else {
          const finalOutputPath = result?.outputPath || outputPath;
          setLastBackupPath(finalOutputPath);
          alert(
            `Backup complete!\n\nSaved AppLocker events to:\n${finalOutputPath}\n\nBackup scope: ${
              systems.length > 0 ? systems.join(', ') : 'Local system'
            }.`
          );
        }
      } catch (err) {
        console.warn('Error backing up:', err);
        alert(`Backup error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      setBackupProgress(null);
    } catch (error) {
      setBackupProgress(null);
      console.error('Backup failed:', error);
      alert(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [backupPath, backupTargets]);

  // Clear component error after displaying
  useEffect(() => {
    if (componentError) {
      const timer = setTimeout(() => setComponentError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [componentError]);

  useEffect(() => {
    if (!selectedEvent) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedEvent]);

  // Loading state
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

  // Error state
  if (eventsError) {
    return (
      <div role="alert" className="bg-red-50 border-l-4 border-red-500 p-6 rounded-xl">
        <div className="flex items-start">
          <ShieldAlert className="text-red-500 mr-3 mt-0.5 shrink-0" size={20} aria-hidden="true" />
          <div className="flex-1">
            <h3 className="font-bold text-red-800">Unable to load events</h3>
            <p className="text-red-700 text-sm mt-1">{eventsError?.message || 'Unknown error occurred'}</p>
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
      {/* Component-level error toast */}
      {componentError && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-in slide-in-from-right">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{componentError}</span>
          <button onClick={() => setComponentError(null)} className="p-1 hover:bg-red-700 rounded">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
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
            aria-label="Backup AppLocker events"
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
                  <p className="text-xs text-slate-500">Backup AppLocker logs from local or remote systems</p>
                </div>
              </div>
              <button
                onClick={() => { setShowBackupModal(false); }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                aria-label="Close backup modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Backup Path */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                  Backup Location
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={backupPath}
                    onChange={(e) => setBackupPath(e.target.value)}
                    placeholder="C:\\AppLocker\\backups\\events"
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const electron = (window as any).electron;
                      if (!electron?.ipc) {
                        alert('Folder selection requires the Electron app');
                        return;
                      }
                      const result = await electron.ipc.invoke('dialog:showOpenDirectoryDialog', {
                        title: 'Select Backup Folder',
                        defaultPath: backupPath || defaultBackupRoot
                      });
                      if (!result?.canceled && result?.filePath) {
                        setBackupPath(result.filePath);
                      }
                    }}
                    className="px-3 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                  >
                    Browse
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Files saved as: [path]\[YYYY-MM]\[system]-[date]-[time].evtx</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                  Target Systems (Optional)
                </label>
                <input
                  type="text"
                  value={backupTargets}
                  onChange={(e) => setBackupTargets(e.target.value)}
                  placeholder="DC01, DC02, WKST-01"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Leave blank to back up the local system only. Separate multiple systems with commas.</p>
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
                    {backupTargets.trim() ? 'Remote systems' : 'Local system'} ({backupProgress.current} of {backupProgress.total})
                  </p>
                </div>
              )}
              {lastBackupPath && !backupProgress && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">Backup completed</p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Final output path:
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-emerald-900">
                    {lastBackupPath}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => { setShowBackupModal(false); }}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBackupEvents}
                disabled={backupProgress !== null}
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

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-[640px] max-h-[80vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Event Details</h3>
                <p className="text-xs text-slate-500">AppLocker event metadata</p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                aria-label="Close event details"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event ID</p>
                  <p className="font-semibold text-slate-800">{selectedEvent.eventId}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</p>
                  <p className="font-semibold text-slate-800">{selectedEvent.action}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timestamp</p>
                  <p className="font-semibold text-slate-800">{selectedEvent.timestamp || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Machine</p>
                  <p className="font-semibold text-slate-800">{selectedEvent.machine || 'Unknown'}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Executable Path</p>
                <p className="mt-1 font-mono text-xs text-slate-700 break-all">
                  {selectedEvent.path || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Publisher</p>
                <p className="mt-1 text-sm text-slate-700">
                  {selectedEvent.publisher || 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <EventStatCard
          label="Total Blocked (8004)"
          value={safeStats.totalBlocked.toString()}
          color="text-red-600"
          onClick={() => setEventTypeFilter('blocked')}
          active={eventTypeFilter === 'blocked'}
        />
        <EventStatCard
          label="Total Audit (8003)"
          value={safeStats.totalAudit.toString()}
          color="text-blue-600"
          onClick={() => setEventTypeFilter('audit')}
          active={eventTypeFilter === 'audit'}
        />
        <EventStatCard
          label="Total Allowed (8001/8002)"
          value={safeStats.totalAllowed.toString()}
          color="text-green-600"
          onClick={() => setEventTypeFilter('allowed')}
          active={eventTypeFilter === 'allowed'}
        />
        <EventStatCard
          label="Unique Paths"
          value={safeStats.uniquePaths.toString()}
          color="text-slate-600"
          onClick={() => setEventTypeFilter('all')}
          active={eventTypeFilter === 'all'}
        />
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center space-x-4">
          <div className="flex-1 relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              id="events-search"
              placeholder="Filter by machine, path, or publisher..."
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
          <button
            onClick={() => refetchEvents()}
            className="p-3 min-w-[44px] min-h-[44px] text-slate-400 hover:text-blue-600 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Refresh events"
          >
            <RefreshCw size={20} aria-hidden="true" />
          </button>
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
                filteredEvents.map((evt, index) => (
                  <EventRow
                    key={evt?.id || `event-${index}`}
                    event={evt}
                    onView={(selected) => setSelectedEvent(selected)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8">
                    <div className="text-center" role="status">
                      <Activity className="mx-auto text-slate-300 mb-2" size={32} aria-hidden="true" />
                      <p className="text-slate-500 text-sm font-medium">
                        {searchQuery ? 'No events match your search' : 'No events found'}
                      </p>
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
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Showing {filteredEvents.length} of {events.length} events
          </span>
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

export default EventsModule;
