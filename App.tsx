
import React, { useState } from 'react';
import { AppView } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ScanModule from './components/ScanModule';
import PolicyModule from './components/PolicyModule';
import EventsModule from './components/EventsModule';
import ADManagementModule from './components/ADManagementModule';
import ComplianceModule from './components/ComplianceModule';
import AIAssistant from './components/AIAssistant';
import { Bell, Search, Settings, HelpCircle, User, X, Shield, Globe, Terminal, FileText } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [showAbout, setShowAbout] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD: return <Dashboard />;
      case AppView.SCAN: return <ScanModule />;
      case AppView.POLICY: return <PolicyModule />;
      case AppView.EVENTS: return <EventsModule />;
      case AppView.AD_MANAGEMENT: return <ADManagementModule />;
      case AppView.COMPLIANCE: return <ComplianceModule />;
      case AppView.AI_CONSULTANT: return <AIAssistant />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar currentView={currentView} setView={setCurrentView} />
      
      <main className="flex-1 ml-64 p-8">
        <header className="flex items-center justify-between mb-8 sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md py-2 border-b border-transparent">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {currentView.toLowerCase().replace('_', ' ')}
            </h2>
            <div className="h-6 w-px bg-slate-200" />
            <div className="hidden md:flex items-center space-x-1 text-slate-500 text-[11px] font-black uppercase tracking-widest">
              <span>GA-ASI</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900">{currentView}</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button className="p-2 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200">
              <Search size={20} />
            </button>
            <button className="p-2 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200 relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-50" />
            </button>
            <button 
              onClick={() => setShowAbout(true)}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200"
              title="Help & About"
            >
              <HelpCircle size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <div className="flex items-center space-x-3 cursor-pointer group">
              <div className="text-right">
                <p className="text-xs font-black text-slate-900 leading-none">Tony Tran</p>
                <p className="text-[10px] font-bold text-slate-400 leading-none mt-1 uppercase tracking-widest">ISSO, GA-ASI</p>
              </div>
              <div className="w-9 h-9 bg-[#002868] rounded-full flex items-center justify-center text-white ring-2 ring-transparent group-hover:ring-blue-500 transition-all shadow-lg">
                <User size={18} />
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto">
          {renderView()}
        </div>
      </main>

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="relative h-48 bg-[#002868] flex flex-col items-center justify-center text-white p-8">
              <button 
                onClick={() => setShowAbout(false)}
                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
              >
                <X size={24} />
              </button>
              
              <div className="w-16 h-16 bg-white flex items-center justify-center rounded-sm mb-4 shadow-2xl">
                {/* GA Star Logo */}
                <div className="relative w-10 h-10">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#002868] rotate-45 transform origin-center" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#002868] rotate-45 transform origin-center" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#002868] rotate-45 transform origin-center" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#002868] rotate-45 transform origin-center" />
                </div>
              </div>
              <h3 className="text-2xl font-black tracking-tighter uppercase italic">GENERAL ATOMICS</h3>
              <p className="text-xs font-black text-blue-300 uppercase tracking-[0.4em] mt-1">AERONAUTICAL</p>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-8 scroll-smooth custom-scrollbar">
              <div className="text-center space-y-3">
                <h4 className="text-3xl font-black text-slate-900 tracking-tight">GA-AppLocker v1.2.4</h4>
                <div className="flex items-center justify-center space-x-2 text-slate-400 text-xs font-black uppercase tracking-widest">
                  <span>Created By</span>
                  <span className="text-blue-600">Tony Tran, ISSO</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col items-center text-center space-y-2">
                  <Terminal size={24} className="text-blue-600" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Toolkit Logic</p>
                  <p className="text-xs font-bold text-slate-700">PowerShell 5.1/7.x & WinRM Core</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col items-center text-center space-y-2">
                  <Globe size={24} className="text-blue-600" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">AD Integration</p>
                  <p className="text-xs font-bold text-slate-700">GPO Deployment Engine</p>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <FileText size={14} />
                  <span>Deployment Workflow</span>
                </h5>
                <div className="space-y-3">
                  <AboutPoint title="Phase 1-4 Methodology" text="Structured roll-out from EXE auditing to full DLL enforcement (Phase 4)." />
                  <AboutPoint title="Audit Integrity" text="Mandatory 14-day audit log collection via event 8003/8004 before policy commit." />
                  <AboutPoint title="CORA Readiness" text="Automated evidence package generation for NIST/HIPAA compliance reviews." />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 text-center">
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest italic">
                  Internal GA-ASI Administrative Asset<br />
                  Sensitive Policy Management Interface
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Hotkeys Info */}
      <div className="fixed bottom-4 right-8 bg-slate-900/90 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm shadow-2xl z-50 pointer-events-none opacity-50 flex items-center space-x-2">
        <span>Press</span>
        <span className="bg-slate-700 px-1.5 py-0.5 rounded">F1</span>
        <span>for help</span>
        <span className="text-slate-600">|</span>
        <span className="bg-slate-700 px-1.5 py-0.5 rounded">Ctrl+1-7</span>
        <span>Switch Tabs</span>
      </div>
    </div>
  );
};

const AboutPoint: React.FC<{title: string, text: string}> = ({title, text}) => (
  <div className="flex items-start space-x-3">
    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0" />
    <div>
      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{title}</p>
      <p className="text-xs text-slate-500 font-medium leading-relaxed">{text}</p>
    </div>
  </div>
);

export default App;
