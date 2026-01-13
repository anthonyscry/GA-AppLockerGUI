
import React, { useState, useMemo } from 'react';
import { PolicyPhase, InventoryItem, TrustedPublisher } from '../types';
import { 
  FileCode, 
  Settings, 
  Plus, 
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Activity,
  Import,
  Check,
  X,
  Search,
  Filter,
  CheckCircle,
  Archive,
  Users
} from 'lucide-react';
import { APPLOCKER_GROUPS, COMMON_PUBLISHERS } from '../constants';

const PolicyModule: React.FC = () => {
  const [selectedPhase, setSelectedPhase] = useState<PolicyPhase>(PolicyPhase.PHASE_1);
  const [healthResults, setHealthResults] = useState<{c: number, w: number, i: number, score: number} | null>(null);
  
  // Rule Generator State
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorTab, setGeneratorTab] = useState<'scanned' | 'trusted'>('scanned');
  const [selectedApp, setSelectedApp] = useState<InventoryItem | null>(null);
  const [selectedPublisher, setSelectedPublisher] = useState<TrustedPublisher | null>(null);
  const [ruleAction, setRuleAction] = useState<'Allow' | 'Deny'>('Allow');
  const [targetGroup, setTargetGroup] = useState(APPLOCKER_GROUPS[0]);
  const [ruleType, setRuleType] = useState<'Publisher' | 'Path' | 'Hash'>('Publisher');

  // Filtering for generator
  const [genSearchQuery, setGenSearchQuery] = useState('');
  const [genCategoryFilter, setGenCategoryFilter] = useState('All');

  const filteredInventory = useMemo(() => {
    return [].filter((item: InventoryItem) => 
      item.name.toLowerCase().includes(genSearchQuery.toLowerCase()) ||
      item.publisher.toLowerCase().includes(genSearchQuery.toLowerCase())
    );
  }, [genSearchQuery]);

  const filteredPublishers = useMemo(() => {
    return COMMON_PUBLISHERS.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(genSearchQuery.toLowerCase()) ||
                            p.publisherName.toLowerCase().includes(genSearchQuery.toLowerCase());
      const matchesCategory = genCategoryFilter === 'All' || p.category === genCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [genSearchQuery, genCategoryFilter]);

  const categories = ['All', ...Array.from(new Set(COMMON_PUBLISHERS.map(p => p.category)))];

  const runHealthCheck = () => {
    const critical = 0;
    const warning = 2;
    const info = 4;
    const score = 100 - (20 * critical) - (5 * warning) - (1 * info);
    setHealthResults({ c: critical, w: warning, i: info, score });
  };

  const handleCreateRule = () => {
    const subject = generatorTab === 'scanned' ? selectedApp?.name : selectedPublisher?.name;
    alert(`Rule created for ${subject}\nAction: ${ruleAction}\nGroup: ${targetGroup}\nType: ${ruleType}`);
    setShowGenerator(false);
    resetGenerator();
  };

  const resetGenerator = () => {
    setSelectedApp(null);
    setSelectedPublisher(null);
    setGenSearchQuery('');
    setGenCategoryFilter('All');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Policy Lab</h2>
          <p className="text-slate-500 text-sm">Design, merge, and validate AppLocker XML policies.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => { setShowGenerator(true); setGeneratorTab('scanned'); }}
            className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2"
          >
            <Import size={18} />
            <span>Rule Generator</span>
          </button>
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 flex items-center space-x-2 shadow-sm">
            <Plus size={18} />
            <span>New Manual Rule</span>
          </button>
        </div>
      </div>

      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <Archive size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Rule Generation Engine</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">GA-AppLocker Toolkit v1.2.4</p>
                </div>
              </div>
              <button onClick={() => { setShowGenerator(false); resetGenerator(); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Sidebar: App/Publisher List */}
              <div className="w-full md:w-1/2 border-r border-slate-100 flex flex-col bg-slate-50/30">
                <div className="p-6 space-y-4">
                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button 
                      onClick={() => { setGeneratorTab('scanned'); resetGenerator(); }}
                      className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${generatorTab === 'scanned' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >Scanned Apps</button>
                    <button 
                      onClick={() => { setGeneratorTab('trusted'); resetGenerator(); }}
                      className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${generatorTab === 'trusted' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >Trusted Vendors</button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder={generatorTab === 'scanned' ? "Search machine inventory..." : "Search 19+ trusted vendors..."}
                      value={genSearchQuery}
                      onChange={(e) => setGenSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {generatorTab === 'trusted' && (
                    <div className="flex items-center space-x-2 overflow-x-auto pb-1 custom-scrollbar">
                      {categories.map(cat => (
                        <button 
                          key={cat}
                          onClick={() => setGenCategoryFilter(cat)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${
                            genCategoryFilter === cat ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2 custom-scrollbar">
                  {generatorTab === 'scanned' ? (
                    filteredInventory.map((app) => (
                      <button 
                        key={app.id}
                        onClick={() => { setSelectedApp(app); setSelectedPublisher(null); }}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          selectedApp?.id === app.id 
                          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20' 
                          : 'bg-white border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{app.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]">{app.publisher}</p>
                          </div>
                          <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded uppercase">{app.type}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    filteredPublishers.map((pub) => (
                      <button 
                        key={pub.id}
                        onClick={() => { setSelectedPublisher(pub); setSelectedApp(null); }}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          selectedPublisher?.id === pub.id 
                          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20' 
                          : 'bg-white border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-slate-900 text-sm">{pub.name}</p>
                          <span className="text-[9px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded uppercase tracking-widest">{pub.category}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium line-clamp-1">{pub.description}</p>
                      </button>
                    ))
                  )}
                  {(generatorTab === 'scanned' ? filteredInventory : filteredPublishers).length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <Search size={32} className="mx-auto mb-2 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest">No matches found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Form: Rule Config */}
              <div className="flex-1 p-8 space-y-8 bg-white overflow-y-auto custom-scrollbar">
                {(selectedApp || selectedPublisher) ? (
                  <>
                    <div className="space-y-6">
                      <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="p-3 bg-blue-600 text-white rounded-xl">
                          <CheckCircle size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">
                            Target: {generatorTab === 'scanned' ? selectedApp?.name : selectedPublisher?.name}
                          </h4>
                          <p className="text-[10px] font-mono text-slate-500 break-all">
                            {generatorTab === 'scanned' ? selectedApp?.publisher : selectedPublisher?.publisherName}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Policy Action</label>
                          <div className="flex p-1 bg-slate-100 rounded-xl">
                            <button 
                              onClick={() => setRuleAction('Allow')}
                              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${ruleAction === 'Allow' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500'}`}
                            >Permit</button>
                            <button 
                              onClick={() => setRuleAction('Deny')}
                              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${ruleAction === 'Deny' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                            >Deny</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Rule Logic</label>
                          <select 
                            value={ruleType}
                            onChange={(e) => setRuleType(e.target.value as any)}
                            className="w-full bg-slate-100 border-none rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none h-[42px]"
                          >
                            <option value="Publisher">Publisher (Resilient to Updates)</option>
                            <option value="Path">File Path (Restricted)</option>
                            <option value="Hash">Unique File Hash (Most Secure)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">AD Security Principal</label>
                        <div className="relative">
                          <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <select 
                            value={targetGroup}
                            onChange={(e) => setTargetGroup(e.target.value)}
                            className="w-full bg-slate-100 border-none rounded-xl pl-12 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none"
                          >
                            {APPLOCKER_GROUPS.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="p-6 bg-slate-900 rounded-3xl text-white relative overflow-hidden">
                        <div className="relative z-10">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">AppLocker XML Blueprint</span>
                            <FileCode size={18} className="text-blue-400" />
                          </div>
                          <pre className="text-[11px] font-mono leading-relaxed text-blue-100 opacity-80">
{`<FilePublisherRule Id="${Math.random().toString(36).substr(2, 9)}" Name="${(generatorTab === 'scanned' ? selectedApp?.name : selectedPublisher?.name)?.replace(/\s/g, '-')}" Action="${ruleAction}">
  <Conditions>
    <PublisherCondition PublisherName="${generatorTab === 'scanned' ? selectedApp?.publisher : selectedPublisher?.publisherName}" ... />
  </Conditions>
</FilePublisherRule>`}
                          </pre>
                        </div>
                        <ShieldCheck size={120} className="absolute -right-8 -bottom-8 text-white opacity-[0.03]" />
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleCreateRule}
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center space-x-3"
                    >
                      <Check size={20} />
                      <span>Commit to AD Environment</span>
                    </button>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 border-4 border-dashed border-slate-50 rounded-[40px] bg-slate-50/20 p-12">
                    <div className="p-6 bg-white rounded-full shadow-sm">
                      <Import size={64} className="text-slate-100" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-lg font-black text-slate-400 uppercase tracking-tight">Awaiting Selection</p>
                      <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto">Select a scanned application or a trusted vendor from the sidebar to generate a new policy rule.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h4 className="font-black text-slate-900 text-[10px] uppercase tracking-widest mb-4">Deployment Phase</h4>
            <div className="space-y-2">
              {Object.values(PolicyPhase).map((phase) => (
                <button
                  key={phase}
                  onClick={() => setSelectedPhase(phase)}
                  className={`w-full text-left p-3.5 rounded-xl text-xs font-bold transition-all border ${
                    selectedPhase === phase 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {phase}
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
               <button 
                onClick={runHealthCheck}
                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
               >
                 <Activity size={14} />
                 <span>Run Health Check</span>
               </button>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border transition-all ${
            selectedPhase.includes('Phase 4') ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <div className={`flex items-center space-x-2 mb-2 font-black text-[10px] uppercase tracking-widest ${
              selectedPhase.includes('Phase 4') ? 'text-red-700' : 'text-amber-700'
            }`}>
              <ShieldAlert size={16} />
              <span>Phase Risk Assessment</span>
            </div>
            <p className={`text-xs leading-relaxed font-medium ${
              selectedPhase.includes('Phase 4') ? 'text-red-600' : 'text-amber-600'
            }`}>
              {selectedPhase.includes('Phase 4') 
                ? "CRITICAL: DLL rules impact system performance and stability. 14+ days of auditing is REQUIRED before enforcement."
                : "Safe to deploy in Audit Mode. Ensure all high-priority systems have been scanned first."
              }
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {healthResults && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-top-4">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-2xl font-black text-xl ${
                    healthResults.score > 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {healthResults.score}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Rule Health Score</h3>
                    <p className="text-xs text-slate-500">Based on GA-AppLocker Test-RuleHealth.ps1</p>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <HealthStat icon={<ShieldAlert size={14} className="text-red-500" />} label="Critical" value={healthResults.c} />
                  <HealthStat icon={<AlertTriangle size={14} className="text-amber-500" />} label="Warning" value={healthResults.w} />
                  <HealthStat icon={<Info size={14} className="text-blue-500" />} label="Info" value={healthResults.i} />
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800 font-mono group relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <FileCode size={20} className="text-blue-400" />
                <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">AppLocker XML Preview</span>
              </div>
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-slate-800" />
                <div className="w-3 h-3 rounded-full bg-slate-800" />
                <div className="w-3 h-3 rounded-full bg-slate-800" />
              </div>
            </div>
            <pre className="text-blue-100 text-[11px] overflow-x-auto whitespace-pre-wrap leading-loose opacity-90 group-hover:opacity-100 transition-opacity">
{`<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly">
    <!-- Policy Phase: ${selectedPhase} -->
    <FilePublisherRule Id="72277d33-..." Name="Microsoft-Signed" Action="Allow">
      <Conditions>
        <PublisherCondition PublisherName="O=Microsoft Corporation, ..." />
      </Conditions>
    </FilePublisherRule>
    ${selectedPhase.includes('Phase 2') ? '<FilePathRule Id="..." Name="Script-Allow" Action="Allow">...</FilePathRule>' : '<!-- Scripts Restricted in Phase 1 -->'}
  </RuleCollection>
</AppLockerPolicy>`}
            </pre>
          </div>

        </div>
      </div>
    </div>
  );
};

const HealthStat: React.FC<{icon: React.ReactNode, label: string, value: number}> = ({icon, label, value}) => (
  <div className="text-center">
    <div className="flex items-center justify-center space-x-1 mb-1">
      {icon}
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <span className="text-sm font-black text-slate-900">{value}</span>
  </div>
);

export default PolicyModule;
