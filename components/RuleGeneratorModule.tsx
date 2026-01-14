/**
 * Rule Generator Module
 * Provides dedicated access to the Rule Generator from the sidebar.
 * This is a thin wrapper that loads PolicyModule with the generator tab active.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { PolicyPhase, InventoryItem, TrustedPublisher, MachineScan, MachineType, getMachineTypeFromOU, groupMachinesByOU, MachinesByType } from '../src/shared/types';
import {
  Archive,
  Search,
  Filter,
  CheckCircle,
  Check,
  X,
  Import,
  ChevronDown,
  Wand2,
  Info,
  AlertCircle
} from 'lucide-react';
import { APPLOCKER_GROUPS, COMMON_PUBLISHERS } from '../constants';
import { useAppServices } from '../src/presentation/contexts/AppContext';
import { useAsync } from '../src/presentation/hooks/useAsync';
import { LoadingState } from './ui/LoadingState';

const RuleGeneratorModule: React.FC = () => {
  const { policy, machine } = useAppServices();

  // Generator State
  const [generatorTab, setGeneratorTab] = useState<'scanned' | 'trusted'>('trusted');
  const [selectedApp, setSelectedApp] = useState<InventoryItem | null>(null);
  const [selectedPublisher, setSelectedPublisher] = useState<TrustedPublisher | null>(null);
  const [ruleAction, setRuleAction] = useState<'Allow' | 'Deny'>('Allow');
  const [targetGroup, setTargetGroup] = useState(APPLOCKER_GROUPS[0]);
  const [ruleType, setRuleType] = useState<'Publisher' | 'Path' | 'Hash'>('Publisher');
  const [genSearchQuery, setGenSearchQuery] = useState('');
  const [genCategoryFilter, setGenCategoryFilter] = useState('All');
  const [importedArtifacts, setImportedArtifacts] = useState<InventoryItem[]>([]);
  const [importedFrom, setImportedFrom] = useState<string>('');

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch inventory
  const { data: inventory, loading: inventoryLoading, refetch: refetchInventory } = useAsync(
    () => policy.getInventory()
  );

  // Fetch trusted publishers from Windows certificate store (merged with COMMON_PUBLISHERS)
  const { data: trustedPublishers, loading: publishersLoading } = useAsync(
    () => policy.getTrustedPublishers()
  );

  // Combined inventory: scanned + imported artifacts
  const combinedInventory = useMemo(() => {
    const scanned: InventoryItem[] = inventory || [];
    return [...scanned, ...importedArtifacts];
  }, [inventory, importedArtifacts]);

  // Merge COMMON_PUBLISHERS with certificate store publishers
  const allPublishers = useMemo(() => {
    const base = [...COMMON_PUBLISHERS];
    if (trustedPublishers && trustedPublishers.length > 0) {
      trustedPublishers.forEach(certPub => {
        const exists = base.some(p =>
          (p.name || '').toLowerCase() === (certPub.name || '').toLowerCase() ||
          (p.publisherName || '').toLowerCase().includes((certPub.name || '').toLowerCase())
        );
        if (!exists && certPub.name) {
          base.push({
            ...certPub,
            category: certPub.category || 'Installed',
            description: certPub.description || `Trusted certificate: ${certPub.name}`
          });
        }
      });
    }
    return base;
  }, [trustedPublishers]);

  // Get unique categories for the dropdown
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allPublishers.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return ['All', ...Array.from(cats).sort()];
  }, [allPublishers]);

  // Filter publishers by category and search
  const filteredPublishers = useMemo(() => {
    return allPublishers.filter(p => {
      const matchesCategory = genCategoryFilter === 'All' || p.category === genCategoryFilter;
      const matchesSearch = !genSearchQuery ||
        (p.name || '').toLowerCase().includes(genSearchQuery.toLowerCase()) ||
        (p.publisherName || '').toLowerCase().includes(genSearchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allPublishers, genCategoryFilter, genSearchQuery]);

  // Filter inventory by search
  const filteredInventory = useMemo(() => {
    if (!genSearchQuery) return combinedInventory;
    const query = genSearchQuery.toLowerCase();
    return combinedInventory.filter((item: InventoryItem) =>
      (item.name?.toLowerCase() || '').includes(query) ||
      (item.publisher?.toLowerCase() || '').includes(query) ||
      (item.path?.toLowerCase() || '').includes(query)
    );
  }, [combinedInventory, genSearchQuery]);

  const resetGenerator = () => {
    setSelectedApp(null);
    setSelectedPublisher(null);
    setGenSearchQuery('');
  };

  const handleGenerateRule = async () => {
    if (!selectedApp && !selectedPublisher) {
      setToastMessage({ type: 'warning', message: 'Please select an application or publisher first.' });
      return;
    }

    try {
      // Prepare rule parameters
      const ruleConfig = {
        type: ruleType,
        action: ruleAction,
        targetGroup,
        ...(selectedApp ? {
          name: selectedApp.name,
          publisher: selectedApp.publisher,
          path: selectedApp.path,
          version: selectedApp.version
        } : {
          name: selectedPublisher!.name,
          publisher: selectedPublisher!.publisherName
        })
      };

      await policy.createRule(ruleConfig);
      setToastMessage({ type: 'success', message: `Rule created successfully for ${selectedApp?.name || selectedPublisher?.name}` });
      resetGenerator();
    } catch (error) {
      console.error('Failed to create rule:', error);
      setToastMessage({ type: 'error', message: `Failed to create rule: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  if (inventoryLoading && publishersLoading) {
    return <LoadingState message="Loading Rule Generator..." />;
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500 pb-8">
      {/* Toast notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-in slide-in-from-right ${
          toastMessage.type === 'success' ? 'bg-green-600 text-white' :
          toastMessage.type === 'error' ? 'bg-red-600 text-white' :
          'bg-yellow-500 text-white'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle size={16} /> :
           toastMessage.type === 'error' ? <AlertCircle size={16} /> :
           <Info size={16} />}
          <span className="text-xs font-medium">{toastMessage.message}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-white/20 rounded">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center space-x-2">
            <Wand2 size={24} className="text-blue-600" />
            <span>Rule Generator</span>
          </h2>
          <p className="text-slate-500 text-xs font-medium">Create AppLocker rules from scan data or trusted vendors</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl">
              <Archive size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight">Rule Generation Engine</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Generate AppLocker rules from scan data or trusted publishers</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row" style={{ minHeight: '500px' }}>
          {/* Left Panel: App/Publisher List */}
          <div className="w-full lg:w-1/2 border-r border-slate-100 flex flex-col bg-slate-50/30">
            <div className="p-4 space-y-3">
              {/* Tab Toggle */}
              <div className="flex p-0.5 bg-slate-100 rounded-lg">
                <button
                  onClick={() => { setGeneratorTab('scanned'); resetGenerator(); }}
                  className={`flex-1 py-2 min-h-[36px] text-xs font-black uppercase tracking-wide rounded-md transition-all ${generatorTab === 'scanned' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Scanned {combinedInventory.length > 0 && `(${combinedInventory.length})`}
                </button>
                <button
                  onClick={() => { setGeneratorTab('trusted'); resetGenerator(); }}
                  className={`flex-1 py-2 min-h-[36px] text-xs font-black uppercase tracking-wide rounded-md transition-all ${generatorTab === 'trusted' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Vendors ({allPublishers.length})
                </button>
              </div>

              {/* Import Artifacts (scanned tab only) */}
              {generatorTab === 'scanned' && (
                <label className="block">
                  <input
                    type="file"
                    accept=".csv,.json"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;

                      let allItems: InventoryItem[] = [];
                      const fileNames: string[] = [];

                      /**
                       * Parse CSV line handling quoted fields properly
                       * Handles: "field,with,commas", "field""with""quotes", regular,fields
                       */
                      const parseCSVLine = (line: string): string[] => {
                        const result: string[] = [];
                        let current = '';
                        let inQuotes = false;

                        for (let i = 0; i < line.length; i++) {
                          const char = line[i];
                          const nextChar = line[i + 1];

                          if (inQuotes) {
                            if (char === '"' && nextChar === '"') {
                              // Escaped quote
                              current += '"';
                              i++;
                            } else if (char === '"') {
                              // End of quoted field
                              inQuotes = false;
                            } else {
                              current += char;
                            }
                          } else {
                            if (char === '"') {
                              inQuotes = true;
                            } else if (char === ',') {
                              result.push(current.trim());
                              current = '';
                            } else {
                              current += char;
                            }
                          }
                        }
                        result.push(current.trim());
                        return result;
                      };

                      const parseFile = (text: string, fileName: string, baseOffset: number): InventoryItem[] => {
                        const baseId = Date.now() + baseOffset * 10000;
                        let items: InventoryItem[] = [];

                        // Validate file has content
                        if (!text || !text.trim()) {
                          console.warn(`Empty file: ${fileName}`);
                          return [];
                        }

                        if (fileName.toLowerCase().endsWith('.json')) {
                          try {
                            const data = JSON.parse(text);
                            if (data.Executables && Array.isArray(data.Executables)) {
                              items = data.Executables.map((exe: any, index: number) => ({
                                id: `imported-${baseId}-${index}`,
                                name: exe.Name || exe.name || 'Unknown',
                                publisher: exe.Publisher || exe.publisher || 'Unknown',
                                path: exe.Path || exe.path || '',
                                version: exe.Version || exe.version || '',
                                type: (exe.Type || exe.type || 'EXE') as InventoryItem['type']
                              }));
                            } else if (Array.isArray(data)) {
                              items = data.map((item: any, index: number) => ({
                                id: `imported-${baseId}-${index}`,
                                name: item.Name || item.name || 'Unknown',
                                publisher: item.Publisher || item.publisher || 'Unknown',
                                path: item.Path || item.path || '',
                                version: item.Version || item.version || '',
                                type: (item.Type || item.type || 'EXE') as InventoryItem['type']
                              }));
                            }
                          } catch (jsonErr) {
                            console.error(`Invalid JSON in ${fileName}:`, jsonErr);
                            return [];
                          }
                        } else if (fileName.toLowerCase().endsWith('.csv')) {
                          const lines = text.split('\n').filter(l => l.trim());

                          // Need at least header + 1 data row
                          if (lines.length < 2) {
                            console.warn(`CSV file ${fileName} has no data rows`);
                            return [];
                          }

                          const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());

                          items = lines.slice(1).map((line, index) => {
                            const values = parseCSVLine(line);
                            const getField = (name: string, fallbackIdx: number): string => {
                              const idx = headers.indexOf(name);
                              return (idx >= 0 ? values[idx] : values[fallbackIdx]) || '';
                            };

                            return {
                              id: `imported-${baseId}-${index}`,
                              name: getField('name', 0) || 'Unknown',
                              publisher: getField('publisher', 1) || 'Unknown',
                              path: getField('path', 2),
                              version: getField('version', 3),
                              type: (getField('type', 4) || 'EXE') as InventoryItem['type']
                            };
                          }).filter(item => item.name !== 'Unknown' || item.path);
                        } else {
                          console.warn(`Unsupported file type: ${fileName}`);
                          return [];
                        }
                        return items;
                      };

                      const processFiles = async () => {
                        let offset = 0;
                        for (const file of files) {
                          try {
                            const text = await file.text();
                            if (text) {
                              const items = parseFile(text, file.name, offset);
                              allItems = [...allItems, ...items];
                              fileNames.push(file.name);
                            }
                          } catch (error) {
                            console.error(`Error parsing ${file.name}:`, error);
                          }
                          offset++;
                        }

                        const uniqueItems = allItems.filter((item, index, self) =>
                          index === self.findIndex(t => t.path === item.path && t.path !== '')
                        );

                        if (uniqueItems.length > 0) {
                          setImportedArtifacts(prev => [...prev, ...uniqueItems]);
                          setImportedFrom(fileNames.length > 1 ? `${fileNames.length} files` : fileNames[0]);
                          setToastMessage({ type: 'success', message: `Imported ${uniqueItems.length} items from ${fileNames.length} file(s)` });
                        }
                      };

                      processFiles().catch(err => {
                        console.error('Failed to process files:', err);
                        setToastMessage({ type: 'error', message: `Failed to import files: ${err instanceof Error ? err.message : 'Unknown error'}` });
                      });
                    }}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-blue-300 rounded-xl p-3 text-center cursor-pointer hover:border-blue-500 transition-colors bg-blue-50/50">
                    <Import size={16} className="mx-auto mb-1 text-blue-600" />
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Import Scan Artifacts</p>
                    <p className="text-[9px] text-blue-500">CSV, JSON (multiple files)</p>
                  </div>
                </label>
              )}

              {importedArtifacts.length > 0 && generatorTab === 'scanned' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 flex items-center justify-between">
                  <span className="text-[10px] font-black text-blue-900 uppercase">
                    {importedArtifacts.length} imported from {importedFrom}
                  </span>
                  <button
                    onClick={() => { setImportedArtifacts([]); setImportedFrom(''); }}
                    className="text-[9px] text-blue-600 hover:text-blue-800"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder={generatorTab === 'scanned' ? 'Search scanned items...' : 'Search vendors...'}
                  value={genSearchQuery}
                  onChange={(e) => setGenSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category Dropdown (vendors tab only) */}
              {generatorTab === 'trusted' && (
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <select
                    value={genCategoryFilter}
                    onChange={(e) => setGenCategoryFilter(e.target.value)}
                    className="w-full appearance-none pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium cursor-pointer outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 max-h-[400px] custom-scrollbar">
              {generatorTab === 'scanned' ? (
                filteredInventory.length > 0 ? (
                  filteredInventory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setSelectedApp(item); setSelectedPublisher(null); }}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedApp?.id === item.id
                          ? 'bg-blue-50 border-blue-300 shadow-sm'
                          : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{item.publisher}</p>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Info size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No scanned items. Import artifacts or run a scan.</p>
                  </div>
                )
              ) : (
                filteredPublishers.map((pub) => (
                  <button
                    key={pub.id}
                    onClick={() => { setSelectedPublisher(pub); setSelectedApp(null); }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedPublisher?.id === pub.id
                        ? 'bg-blue-50 border-blue-300 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900 truncate">{pub.name}</p>
                      <span className="text-[8px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{pub.category}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 truncate mt-0.5">{pub.description}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Rule Configuration */}
          <div className="w-full lg:w-1/2 p-6 space-y-4 bg-white">
            <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center space-x-2">
              <CheckCircle size={16} className="text-green-600" />
              <span>Rule Configuration</span>
            </h4>

            {(selectedApp || selectedPublisher) ? (
              <>
                {/* Selected Item Info */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Selected</p>
                  <p className="text-sm font-bold text-slate-900">{selectedApp?.name || selectedPublisher?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{selectedApp?.publisher || selectedPublisher?.publisherName}</p>
                </div>

                {/* Rule Type */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Rule Type</label>
                  <div className="flex space-x-2">
                    {(['Publisher', 'Path', 'Hash'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setRuleType(type)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                          ruleType === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Action</label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setRuleAction('Allow')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                        ruleAction === 'Allow' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Check size={14} />
                      <span>Allow</span>
                    </button>
                    <button
                      onClick={() => setRuleAction('Deny')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                        ruleAction === 'Deny' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <X size={14} />
                      <span>Deny</span>
                    </button>
                  </div>
                </div>

                {/* Target Group */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Target Group</label>
                  <select
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {APPLOCKER_GROUPS.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerateRule}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                >
                  Generate Rule
                </button>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 space-y-3 py-12">
                <Wand2 size={48} className="opacity-30" />
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-400">Select an item</p>
                  <p className="text-xs text-slate-400">Choose an application or vendor from the list to configure a rule</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleGeneratorModule;
