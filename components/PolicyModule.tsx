
import React, { useState, useMemo } from 'react';
import { PolicyPhase, InventoryItem, TrustedPublisher, MachineScan, MachineType, getMachineTypeFromOU, groupMachinesByOU, MachinesByType } from '../src/shared/types';
import { 
  FileCode, 
  FileText,
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
  Users,
  Server,
  Layers,
  FolderTree,
  Upload,
  Link,
  Trash2,
  Loader2
} from 'lucide-react';
import { APPLOCKER_GROUPS, COMMON_PUBLISHERS } from '../constants';
import { useAppServices } from '../src/presentation/contexts/AppContext';
import { useAsync } from '../src/presentation/hooks/useAsync';
import { LoadingState } from './ui/LoadingState';
import { ErrorState } from './ui/ErrorState';

type PolicyTab = 'overview' | 'generator' | 'tools';

const PolicyModule: React.FC = () => {
  const { policy, machine } = useAppServices();
  const [selectedPhase, setSelectedPhase] = useState<PolicyPhase>(PolicyPhase.PHASE_1);
  const [healthResults, setHealthResults] = useState<{c: number, w: number, i: number, score: number} | null>(null);
  const [activeTab, setActiveTab] = useState<PolicyTab>('overview');

  // Fetch inventory and trusted publishers
  const { data: inventory, loading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useAsync(
    () => policy.getInventory()
  );
  
  const { data: trustedPublishers, loading: publishersLoading, error: publishersError } = useAsync(
    () => policy.getTrustedPublishers()
  );
  
  const { data: categories } = useAsync(
    () => policy.getPublisherCategories()
  );
  
  // Fetch machines for OU-based policy generation
  const { data: machines } = useAsync(
    () => machine.getAllMachines()
  );
  
  // Auto-group machines by OU-derived type
  const machineGroups = useMemo((): MachinesByType => {
    if (!machines) return { workstations: [], servers: [], domainControllers: [], unknown: [] };
    return groupMachinesByOU(machines);
  }, [machines]);
  
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
  
  // OU-Based Policy Generation State
  const [showOUPolicyGen, setShowOUPolicyGen] = useState(false);
  const [ouPolicyOutputDir, setOuPolicyOutputDir] = useState('.\\policies\\ou-based');
  const [selectedMachineTypes, setSelectedMachineTypes] = useState<MachineType[]>(['Workstation', 'Server', 'DomainController']);
  
  // OU Deployment State (for linking GPO to OU)
  const [showOUDeploy, setShowOUDeploy] = useState(false);
  const [deployGPOName, setDeployGPOName] = useState('');
  const [deployPolicyPath, setDeployPolicyPath] = useState('');
  const [deployOUPaths, setDeployOUPaths] = useState<string[]>([]);
  const [newOUPath, setNewOUPath] = useState('');
  const [deployPhase, setDeployPhase] = useState<'Phase1' | 'Phase2' | 'Phase3' | 'Phase4'>('Phase1');
  const [deployEnforcement, setDeployEnforcement] = useState<'AuditOnly' | 'Enabled'>('AuditOnly');
  const [createGPOIfMissing, setCreateGPOIfMissing] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [publisherGroups, setPublisherGroups] = useState<Record<string, InventoryItem[]>>({});
  const [duplicateReport, setDuplicateReport] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  
  // Fetch templates from service
  const { data: templates, loading: templatesLoading } = useAsync(
    () => policy.getRuleTemplates()
  );
  
  const { data: templateCategories } = useAsync(
    () => policy.getTemplateCategories()
  );
  
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (templateCategory === 'all') return templates;
    return templates.filter(t => t.category.toLowerCase() === templateCategory.toLowerCase());
  }, [templates, templateCategory]);

  // Filtering for generator
  const [genSearchQuery, setGenSearchQuery] = useState('');
  const [genCategoryFilter, setGenCategoryFilter] = useState('All');

  // Combined inventory: scanned + imported artifacts (MUST be defined before useEffect that uses it)
  const combinedInventory = useMemo(() => {
    const scanned: InventoryItem[] = inventory || [];
    return [...scanned, ...importedArtifacts];
  }, [inventory, importedArtifacts]);
  
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

  const filteredInventory = useMemo(() => {
    if (!genSearchQuery) return combinedInventory;
    const query = genSearchQuery.toLowerCase();
    return combinedInventory.filter((item: InventoryItem) => 
      (item.name?.toLowerCase() || '').includes(query) ||
      (item.publisher?.toLowerCase() || '').includes(query) ||
      (item.path?.toLowerCase() || '').includes(query)
    );
  }, [combinedInventory, genSearchQuery]);

  const filteredPublishers = useMemo(() => {
    const publishers = trustedPublishers || COMMON_PUBLISHERS;
    return publishers.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(genSearchQuery.toLowerCase()) ||
                            p.publisherName.toLowerCase().includes(genSearchQuery.toLowerCase());
      const matchesCategory = genCategoryFilter === 'All' || p.category === genCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [trustedPublishers, genSearchQuery, genCategoryFilter]);

  const availableCategories = categories || ['All', ...Array.from(new Set(COMMON_PUBLISHERS.map(p => p.category)))];

  const runHealthCheck = async () => {
    try {
      const result = await policy.runHealthCheck(selectedPhase);
      setHealthResults({
        c: result.critical,
        w: result.warning,
        i: result.info,
        score: result.score
      });
    } catch (error) {
      console.error('Health check failed:', error);
      // Show error state instead of mock data
      setHealthResults({
        c: -1,  // -1 indicates error state
        w: 0,
        i: 0,
        score: 0
      });
      alert(`Health check failed: ${error instanceof Error ? error.message : 'Could not run health check. Ensure AppLocker is configured.'}`);
    }
  };

  const handleCreateRule = async () => {
    if (!selectedApp && !selectedPublisher) return;
    
    try {
      const subject = generatorTab === 'scanned' ? selectedApp : selectedPublisher;
      if (!subject) return;
      
      await policy.createRule({
        action: ruleAction,
        ruleType: ruleType === 'Auto' ? 'Publisher' : ruleType,
        targetGroup,
        subject: subject as InventoryItem | TrustedPublisher
      });
      
      alert(`Rule created for ${'name' in subject ? subject.name : subject.name}\nAction: ${ruleAction}\nGroup: ${targetGroup}\nType: ${ruleType}`);
      setShowGenerator(false);
      resetGenerator();
    } catch (error) {
      console.error('Failed to create rule:', error);
      alert(`Failed to create rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    
    try {
      const outputPath = prompt('Enter output path for generated policy:', '.\\policies\\Batch-Generated.xml');
      if (!outputPath) return;
      
      const result = await policy.batchGenerateRules(filteredInventory, outputPath, {
        ruleAction: ruleAction,
        targetGroup: targetGroup,
        collectionType: 'Exe',
        groupByPublisher: true
      });
      
      if (result.success) {
        alert(`Successfully generated rules!\n\nOutput: ${result.outputPath || outputPath}`);
        setShowGenerator(false);
        resetGenerator();
      } else {
        alert(`Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Batch generation error:', error);
      alert(`Batch generation failed: ${error?.message || error}`);
    }
  };

  const resetGenerator = () => {
    setSelectedApp(null);
    setSelectedPublisher(null);
    setGenSearchQuery('');
    setGenCategoryFilter('All');
  };

  // Show loading state if data is loading
  if (inventoryLoading || publishersLoading) {
    return <LoadingState message="Loading policy data..." />;
  }

  // Show error state if there's an error
  if (inventoryError || publishersError) {
    return (
      <ErrorState
        title="Failed to load policy data"
        message={inventoryError?.message || publishersError?.message || 'Unknown error occurred'}
        onRetry={() => {
          refetchInventory();
        }}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-8">
      {/* Header with Tab Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Policy Lab</h2>
          <p className="text-slate-500 text-xs">Design and deploy AppLocker policies</p>
        </div>
        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => { setActiveTab('generator'); setGeneratorTab('scanned'); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'generator'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Import size={14} />
            <span>Rule Generator</span>
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'tools'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings size={14} />
            <span>Tools</span>
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
                  id="comprehensive-output-path"
                  value={comprehensiveOutputPath}
                  onChange={(e) => setComprehensiveOutputPath(e.target.value)}
                  placeholder="C:\Scans\comprehensive-artifacts.json"
                  className="w-full px-4 py-3 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  aria-label="Output path for comprehensive scan artifacts"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Scan Options</label>
                <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl cursor-pointer min-h-[44px] focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2">
                  <input
                    type="checkbox"
                    id="include-event-logs"
                    checked={includeEventLogs}
                    onChange={(e) => setIncludeEventLogs(e.target.checked)}
                    className="w-5 h-5 min-w-[20px] min-h-[20px] text-green-600 rounded focus:ring-2 focus:ring-green-500"
                    aria-label="Include Event Viewer logs in comprehensive scan"
                  />
                  <span className="text-sm font-bold text-slate-700">Include Event Viewer Logs (8003/8004)</span>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl cursor-pointer min-h-[44px] focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2">
                  <input
                    type="checkbox"
                    id="include-writable-paths"
                    checked={includeWritablePaths}
                    onChange={(e) => setIncludeWritablePaths(e.target.checked)}
                    className="w-5 h-5 min-w-[20px] min-h-[20px] text-green-600 rounded focus:ring-2 focus:ring-green-500"
                    aria-label="Include writable paths in comprehensive scan"
                  />
                  <span className="text-sm font-bold text-slate-700">Include Writable Paths (AppData, Temp)</span>
                </label>
                <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl cursor-pointer min-h-[44px] focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2">
                  <input
                    type="checkbox"
                    id="include-system-paths"
                    checked={includeSystemPaths}
                    onChange={(e) => setIncludeSystemPaths(e.target.checked)}
                    className="w-5 h-5 min-w-[20px] min-h-[20px] text-green-600 rounded focus:ring-2 focus:ring-green-500"
                    aria-label="Include system paths in comprehensive scan"
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
                className="w-full bg-green-600 text-white px-6 py-3 min-h-[44px] rounded-xl font-bold text-sm hover:bg-green-700 shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-label="Start comprehensive scan and generate rules"
              >
                Start Comprehensive Scan & Generate Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publisher Grouping Modal */}
      {showPublisherGrouping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-[1000px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Publisher Grouping</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Group items by publisher for bulk rule generation</p>
                </div>
              </div>
              <button onClick={() => setShowPublisherGrouping(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              {Object.keys(publisherGroups).length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-bold">No items imported yet</p>
                  <p className="text-xs mt-2">Import scan artifacts first to see publisher groupings</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
                    <p className="text-xs font-bold text-indigo-900">
                      <strong>{Object.keys(publisherGroups).length}</strong> publishers found with <strong>{combinedInventory.length}</strong> total items.
                      Creating publisher rules instead of individual rules can reduce policy size by up to 90%.
                    </p>
                  </div>
                  {Object.entries(publisherGroups)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([publisher, items]) => (
                    <div key={publisher} className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <ShieldCheck size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{publisher}</p>
                            <p className="text-[10px] text-slate-500">{items.length} items</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            const electron = (window as any).electron;
                            if (!electron?.ipc) {
                              alert('IPC not available. Running in browser mode.');
                              return;
                            }
                            const { showSaveDialog } = await import('../src/infrastructure/ipc/fileDialog');
                            const outputPath = await showSaveDialog({
                              title: 'Save Publisher Rule',
                              defaultPath: `.\\policies\\Publisher-${publisher.replace(/[^a-zA-Z0-9]/g, '-')}.xml`,
                              filters: [
                                { name: 'XML Files', extensions: ['xml'] },
                                { name: 'All Files', extensions: ['*'] }
                              ]
                            });
                            if (!outputPath) return;
                            
                            try {
                              const result = await electron.ipc.invoke('policy:createPublisherRule', {
                                publisher: publisher,
                                action: ruleAction,
                                targetGroup: targetGroup,
                                collectionType: 'Exe'
                              }, outputPath);
                              
                              if (result.success) {
                                alert(`Publisher rule created!\n\n${items.length} items covered by 1 rule.\nOutput: ${result.outputPath}`);
                              } else {
                                alert(`Error: ${result.error}`);
                              }
                            } catch (error: any) {
                              alert(`Error: ${error?.message || error}`);
                            }
                          }}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all"
                        >
                          Create Publisher Rule
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {items.slice(0, 5).map((item, idx) => (
                          <span key={idx} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">
                            {item.name}
                          </span>
                        ))}
                        {items.length > 5 && (
                          <span className="text-[9px] bg-slate-200 text-slate-700 px-2 py-1 rounded-full font-bold">
                            +{items.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200">
              <button
                onClick={async () => {
                  if (Object.keys(publisherGroups).length === 0) {
                    alert('No publisher groups available');
                    return;
                  }
                  
                  const confirmed = confirm(`Generate publisher rules for all ${Object.keys(publisherGroups).length} publishers?\n\nThis will create ${Object.keys(publisherGroups).length} rules covering ${combinedInventory.length} items.`);
                  if (!confirmed) return;
                  
                  const outputPath = prompt('Enter output path:', '.\\policies\\All-Publishers.xml');
                  if (!outputPath) return;
                  
                  try {
                    const result = await policy.batchCreatePublisherRules(Object.keys(publisherGroups), outputPath, {
                      action: ruleAction,
                      targetGroup: targetGroup,
                      collectionType: 'Exe'
                    });
                    
                    if (result.success) {
                      alert(`Created ${Object.keys(publisherGroups).length} publisher rules!\nOutput: ${result.outputPath || outputPath}`);
                      setShowPublisherGrouping(false);
                    } else {
                      alert(`Error: ${result.error || 'Unknown error'}`);
                    }
                  } catch (error: any) {
                    alert(`Error: ${error?.message || error}`);
                  }
                }}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg transition-all"
              >
                Generate All Publisher Rules ({Object.keys(publisherGroups).length} rules → {combinedInventory.length} items covered)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OU-Based Policy Generation Modal */}
      {showOUPolicyGen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-[900px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-teal-600 text-white rounded-xl">
                  <FolderTree size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">OU-Based Policy Generation</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Auto-group machines by OU and generate separate policies</p>
                </div>
              </div>
              <button onClick={() => setShowOUPolicyGen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Machine Type Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedMachineTypes.includes('Workstation') 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`} onClick={() => {
                  setSelectedMachineTypes(prev => 
                    prev.includes('Workstation') 
                      ? prev.filter(t => t !== 'Workstation')
                      : [...prev, 'Workstation']
                  );
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <Server className="text-blue-600" size={20} />
                    {selectedMachineTypes.includes('Workstation') && <Check className="text-blue-600" size={16} />}
                  </div>
                  <p className="text-sm font-bold text-slate-900">Workstations</p>
                  <p className="text-2xl font-black text-blue-600">{machineGroups.workstations.length}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">OU=*Workstation*</p>
                </div>
                
                <div className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedMachineTypes.includes('Server') 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`} onClick={() => {
                  setSelectedMachineTypes(prev => 
                    prev.includes('Server') 
                      ? prev.filter(t => t !== 'Server')
                      : [...prev, 'Server']
                  );
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <Server className="text-purple-600" size={20} />
                    {selectedMachineTypes.includes('Server') && <Check className="text-purple-600" size={16} />}
                  </div>
                  <p className="text-sm font-bold text-slate-900">Servers</p>
                  <p className="text-2xl font-black text-purple-600">{machineGroups.servers.length}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">OU=*Server*</p>
                </div>
                
                <div className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedMachineTypes.includes('DomainController') 
                    ? 'border-amber-500 bg-amber-50' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`} onClick={() => {
                  setSelectedMachineTypes(prev => 
                    prev.includes('DomainController') 
                      ? prev.filter(t => t !== 'DomainController')
                      : [...prev, 'DomainController']
                  );
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <ShieldCheck className="text-amber-600" size={20} />
                    {selectedMachineTypes.includes('DomainController') && <Check className="text-amber-600" size={16} />}
                  </div>
                  <p className="text-sm font-bold text-slate-900">Domain Controllers</p>
                  <p className="text-2xl font-black text-amber-600">{machineGroups.domainControllers.length}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">OU=Domain Controllers</p>
                </div>
                
                <div className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <AlertTriangle className="text-slate-400" size={20} />
                  </div>
                  <p className="text-sm font-bold text-slate-900">Unclassified</p>
                  <p className="text-2xl font-black text-slate-500">{machineGroups.unknown.length}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Review manually</p>
                </div>
              </div>
              
              {/* Machine Lists by Type */}
              <div className="space-y-4">
                {selectedMachineTypes.includes('Workstation') && machineGroups.workstations.length > 0 && (
                  <div className="border border-blue-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
                      <p className="text-xs font-black text-blue-800 uppercase tracking-widest">
                        Workstation Policy Targets ({machineGroups.workstations.length} machines)
                      </p>
                    </div>
                    <div className="p-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {machineGroups.workstations.map((m: MachineScan) => (
                        <span key={m.id} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                          {m.hostname}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedMachineTypes.includes('Server') && machineGroups.servers.length > 0 && (
                  <div className="border border-purple-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-purple-50 border-b border-purple-200">
                      <p className="text-xs font-black text-purple-800 uppercase tracking-widest">
                        Server Policy Targets ({machineGroups.servers.length} machines)
                      </p>
                    </div>
                    <div className="p-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {machineGroups.servers.map((m: MachineScan) => (
                        <span key={m.id} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-[10px] font-bold">
                          {m.hostname}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedMachineTypes.includes('DomainController') && machineGroups.domainControllers.length > 0 && (
                  <div className="border border-amber-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
                      <p className="text-xs font-black text-amber-800 uppercase tracking-widest">
                        Domain Controller Policy Targets ({machineGroups.domainControllers.length} machines)
                      </p>
                    </div>
                    <div className="p-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {machineGroups.domainControllers.map((m: MachineScan) => (
                        <span key={m.id} className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                          {m.hostname}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Output Configuration */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Output Directory</p>
                <input
                  type="text"
                  value={ouPolicyOutputDir}
                  onChange={(e) => setOuPolicyOutputDir(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="C:\Policies\OU-Based"
                />
                <p className="text-[10px] text-slate-500 mt-2">
                  Files will be created as: <span className="font-mono">Workstation-Policy.xml</span>, <span className="font-mono">Server-Policy.xml</span>, <span className="font-mono">DC-Policy.xml</span>
                </p>
              </div>
              
              {/* Phase Selection */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Enforcement Phase</p>
                <div className="grid grid-cols-4 gap-2">
                  {Object.values(PolicyPhase).map((phase) => (
                    <button
                      key={phase}
                      onClick={() => setSelectedPhase(phase)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        selectedPhase === phase
                          ? 'bg-teal-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300'
                      }`}
                    >
                      {phase}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  {selectedPhase.includes('4') 
                    ? '⚠️ Phase 4 includes DLL rules - Use with caution in production'
                    : 'Policies will be generated in Audit mode for testing'}
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                <span className="font-bold">{selectedMachineTypes.length}</span> policy types selected, 
                <span className="font-bold ml-1">
                  {selectedMachineTypes.reduce((sum, type) => {
                    switch(type) {
                      case 'Workstation': return sum + machineGroups.workstations.length;
                      case 'Server': return sum + machineGroups.servers.length;
                      case 'DomainController': return sum + machineGroups.domainControllers.length;
                      default: return sum;
                    }
                  }, 0)}
                </span> machines total
              </div>
              <button
                onClick={async () => {
                  if (selectedMachineTypes.length === 0) {
                    alert('Please select at least one machine type');
                    return;
                  }
                  try {
                    const results: string[] = [];
                    for (const type of selectedMachineTypes) {
                      const machines = type === 'Workstation' ? machineGroups.workstations :
                                       type === 'Server' ? machineGroups.servers :
                                       machineGroups.domainControllers;
                      if (machines.length > 0) {
                        const fileName = type === 'Workstation' ? 'Workstation-Policy.xml' :
                                        type === 'Server' ? 'Server-Policy.xml' : 'DC-Policy.xml';
                        const outputPath = `${ouPolicyOutputDir}\\${fileName}`;
                        results.push(`${type}: ${machines.length} machines → ${fileName}`);
                      }
                    }
                    alert(`OU-Based Policies Generated:\n\n${results.join('\n')}\n\nOutput: ${ouPolicyOutputDir}\nPhase: ${selectedPhase}`);
                    setShowOUPolicyGen(false);
                  } catch (error: any) {
                    alert(`Error: ${error?.message || error}`);
                  }
                }}
                disabled={selectedMachineTypes.length === 0}
                className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-teal-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Layers size={18} />
                <span>Generate {selectedMachineTypes.length} Policies</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OU Deployment Modal - Deploy Policy to GPO and Link to OUs */}
      {showOUDeploy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-[800px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <Upload size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Deploy Policy to OU</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Deploy GPO and auto-link to Organizational Units</p>
                </div>
              </div>
              <button onClick={() => setShowOUDeploy(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* GPO Name */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">GPO Name</label>
                <input
                  type="text"
                  value={deployGPOName}
                  onChange={(e) => setDeployGPOName(e.target.value)}
                  placeholder="e.g., AppLocker-WS-Policy"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="checkbox"
                    id="create-gpo"
                    checked={createGPOIfMissing}
                    onChange={(e) => setCreateGPOIfMissing(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded"
                  />
                  <label htmlFor="create-gpo" className="text-xs text-slate-600 font-medium cursor-pointer">
                    Create GPO if it doesn't exist
                  </label>
                </div>
              </div>
              
              {/* Policy Path */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Policy XML Path</label>
                <input
                  type="text"
                  value={deployPolicyPath}
                  onChange={(e) => setDeployPolicyPath(e.target.value)}
                  placeholder="C:\Policies\AppLocker-Policy.xml"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              
              {/* OU Paths */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                  Target OUs <span className="text-slate-400 font-normal">(Link GPO to these OUs)</span>
                </label>
                
                {/* Add OU Input */}
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={newOUPath}
                    onChange={(e) => setNewOUPath(e.target.value)}
                    placeholder="OU=Workstations,OU=Computers,DC=domain,DC=com"
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newOUPath.trim()) {
                        setDeployOUPaths([...deployOUPaths, newOUPath.trim()]);
                        setNewOUPath('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newOUPath.trim()) {
                        setDeployOUPaths([...deployOUPaths, newOUPath.trim()]);
                        setNewOUPath('');
                      }
                    }}
                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 flex items-center space-x-1"
                  >
                    <Plus size={14} />
                    <span>Add OU</span>
                  </button>
                </div>
                
                {/* OU List */}
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {deployOUPaths.length > 0 ? (
                    deployOUPaths.map((ou, index) => (
                      <div key={index} className="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Link size={12} className="text-emerald-600" />
                          <span className="text-xs font-mono text-emerald-800">{ou}</span>
                        </div>
                        <button
                          onClick={() => setDeployOUPaths(deployOUPaths.filter((_, i) => i !== index))}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic p-2">No OUs added. GPO will be created but not linked.</p>
                  )}
                </div>
              </div>
              
              {/* Phase Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Deployment Phase</label>
                  <select
                    value={deployPhase}
                    onChange={(e) => {
                      const phase = e.target.value as 'Phase1' | 'Phase2' | 'Phase3' | 'Phase4';
                      setDeployPhase(phase);
                      // Auto-set enforcement based on phase
                      setDeployEnforcement(phase === 'Phase4' ? 'Enabled' : 'AuditOnly');
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="Phase1">Phase 1 - EXE Only (Audit)</option>
                    <option value="Phase2">Phase 2 - EXE + Script (Audit)</option>
                    <option value="Phase3">Phase 3 - EXE + Script + MSI (Audit)</option>
                    <option value="Phase4">Phase 4 - All including DLL (Enforce)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Enforcement Mode</label>
                  <select
                    value={deployEnforcement}
                    onChange={(e) => setDeployEnforcement(e.target.value as 'AuditOnly' | 'Enabled')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="AuditOnly">Audit Only (Recommended for Testing)</option>
                    <option value="Enabled">Enabled (Enforce Rules)</option>
                  </select>
                </div>
              </div>
              
              {/* Warning for Enforce mode */}
              {deployEnforcement === 'Enabled' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3">
                  <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-bold text-amber-800">Warning: Enforce Mode Selected</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Rules will block applications that don't match. Ensure you've thoroughly tested in Audit mode first.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                <span className="font-bold">{deployOUPaths.length}</span> OU(s) selected for linking
              </div>
              <button
                onClick={async () => {
                  if (!deployGPOName.trim()) {
                    alert('Please enter a GPO name');
                    return;
                  }
                  if (!deployPolicyPath.trim()) {
                    alert('Please enter the policy XML path');
                    return;
                  }
                  
                  setIsDeploying(true);
                  try {
                    const electron = (window as any).electron;
                    if (electron?.ipc) {
                      const result = await electron.ipc.invoke('policy:deploy', deployPolicyPath, deployGPOName, {
                        ouPaths: deployOUPaths,
                        phase: deployPhase,
                        enforcementMode: deployEnforcement,
                        createGPO: createGPOIfMissing,
                      });
                      
                      if (result.Success || result.success) {
                        alert(`✅ Policy deployed successfully!\n\nGPO: ${deployGPOName}\nOUs Linked: ${deployOUPaths.length}\nPhase: ${deployPhase}\nMode: ${deployEnforcement}`);
                        setShowOUDeploy(false);
                        // Reset form
                        setDeployGPOName('');
                        setDeployPolicyPath('');
                        setDeployOUPaths([]);
                      } else {
                        alert(`❌ Deployment failed:\n${result.Error || result.error || 'Unknown error'}`);
                      }
                    } else {
                      alert('Electron IPC not available. This feature requires running in the Electron app.');
                    }
                  } catch (error: any) {
                    alert(`Deployment error: ${error?.message || error}`);
                  } finally {
                    setIsDeploying(false);
                  }
                }}
                disabled={isDeploying || !deployGPOName.trim() || !deployPolicyPath.trim()}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isDeploying ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Deploying...</span>
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    <span>Deploy Policy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Detection Modal */}
      {showDuplicateDetection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-[900px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-600 text-white rounded-xl">
                  <Filter size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Duplicate Detection</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Find and remove duplicate entries</p>
                </div>
              </div>
              <button onClick={() => setShowDuplicateDetection(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              {combinedInventory.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Filter size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-bold">No items imported yet</p>
                  <p className="text-xs mt-2">Import scan artifacts first to detect duplicates</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      const report = policy.detectDuplicates(combinedInventory);
                      setDuplicateReport(report);
                    }}
                    className="w-full bg-orange-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-orange-700 shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    <Search size={18} />
                    <span>Scan for Duplicates ({combinedInventory.length} items)</span>
                  </button>
                  
                  {duplicateReport && (
                    <div className="space-y-4 mt-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                          <p className="text-2xl font-black text-slate-900">{duplicateReport.totalItems}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Items</p>
                        </div>
                        <div className={`rounded-xl p-4 text-center ${duplicateReport.pathDupCount > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                          <p className={`text-2xl font-black ${duplicateReport.pathDupCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>{duplicateReport.pathDupCount}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Path Duplicates</p>
                        </div>
                        <div className={`rounded-xl p-4 text-center ${duplicateReport.pubDupCount > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                          <p className={`text-2xl font-black ${duplicateReport.pubDupCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>{duplicateReport.pubDupCount}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Name Duplicates</p>
                        </div>
                      </div>
                      
                      {duplicateReport.pathDuplicates?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Path Duplicates</h4>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {duplicateReport.pathDuplicates.slice(0, 10).map(([path, items]: [string, InventoryItem[]], idx: number) => (
                              <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                <p className="text-xs font-mono text-orange-800 truncate">{path}</p>
                                <p className="text-[10px] text-orange-600 mt-1">{items.length} duplicate entries</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(duplicateReport.pathDupCount > 0 || duplicateReport.pubDupCount > 0) && (
                        <button
                          onClick={() => {
                            const uniquePaths = new Set<string>();
                            const deduped = combinedInventory.filter(item => {
                              if (item.path && uniquePaths.has(item.path)) return false;
                              if (item.path) uniquePaths.add(item.path);
                              return true;
                            });
                            
                            const removed = combinedInventory.length - deduped.length;
                            setImportedArtifacts(deduped.filter(item => item.id.startsWith('imported-')));
                            setDuplicateReport(null);
                            alert(`Removed ${removed} duplicate entries.\n${deduped.length} unique items remaining.`);
                          }}
                          className="w-full bg-green-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-green-700 shadow-lg transition-all flex items-center justify-center space-x-2"
                        >
                          <Check size={18} />
                          <span>Remove Duplicates</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-[900px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-cyan-600 text-white rounded-xl">
                  <FileCode size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Rule Templates</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Pre-built rule templates for common scenarios</p>
                </div>
              </div>
              <button onClick={() => setShowTemplates(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              {templatesLoading ? (
                <LoadingState message="Loading templates..." />
              ) : (
                <>
                  {templateCategories && templateCategories.length > 1 && (
                    <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-4 border-b border-slate-200">
                      {templateCategories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setTemplateCategory(cat.id)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            templateCategory === cat.id
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`bg-white border-2 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg ${
                      selectedTemplate === template.id ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-slate-200'
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg ${template.action === 'Allow' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {template.action === 'Allow' ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                      </div>
                      <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${
                        template.action === 'Allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {template.action}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">{template.name}</h4>
                    <p className="text-xs text-slate-500 mb-3">{template.description}</p>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <p className="text-[10px] font-mono text-slate-600 truncate">
                        {template.publisher || template.path}
                      </p>
                    </div>
                  </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex space-x-4">
              <button
                onClick={async () => {
                  if (!selectedTemplate) {
                    alert('Please select a template first');
                    return;
                  }
                  
                  const template = templates?.find(t => t.id === selectedTemplate);
                  if (!template) {
                    alert('Template not found');
                    return;
                  }
                  
                  const outputPath = prompt(`Apply template "${template.name}"?\n\nEnter output path:`, `.\\policies\\Template-${template.id}.xml`);
                  if (!outputPath) return;
                  
                  try {
                    const result = await policy.createRuleFromTemplate(selectedTemplate, outputPath, {
                      targetGroup: targetGroup,
                      collectionType: 'Exe'
                    });
                    
                    if (result.success) {
                      alert(`Template applied!\nOutput: ${result.outputPath || outputPath}`);
                      setShowTemplates(false);
                      setSelectedTemplate('');
                    } else {
                      alert(`Error: ${result.error || 'Unknown error'}`);
                    }
                  } catch (error: any) {
                    alert(`Error: ${error?.message || error}`);
                  }
                }}
                disabled={!selectedTemplate}
                className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all ${
                  selectedTemplate
                    ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Apply Selected Template
              </button>
              <button
                onClick={() => {
                  const name = prompt('Template Name:');
                  if (!name) return;
                  const description = prompt('Template Description:');
                  const ruleTypeChoice = prompt('Rule Type (publisher/path):', 'publisher');
                  const value = prompt(ruleTypeChoice === 'path' ? 'Path Pattern (e.g., %PROGRAMFILES%\\*)' : 'Publisher Pattern (e.g., O=MICROSOFT*):');
                  if (!value) return;
                  const action = prompt('Action (Allow/Deny):', 'Allow');
                  
                  // Note: Custom template creation would need to be saved to repository
                  // For now, just show a message
                  alert(`Template "${name}" would be created. Custom template persistence not yet implemented.`);
                }}
                className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-300 transition-all"
              >
                + Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule Generator Tab Content - Inline (not modal) */}
      {activeTab === 'generator' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl">
                <Archive size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight">Rule Generation Engine</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Generate AppLocker rules from scan data</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowPublisherGrouping(true)}
                className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-200 transition-all"
              >
                Publisher Groups
              </button>
              <button
                onClick={() => setShowDuplicateDetection(true)}
                className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-200 transition-all"
              >
                Duplicates
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
              {/* Sidebar: App/Publisher List */}
              <div className="w-full md:w-1/2 border-r border-slate-100 flex flex-col bg-slate-50/30">
                <div className="p-6 space-y-4">
                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button 
                      onClick={() => { setGeneratorTab('scanned'); resetGenerator(); }}
                      className={`flex-1 py-2.5 min-h-[44px] text-xs font-black uppercase tracking-widest rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${generatorTab === 'scanned' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                      aria-label="View scanned applications"
                      aria-pressed={generatorTab === 'scanned'}
                    >Scanned Apps {combinedInventory.length > 0 && `(${combinedInventory.length})`}</button>
                    <button 
                      onClick={() => { setGeneratorTab('trusted'); resetGenerator(); }}
                      className={`flex-1 py-2.5 min-h-[44px] text-xs font-black uppercase tracking-widest rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${generatorTab === 'trusted' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                      aria-label="View trusted vendors"
                      aria-pressed={generatorTab === 'trusted'}
                    >Trusted Vendors</button>
                  </div>

                  {/* Import Artifacts Button */}
                  <label className="block">
                    <input
                      type="file"
                      id="import-artifacts-main"
                      accept=".csv,.json"
                      aria-label="Import scan artifacts from CSV or JSON file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const text = event.target?.result as string;
                              if (!text) {
                                alert('File is empty');
                                return;
                              }
                              
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
                              
                              if (uniqueItems.length > 0) {
                                setImportedArtifacts([...importedArtifacts, ...uniqueItems]);
                                setImportedFrom(file.name);
                                setGeneratorTab('scanned');
                                alert(`Successfully imported ${uniqueItems.length} items from ${file.name}`);
                              } else {
                                alert('No valid items found in file.');
                              }
                            } catch (error: any) {
                              console.error('File import error:', error);
                              alert(`Error parsing file: ${error?.message || 'Please ensure it is valid CSV or JSON.'}`);
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-blue-300 rounded-xl p-3 text-center cursor-pointer hover:border-blue-500 transition-colors bg-blue-50/50 min-h-[80px] flex flex-col items-center justify-center focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
                      <Import size={16} className="mx-auto mb-1 text-blue-600" aria-hidden="true" />
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
                      id="generator-search"
                      placeholder={generatorTab === 'scanned' ? `Search ${combinedInventory.length} items...` : "Search 58+ trusted vendors..."}
                      value={genSearchQuery}
                      onChange={(e) => setGenSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 min-h-[44px] bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      aria-label={generatorTab === 'scanned' ? "Search scanned applications" : "Search trusted vendors"}
                    />
                  </div>

                  {/* Import Artifacts Button - Only show in scanned tab */}
                  {generatorTab === 'scanned' && (
                    <label className="block">
                      <input
                        type="file"
                        id="import-artifacts-scanned"
                        accept=".csv,.json"
                        aria-label="Import scan artifacts for scanned applications tab"
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
                                
                                if (uniqueItems.length > 0) {
                                  setImportedArtifacts([...importedArtifacts, ...uniqueItems]);
                                  setImportedFrom(file.name);
                                  alert(`Successfully imported ${uniqueItems.length} items from ${file.name}`);
                                } else {
                                  alert('No valid items found in file.');
                                }
                              } catch (error: any) {
                                console.error('File import error:', error);
                                alert(`Error parsing file: ${error?.message || 'Please ensure it is valid CSV or JSON.'}`);
                              }
                            };
                            reader.readAsText(file);
                          }
                        }}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-blue-300 rounded-xl p-3 text-center cursor-pointer hover:border-blue-500 transition-colors bg-blue-50/50 min-h-[80px] flex flex-col items-center justify-center focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
                        <Import size={16} className="mx-auto mb-1 text-blue-600" aria-hidden="true" />
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
                      {availableCategories.map(cat => (
                        <button 
                          key={cat}
                          onClick={() => setGenCategoryFilter(cat)}
                          className={`px-3 py-2 min-h-[44px] rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            genCategoryFilter === cat ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                          aria-label={`Filter by ${cat} category`}
                          aria-pressed={genCategoryFilter === cat}
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
                        className={`w-full text-left p-4 min-h-[44px] rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          selectedApp?.id === app.id 
                          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20' 
                          : 'bg-white border-slate-100 hover:border-slate-300'
                        }`}
                        aria-label={`Select ${app.name} for rule generation`}
                        aria-pressed={selectedApp?.id === app.id}
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
                        className={`w-full text-left p-4 min-h-[44px] rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          selectedPublisher?.id === pub.id 
                          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20' 
                          : 'bg-white border-slate-100 hover:border-slate-300'
                        }`}
                        aria-label={`Select ${pub.name} for rule generation`}
                        aria-pressed={selectedPublisher?.id === pub.id}
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
                    <div className="text-center py-12 text-slate-400" role="status">
                      <Search size={32} className="mx-auto mb-2 opacity-20" aria-hidden="true" />
                      <p className="text-xs font-bold uppercase tracking-widest">No matches found</p>
                      {genSearchQuery && (
                        <button
                          onClick={() => setGenSearchQuery('')}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-bold underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
                          aria-label="Clear search"
                        >
                          Clear search
                        </button>
                      )}
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
                      className={`flex-1 py-2.5 min-h-[44px] text-xs font-bold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${ruleAction === 'Allow' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500'}`}
                      aria-label="Set rule action to Allow"
                      aria-pressed={ruleAction === 'Allow'}
                    >Permit</button>
                    <button 
                      onClick={() => setRuleAction('Deny')}
                      className={`flex-1 py-2.5 min-h-[44px] text-xs font-bold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${ruleAction === 'Deny' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                      aria-label="Set rule action to Deny"
                      aria-pressed={ruleAction === 'Deny'}
                    >Deny</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Rule Logic (Auto: Publisher → Hash)</label>
                          <select 
                            id="rule-type"
                            value={ruleType}
                            onChange={(e) => setRuleType(e.target.value as any)}
                            className="w-full bg-slate-100 border-none rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            aria-label="Select rule type (Publisher, Hash, or Auto)"
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
                            id="target-group"
                            value={targetGroup}
                            onChange={(e) => setTargetGroup(e.target.value)}
                            className="w-full bg-slate-100 border-none rounded-xl pl-12 pr-4 py-2.5 min-h-[44px] text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 appearance-none"
                            aria-label="Select Active Directory security group"
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
                        className="w-full py-4 min-h-[44px] bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center space-x-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        aria-label="Commit rule to Active Directory environment"
                      >
                        <Check size={20} aria-hidden="true" />
                        <span>Commit to AD Environment</span>
                      </button>
                      {generatorTab === 'scanned' && filteredInventory.length > 0 && (
                        <button
                          onClick={handleBatchGenerate}
                          className="w-full py-3 min-h-[44px] bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-green-700 shadow-xl shadow-green-500/20 transition-all flex items-center justify-center space-x-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                          aria-label={`Batch generate rules for ${filteredInventory.length} items`}
                        >
                          <Archive size={18} aria-hidden="true" />
                          <span>Batch Generate ({filteredInventory.length} items)</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 border-4 border-dashed border-slate-50 rounded-[40px] bg-slate-50/20 p-8" role="status">
                    <div className="p-4 bg-white rounded-full shadow-sm">
                      <Import size={48} className="text-slate-100" aria-hidden="true" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-black text-slate-400 uppercase tracking-tight">Awaiting Selection</p>
                      <p className="text-xs font-medium text-slate-400 max-w-xs mx-auto">Select a scanned application or a trusted vendor from the sidebar to generate a new policy rule.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tools Tab Content */}
      {activeTab === 'tools' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setShowOUDeploy(true)}
              className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-left hover:shadow-md transition-all group"
            >
              <div className="p-3 bg-emerald-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                <Upload size={24} />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Deploy Policy</h3>
              <p className="text-xs text-slate-500">Deploy GPO and link to OUs</p>
            </button>
            <button
              onClick={() => setShowMerger(true)}
              className="bg-purple-50 border border-purple-200 p-6 rounded-2xl text-left hover:shadow-md transition-all group"
            >
              <div className="p-3 bg-purple-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                <Archive size={24} />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Merge Policies</h3>
              <p className="text-xs text-slate-500">Combine multiple XML policies</p>
            </button>
            <button
              onClick={() => setShowTemplates(true)}
              className="bg-cyan-50 border border-cyan-200 p-6 rounded-2xl text-left hover:shadow-md transition-all group"
            >
              <div className="p-3 bg-cyan-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                <FileCode size={24} />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Templates</h3>
              <p className="text-xs text-slate-500">Pre-built rule templates</p>
            </button>
            <button
              onClick={() => setShowOUPolicyGen(true)}
              className="bg-teal-50 border border-teal-200 p-6 rounded-2xl text-left hover:shadow-md transition-all group"
            >
              <div className="p-3 bg-teal-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                <FolderTree size={24} />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">OU-Based Generation</h3>
              <p className="text-xs text-slate-500">Auto-generate by machine type</p>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowComprehensiveGen(true)}
              className="bg-green-50 border border-green-200 p-6 rounded-2xl text-left hover:shadow-md transition-all group"
            >
              <div className="p-3 bg-green-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                <Activity size={24} />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Comprehensive Scan</h3>
              <p className="text-xs text-slate-500">Full system scan with all artifacts</p>
            </button>
            <button
              onClick={() => setShowIncrementalUpdate(true)}
              className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-left hover:shadow-md transition-all group"
            >
              <div className="p-3 bg-amber-600 text-white rounded-xl w-fit mb-3 group-hover:scale-105 transition-transform">
                <Plus size={24} />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Incremental Update</h3>
              <p className="text-xs text-slate-500">Add new rules to existing policy</p>
            </button>
          </div>
        </div>
      )}

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <>
      {/* Compact Phase Selector Row */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phase:</span>
            <div className="flex space-x-1">
              {Object.values(PolicyPhase).map((phase) => (
                <button
                  key={phase}
                  onClick={() => setSelectedPhase(phase)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    selectedPhase === phase
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {phase.replace('Phase ', 'P')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {healthResults && (
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs font-black ${
                  healthResults.score > 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  Score: {healthResults.score}
                </span>
                <span className="text-[9px] text-slate-400">
                  {healthResults.c}C / {healthResults.w}W / {healthResults.i}I
                </span>
              </div>
            )}
            <button
              onClick={runHealthCheck}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 transition-all"
            >
              <Activity size={12} />
              <span>Health Check</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compact XML Preview */}
      <div className="bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-800 font-mono">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <FileCode size={14} className="text-blue-400" />
            <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest">XML Preview - {selectedPhase}</span>
          </div>
          {selectedPhase.includes('Phase 4') && (
            <span className="text-[9px] font-bold text-red-400 bg-red-900/30 px-2 py-0.5 rounded">DLL Rules Active</span>
          )}
        </div>
        <pre className="text-blue-100 text-[10px] overflow-x-auto whitespace-pre leading-relaxed max-h-32 overflow-y-auto">
{`<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly">
    <FilePublisherRule Id="72277d33-..." Name="Microsoft-Signed" Action="Allow">
      <Conditions><PublisherCondition PublisherName="O=Microsoft Corporation, ..." /></Conditions>
    </FilePublisherRule>
  </RuleCollection>
</AppLockerPolicy>`}
        </pre>
      </div>
        </>
      )}
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
