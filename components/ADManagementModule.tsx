
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
  X,
  CheckCircle2,
  Lock,
  Terminal,
  FileText,
  RefreshCw,
  AlertCircle,
  Filter,
  Check,
  Minus
} from 'lucide-react';
import { useAppServices } from '../src/presentation/contexts/AppContext';
import { useAsync } from '../src/presentation/hooks/useAsync';
import { LoadingState } from './ui/LoadingState';
import { ErrorState } from './ui/ErrorState';
import { showSaveDialog } from '../src/infrastructure/ipc/fileDialog';

// Convert wildcard pattern to regex
const wildcardToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${regexPattern}$`, 'i');
};

const safeString = (value: unknown): string => (typeof value === 'string' ? value : '');

const normalizeGroupName = (value: string): string => value.trim().toLowerCase();

// Check if a string matches a wildcard pattern
const matchesWildcard = (value: string | undefined | null, pattern: string): boolean => {
  if (!value) return false;
  if (!pattern.includes('*')) {
    return value.toLowerCase().includes(pattern.toLowerCase());
  }
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
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<ADUser | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [updatingGroups, setUpdatingGroups] = useState<Set<string>>(new Set());

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
        return u != null && typeof u === 'object';
      }).map(u => ({
        ...u,
        id: safeString(u.id) || safeString(u.samAccountName) || `user-${Math.random()}`,
        displayName: safeString(u.displayName) || safeString(u.samAccountName) || 'Unknown User',
        samAccountName: safeString(u.samAccountName) || 'unknown',
        groups: Array.isArray(u.groups)
          ? u.groups.filter((group): group is string => typeof group === 'string')
          : [],
        department: safeString(u.department),
        ou: safeString(u.ou)
      }));
    } catch (err) {
      console.error('Error normalizing users:', err);
      return [];
    }
  }, [rawUsers]);

  const selectedUserDetailItems = useMemo(() => {
    if (!selectedUser) return [];
    const items: Array<{ key: string; content: React.ReactNode }> = [
      {
        key: 'account',
        content: (
          <span className="flex items-center space-x-1">
            <Terminal size={10} />
            <span>{selectedUser.samAccountName || 'unknown'}</span>
          </span>
        )
      },
      selectedUser.department
        ? { key: 'department', content: <span>{selectedUser.department}</span> }
        : null,
      selectedUser.ou
        ? {
            key: 'ou',
            content: (
              <span className="text-blue-400">
                {selectedUser.ou.match(/OU=([^,]+)/)?.[1] || selectedUser.ou}
              </span>
            )
          }
        : null
    ];

    return items.filter((item): item is { key: string; content: React.ReactNode } => item !== null);
  }, [selectedUser]);

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

  // Check if user is in a specific AppLocker group
  const isUserInAppLockerGroup = useCallback((user: ADUser, group: string): boolean => {
    if (!user.groups || !Array.isArray(user.groups)) return false;
    const normalizedGroup = normalizeGroupName(group);
    return user.groups.some(g => typeof g === 'string' && normalizeGroupName(g) === normalizedGroup);
  }, []);

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

      // Filter by AppLocker group
      if (selectedGroupFilter !== 'all') {
        filtered = filtered.filter((u) => {
          try {
            return isUserInAppLockerGroup(u, selectedGroupFilter);
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
  }, [users, searchQuery, selectedOU, selectedGroupFilter, isUserInAppLockerGroup]);

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
  const handleUserSelect = useCallback(async (user: ADUser) => {
    try {
      if (!user) return;
      setLookupError(null);
      const userId = safeString(user.id) || safeString(user.samAccountName);
      const refreshed = userId ? await ad.getUserById(userId) : null;
      const nextUser = refreshed || user;
      setSelectedUser({
        ...nextUser,
        id: safeString(nextUser.id) || safeString(nextUser.samAccountName) || 'unknown',
        displayName: safeString(nextUser.displayName) || safeString(nextUser.samAccountName) || 'Unknown',
        samAccountName: safeString(nextUser.samAccountName) || 'unknown',
        groups: Array.isArray(nextUser.groups)
          ? nextUser.groups.filter((group): group is string => typeof group === 'string')
          : [],
        department: safeString(nextUser.department),
        ou: safeString(nextUser.ou)
      });
    } catch (err) {
      console.error('Error selecting user:', err);
      setComponentError('Error selecting user');
    }
  }, [ad]);

  // Toggle group membership
  const handleToggleGroup = useCallback(async (group: string, isCurrentlyMember: boolean) => {
    if (!selectedUser) return;

    const userId = selectedUser.id || selectedUser.samAccountName;
    const currentAppLockerGroups = APPLOCKER_GROUPS.filter((appGroup) =>
      isUserInAppLockerGroup(selectedUser, appGroup)
    );
    const groupsToUpdate = new Set([group, ...currentAppLockerGroups]);
    setUpdatingGroups(prev => new Set([...prev, ...groupsToUpdate]));

    try {
      if (isCurrentlyMember) {
        await ad.removeUserFromGroup(userId, group);
      } else {
        for (const existingGroup of currentAppLockerGroups) {
          if (existingGroup !== group) {
            await ad.removeUserFromGroup(userId, existingGroup);
          }
        }
        await ad.addUserToGroup(userId, group);
      }

      // Refresh user data
      await refetchUsers();

      // Update selected user with new data
      const updatedUser = await ad.getUserById(userId);
      if (updatedUser) {
        setLookupError(null);
        await handleUserSelect(updatedUser);
      } else {
        setLookupError('Active Directory did not return updated user details.');
        setComponentError('Failed to refresh user details from Active Directory');
      }
    } catch (error) {
      console.error(`Failed to ${isCurrentlyMember ? 'remove' : 'add'} user ${isCurrentlyMember ? 'from' : 'to'} group ${group}:`, error);
      setComponentError(`Failed to update group membership`);
      setLookupError('Failed to refresh user details from Active Directory.');
    } finally {
      setUpdatingGroups(prev => {
        const newSet = new Set(prev);
        groupsToUpdate.forEach(item => newSet.delete(item));
        return newSet;
      });
    }
  }, [selectedUser, ad, refetchUsers, handleUserSelect, isUserInAppLockerGroup]);

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

  const activeAppLockerGroup = selectedUser
    ? APPLOCKER_GROUPS.find((group) => isUserInAppLockerGroup(selectedUser, group)) || null
    : null;

  return (
    <div className="space-y-3 animate-in slide-in-from-left-4 duration-500 pb-8">
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight italic uppercase">AD Manager</h2>
          <p className="text-slate-500 text-xs font-medium">Select users and manage their AppLocker group memberships.</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={async () => {
              try {
                const electron = (window as any).electron;
                if (electron?.ipc) {
                  const result = await electron.ipc.invoke('ad:createAppLockerGroups', {});
                  if (result.success) {
                    alert(`AppLocker security groups created successfully!\n\nGroups: ${APPLOCKER_GROUPS.join(', ')}`);
                  } else {
                    alert(`Failed to create groups: ${result.error || 'Unknown error'}`);
                  }
                }
              } catch (error) {
                console.error('Failed to create AppLocker groups:', error);
                setComponentError('Failed to create AppLocker groups');
              }
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-green-700 shadow-lg shadow-green-900/20 transition-all flex items-center space-x-2 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            aria-label="Import AppLocker security groups in AD"
          >
            <UserPlus size={14} aria-hidden="true" />
            <span>Import AppLocker Groups</span>
          </button>
          <button
            onClick={handleScanAD}
            disabled={isScanning}
            className="bg-[#002868] text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#001f4d] shadow-lg shadow-blue-900/20 transition-all flex items-center space-x-2 disabled:opacity-50 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={isScanning ? "Syncing Active Directory domain" : "Refresh Active Directory inventory"}
          >
            {isScanning ? <Activity className="animate-spin" size={14} aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
            <span>{isScanning ? 'Syncing...' : 'Refresh AD'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* User Search List */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[420px] overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Directory Users</h3>
              <span className="text-[8px] font-bold text-slate-400">{filteredUsers.length} of {users.length}</span>
            </div>

            {/* Filters Row */}
            <div className="flex gap-2">
              {/* OU Filter */}
              <div className="flex-1">
                <select
                  value={selectedOU}
                  onChange={(e) => setSelectedOU(e.target.value)}
                  className="w-full py-1.5 px-2 min-h-[32px] bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={ousLoading}
                >
                  <option value="all">All OUs</option>
                  {availableOUs.map((ou, idx) => (
                    <option key={idx} value={ou.path}>{ou.name} ({ou.userCount})</option>
                  ))}
                </select>
              </div>

              {/* AppLocker Group Filter */}
              <div className="flex-1">
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="w-full py-1.5 px-2 min-h-[32px] bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Groups</option>
                  {APPLOCKER_GROUPS.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search */}
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
              filteredUsers.map((user) => {
                const userAppLockerGroups = APPLOCKER_GROUPS.filter(g => isUserInAppLockerGroup(user, g));
                const userAccountName = safeString(user.samAccountName) || 'unknown';
                const userDisplayName = safeString(user.displayName) || userAccountName;
                return (
                  <div
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className={`w-full group cursor-pointer text-left p-2 rounded-lg border transition-all ${
                      selectedUser?.id === user.id
                        ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0 ${
                        selectedUser?.id === user.id ? 'bg-[#002868] text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <User size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-slate-900 group-hover:text-blue-700 transition-colors truncate">{userAccountName}</p>
                        <p className="text-[9px] text-slate-500 font-medium truncate">{userDisplayName}</p>
                        {user.ou && (
                          <p className="text-[8px] text-slate-400 font-medium truncate">{user.ou.match(/OU=([^,]+)/)?.[1] || user.ou}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        {userAppLockerGroups.length > 0 ? (
                          <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                            {userAppLockerGroups.length} group{userAppLockerGroups.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                            No groups
                          </span>
                        )}
                        <ChevronRight size={10} className={`mt-1 ${selectedUser?.id === user.id ? 'text-blue-600' : 'text-slate-300'}`} />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 py-4">
                <User size={32} className="opacity-20" />
                <p className="text-[10px] font-bold">No users found</p>
                <p className="text-[9px] text-slate-400">Click "Refresh AD" to load users</p>
                {(searchQuery || selectedOU !== 'all' || selectedGroupFilter !== 'all') && (
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedOU('all'); setSelectedGroupFilter('all'); }}
                    className="mt-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Details & Group Management */}
        <div className="lg:col-span-7 space-y-3">
          {/* Selected User Header */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-lg relative overflow-hidden text-white">
            <div className="relative z-10">
              {selectedUser ? (
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-[#002868] rounded-xl flex items-center justify-center shadow-lg ring-2 ring-white/10">
                    <User size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-black tracking-tight">{selectedUser.displayName || selectedUser.samAccountName || 'Unknown User'}</h3>
                      <span className="px-1.5 py-0.5 bg-green-500 text-white text-[7px] font-black uppercase rounded tracking-widest">Selected</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-400 font-bold text-[9px] uppercase tracking-widest mt-1">
                      {selectedUserDetailItems.map((item, index) => (
                        <React.Fragment key={item.key}>
                          {item.content}
                          {index < selectedUserDetailItems.length - 1 && (
                            <span className="w-1 h-1 bg-slate-700 rounded-full" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    {lookupError && (
                      <div className="mt-2 inline-flex items-center space-x-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-200">
                        <AlertCircle size={12} />
                        <span>{lookupError}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3 text-slate-500 py-2">
                  <Users size={20} />
                  <p className="font-black uppercase tracking-widest text-[10px] italic">Select a user from the list to manage their groups</p>
                </div>
              )}
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-[0.03]">
              <Lock size={100} />
            </div>
          </div>

          {/* Group Management */}
          {selectedUser ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* AppLocker Group Assignment */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-black text-slate-900 text-[9px] uppercase tracking-[0.15em] flex items-center space-x-2">
                    <ShieldCheck size={14} className="text-blue-600" />
                    <span>AppLocker Groups</span>
                  </h4>
                  <span className="text-[8px] font-bold text-slate-400">Select one</span>
                </div>

                <div className="space-y-2">
                  {APPLOCKER_GROUPS.map((group) => {
                    const isMember = isUserInAppLockerGroup(selectedUser, group);
                    const isUpdating = updatingGroups.has(group);
                    const isOtherActive = Boolean(activeAppLockerGroup && activeAppLockerGroup !== group);

                    return (
                      <button
                        key={group}
                        onClick={() => handleToggleGroup(group, isMember)}
                        disabled={isUpdating}
                        className={`w-full p-3 rounded-lg border-2 transition-all flex items-center justify-between group ${
                          isMember
                            ? 'bg-green-50 border-green-300 hover:border-green-400'
                            : 'bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                        } ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'} ${isOtherActive ? 'opacity-70' : ''}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            isMember
                              ? 'bg-green-500 text-white'
                              : 'bg-white border-2 border-slate-300 group-hover:border-blue-400'
                          }`}>
                            {isUpdating ? (
                              <Activity size={12} className="animate-spin" />
                            ) : isMember ? (
                              <Check size={12} />
                            ) : null}
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-tight ${
                            isMember ? 'text-green-700' : 'text-slate-600 group-hover:text-blue-600'
                          }`}>
                            {group}
                          </span>
                        </div>
                        <span className={`text-[8px] font-bold uppercase tracking-widest ${
                          isMember ? 'text-green-600' : 'text-slate-400'
                        }`}>
                          {isUpdating ? 'Updating...' : isMember ? 'Selected' : 'Not Selected'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Group Memberships */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                <h4 className="font-black text-slate-900 text-[9px] uppercase tracking-[0.15em] mb-3 flex items-center space-x-2">
                  <CheckCircle2 size={14} className="text-green-600" />
                  <span>All Group Memberships</span>
                </h4>

                <div className="space-y-1 flex-1 overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
                  {selectedUser.groups && selectedUser.groups.length > 0 ? (
                    selectedUser.groups.map((group, i) => {
                      const isAppLockerGroup = APPLOCKER_GROUPS.some(ag => group.toLowerCase().includes(ag.toLowerCase()));
                      return (
                        <div
                          key={i}
                          className={`flex items-center justify-between p-2 rounded-lg border ${
                            isAppLockerGroup
                              ? 'bg-blue-50 border-blue-200'
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <span className={`text-[9px] font-bold truncate max-w-[180px] ${
                            isAppLockerGroup ? 'text-blue-700' : 'text-slate-600'
                          }`}>{group}</span>
                          {isAppLockerGroup && (
                            <span className="text-[7px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase">AppLocker</span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-slate-400">
                      <Users size={24} className="mx-auto opacity-20 mb-2" />
                      <p className="text-[9px] font-medium">No group memberships found</p>
                    </div>
                  )}
                </div>

                {/* Export Profile Button */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={async () => {
                      if (!selectedUser) return;
                      try {
                        const filePath = await showSaveDialog({
                          title: 'Export User Profile',
                          defaultPath: `C:\\AppLocker\\user-profile-${selectedUser.samAccountName}-${new Date().toISOString().split('T')[0]}.json`,
                          filters: [
                            { name: 'JSON Files', extensions: ['json'] },
                            { name: 'All Files', extensions: ['*'] }
                          ]
                        });
                        if (filePath) {
                          const profile = {
                            user: selectedUser,
                            exportedAt: new Date().toISOString(),
                            groups: selectedUser.groups || [],
                            appLockerGroups: APPLOCKER_GROUPS.filter(g => isUserInAppLockerGroup(selectedUser, g))
                          };
                          const electron = (window as any).electron;
                          if (electron?.ipc) {
                            await electron.ipc.invoke('fs:writeFile', filePath, JSON.stringify(profile, null, 2));
                            alert(`User profile exported successfully to:\n${filePath}`);
                          }
                        }
                      } catch (error) {
                        console.error('Failed to export user profile:', error);
                        setComponentError('Failed to export user profile');
                      }
                    }}
                    className="w-full py-2 bg-slate-900 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center space-x-2 min-h-[32px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <FileText size={12} />
                    <span>Export Profile</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
              <div className="flex flex-col items-center justify-center text-slate-300 space-y-4">
                <div className="p-4 bg-slate-50 rounded-full border-2 border-dashed border-slate-200">
                  <Users size={32} className="opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">No User Selected</p>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-md">
                    Select a user from the list to view their current groups and manage their AppLocker group memberships using checkboxes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ADManagementModule;
