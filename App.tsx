import React, { useState, useEffect, useRef } from 'react';
import { AppView } from './src/shared/types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ScanModule from './components/ScanModule';
import PolicyModule from './components/PolicyModule';
import EventsModule from './components/EventsModule';
import ADManagementModule from './components/ADManagementModule';
import ComplianceModule from './components/ComplianceModule';
import SoftwareComparisonModule from './components/InventoryCompareModule';
import { HelpCircle, User, X, Globe, Terminal, FileText } from 'lucide-react';
import { NAVIGATION } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [showAbout, setShowAbout] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // F1 for help/about
      if (event.key === 'F1') {
        event.preventDefault();
        setShowAbout(true);
        if (process.env.NODE_ENV === 'development') {
          console.log('[GUI Test] F1 pressed - About modal opened');
        }
      }
      
      // Ctrl+1-7 for navigation
      if (event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
        const keyNum = parseInt(event.key, 10); // Fix: Added radix parameter
        if (keyNum >= 1 && keyNum <= 7) {
          event.preventDefault();
          const viewIndex = keyNum - 1;
          if (viewIndex < NAVIGATION.length) {
            const newView = NAVIGATION[viewIndex].id;
            // Fix: Validate that newView is a valid AppView
            if (Object.values(AppView).includes(newView as AppView)) {
              setCurrentView(newView as AppView);
              if (process.env.NODE_ENV === 'development') {
                console.log(`[GUI Test] Ctrl+${keyNum} pressed - Navigated to ${newView}`);
              }
            }
          }
        }
      }

      // ESC to close about modal
      if (event.key === 'Escape' && showAbout) {
        setShowAbout(false);
        if (process.env.NODE_ENV === 'development') {
          console.log('[GUI Test] ESC pressed - About modal closed');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAbout]);

  // Log view changes for testing (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GUI Test] View changed to: ${currentView}`);
    }
  }, [currentView]);

  // Log about modal state changes (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GUI Test] About modal: ${showAbout ? 'opened' : 'closed'}`);
    }
  }, [showAbout]);

  // Focus trap for modal (accessibility)
  useEffect(() => {
    if (showAbout && modalRef.current) {
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Focus first focusable element in modal
      const firstFocusable = modalRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      if (firstFocusable) {
        firstFocusable.focus();
      }

      // Handle tab trapping
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab' || !modalRef.current) return;

        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      };

      document.addEventListener('keydown', handleTabKey);
      return () => {
        document.removeEventListener('keydown', handleTabKey);
        // Restore previous focus
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [showAbout]);

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD: return <Dashboard />;
      case AppView.SCAN: return <ScanModule />;
      case AppView.POLICY: return <PolicyModule />;
      case AppView.EVENTS: return <EventsModule />;
      case AppView.AD_MANAGEMENT: return <ADManagementModule />;
      case AppView.COMPLIANCE: return <ComplianceModule />;
      case AppView.SOFTWARE_COMPARE: return <SoftwareComparisonModule />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Skip to main content link for keyboard users */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>
      
      <Sidebar currentView={currentView} setView={setCurrentView} />
      
      <main id="main-content" className="flex-1 ml-64 p-8">
        <header className="flex items-center justify-between mb-8 sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md py-2 border-b border-transparent">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {/* Fix: Use global flag to replace all underscores */}
              {currentView.toLowerCase().replace(/_/g, ' ')}
            </h2>
            <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
            <div className="hidden md:flex items-center space-x-1 text-slate-500 text-[11px] font-black uppercase tracking-widest">
              <span>GA-ASI</span>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="text-slate-900">{currentView}</span>
            </div>
          </div>

          <button
            onClick={() => setShowAbout(true)}
            className="p-3 min-w-[44px] min-h-[44px] text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Open help and about dialog"
            title="Help & About (F1)"
          >
            <HelpCircle size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="max-w-7xl mx-auto">
          {renderView()}
        </div>
      </main>

      {/* About Modal */}
      {showAbout && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-title"
          aria-describedby="about-description"
          onClick={(e) => {
            // Close modal when clicking backdrop
            if (e.target === e.currentTarget) {
              setShowAbout(false);
            }
          }}
        >
          <div 
            ref={modalRef}
            className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-48 bg-[#002868] flex flex-col items-center justify-center text-white p-8">
              <button 
                onClick={() => setShowAbout(false)}
                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                aria-label="Close about dialog"
              >
                <X size={24} aria-hidden="true" />
              </button>
              
              <img src="/assets/ga-logo.svg" alt="GA Logo" className="w-16 h-16 mb-4" />
              <h3 id="about-title" className="text-2xl font-black tracking-tighter uppercase italic">GENERAL ATOMICS</h3>
              <p className="text-xs font-black text-blue-300 uppercase tracking-[0.4em] mt-1">AERONAUTICAL</p>
            </div>

            <div id="about-description" className="flex-1 overflow-y-auto p-10 space-y-8 scroll-smooth custom-scrollbar">
              <div className="text-center space-y-3">
                <h4 className="text-3xl font-black text-slate-900 tracking-tight">GA-AppLocker v1.2.10</h4>
                <div className="flex items-center justify-center space-x-2 text-slate-400 text-xs font-black uppercase tracking-widest">
                  <span>Created By</span>
                  <span className="text-blue-600">Tony Tran, ISSO</span>
                </div>
              </div>

              {/* Keyboard Shortcuts */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <Terminal size={14} aria-hidden="true" />
                  <span>Keyboard Shortcuts</span>
                </h5>
                <div className="grid grid-cols-2 gap-2">
                  <HelpShortcut keys={['F1']} action="Open Help" />
                  <HelpShortcut keys={['Ctrl', '1-7']} action="Switch Tabs" />
                  <HelpShortcut keys={['Esc']} action="Close Dialog" />
                </div>
              </div>

              {/* Quick Start Guide */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <FileText size={14} aria-hidden="true" />
                  <span>Quick Start Guide</span>
                </h5>
                <div className="space-y-3">
                  <AboutPoint title="1. Remote Scan" text="Scan target machines to collect software inventory. Use Local Scan for this machine or select machines for remote scanning." />
                  <AboutPoint title="2. Policy Lab" text="Generate AppLocker rules from scan results. Use the Rule Generator tab or import artifacts (CSV/JSON)." />
                  <AboutPoint title="3. Event Monitor" text="Monitor 8003 (audit) and 8004 (blocked) events. Filter by type and export for analysis." />
                  <AboutPoint title="4. AD Manager" text="Drag users to security groups for AppLocker policy assignment. View group membership." />
                  <AboutPoint title="5. Compliance" text="Generate evidence packages for NIST 800-53 compliance reviews." />
                </div>
              </div>

              {/* AppLocker Deployment Phases */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <Activity size={14} aria-hidden="true" />
                  <span>Deployment Phases</span>
                </h5>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="font-black text-blue-700">Phase 1:</span>
                    <span className="text-blue-600 ml-2">EXE rules only (Audit Mode) - Start here for initial testing</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="font-black text-blue-700">Phase 2:</span>
                    <span className="text-blue-600 ml-2">EXE + Script rules (Audit Mode) - Add PS1, BAT, CMD, VBS</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="font-black text-blue-700">Phase 3:</span>
                    <span className="text-blue-600 ml-2">EXE + Script + MSI/MSP rules (Audit Mode) - Add installers</span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="font-black text-amber-700">Phase 4:</span>
                    <span className="text-amber-600 ml-2">All + DLL rules (Enforce Mode) - Full enforcement (caution!)</span>
                  </div>
                </div>
              </div>

              {/* Event IDs Reference */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <Monitor size={14} aria-hidden="true" />
                  <span>Event IDs Reference</span>
                </h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-green-50 rounded-lg"><span className="font-black text-green-700">8002:</span> Allowed execution</div>
                  <div className="p-2 bg-amber-50 rounded-lg"><span className="font-black text-amber-700">8003:</span> Would be blocked (Audit)</div>
                  <div className="p-2 bg-red-50 rounded-lg"><span className="font-black text-red-700">8004:</span> Blocked execution</div>
                  <div className="p-2 bg-slate-50 rounded-lg"><span className="font-black text-slate-700">8005:</span> DLL allowed</div>
                  <div className="p-2 bg-slate-50 rounded-lg"><span className="font-black text-slate-700">8006:</span> DLL would be blocked</div>
                  <div className="p-2 bg-slate-50 rounded-lg"><span className="font-black text-slate-700">8007:</span> DLL blocked</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col items-center text-center space-y-2">
                  <Terminal size={24} className="text-blue-600" aria-hidden="true" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Toolkit Logic</p>
                  <p className="text-xs font-bold text-slate-700">PowerShell 5.1/7.x & WinRM</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col items-center text-center space-y-2">
                  <Globe size={24} className="text-blue-600" aria-hidden="true" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">AD Integration</p>
                  <p className="text-xs font-bold text-slate-700">GPO Deployment Engine</p>
                </div>
              </div>

              {/* Troubleshooting */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>Troubleshooting</span>
                </h5>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="font-bold">WinRM Connection Failed:</span>
                    <span className="text-slate-600 ml-2">Run Enable-PSRemoting -Force on target, check firewall port 5985/5986</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="font-bold">Access Denied:</span>
                    <span className="text-slate-600 ml-2">Ensure Domain Admin rights or WinRM permissions delegated</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="font-bold">AppIdentity Service:</span>
                    <span className="text-slate-600 ml-2">Service must be running for AppLocker enforcement</span>
                  </div>
                </div>
              </div>

              {/* Security Groups Reference */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <User size={14} aria-hidden="true" />
                  <span>Security Groups Reference</span>
                </h5>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="font-bold">AppLocker-WS-Audit/Enforce</span>
                    <span className="text-slate-500">Workstations</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="font-bold">AppLocker-SRV-Audit/Enforce</span>
                    <span className="text-slate-500">Servers</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="font-bold">AppLocker-Admins</span>
                    <span className="text-slate-500">IT Administrators</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="font-bold">AppLocker-Installers</span>
                    <span className="text-slate-500">Software Installers</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="font-bold">AppLocker-StandardUsers</span>
                    <span className="text-slate-500">Regular Users</span>
                  </div>
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

    </div>
  );
};

const AboutPoint: React.FC<{title: string, text: string}> = ({title, text}) => (
  <div className="flex items-start space-x-3">
    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0" aria-hidden="true" />
    <div>
      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{title}</p>
      <p className="text-xs text-slate-500 font-medium leading-relaxed">{text}</p>
    </div>
  </div>
);

const HelpShortcut: React.FC<{keys: string[], action: string}> = ({keys, action}) => (
  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
    <div className="flex items-center space-x-1">
      {keys.map((key, i) => (
        <React.Fragment key={key}>
          {i > 0 && <span className="text-slate-400">+</span>}
          <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 shadow-sm">{key}</kbd>
        </React.Fragment>
      ))}
    </div>
    <span className="text-xs text-slate-600 font-medium">{action}</span>
  </div>
);

export default App;
