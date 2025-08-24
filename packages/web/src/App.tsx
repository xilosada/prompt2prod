import React, { useEffect, useState } from 'react';
import { Run } from './api';
import { getSelectedRunId, setSelectedRunId, CachedRun } from './lib/localStore';
import { RunList } from './components/RunList';
import { RunLogs } from './components/RunLogs';
import { RunCreateForm } from './components/RunCreateForm';
import { StatusChip } from './components/StatusChip';

export function App() {
  const [selectedRunId, setSelectedRunIdState] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [isLoadingRun, setIsLoadingRun] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Load selected run ID from localStorage on mount
  useEffect(() => {
    const savedRunId = getSelectedRunId();
    if (savedRunId) {
      setSelectedRunIdState(savedRunId);
    }
  }, []);

  // Fetch run details when selection changes
  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null);
      return;
    }

    setIsLoadingRun(true);
    // For now, we'll just set a placeholder run since we don't have the actual API
    // In a real implementation, you'd call getRun(selectedRunId)
    setSelectedRun({
      id: selectedRunId,
      agentId: 'demo-agent',
      repo: 'demo/repo',
      base: 'main',
      prompt: 'Hello world',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsLoadingRun(false);
  }, [selectedRunId]);

  const handleSelectRun = (runId: string) => {
    setSelectedRunIdState(runId);
    setSelectedRunId(runId);
    setShowCreateForm(false);
  };

  const handleImportRun = (run: CachedRun) => {
    handleSelectRun(run.id);
  };

  const handleRunCreated = (runId: string) => {
    handleSelectRun(runId);
    setShowCreateForm(false);
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-semibold">prompt2prod — Runs Monitor</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor and manage agent runs with live SSE logs
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Runs</h2>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-sm hover:bg-indigo-500"
                >
                  {showCreateForm ? 'Cancel' : 'New'}
                </button>
              </div>

              {showCreateForm ? (
                <RunCreateForm onRunCreated={handleRunCreated} />
              ) : (
                <RunList
                  selectedRunId={selectedRunId}
                  onSelectRun={handleSelectRun}
                  onImportRun={handleImportRun}
                />
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            {selectedRunId ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                {isLoadingRun ? (
                  <div className="text-center py-8">
                    <div className="text-slate-400">Loading run...</div>
                  </div>
                ) : selectedRun ? (
                  <div className="space-y-6">
                    {/* Run header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold font-mono">{selectedRun.id}</h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <span>Agent: {selectedRun.agentId}</span>
                          <StatusChip status={selectedRun.status} />
                        </div>
                      </div>
                    </div>

                    {/* Logs */}
                    <RunLogs runId={selectedRun.id} />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-red-400">Failed to load run</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <div className="text-center py-8">
                  <div className="text-slate-400">Select a run to view details and logs</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
