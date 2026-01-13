import React, { useState, useEffect, useRef } from 'react';
import { AppView } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ScanModule from './components/ScanModule';
import PolicyModule from './components/PolicyModule';
import EventsModule from './components/EventsModule';
import ADManagementModule from './components/ADManagementModule';
import ComplianceModule from './components/ComplianceModule';
import { Bell, Search, HelpCircle, User, X, Globe, Terminal, FileText } from 'lucide-react';
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

          <div className="flex items-center space-x-4">
            <button 
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200"
              aria-label="Search"
            >
              <Search size={20} aria-hidden="true" />
            </button>
            <button 
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200 relative"
              aria-label="Notifications"
            >
              <Bell size={20} aria-hidden="true" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-50" aria-label="Unread notifications" />
            </button>
            <button 
              onClick={() => setShowAbout(true)}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200"
              aria-label="Open help and about dialog"
              title="Help & About"
            >
              <HelpCircle size={20} aria-hidden="true" />
            </button>
          </div>
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
                <h4 className="text-3xl font-black text-slate-900 tracking-tight">GA-AppLocker v1.2.4</h4>
                <div className="flex items-center justify-center space-x-2 text-slate-400 text-xs font-black uppercase tracking-widest">
                  <span>Created By</span>
                  <span className="text-blue-600">GA-ASI ISSO Team</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col items-center text-center space-y-2">
                  <Terminal size={24} className="text-blue-600" aria-hidden="true" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Toolkit Logic</p>
                  <p className="text-xs font-bold text-slate-700">PowerShell 5.1/7.x & WinRM Core</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col items-center text-center space-y-2">
                  <Globe size={24} className="text-blue-600" aria-hidden="true" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">AD Integration</p>
                  <p className="text-xs font-bold text-slate-700">GPO Deployment Engine</p>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <FileText size={14} aria-hidden="true" />
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
      <div className="fixed bottom-4 right-8 bg-slate-900/90 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm shadow-2xl z-50 pointer-events-none opacity-50 flex items-center space-x-2" aria-hidden="true">
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
    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0" aria-hidden="true" />
    <div>
      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{title}</p>
      <p className="text-xs text-slate-500 font-medium leading-relaxed">{text}</p>
    </div>
  </div>
);

export default App;
