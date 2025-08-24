import React, { useState } from 'react';
import { CachedRun, getCachedRuns, addCachedRun } from '../lib/localStore';
import { StatusChip } from './StatusChip';

interface RunListProps {
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  onImportRun: (run: CachedRun) => void;
  agentFilterId: string | null;
  clearAgentFilter: () => void;
}

export function RunList({
  selectedRunId,
  onSelectRun,
  onImportRun,
  agentFilterId,
  clearAgentFilter,
}: RunListProps) {
  const [importId, setImportId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const cachedRuns = getCachedRuns();

  // Filter runs by agent if agentFilterId is set
  const filteredRuns = agentFilterId
    ? cachedRuns.filter((run) => run.agentId === agentFilterId)
    : cachedRuns;

  const handleImport = async () => {
    const trimmedId = importId.trim();
    if (!trimmedId) return;

    setIsImporting(true);
    setImportError(null);

    try {
      const run: CachedRun = {
        id: trimmedId,
        addedAt: new Date().toISOString(),
      };
      addCachedRun(run);
      onImportRun(run);
      setImportId('');
    } catch (error) {
      setImportError('Failed to import run. Please check the ID and try again.');
      console.error('Failed to import run:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-3">Runs</h2>

        {/* Agent filter pill */}
        {agentFilterId && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-indigo-900/20 border border-indigo-700 rounded-lg">
            <span className="text-sm text-indigo-300">Filtered by agent:</span>
            <span className="text-sm font-mono text-indigo-200">{agentFilterId}</span>
            <button
              onClick={clearAgentFilter}
              className="ml-auto text-indigo-400 hover:text-indigo-200 text-sm"
              data-testid="clear-agent-filter"
            >
              Clear
            </button>
          </div>
        )}

        {/* Import by ID */}
        <div className="space-y-2 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Import run by ID..."
              value={importId}
              onChange={(e) => setImportId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleImport}
              disabled={isImporting || !importId.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? 'Importing...' : 'Import'}
            </button>
          </div>
          {importError && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-2">
              {importError}
            </div>
          )}
        </div>
      </div>

      {/* Runs list */}
      <div className="space-y-2">
        {filteredRuns.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-slate-400 mb-2">
              {agentFilterId ? 'No runs for agent' : 'No runs yet'}
            </div>
            <div className="text-sm text-slate-500">
              {agentFilterId ? 'This agent has no runs' : 'Create a run to get started'}
            </div>
          </div>
        ) : (
          filteredRuns.map((run) => (
            <button
              key={run.id}
              onClick={() => onSelectRun(run.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedRunId === run.id
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100'
                  : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate">{run.id}</div>
                  {run.agentId && (
                    <div className="text-xs text-slate-400 truncate">Agent: {run.agentId}</div>
                  )}
                  <div className="text-xs text-slate-500">
                    {new Date(run.addedAt).toLocaleDateString()}
                  </div>
                </div>
                <StatusChip status="queued" className="ml-2 flex-shrink-0" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
