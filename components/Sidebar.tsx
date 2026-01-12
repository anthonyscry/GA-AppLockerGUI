
import React from 'react';
import { AppView } from '../types';
import { NAVIGATION } from '../constants';
import { ChevronRight } from 'lucide-react';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  return (
    <div className="w-64 bg-[#001f4d] h-screen flex flex-col fixed left-0 top-0 text-slate-300">
      <div className="p-6 flex items-center space-x-3 border-b border-slate-800/50">
        <div className="w-10 h-10 bg-white flex items-center justify-center rounded-sm shrink-0 shadow-lg">
          {/* GA Four-Diamond Star Logo Mimic */}
          <div className="relative w-6 h-6">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#001f4d] rotate-45 transform origin-center" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#001f4d] rotate-45 transform origin-center" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#001f4d] rotate-45 transform origin-center" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#001f4d] rotate-45 transform origin-center" />
          </div>
        </div>
        <div>
          <h1 className="font-black text-white tracking-tighter leading-none text-lg">GA-ASI</h1>
          <p className="text-[9px] uppercase font-black text-blue-400 tracking-[0.2em] mt-1">AppLocker Toolkit</p>
        </div>
      </div>
      
      <nav className="flex-1 mt-6 px-3 space-y-1">
        {NAVIGATION.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as AppView)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${
              currentView === item.id 
                ? 'bg-white/10 text-white border border-white/10 shadow-xl' 
                : 'hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className={currentView === item.id ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'}>
                {item.icon}
              </span>
              <span className="text-sm font-bold tracking-tight">{item.label}</span>
            </div>
            {currentView === item.id && <ChevronRight size={14} className="text-blue-400" />}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800/50 bg-[#001a40]">
        <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-900/30">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Environment</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            v1.2.4 (Branch: main)<br />
            AD Principal: CONTOSO\ttran
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
