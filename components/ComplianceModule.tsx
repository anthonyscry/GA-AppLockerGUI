
import React from 'react';
import { ClipboardCheck, Download, ShieldCheck, HelpCircle } from 'lucide-react';

const ComplianceModule: React.FC = () => {

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Compliance & Audit</h2>
          <p className="text-slate-500 text-sm">Generate CORA evidence packages and regulatory reports.</p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 flex items-center space-x-2">
          <ShieldCheck size={20} />
          <span>New Evidence Bundle</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-400 font-bold uppercase tracking-widest text-xs">
              <ClipboardCheck size={16} />
              <span>Evidence Readiness</span>
            </div>
            <h3 className="text-2xl font-bold text-white">CORA Evidence Builder</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Automate the collection of configuration XMLs, event logs, and system snapshots 
              into a signed package ready for inspector review.
            </p>
            
            <div className="space-y-3 mt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Policy Definitions</span>
                <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded">COMPLETE</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Audit Logs (Last 30 Days)</span>
                <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded">SYNCED</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">System Inventory Snapshots</span>
                <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">STALE (3d)</span>
              </div>
            </div>
          </div>
          
          <button className="mt-8 w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all flex items-center justify-center space-x-2 shadow-xl shadow-blue-500/20">
            <span>Export Evidence Package</span>
            <Download size={18} />
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-800">Historical Reports</h4>
          <HelpCircle size={18} className="text-slate-300" />
        </div>
        <div className="p-6 text-center">
          <p className="text-slate-400 text-sm mb-4">No historical reports found in the current output directory.</p>
          <button className="text-blue-600 font-bold text-sm hover:underline">Browse Repository</button>
        </div>
      </div>
    </div>
  );
};

export default ComplianceModule;
