import React from 'react';
import { AppView } from '../src/shared/types';
import { NAVIGATION } from '../constants';
import { ChevronRight } from 'lucide-react';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const [domainInfo, setDomainInfo] = React.useState({
    principal: 'Loading...',
    domain: 'Detecting...',
    isDC: false,
    hostname: '',
    workgroup: '',
    isDomainJoined: false,
  });

  React.useEffect(() => {
    let isMounted = true;

    const safeSetDomainInfo = (nextInfo: typeof domainInfo) => {
      if (isMounted) {
        setDomainInfo(nextInfo);
      }
    };

    // Get domain info from DC (auto-detect)
    const fetchDomainInfo = async () => {
      try {
        const electron = (window as any).electron;
        if (electron?.ipc) {
          // Try to get detailed domain info from PowerShell
          const info = await electron.ipc.invoke('system:getDomainInfo');
          if (info) {
            const isDomainJoined = !!(info.DomainName || info.DomainNetBIOS) &&
              (info.DomainName || info.DomainNetBIOS) !== 'WORKGROUP';
            safeSetDomainInfo({
              principal: `${info.UserDomain || info.DomainNetBIOS || 'LOCAL'}\\${info.UserName}`,
              domain: info.DomainName || info.DomainNetBIOS || '',
              isDC: info.IsDomainController || false,
              hostname: info.ComputerName || '',
              workgroup: info.Workgroup || 'WORKGROUP',
              isDomainJoined,
            });
            return;
          }
          
          // Fallback to basic user info
          const user = await electron.ipc.invoke('system:getUserInfo');
          if (user) {
            const isDomainJoined = user.domain && user.domain !== 'WORKGROUP';
            safeSetDomainInfo({
              principal: user.principal || 'Unknown',
              domain: user.domain || '',
              isDC: false,
              hostname: user.hostname || '',
              workgroup: user.workgroup || 'WORKGROUP',
              isDomainJoined: !!isDomainJoined,
            });
            return;
          }
        }
        
        // Fallback: Try environment variables
        const domain = process.env.USERDOMAIN || '';
        const username = process.env.USERNAME || 'user';
        const hostname = process.env.COMPUTERNAME || '';
        const isDomainJoined = domain && domain !== 'WORKGROUP' && domain !== hostname;
        safeSetDomainInfo({
          principal: `${domain || 'LOCAL'}\\${username}`,
          domain: isDomainJoined ? domain : '',
          isDC: false,
          hostname: hostname,
          workgroup: isDomainJoined ? '' : (domain || 'WORKGROUP'),
          isDomainJoined: !!isDomainJoined,
        });
      } catch (error) {
        console.warn('Could not fetch domain info:', error);
        safeSetDomainInfo({
          principal: 'Local\\User',
          domain: '',
          isDC: false,
          hostname: '',
          workgroup: 'WORKGROUP',
          isDomainJoined: false,
        });
      }
    };
    
    fetchDomainInfo();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <aside className="w-64 bg-[#001f4d] h-screen flex flex-col fixed left-0 top-0 text-slate-200" role="navigation" aria-label="Main navigation">
      <div className="p-6 flex items-center space-x-3 border-b border-slate-800/50">
        <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-blue-500 to-[#002868] rounded-lg flex items-center justify-center text-white font-black text-sm">
          GA
        </div>
        <div>
          <h1 className="font-black text-white tracking-tighter leading-none text-lg">GA-ASI</h1>
          <p className="text-[9px] uppercase font-black text-blue-400 tracking-[0.2em] mt-1">AppLocker Toolkit</p>
        </div>
      </div>
      
      <nav className="flex-1 mt-6 px-3 space-y-1" aria-label="Application views">
        {NAVIGATION.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as AppView)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#001f4d] ${
              currentView === item.id 
                ? 'bg-white/10 text-white border border-white/10 shadow-xl' 
                : 'hover:bg-white/5 hover:text-white'
            }`}
            aria-label={`Navigate to ${item.label}`}
            aria-current={currentView === item.id ? 'page' : undefined}
            title={`${item.label} (Ctrl+${index + 1})`}
          >
            <div className="flex items-center space-x-3">
              <span className={currentView === item.id ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-400'} aria-hidden="true">
                {item.icon}
              </span>
              <span className="text-sm font-bold tracking-tight">{item.label}</span>
            </div>
            {currentView === item.id && <ChevronRight size={14} className="text-blue-400" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800/50 bg-[#001a40]">
        <div className="p-2 rounded-lg border border-slate-700/50 bg-slate-900/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse ${
                  domainInfo.isDC ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-green-500'
                }`}
                aria-label={domainInfo.isDC ? "Running on Domain Controller" : "System online"}
                role="status"
              />
              <span className="text-xs font-bold text-slate-300">
                {domainInfo.isDC ? 'DC Admin Mode' : 'Online'}
              </span>
            </div>
            <span className="text-xs text-slate-500">v1.2.10</span>
          </div>
          <div className="text-[10px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Domain/Host:</span>
              <span className="font-bold text-blue-400 truncate max-w-[110px]" title={
                domainInfo.isDomainJoined
                  ? `${domainInfo.domain}\\${domainInfo.hostname}`
                  : domainInfo.workgroup || domainInfo.hostname
              }>
                {domainInfo.isDomainJoined
                  ? `${domainInfo.domain}\\${domainInfo.hostname}`
                  : domainInfo.workgroup || domainInfo.hostname || 'LOCAL'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>User:</span>
              <span className="font-medium text-slate-300 truncate max-w-[120px]" title={domainInfo.principal}>
                {domainInfo.principal}
              </span>
            </div>
            {domainInfo.isDC && (
              <div className="flex items-center justify-between">
                <span>Role:</span>
                <span className="font-mono text-amber-400 text-[9px]">Domain Controller</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
