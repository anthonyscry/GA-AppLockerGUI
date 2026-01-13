
import React, { useState } from 'react';
import { ClipboardCheck, Download, ShieldCheck, HelpCircle, Loader2, FolderOpen, CheckCircle, X, FileText, Calendar, Server } from 'lucide-react';
import { useAppServices } from '../src/presentation/contexts/AppContext';
import { useAsync } from '../src/presentation/hooks/useAsync';
import { LoadingState } from './ui/LoadingState';
import { ErrorState } from './ui/ErrorState';
import { showOpenDirectoryDialog } from '../src/infrastructure/ipc/fileDialog';

const ComplianceModule: React.FC = () => {
  const { compliance } = useAppServices();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<{
    success: boolean;
    outputPath: string;
    timestamp: string;
    details?: {
      policiesIncluded: number;
      eventsIncluded: number;
      machinesScanned: number;
    }
  } | null>(null);

  // Fetch evidence status
  const { data: evidenceStatus, loading: statusLoading, error: statusError, refetch: refetchStatus } = useAsync(
    () => compliance.getEvidenceStatus()
  );

  // Fetch historical reports
  const { data: historicalReports, loading: reportsLoading, error: reportsError } = useAsync(
    () => compliance.getHistoricalReports()
  );

  const handleGenerateEvidence = async () => {
    setIsGenerating(true);
    setGenerationResult(null);
    try {
      const result = await compliance.generateEvidencePackage();

      // Handle different response formats
      const outputPath = typeof result === 'string' ? result : result?.outputPath || result?.path || 'Unknown location';
      const details = typeof result === 'object' ? result : null;

      setGenerationResult({
        success: true,
        outputPath: outputPath,
        timestamp: new Date().toLocaleString(),
        details: details ? {
          policiesIncluded: details.policiesIncluded || details.policies || 0,
          eventsIncluded: details.eventsIncluded || details.events || 0,
          machinesScanned: details.machinesScanned || details.machines || 0
        } : undefined
      });
      await refetchStatus();
    } catch (error) {
      console.error('Failed to generate evidence package:', error);
      setGenerationResult({
        success: false,
        outputPath: '',
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Show loading state if data is loading
  if (statusLoading || reportsLoading) {
    return <LoadingState message="Loading compliance data..." />;
  }

  // Show error state if there's an error
  if (statusError || reportsError) {
    return (
      <ErrorState
        title="Failed to load compliance data"
        message={statusError?.message || reportsError?.message || 'Unknown error occurred'}
        onRetry={refetchStatus}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Compliance & Audit</h2>
          <p className="text-slate-500 text-sm">Generate NIST compliance evidence packages and regulatory reports.</p>
        </div>
        <button 
          onClick={handleGenerateEvidence}
          disabled={isGenerating}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 flex items-center space-x-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Create new evidence bundle"
          aria-busy={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <ShieldCheck size={20} aria-hidden="true" />
              <span>New Evidence Bundle</span>
            </>
          )}
        </button>
      </div>

      {/* Generation Result Display */}
      {generationResult && (
        <div className={`p-4 rounded-xl border ${
          generationResult.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              {generationResult.success ? (
                <CheckCircle className="text-green-600 mt-0.5" size={20} />
              ) : (
                <X className="text-red-600 mt-0.5" size={20} />
              )}
              <div>
                <h4 className={`font-bold ${generationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {generationResult.success ? 'Evidence Package Generated Successfully' : 'Generation Failed'}
                </h4>
                {generationResult.success && (
                  <>
                    <p className="text-sm text-green-700 mt-1">
                      <span className="font-medium">Output:</span> {generationResult.outputPath}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      <span className="font-medium">Generated:</span> {generationResult.timestamp}
                    </p>
                    {generationResult.details && (
                      <div className="flex items-center space-x-4 mt-3 pt-3 border-t border-green-200">
                        <div className="flex items-center space-x-1 text-xs text-green-700">
                          <FileText size={12} />
                          <span>{generationResult.details.policiesIncluded} policies</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-green-700">
                          <Calendar size={12} />
                          <span>{generationResult.details.eventsIncluded} events</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-green-700">
                          <Server size={12} />
                          <span>{generationResult.details.machinesScanned} machines</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => setGenerationResult(null)}
              className="p-1 hover:bg-green-100 rounded text-green-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-400 font-bold uppercase tracking-widest text-xs">
              <ClipboardCheck size={16} />
              <span>Evidence Readiness</span>
            </div>
            <h3 className="text-2xl font-bold text-white">Compliance Evidence Builder</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Automate the collection of configuration XMLs, event logs, and system snapshots 
              into a signed package ready for inspector review.
            </p>
            
            <div className="space-y-3 mt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Policy Definitions</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  evidenceStatus?.policyDefinitions === 'COMPLETE' 
                    ? 'text-green-400 bg-green-400/10' 
                    : 'text-amber-400 bg-amber-400/10'
                }`}>
                  {evidenceStatus?.policyDefinitions || 'UNKNOWN'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Audit Logs (Last 30 Days)</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  evidenceStatus?.auditLogs === 'SYNCED' 
                    ? 'text-green-400 bg-green-400/10' 
                    : 'text-amber-400 bg-amber-400/10'
                }`}>
                  {evidenceStatus?.auditLogs || 'UNKNOWN'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">System Inventory Snapshots</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  evidenceStatus?.systemSnapshots === 'SYNCED' 
                    ? 'text-green-400 bg-green-400/10' 
                    : 'text-amber-400 bg-amber-400/10'
                }`}>
                  {evidenceStatus?.systemSnapshots || 'UNKNOWN'}
                </span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleGenerateEvidence}
            disabled={isGenerating}
            className="mt-8 w-full py-3 min-h-[44px] bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all flex items-center justify-center space-x-2 shadow-xl shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Export evidence package for compliance review"
            aria-busy={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <span>Export Evidence Package</span>
                <Download size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-800">Historical Reports</h4>
          <button
            className="p-2 min-w-[44px] min-h-[44px] text-slate-300 hover:text-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Help: Historical reports information"
            title="Historical reports are stored in the configured output directory"
          >
            <HelpCircle size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-6">
          {historicalReports && historicalReports.length > 0 ? (
            <div className="space-y-2">
              {historicalReports.map((report, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{report.name || `Report ${index + 1}`}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Generated: {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                      <a
                      href={report.path}
                      download
                      className="text-blue-600 font-bold text-sm hover:underline min-h-[44px] px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded inline-block"
                      aria-label={`Download ${report.name || `report ${index + 1}`}`}
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-slate-400 text-sm mb-4">No historical reports found in the current output directory.</p>
              <button 
                onClick={async () => {
                  const dirPath = await showOpenDirectoryDialog({
                    title: 'Select Compliance Reports Directory',
                    defaultPath: 'C:\\Compliance'
                  });
                  if (dirPath) {
                    alert(`Selected directory: ${dirPath}\n\nHistorical reports will be loaded from this location.`);
                    // Refresh reports after directory selection
                    window.location.reload();
                  }
                }}
                className="flex items-center space-x-2 text-blue-600 font-bold text-sm hover:underline min-h-[44px] px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                aria-label="Browse repository for historical reports"
              >
                <FolderOpen size={16} aria-hidden="true" />
                <span>Browse Repository</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceModule;
