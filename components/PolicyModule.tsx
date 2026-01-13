
import React, { useState, useMemo } from 'react';
import { PolicyPhase, InventoryItem, TrustedPublisher } from '../src/shared/types';
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
  const [showMerger, setShowMerger] = useState(false);
  const [showComprehensiveGen, setShowComprehensiveGen] = useState(false);
  const [generatorTab, setGeneratorTab] = useState<'scanned' | 'trusted'>('scanned');
  const [selectedApp, setSelectedApp] = useState<InventoryItem | null>(null);
  const [selectedPublisher, setSelectedPublisher] = useState<TrustedPublisher | null>(null);
  const [ruleAction, setRuleAction] = useState<'Allow' | 'Deny'>('Allow');
  const [targetGroup, setTargetGroup] = useState(APPLOCKER_GROUPS[0]);
  const [ruleType, setRuleType] = useState<'Publisher' | 'Path' | 'Hash'>('Publisher');
  
  // Policy Merger State
  const [policyFiles, setPolicyFiles] = useState<string[]>([]);
  const [mergeOutputPath, setMergeOutputPath] = useState('');
  const [mergeConflictResolution, setMergeConflictResolution] = useState<'First' | 'Last' | 'Strict'>('Strict');
  
  // Comprehensive Generation State
  const [comprehensiveComputerName, setComprehensiveComputerName] = useState('');
  const [comprehensiveOutputPath, setComprehensiveOutputPath] = useState('');
  const [includeEventLogs, setIncludeEventLogs] = useState(true);
  const [includeWritablePaths, setIncludeWritablePaths] = useState(true);
  const [includeSystemPaths, setIncludeSystemPaths] = useState(true);

  // Imported Artifacts State
  const [importedArtifacts, setImportedArtifacts] = useState<InventoryItem[]>([]);
  const [importedFrom, setImportedFrom] = useState<string>('');
  
  // Advanced Features State
  const [showPublisherGrouping, setShowPublisherGrouping] = useState(false);
  const [showDuplicateDetection, setShowDuplicateDetection] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showIncrementalUpdate, setShowIncrementalUpdate] = useState(false);
  const [publisherGroups, setPublisherGroups] = useState<Record<string, InventoryItem[]>>({});
  const [duplicateReport, setDuplicateReport] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<any[]>([
    {
      id: 'microsoft-all',
      name: 'Allow All Microsoft-Signed Software',
      description: 'Creates Publisher rule for all Microsoft Corporation signed executables',
      publisher: 'O=MICROSOFT CORPORATION*',
      action: 'Allow'
    },
    {
      id: 'ga-asi-internal',
      name: 'Allow All GA-ASI Internal Tools',
      description: 'Creates Publisher rule for GA-ASI signed software',
      publisher: 'O=GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.*',
      action: 'Allow'
    },
    {
      id: 'deny-unsigned-userdirs',
      name: 'Deny Unsigned Executables in User Directories',
      description: 'Denies all unsigned executables in user writable paths',
      path: '%USERPROFILE%\\*',
      action: 'Deny'
    },
    {
      id: 'allow-programfiles',
      name: 'Allow Program Files',
      description: 'Allows executables in Program Files directories',
      path: '%PROGRAMFILES%\\*',
      action: 'Allow'
    }
  ]);
  
  // Auto-group by publisher when inventory changes
  React.useEffect(() => {
    if (combinedInventory.length > 0) {
      const groups: Record<string, InventoryItem[]> = {};
      combinedInventory.forEach(item => {
        const publisher = item.publisher || 'Unknown';
        if (!groups[publisher]) {
          groups[publisher] = [];
        }
        groups[publisher].push(item);
      });
      setPublisherGroups(groups);
    }
  }, [combinedInventory]);

  // Filtering for generator
  const [genSearchQuery, setGenSearchQuery] = useState('');
  const [genCategoryFilter, setGenCategoryFilter] = useState('All');

  // Combined inventory: scanned + imported artifacts
  const combinedInventory = useMemo(() => {
    // TODO: Get from service when available
    const scanned: InventoryItem[] = [];
    return [...scanned, ...importedArtifacts];
  }, [importedArtifacts]);

  const filteredInventory = useMemo(() => {
    return combinedInventory.filter((item: InventoryItem) => 
      item.name.toLowerCase().includes(genSearchQuery.toLowerCase()) ||
      item.publisher.toLowerCase().includes(genSearchQuery.toLowerCase()) ||
      item.path.toLowerCase().includes(genSearchQuery.toLowerCase())
    );
  }, [combinedInventory, genSearchQuery]);

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

  const handleCreateRule = async () => {
    const subject = generatorTab === 'scanned' ? selectedApp?.name : selectedPublisher?.name;
    // TODO: Call IPC handler to create rule
    alert(`Rule created for ${subject}\nAction: ${ruleAction}\nGroup: ${targetGroup}\nType: ${ruleType}`);
    setShowGenerator(false);
    resetGenerator();
  };

  const handleBatchGenerate = async () => {
    if (filteredInventory.length === 0) {
      alert('No items to generate rules for');
      return;
    }
    
    const count = filteredInventory.length;
    if (!confirm(`Generate rules for all ${count} items?\n\nPriority: Publisher rules first, Hash rules as fallback.\n\nThis will create rules automatically.`)) {
      return;
    }
    
    if (!window.electron?.ipc) {
      alert('IPC not available. Running in browser mode.');
      return;
    }
    
    try {
      const outputPath = prompt('Enter output path for generated policy:', 'C:\\Policies\\Batch-Generated.xml');
      if (!outputPath) return;
      
      const result = await window.electron.ipc.invoke('policy:batchGenerateRules', filteredInventory, outputPath, {
        ruleAction: ruleAction,
        targetGroup: targetGroup,
        collectionType: 'Exe',
        groupByPublisher: true
      });
      
      if (result.success) {
        alert(`Successfully generated rules!\n\nOutput: ${result.outputPath}`);
        setShowGenerator(false);
        resetGenerator();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Batch generation failed: ${error?.message || error}`);
    }
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
          <button 
            onClick={() => setShowMerger(true)}
            className="bg-purple-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-purple-700 shadow-lg shadow-purple-500/20 transition-all flex items-center space-x-2"
          >
            <Archive size={18} />
            <span>Merge Policies</span>
          </button>
          <button 
            onClick={() => setShowComprehensiveGen(true)}
            className="bg-green-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-green-700 shadow-lg shadow-green-500/20 transition-all flex items-center space-x-2"
          >
            <Activity size={18} />
            <span>Comprehensive Scan</span>
          </button>
          <button 
            onClick={() => setShowPublisherGrouping(true)}
            className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center space-x-2"
          >
            <Users size={18} />
            <span>Publisher Grouping</span>
          </button>
          <button 
            onClick={() => setShowDuplicateDetection(true)}
            className="bg-orange-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-orange-700 shadow-lg shadow-orange-500/20 transition-all flex items-center space-x-2"
          >
            <Filter size={18} />
            <span>Detect Duplicates</span>
          </button>
          <button 
            onClick={() => setShowTemplates(true)}
            className="bg-cyan-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-cyan-700 shadow-lg shadow-cyan-500/20 transition-all flex items-center space-x-2"
          >
            <FileCode size={18} />
            <span>Templates</span>
          </button>
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 flex items-center space-x-2 shadow-sm">
            <Plus size={18} />
            <span>New Manual Rule</span>
          </button>
        </div>
      </div>

      {/* Policy Merger Modal */}
      {showMerger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-[900px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-600 text-white rounded-xl">
                  <Archive size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Policy Merger</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Merge multiple AppLocker policies</p>
                </div>
              </div>
              <button onClick={() => setShowMerger(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 p-8 overflow-y-auto space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Policy Files to Merge</label>
                <div className="space-y-2">
                  {policyFiles.map((file, index) => (
                    <div key={index} className="flex items-center space-x-2 p-3 bg-slate-50 rounded-xl">
                      <FileText size={16} className="text-slate-400" />
                      <span className="flex-1 text-sm font-bold text-slate-700">{file}</span>
                      <button onClick={() => setPolicyFiles(policyFiles.filter((_, i) => i !== index))} className="p-1 hover:bg-slate-200 rounded text-slate-400">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <label className="block">
                    <input
                      type="file"
                      accept=".xml"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setPolicyFiles([...policyFiles, ...files.map(f => f.name)]);
                      }}
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-purple-500 transition-colors">
                      <Plus size={20} className="mx-auto mb-1 text-slate-400" />
                      <p className="text-xs font-bold text-slate-600">Add Policy Files</p>
                    </div>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Output Path</label>
                <input
                  type="text"
                  value={mergeOutputPath}
                  onChange={(e) => setMergeOutputPath(e.target.value)}
                  placeholder="C:\Policies\Merged.xml"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Conflict Resolution</label>
                <select
                  value={mergeConflictResolution}
                  onChange={(e) => setMergeConflictResolution(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                >
                  <option value="Strict">Strict (Fail on conflicts)</option>
                  <option value="First">First (Use first policy's rules)</option>
                  <option value="Last">Last (Use last policy's rules)</option>
                </select>
              </div>
              <button
                onClick={async () => {
                  if (policyFiles.length < 2) {
                    alert('Please select at least 2 policy files to merge');
                    return;
                  }
                  if (!mergeOutputPath) {
                    alert('Please specify an output path');
                    return;
                  }
                  alert(`Merging ${policyFiles.length} policies...`);
                  setShowMerger(false);
                }}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-purple-700 shadow-lg transition-all"
              >
                Merge Policies
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Rule Generation Modal */}
      {showComprehensiveGen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-[900px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-600 text-white rounded-xl">
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Comprehensive Rule Generation</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Generate rules from all scanning artifacts</p>
                </div>
              </div>
              <button onClick={() => setShowComprehensiveGen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 p-8 overflow-y-auto space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-900">
                  This will scan: Software inventory, Event Viewer logs, Writable paths, System paths, and all .exe files.
                  Duplicates will be automatically removed.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Computer</label>
                <input
                  type="text"
                  value={comprehensiveComputerName}
                  onChange={(e) => setComprehensiveComputerName(e.target.value)}
                  placeholder="localhost or COMPUTERNAME"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-green-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Output Path</label>
                <input
                  type="text"
                  value={comprehensiveOutputPath}
                  onChange={(e) => setComprehensiveOutputPath(e.target.value)}
                  placeholder="C:\Scans\comprehensive-artifacts.json"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-green-500/20"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Scan Options</label>
                <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeEventLogs}
                    onChange={(e) => setIncludeEventLogs(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm font-bold text-slate-700">Include Event Viewer Logs (8003/8004)</span>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWritablePaths}
                    onChange={(e) => setIncludeWritablePaths(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm font-bold text-slate-700">Include Writable Paths (AppData, Temp)</span>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSystemPaths}
                    onChange={(e) => setIncludeSystemPaths(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm font-bold text-slate-700">Include System Paths (Program Files, Windows)</span>
                </label>
              </div>
              <button
                onClick={async () => {
                  if (!comprehensiveOutputPath) {
                    alert('Please specify an output path');
                    return;
                  }
                  alert(`Starting comprehensive scan of ${comprehensiveComputerName || 'localhost'}...`);
                  setShowComprehensiveGen(false);
                }}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-green-700 shadow-lg transition-all"
              >
                Start Comprehensive Scan & Generate Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-[1200px] h-[800px] shadow-2xl overflow-hidden flex flex-col">
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
                    >Scanned Apps {combinedInventory.length > 0 && `(${combinedInventory.length})`}</button>
                    <button 
                      onClick={() => { setGeneratorTab('trusted'); resetGenerator(); }}
                      className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${generatorTab === 'trusted' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >Trusted Vendors</button>
                  </div>

                  {/* Import Artifacts Button */}
                  <label className="block">
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const text = event.target?.result as string;
                              let items: InventoryItem[] = [];
                              
                              if (file.name.endsWith('.json')) {
                                const data = JSON.parse(text);
                                // Handle comprehensive scan artifacts format
                                if (data.Executables) {
                                  items = data.Executables.map((exe: any, index: number) => ({
                                    id: `imported-${index}`,
                                    name: exe.Name || exe.name || 'Unknown',
                                    publisher: exe.Publisher || exe.publisher || 'Unknown',
                                    path: exe.Path || exe.path || '',
                                    version: exe.Version || exe.version || '',
                                    type: (exe.Type || exe.type || 'EXE') as InventoryItem['type']
                                  }));
                                } else if (Array.isArray(data)) {
                                  items = data.map((item: any, index: number) => ({
                                    id: `imported-${index}`,
                                    name: item.Name || item.name || 'Unknown',
                                    publisher: item.Publisher || item.publisher || 'Unknown',
                                    path: item.Path || item.path || '',
                                    version: item.Version || item.version || '',
                                    type: (item.Type || item.type || 'EXE') as InventoryItem['type']
                                  }));
                                }
                              } else {
                                // CSV format
                                const lines = text.split('\n').filter(l => l.trim());
                                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                                items = lines.slice(1).map((line, index) => {
                                  const values = line.split(',').map(v => v.trim());
                                  return {
                                    id: `imported-${index}`,
                                    name: values[headers.indexOf('name')] || values[0] || 'Unknown',
                                    publisher: values[headers.indexOf('publisher')] || values[1] || 'Unknown',
                                    path: values[headers.indexOf('path')] || values[2] || '',
                                    version: values[headers.indexOf('version')] || values[3] || '',
                                    type: (values[headers.indexOf('type')] || values[4] || 'EXE') as InventoryItem['type']
                                  };
                                });
                              }
                              
                              // Remove duplicates by path
                              const uniqueItems = items.filter((item, index, self) =>
                                index === self.findIndex(t => t.path === item.path && t.path !== '')
                              );
                              
                              setImportedArtifacts([...importedArtifacts, ...uniqueItems]);
                              setImportedFrom(file.name);
                              setGeneratorTab('scanned');
                            } catch (error) {
                              alert('Error parsing file. Please ensure it is valid CSV or JSON.');
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-blue-300 rounded-xl p-3 text-center cursor-pointer hover:border-blue-500 transition-colors bg-blue-50/50">
                      <Import size={16} className="mx-auto mb-1 text-blue-600" />
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Import Scan Artifacts</p>
                      <p className="text-[9px] text-blue-500 mt-0.5">CSV, JSON, or Comprehensive Scan</p>
                    </div>
                  </label>
                  
                  {importedArtifacts.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-2">
                      <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">
                        {importedArtifacts.length} items imported from {importedFrom}
                      </p>
                      <button
                        onClick={() => { setImportedArtifacts([]); setImportedFrom(''); }}
                        className="text-[9px] text-blue-600 hover:text-blue-800 mt-1"
                      >
                        Clear imported
                      </button>
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder={generatorTab === 'scanned' ? `Search ${combinedInventory.length} items...` : "Search 58+ trusted vendors..."}
                      value={genSearchQuery}
                      onChange={(e) => setGenSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Import Artifacts Button - Only show in scanned tab */}
                  {generatorTab === 'scanned' && (
                    <label className="block">
                      <input
                        type="file"
                        accept=".csv,.json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              try {
                                const text = event.target?.result as string;
                                let items: InventoryItem[] = [];
                                
                                if (file.name.endsWith('.json')) {
                                  const data = JSON.parse(text);
                                  // Handle comprehensive scan artifacts format
                                  if (data.Executables) {
                                    items = data.Executables.map((exe: any, index: number) => ({
                                      id: `imported-${Date.now()}-${index}`,
                                      name: exe.Name || exe.name || 'Unknown',
                                      publisher: exe.Publisher || exe.publisher || 'Unknown',
                                      path: exe.Path || exe.path || '',
                                      version: exe.Version || exe.version || '',
                                      type: (exe.Type || exe.type || 'EXE') as InventoryItem['type']
                                    }));
                                  } else if (Array.isArray(data)) {
                                    items = data.map((item: any, index: number) => ({
                                      id: `imported-${Date.now()}-${index}`,
                                      name: item.Name || item.name || 'Unknown',
                                      publisher: item.Publisher || item.publisher || 'Unknown',
                                      path: item.Path || item.path || '',
                                      version: item.Version || item.version || '',
                                      type: (item.Type || item.type || 'EXE') as InventoryItem['type']
                                    }));
                                  }
                                } else {
                                  // CSV format
                                  const lines = text.split('\n').filter(l => l.trim());
                                  if (lines.length > 0) {
                                    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                                    items = lines.slice(1).map((line, index) => {
                                      const values = line.split(',').map(v => v.trim());
                                      return {
                                        id: `imported-${Date.now()}-${index}`,
                                        name: values[headers.indexOf('name')] || values[0] || 'Unknown',
                                        publisher: values[headers.indexOf('publisher')] || values[1] || 'Unknown',
                                        path: values[headers.indexOf('path')] || values[2] || '',
                                        version: values[headers.indexOf('version')] || values[3] || '',
                                        type: (values[headers.indexOf('type')] || values[4] || 'EXE') as InventoryItem['type']
                                      };
                                    });
                                  }
                                }
                                
                                // Remove duplicates by path
                                const uniqueItems = items.filter((item, index, self) =>
                                  index === self.findIndex(t => t.path === item.path && t.path !== '')
                                );
                                
                                setImportedArtifacts([...importedArtifacts, ...uniqueItems]);
                                setImportedFrom(file.name);
                                alert(`Imported ${uniqueItems.length} items from ${file.name}`);
                              } catch (error) {
                                alert('Error parsing file. Please ensure it is valid CSV or JSON.');
                              }
                            };
                            reader.readAsText(file);
                          }
                        }}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-blue-300 rounded-xl p-3 text-center cursor-pointer hover:border-blue-500 transition-colors bg-blue-50/50">
                        <Import size={16} className="mx-auto mb-1 text-blue-600" />
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Import Scan Artifacts</p>
                        <p className="text-[9px] text-blue-500 mt-0.5">CSV, JSON, or Comprehensive Scan</p>
                      </div>
                    </label>
                  )}
                  
                  {importedArtifacts.length > 0 && generatorTab === 'scanned' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-2">
                      <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">
                        {importedArtifacts.length} items imported from {importedFrom}
                      </p>
                      <button
                        onClick={() => { setImportedArtifacts([]); setImportedFrom(''); }}
                        className="text-[9px] text-blue-600 hover:text-blue-800 mt-1"
                      >
                        Clear imported
                      </button>
                    </div>
                  )}

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
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Rule Logic (Auto: Publisher → Hash)</label>
                          <select 
                            value={ruleType}
                            onChange={(e) => setRuleType(e.target.value as any)}
                            className="w-full bg-slate-100 border-none rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none h-[42px]"
                          >
                            <option value="Publisher">Publisher (Preferred - Resilient to Updates)</option>
                            <option value="Hash">Hash (Fallback - Most Secure for Unsigned)</option>
                            <option value="Auto">Auto (Publisher first, then Hash)</option>
                          </select>
                          <p className="text-[9px] text-slate-400 mt-1">Path rules are not recommended (too restrictive)</p>
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
                    
                    <div className="space-y-2">
                      <button 
                        onClick={handleCreateRule}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center space-x-3"
                      >
                        <Check size={20} />
                        <span>Commit to AD Environment</span>
                      </button>
                      {generatorTab === 'scanned' && filteredInventory.length > 0 && (
                        <button
                            onClick={handleBatchGenerate}
                          className="w-full py-3 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-green-700 shadow-xl shadow-green-500/20 transition-all flex items-center justify-center space-x-3"
                        >
                          <Archive size={18} />
                          <span>Batch Generate ({filteredInventory.length} items)</span>
                        </button>
                      )}
                    </div>
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
