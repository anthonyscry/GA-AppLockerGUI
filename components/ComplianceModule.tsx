
import React, { useState } from 'react';
import { ClipboardCheck, FileText, Download, ShieldCheck, HelpCircle } from 'lucide-react';
import { getComplianceSnippet } from '../services/geminiService';

const ComplianceModule: React.FC = () => {
  const [selectedFramework, setSelectedFramework] = useState('NIST 800-171');
  const [snippet, setSnippet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const frameworks = ['NIST 800-171', 'HIPAA', 'PCI-DSS v4.0', 'CMMC Level 2'];

  const handleGenerateSnippet = async () => {
    setLoading(true);
    try {
      const result = await getComplianceSnippet(selectedFramework);
      setSnippet(result || "Error generating snippet.");
    } finally {
      setLoading(false);
    }
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Regulatory AI Assistant</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select Framework</label>
              <div className="grid grid-cols-2 gap-2">
                {frameworks.map(f => (
                  <button 
                    key={f}
                    onClick={() => setSelectedFramework(f)}
                    className={`p-3 text-xs font-bold rounded-xl border transition-all ${
                      selectedFramework === f ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={handleGenerateSnippet}
              disabled={loading}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
            >
              {loading ? 'Consulting Regulations...' : 'Generate Justification Snippet'}
            </button>
          </div>

          {snippet && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Compliance Draft</span>
                <Download size={14} className="text-slate-400 cursor-pointer hover:text-blue-600" />
              </div>
              <p className="text-sm text-slate-700 leading-relaxed italic">"{snippet}"</p>
            </div>
          )}
        </div>

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
