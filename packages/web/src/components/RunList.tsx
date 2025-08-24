import React, { useState } from 'react';
import { CachedRun, getCachedRuns, addCachedRun } from '../lib/localStore';
import { StatusChip } from './StatusChip';

interface RunListProps {
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  onImportRun: (run: CachedRun) => void;
}

export function RunList({ selectedRunId, onSelectRun, onImportRun }: RunListProps) {
  const [importId, setImportId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const cachedRuns = getCachedRuns();

  const handleImport = async () => {
    if (!importId.trim()) return;

    setIsImporting(true);
    try {
      const run: CachedRun = {
        id: importId.trim(),
        addedAt: new Date().toISOString(),
      };
      addCachedRun(run);
      onImportRun(run);
      setImportId('');
    } catch (error) {
      console.error('Failed to import run:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-3">Runs</h2>

        {/* Import by ID */}
        <div className="flex gap-2 mb-4">
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
      </div>

      {/* Runs list */}
      <div className="space-y-2">
        {cachedRuns.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No runs yet. Create a run or import one by ID.
          </p>
        ) : (
          cachedRuns.map((run) => (
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
