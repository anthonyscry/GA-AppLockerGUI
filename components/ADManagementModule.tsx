
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ADUser } from '../src/shared/types';
import { APPLOCKER_GROUPS } from '../constants';
import {
  Users,
  Search,
  UserPlus,
  ShieldCheck,
  User,
  ChevronRight,
  Activity,
  PlusCircle,
  X,
  CheckCircle2,
  Lock,
  GripVertical,
  MousePointer2,
  ArrowRightLeft,
  Terminal,
  FileText,
  Building2,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAppServices } from '../src/presentation/contexts/AppContext';
import { useAsync } from '../src/presentation/hooks/useAsync';
import { LoadingState } from './ui/LoadingState';
import { ErrorState } from './ui/ErrorState';
import { showSaveDialog } from '../src/infrastructure/ipc/fileDialog';

// Convert wildcard pattern to regex
const wildcardToRegex = (pattern: string): RegExp => {
  // Escape special regex characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Convert * to .*
  const regexPattern = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${regexPattern}$`, 'i');
};

// Check if a string matches a wildcard pattern
const matchesWildcard = (value: string | undefined | null, pattern: string): boolean => {
  if (!value) return false;
  if (!pattern.includes('*')) {
    // Simple case-insensitive contains match
    return value.toLowerCase().includes(pattern.toLowerCase());
  }
  // Use regex for wildcard matching
  const regex = wildcardToRegex(pattern);
  return regex.test(value);
};

interface ADOrganizationalUnit {
  path: string;
  name: string;
  userCount: number;
}

const ADManagementModule: React.FC = () => {
  const { ad } = useAppServices();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOU, setSelectedOU] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<ADUser | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [draggedUser, setDraggedUser] = useState<ADUser | null>(null);
  const [activeDropGroup, setActiveDropGroup] = useState<string | null>(null);
  const [componentError, setComponentError] = useState<string | null>(null);

  // Available OUs from AD
  const [availableOUs, setAvailableOUs] = useState<ADOrganizationalUnit[]>([]);
  const [ousLoading, setOusLoading] = useState(false);

  // Fetch AD users with error handling
  const { data: rawUsers, loading: usersLoading, error: usersError, refetch: refetchUsers } = useAsync(
    () => ad.getAllUsers().catch(err => {
      console.error('Error fetching users:', err);
      return [];
    })
  );

  // Safely normalize users to prevent crashes
  const users = useMemo(() => {
    try {
      if (!rawUsers) return [];
      if (!Array.isArray(rawUsers)) return [];
      return rawUsers.filter((u): u is ADUser => {
        return u != null && typeof u === 'object' && typeof u.samAccountName === 'string';
      }).map(u => ({
        ...u,
        id: u.id || u.samAccountName || `user-${Math.random()}`,
        displayName: u.displayName || u.samAccountName || 'Unknown User',
        samAccountName: u.samAccountName || 'unknown',
        groups: Array.isArray(u.groups) ? u.groups : [],
        department: u.department || '',
        ou: u.ou || ''
      }));
    } catch (err) {
      console.error('Error normalizing users:', err);
      return [];
    }
  }, [rawUsers]);

  // Fetch OUs from AD on mount
  useEffect(() => {
    const fetchOUs = async () => {
      setOusLoading(true);
      try {
        const electron = (window as any).electron;
        if (electron?.ipc) {
          const result = await electron.ipc.invoke('ad:getOUsWithUsers');
          if (result?.success && Array.isArray(result.ous)) {
            setAvailableOUs(result.ous);
          } else {
            // Try to extract OUs from users if the endpoint doesn't exist
            extractOUsFromUsers();
          }
        } else {
          extractOUsFromUsers();
        }
      } catch (error) {
        console.warn('Could not fetch OUs from AD, extracting from users:', error);
        extractOUsFromUsers();
      } finally {
        setOusLoading(false);
      }
    };

    fetchOUs();
  }, []);

  // Extract OUs from loaded users as fallback
  const extractOUsFromUsers = useCallback(() => {
    if (!users || users.length === 0) return;

    const ouMap = new Map<string, number>();
    users.forEach(user => {
      if (user.ou) {
        // Extract OU name from distinguished name
        const ouMatch = user.ou.match(/OU=([^,]+)/);
        if (ouMatch) {
          const ouName = ouMatch[1];
          ouMap.set(ouName, (ouMap.get(ouName) || 0) + 1);
        }
      }
    });

    const extractedOUs: ADOrganizationalUnit[] = Array.from(ouMap.entries()).map(([name, count]) => ({
      path: name,
      name: name,
      userCount: count
    })).sort((a, b) => a.name.localeCompare(b.name));

    setAvailableOUs(extractedOUs);
  }, [users]);

  // Re-extract OUs when users change
  useEffect(() => {
    if (users.length > 0 && availableOUs.length === 0) {
      extractOUsFromUsers();
    }
  }, [users, availableOUs.length, extractOUsFromUsers]);

  // Filter users with comprehensive error handling
  const filteredUsers = useMemo(() => {
    try {
      if (!users || users.length === 0) return [];

      let filtered = [...users];

      // Filter by OU
      if (selectedOU !== 'all') {
        filtered = filtered.filter((u) => {
          try {
            if (!u.ou) return false;
            return u.ou.includes(`OU=${selectedOU}`) || u.ou === selectedOU;
          } catch {
            return false;
          }
        });
      }

      // Filter by search query (supports wildcards)
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.trim();
        filtered = filtered.filter((u) => {
          try {
            return matchesWildcard(u.samAccountName, query) ||
                   matchesWildcard(u.displayName, query) ||
                   matchesWildcard(u.department, query) ||
                   matchesWildcard(u.ou, query);
          } catch {
            return false;
          }
        });
      }

      return filtered;
    } catch (err) {
      console.error('Error filtering users:', err);
      setComponentError('Error filtering users');
      return [];
    }
  }, [users, searchQuery, selectedOU]);

  const handleScanAD = async () => {
    setIsScanning(true);
    setComponentError(null);
    try {
      await refetchUsers();
    } catch (error) {
      console.error('Failed to refresh AD inventory:', error);
      setComponentError('Failed to refresh AD inventory');
    } finally {
      setIsScanning(false);
    }
  };

  // Safe user selection handler
  const handleUserSelect = useCallback((user: ADUser) => {
    try {
      if (!user) return;
      setSelectedUser({
        ...user,
        id: user.id || user.samAccountName || 'unknown',
        displayName: user.displayName || user.samAccountName || 'Unknown',
        samAccountName: user.samAccountName || 'unknown',
        groups: Array.isArray(user.groups) ? user.groups : [],
        department: user.department || '',
        ou: user.ou || ''
      });
    } catch (err) {
      console.error('Error selecting user:', err);
      setComponentError('Error selecting user');
    }
  }, []);

  // Drag and Drop Logic with error handling
  const handleDragStart = useCallback((e: React.DragEvent, user: ADUser) => {
    try {
      setDraggedUser(user);
      e.dataTransfer.setData('userId', user.id || user.samAccountName);
      e.dataTransfer.effectAllowed = 'move';
      const target = e.currentTarget as HTMLElement;
      target.style.opacity = '0.5';
    } catch (err) {
      console.error('Error starting drag:', err);
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    try {
      const target = e.currentTarget as HTMLElement;
      target.style.opacity = '1';
      setDraggedUser(null);
      setActiveDropGroup(null);
    } catch (err) {
      console.error('Error ending drag:', err);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, group: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropGroup !== group) {
      setActiveDropGroup(group);
    }
  }, [activeDropGroup]);

  const handleDragLeave = useCallback(() => {
    setActiveDropGroup(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, group: string) => {
    e.preventDefault();
    const userId = e.dataTransfer.getData('userId');

    try {
      await ad.addUserToGroup(userId, group);
      await refetchUsers();
      if (selectedUser?.id === userId || selectedUser?.samAccountName === userId) {
        const updatedUser = await ad.getUserById(userId);
        if (updatedUser) {
          handleUserSelect(updatedUser);
        }
      }
    } catch (error) {
      console.error(`Failed to add user ${userId} to group ${group}:`, error);
      setComponentError(`Failed to add user to ${group}`);
    }

    setActiveDropGroup(null);
    setDraggedUser(null);
  }, [ad, refetchUsers, selectedUser, handleUserSelect]);

  // Clear error after timeout
  useEffect(() => {
    if (componentError) {
      const timer = setTimeout(() => setComponentError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [componentError]);

  // Show loading state
  if (usersLoading && !users.length) {
    return <LoadingState message="Loading Active Directory users..." />;
  }

  // Show error state
  if (usersError && !users.length) {
    return (
      <ErrorState
        title="Failed to load Active Directory users"
        message={usersError?.message || 'Unknown error occurred'}
        onRetry={refetchUsers}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-left-4 duration-500 pb-8">
      {/* Component-level error toast */}
      {componentError && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-in slide-in-from-right">
          <AlertCircle size={16} />
          <span className="text-xs font-medium">{componentError}</span>
          <button onClick={() => setComponentError(null)} className="p-1 hover:bg-red-700 rounded">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Header - Compact */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight italic uppercase">AD Manager</h2>
          <p className="text-slate-500 text-xs font-medium">Drag users into security groups to update AppLocker permissions.</p>
        </div>
        <button
          onClick={handleScanAD}
          disabled={isScanning}
          className="bg-[#002868] text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#001f4d] shadow-lg shadow-blue-900/20 transition-all flex items-center space-x-2 disabled:opacity-50 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={isScanning ? "Syncing Active Directory domain" : "Refresh Active Directory inventory"}
        >
          {isScanning ? <Activity className="animate-spin" size={14} aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
          <span>{isScanning ? 'Syncing...' : 'Refresh AD Inventory'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* User Search List - Compact */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[340px] overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Directory Users</h3>
              <div className="flex items-center space-x-1 text-[8px] font-bold text-blue-600">
                <MousePointer2 size={8} />
                <span>Drag to Group</span>
              </div>
            </div>

            {/* OU Filter - Compact */}
            <div className="mb-2">
              <select
                value={selectedOU}
                onChange={(e) => setSelectedOU(e.target.value)}
                className="w-full py-1.5 px-2 min-h-[32px] bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                disabled={ousLoading}
              >
                <option value="all">All Organizational Units ({users.length})</option>
                {availableOUs.map((ou, idx) => (
                  <option key={idx} value={ou.path}>{ou.name} ({ou.userCount})</option>
                ))}
              </select>
            </div>

            {/* Search - Compact */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                type="text"
                placeholder="Search users... (use * for wildcard)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 min-h-[32px] bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, user)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleUserSelect(user)}
                  className={`w-full group cursor-grab active:cursor-grabbing text-left p-2 rounded-lg border transition-all flex items-center justify-between ${
                    selectedUser?.id === user.id
                      ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <div className="text-slate-300 group-hover:text-blue-400 transition-colors shrink-0">
                      <GripVertical size={10} />
                    </div>
                    <div className={`w-6 h-6 rounded flex items-center justify-center shadow-sm shrink-0 ${
                      selectedUser?.id === user.id ? 'bg-[#002868] text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <User size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-900 group-hover:text-blue-700 transition-colors truncate">{user.samAccountName}</p>
                      <p className="text-[9px] text-slate-500 font-medium truncate">{user.displayName}</p>
                      {user.ou && (
                        <p className="text-[8px] text-slate-400 font-medium truncate">{user.ou.match(/OU=([^,]+)/)?.[1] || user.ou}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={10} className={`shrink-0 ${selectedUser?.id === user.id ? 'text-blue-600' : 'text-slate-300'}`} />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 py-4">
                <User size={32} className="opacity-20" />
                <p className="text-[10px] font-bold">No users found</p>
                <p className="text-[9px] text-slate-400">Click "Refresh AD Inventory" to load users</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Center & Groups - Compact */}
        <div className="lg:col-span-8 space-y-4">
          {/* Active Profile Header - Compact */}
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 shadow-lg relative overflow-hidden text-white flex items-center">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
              {selectedUser ? (
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-[#002868] rounded-lg flex items-center justify-center shadow-lg ring-2 ring-white/10">
                    <User size={20} />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-black tracking-tight">{selectedUser.displayName}</h3>
                      <span className="px-1.5 py-0.5 bg-green-500 text-white text-[7px] font-black uppercase rounded tracking-widest">Active</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-400 font-bold text-[9px] uppercase tracking-widest">
                      <span className="flex items-center space-x-1"><Terminal size={8} /> <span>{selectedUser.samAccountName}</span></span>
                      {selectedUser.department && (
                        <>
                          <span className="w-1 h-1 bg-slate-700 rounded-full" />
                          <span>{selectedUser.department}</span>
                        </>
                      )}
                      {selectedUser.ou && (
                        <>
                          <span className="w-1 h-1 bg-slate-700 rounded-full" />
                          <span className="text-blue-400">{selectedUser.ou.match(/OU=([^,]+)/)?.[1] || 'Root'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-slate-500">
                  <ArrowRightLeft size={16} />
                  <p className="font-black uppercase tracking-widest text-[10px] italic">Select a user to manage</p>
                </div>
              )}
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-[0.03]">
              <Lock size={100} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Target Drop Zone - Compact */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full relative">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-black text-slate-900 text-[8px] uppercase tracking-[0.15em] flex items-center space-x-2">
                  <ShieldCheck size={12} className="text-blue-600" />
                  <span>Target Security Groups</span>
                </h4>
              </div>

              <div className="space-y-1.5 flex-1">
                {APPLOCKER_GROUPS.map((group) => (
                  <div
                    key={group}
                    onDragOver={(e) => handleDragOver(e, group)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, group)}
                    className={`relative p-2 rounded-lg border-2 transition-all duration-300 group flex items-center justify-between ${
                      activeDropGroup === group
                        ? 'bg-blue-600 border-blue-400 scale-[1.02] shadow-lg shadow-blue-500/30'
                        : draggedUser
                          ? 'bg-slate-50 border-dashed border-blue-200 border-2'
                          : 'bg-slate-50 border-slate-50 hover:border-blue-100 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`p-1 rounded transition-colors ${
                        activeDropGroup === group ? 'bg-white text-blue-600' : 'bg-white text-slate-400 border border-slate-100'
                      }`}>
                        <PlusCircle size={10} />
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-tight transition-colors ${
                        activeDropGroup === group ? 'text-white' : 'text-slate-700'
                      }`}>
                        {group}
                      </span>
                    </div>
                    {activeDropGroup === group && (
                      <span className="text-[7px] font-black tracking-widest uppercase text-white">Drop</span>
                    )}
                  </div>
                ))}
              </div>

              {draggedUser && !activeDropGroup && (
                <div className="mt-2 p-1.5 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center space-x-2 text-blue-600 animate-pulse">
                  <UserPlus size={10} />
                  <p className="text-[8px] font-black uppercase tracking-widest">Dragging: {draggedUser.samAccountName}</p>
                </div>
              )}
            </div>

            {/* Selected User Details - Compact */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
              {selectedUser ? (
                <>
                  <h4 className="font-black text-slate-900 text-[8px] uppercase tracking-[0.15em] mb-2 flex items-center space-x-2">
                    <CheckCircle2 size={12} className="text-green-600" />
                    <span>Existing Access Token</span>
                  </h4>
                  <div className="space-y-1 flex-1 overflow-y-auto max-h-[180px] pr-1 custom-scrollbar">
                    {selectedUser.groups && selectedUser.groups.length > 0 ? (
                      selectedUser.groups.map((group, i) => (
                        <div key={i} className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-100 rounded group hover:border-slate-200 transition-colors">
                          <span className="text-[9px] font-bold text-slate-700 truncate max-w-[150px]">{group}</span>
                          <span className="text-[7px] font-black bg-white border border-slate-100 px-1.5 py-0.5 rounded-full text-slate-400 uppercase">Active</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-slate-400">
                        <p className="text-[9px] font-medium">No group memberships found</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <button
                      onClick={async () => {
                        if (!selectedUser) return;
                        try {
                          const filePath = await showSaveDialog({
                            title: 'Export Audit Profile',
                            defaultPath: `C:\\AppLocker\\audit-profile-${selectedUser.samAccountName}-${new Date().toISOString().split('T')[0]}.json`,
                            filters: [
                              { name: 'JSON Files', extensions: ['json'] },
                              { name: 'All Files', extensions: ['*'] }
                            ]
                          });
                          if (filePath) {
                            const profile = {
                              user: selectedUser,
                              exportedAt: new Date().toISOString(),
                              groups: selectedUser.groups || []
                            };
                            const electron = (window as any).electron;
                            if (electron?.ipc) {
                              await electron.ipc.invoke('fs:writeFile', filePath, JSON.stringify(profile, null, 2));
                              alert(`Audit profile exported successfully to:\n${filePath}`);
                            } else {
                              const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = filePath.split(/[/\\]/).pop() || 'audit-profile.json';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              window.URL.revokeObjectURL(url);
                            }
                          }
                        } catch (error) {
                          console.error('Failed to export audit profile:', error);
                          setComponentError('Failed to export audit profile');
                        }
                      }}
                      className="w-full py-2 bg-slate-900 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center space-x-2 min-h-[32px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <FileText size={12} />
                      <span>Export Profile</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 space-y-3 py-4">
                  <div className="p-3 bg-slate-50 rounded-full border-2 border-dashed border-slate-200">
                    <Users size={24} className="opacity-20" />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">No Selection</p>
                    <p className="text-[8px] text-slate-400 font-medium leading-relaxed">
                      Select a user to view memberships or drag to provision rights.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ADManagementModule;
