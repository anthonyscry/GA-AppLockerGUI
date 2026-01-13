import React, { useState, useMemo } from 'react';
import { 
  GitCompare, 
  Upload, 
  Download, 
  FileText, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Loader2
} from 'lucide-react';
import { InventoryItem } from '../src/shared/types';

interface ComparisonResult {
  onlyInA: InventoryItem[];
  onlyInB: InventoryItem[];
  inBoth: InventoryItem[];
  differences: Array<{
    item: InventoryItem;
    field: string;
    valueA: string;
    valueB: string;
  }>;
}

const SoftwareComparisonModule: React.FC = () => {
  const [inventoryA, setInventoryA] = useState<InventoryItem[]>([]);
  const [inventoryB, setInventoryB] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'onlyA' | 'onlyB' | 'both' | 'diff'>('all');
  const [loading, setLoading] = useState(false);

  const comparison = useMemo<ComparisonResult>(() => {
    if (inventoryA.length === 0 && inventoryB.length === 0) {
      return { onlyInA: [], onlyInB: [], inBoth: [], differences: [] };
    }

    const mapA = new Map(inventoryA.map(item => [item.path, item]));
    const mapB = new Map(inventoryB.map(item => [item.path, item]));

    const onlyInA: InventoryItem[] = [];
    const onlyInB: InventoryItem[] = [];
    const inBoth: InventoryItem[] = [];
    const differences: ComparisonResult['differences'] = [];

    // Find items only in A
    for (const item of inventoryA) {
      if (!mapB.has(item.path)) {
        onlyInA.push(item);
      }
    }

    // Find items only in B
    for (const item of inventoryB) {
      if (!mapA.has(item.path)) {
        onlyInB.push(item);
      }
    }

    // Find items in both and check for differences
    for (const itemA of inventoryA) {
      const itemB = mapB.get(itemA.path);
      if (itemB) {
        inBoth.push(itemA);
        
        // Check for differences
        if (itemA.name !== itemB.name) {
          differences.push({ item: itemA, field: 'name', valueA: itemA.name, valueB: itemB.name });
        }
        if (itemA.version !== itemB.version) {
          differences.push({ item: itemA, field: 'version', valueA: itemA.version, valueB: itemB.version });
        }
        if (itemA.publisher !== itemB.publisher) {
          differences.push({ item: itemA, field: 'publisher', valueA: itemA.publisher, valueB: itemB.publisher });
        }
      }
    }

    return { onlyInA, onlyInB, inBoth, differences };
  }, [inventoryA, inventoryB]);

  const filteredResults = useMemo(() => {
    let items: InventoryItem[] = [];
    
    switch (filterType) {
      case 'onlyA':
        items = comparison.onlyInA;
        break;
      case 'onlyB':
        items = comparison.onlyInB;
        break;
      case 'both':
        items = comparison.inBoth;
        break;
      case 'diff':
        items = comparison.differences.map(d => d.item);
        break;
      default:
        items = [...comparison.onlyInA, ...comparison.onlyInB, ...comparison.inBoth];
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        (item.name?.toLowerCase() || '').includes(query) ||
        (item.publisher?.toLowerCase() || '').includes(query) ||
        (item.path?.toLowerCase() || '').includes(query)
      );
    }

    return items;
  }, [comparison, filterType, searchQuery]);

  const handleFileUpload = (file: File, setInventory: (items: InventoryItem[]) => void) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        
        const items: InventoryItem[] = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim());
          return {
            id: `item-${index}`,
            name: values[headers.indexOf('Name')] || values[0] || 'Unknown',
            publisher: values[headers.indexOf('Publisher')] || values[1] || 'Unknown',
            path: values[headers.indexOf('Path')] || values[2] || '',
            version: values[headers.indexOf('Version')] || values[3] || '',
            type: (values[headers.indexOf('Type')] || values[4] || 'EXE') as InventoryItem['type']
          };
        });
        
        setInventory(items);
      } catch (error) {
        alert('Error parsing file. Please ensure it is a valid CSV.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const exportComparison = () => {
    const csv = [
      'Type,Name,Publisher,Path,Version,Status',
      ...comparison.onlyInA.map(item => `Only in A,${item.name},${item.publisher},${item.path},${item.version},Missing in B`),
      ...comparison.onlyInB.map(item => `Only in B,${item.name},${item.publisher},${item.path},${item.version},Missing in A`),
      ...comparison.differences.map(d => `Difference,${d.item.name},${d.item.publisher},${d.item.path},${d.item.version},${d.field}: ${d.valueA} vs ${d.valueB}`),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Software Inventory Comparison</h2>
          <p className="text-slate-500 text-sm">Compare software inventories from different scans or time periods.</p>
        </div>
        {(inventoryA.length > 0 || inventoryB.length > 0) && (
          <button
            onClick={exportComparison}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Export comparison results to CSV"
          >
            <Download size={18} aria-hidden="true" />
            <span>Export Comparison</span>
          </button>
        )}
      </div>

      {/* File Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-600 text-white rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">Inventory A</h3>
              <p className="text-[10px] text-slate-500 font-bold">{inventoryA.length} items</p>
            </div>
          </div>
          <label className="block">
            <input
              type="file"
              accept=".csv,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, setInventoryA);
              }}
              className="hidden"
            />
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 transition-colors min-h-[120px] flex flex-col items-center justify-center focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
              <Upload size={32} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-600">Click to upload CSV/JSON</p>
              <p className="text-xs text-slate-400 mt-1">or drag and drop</p>
            </div>
          </label>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-600 text-white rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">Inventory B</h3>
              <p className="text-[10px] text-slate-500 font-bold">{inventoryB.length} items</p>
            </div>
          </div>
          <label className="block">
            <input
              type="file"
              accept=".csv,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, setInventoryB);
              }}
              className="hidden"
            />
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-green-500 transition-colors min-h-[120px] flex flex-col items-center justify-center focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2">
              <Upload size={32} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-600">Click to upload CSV/JSON</p>
              <p className="text-xs text-slate-400 mt-1">or drag and drop</p>
            </div>
          </label>
        </div>
      </div>

      {/* Comparison Statistics */}
      {(inventoryA.length > 0 || inventoryB.length > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center space-x-2 mb-2">
              <XCircle size={20} className="text-red-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Only in A</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{comparison.onlyInA.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center space-x-2 mb-2">
              <XCircle size={20} className="text-orange-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Only in B</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{comparison.onlyInB.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle2 size={20} className="text-green-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">In Both</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{comparison.inBoth.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle size={20} className="text-yellow-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Differences</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{comparison.differences.length}</p>
          </div>
        </div>
      )}

      {/* Results Table */}
      {(inventoryA.length > 0 || inventoryB.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">Comparison Results</h3>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  id="comparison-search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Search comparison results"
                />
              </div>
              <select
                id="comparison-filter"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Filter comparison results"
              >
                <option value="all">All Items</option>
                <option value="onlyA">Only in A</option>
                <option value="onlyB">Only in B</option>
                <option value="both">In Both</option>
                <option value="diff">Differences</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Publisher</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Path</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Version</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((item, index) => {
                  const status = comparison.onlyInA.includes(item) ? 'onlyA' :
                                comparison.onlyInB.includes(item) ? 'onlyB' :
                                comparison.differences.some(d => d.item.path === item.path) ? 'diff' : 'both';
                  
                  return (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {status === 'onlyA' && <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-[10px] font-black uppercase">Only A</span>}
                        {status === 'onlyB' && <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded text-[10px] font-black uppercase">Only B</span>}
                        {status === 'both' && <span className="px-2 py-1 bg-green-100 text-green-600 rounded text-[10px] font-black uppercase">Both</span>}
                        {status === 'diff' && <span className="px-2 py-1 bg-yellow-100 text-yellow-600 rounded text-[10px] font-black uppercase">Diff</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.publisher}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{item.path}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.version}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoftwareComparisonModule;
