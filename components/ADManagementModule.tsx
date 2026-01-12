
import React, { useState, useMemo } from 'react';
import { ADUser } from '../types';
import { MOCK_AD_USERS, APPLOCKER_GROUPS } from '../constants';
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
  // Added missing Terminal and FileText imports
  Terminal,
  FileText
} from 'lucide-react';

const ADManagementModule: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ADUser | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [draggedUser, setDraggedUser] = useState<ADUser | null>(null);
  const [activeDropGroup, setActiveDropGroup] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    return MOCK_AD_USERS.filter(u => 
      u.samAccountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleScanAD = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 1500);
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, user: ADUser) => {
    setDraggedUser(user);
    e.dataTransfer.setData('userId', user.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a ghost image if needed, but standard is fine
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDraggedUser(null);
    setActiveDropGroup(null);
  };

  const handleDragOver = (e: React.DragEvent, group: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropGroup !== group) {
      setActiveDropGroup(group);
    }
  };

  const handleDragLeave = () => {
    setActiveDropGroup(null);
  };

  const handleDrop = (e: React.DragEvent, group: string) => {
    e.preventDefault();
    const userId = e.dataTransfer.getData('userId');
    const user = MOCK_AD_USERS.find(u => u.id === userId);
    
    if (user) {
      alert(`SUCCESS: Provisioning ${user.displayName} (${user.samAccountName}) into ${group}.\n\nGPUpdate will trigger on next login.`);
    }
    
    setActiveDropGroup(null);
    setDraggedUser(null);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 duration-500 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">AD Manager</h2>
          <p className="text-slate-500 text-sm font-medium">Drag users into security groups to update AppLocker permissions.</p>
        </div>
        <button 
          onClick={handleScanAD}
          disabled={isScanning}
          className="bg-[#002868] text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#001f4d] shadow-lg shadow-blue-900/20 transition-all flex items-center space-x-2 disabled:opacity-50"
        >
          {isScanning ? <Activity className="animate-spin" size={18} /> : <Search size={18} />}
          <span>{isScanning ? 'Syncing Domain...' : 'Refresh AD Inventory'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Search List (Drag Source) */}
        <div className="lg:col-span-4 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[700px] overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personnel Directory</h3>
              <div className="flex items-center space-x-1 text-[10px] font-bold text-blue-600">
                <MousePointer2 size={12} />
                <span>Drag to Assign</span>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search SamAccountName..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filteredUsers.map((user) => (
              <div 
                key={user.id}
                draggable
                onDragStart={(e) => handleDragStart(e, user)}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedUser(user)}
                className={`w-full group cursor-grab active:cursor-grabbing text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  selectedUser?.id === user.id 
                    ? 'bg-blue-50 border-blue-200 shadow-sm' 
                    : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-slate-300 group-hover:text-blue-400 transition-colors">
                    <GripVertical size={18} />
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
                    selectedUser?.id === user.id ? 'bg-[#002868] text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <User size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 group-hover:text-blue-700 transition-colors">{user.samAccountName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{user.department}</p>
                  </div>
                </div>
                <ChevronRight size={14} className={selectedUser?.id === user.id ? 'text-blue-600' : 'text-slate-200'} />
              </div>
            ))}
          </div>
        </div>

        {/* Action Center & Groups (Drop Targets) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Profile Header */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl relative overflow-hidden text-white min-h-[160px] flex items-center">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between w-full gap-6">
              {selectedUser ? (
                <div className="flex items-center space-x-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-[#002868] rounded-3xl flex items-center justify-center shadow-2xl ring-4 ring-white/10">
                    <User size={48} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-3xl font-black tracking-tighter">{selectedUser.displayName}</h3>
                      <span className="px-2 py-0.5 bg-green-500 text-white text-[9px] font-black uppercase rounded tracking-widest">Active</span>
                    </div>
                    <div className="flex items-center space-x-4 text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">
                      <span className="flex items-center space-x-1"><Terminal size={12} /> <span>{selectedUser.samAccountName}</span></span>
                      <span className="w-1 h-1 bg-slate-700 rounded-full" />
                      <span>{selectedUser.department}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-4 text-slate-500">
                  <ArrowRightLeft size={32} />
                  <p className="font-black uppercase tracking-widest text-sm italic">System Ready: Awaiting Drag/Select Event</p>
                </div>
              )}
            </div>
            <div className="absolute -right-16 -bottom-16 opacity-[0.05]">
              <Lock size={280} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Target Drop Zone: AppLocker Groups */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col h-full relative">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-black text-slate-900 text-[10px] uppercase tracking-[0.2em] flex items-center space-x-2">
                  <ShieldCheck size={16} className="text-blue-600" />
                  <span>Target Security Groups</span>
                </h4>
              </div>
              
              <div className="space-y-3 flex-1">
                {APPLOCKER_GROUPS.map((group) => (
                  <div 
                    key={group}
                    onDragOver={(e) => handleDragOver(e, group)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, group)}
                    className={`relative p-5 rounded-3xl border-2 transition-all duration-300 group flex items-center justify-between ${
                      activeDropGroup === group 
                        ? 'bg-blue-600 border-blue-400 scale-[1.02] shadow-xl shadow-blue-500/30' 
                        : draggedUser 
                          ? 'bg-slate-50 border-dashed border-blue-200 border-2'
                          : 'bg-slate-50 border-slate-50 hover:border-blue-100 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-xl transition-colors ${
                        activeDropGroup === group ? 'bg-white text-blue-600' : 'bg-white text-slate-400 border border-slate-100'
                      }`}>
                        <PlusCircle size={18} />
                      </div>
                      <span className={`text-xs font-black uppercase tracking-tight transition-colors ${
                        activeDropGroup === group ? 'text-white' : 'text-slate-700'
                      }`}>
                        {group}
                      </span>
                    </div>
                    {activeDropGroup === group && (
                      <div className="flex items-center space-x-2 text-white animate-in slide-in-from-right-2">
                        <span className="text-[9px] font-black tracking-widest uppercase">Drop Now</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {draggedUser && !activeDropGroup && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center space-x-3 text-blue-600 animate-pulse">
                  <UserPlus size={18} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Dragging: {draggedUser.samAccountName}</p>
                </div>
              )}
            </div>

            {/* Selected User Details / Membership View */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col h-full">
              {selectedUser ? (
                <>
                  <h4 className="font-black text-slate-900 text-[10px] uppercase tracking-[0.2em] mb-6 flex items-center space-x-2">
                    <CheckCircle2 size={16} className="text-green-600" />
                    <span>Existing Access Token</span>
                  </h4>
                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[360px] pr-2 custom-scrollbar">
                    {selectedUser.groups.map((group, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-slate-200 transition-colors">
                        <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{group}</span>
                        <span className="text-[9px] font-black bg-white border border-slate-100 px-3 py-1 rounded-full text-slate-400 uppercase tracking-widest">Active</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <button className="w-full py-4 bg-slate-900 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center space-x-2 group">
                      <FileText size={16} />
                      <span>Export Audit Profile</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 space-y-6">
                  <div className="p-8 bg-slate-50 rounded-full border-2 border-dashed border-slate-200">
                    <Users size={64} className="opacity-20" />
                  </div>
                  <div className="text-center px-8">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-2">No Active Selection</p>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      Select a user from the directory to view memberships or drag any user record to provision new rights.
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
