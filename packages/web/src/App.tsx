import React, { useEffect, useState, useCallback } from 'react';
import { Run, getRun, formatRelative, type RunStatus } from './api';
import {
  getSelectedRunId,
  setSelectedRunId,
  getSelectedAgentId,
  setSelectedAgentId,
  CachedRun,
} from './lib/localStore';
import { copyToClipboard } from './lib/clipboard';
import { RunList } from './components/RunList';
import { RunLogs } from './components/RunLogs';
import { RunCreateForm } from './components/RunCreateForm';
import { StatusChip } from './components/StatusChip';
import { RunStatusChip } from './components/RunStatusChip';
import { AgentsPanel } from './components/AgentsPanel';
import { ApprovalsCard } from './components/ApprovalsCard';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

export function App() {
  const [selectedRunId, setSelectedRunIdState] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [isLoadingRun, setIsLoadingRun] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentIdState] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; paused: boolean }>(
    {
      connected: false,
      paused: false,
    },
  );
  const [runStatus, setRunStatus] = useState<RunStatus>('queued');
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Load selected run ID and agent ID from localStorage on mount
  useEffect(() => {
    const savedRunId = getSelectedRunId();
    if (savedRunId) {
      setSelectedRunIdState(savedRunId);
    }

    const savedAgentId = getSelectedAgentId();
    if (savedAgentId) {
      setSelectedAgentIdState(savedAgentId);
    }
  }, []);

  // Fetch run details when selection changes
  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null);
      return;
    }

    setIsLoadingRun(true);
    getRun(selectedRunId)
      .then((run) => {
        setSelectedRun(run);
        setRunStatus(run.status);
        setLastUpdated(Date.now());
      })
      .catch((error) => {
        console.error('Failed to load run:', error);
      })
      .finally(() => {
        setIsLoadingRun(false);
      });
  }, [selectedRunId]);

  const refreshRunStatus = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedRunId) return;

      try {
        const run = await getRun(selectedRunId, signal);
        setRunStatus(run.status);
        setLastUpdated(Date.now());
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to refresh run status:', error);
        }
        throw error;
      }
    },
    [selectedRunId],
  );

  // Poll run status every 5 seconds
  useEffect(() => {
    if (!selectedRunId) return;

    const abortController = new AbortController();
    let alive = true;

    const tick = async () => {
      if (alive && !abortController.signal.aborted) {
        try {
          await refreshRunStatus(abortController.signal);
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error('Failed to refresh run status:', error);
          }
        }
      }
    };

    // Initial fetch
    tick();

    const interval = setInterval(tick, 5000);

    return () => {
      alive = false;
      abortController.abort();
      clearInterval(interval);
    };
  }, [selectedRunId, refreshRunStatus]);

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

  const handleCopyRunId = async () => {
    if (!selectedRun) return;

    const success = await copyToClipboard(selectedRun.id);
    setCopyFeedback(success ? 'Copied!' : 'Failed to copy');

    // Clear feedback after 2 seconds
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleSelectAgent = (agentId: string | null) => {
    setSelectedAgentIdState(agentId);
    setSelectedAgentId(agentId);
  };

  const handleClearAgentFilter = () => {
    setSelectedAgentIdState(null);
    setSelectedAgentId(null);
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
            <div className="space-y-6">
              {/* Agents Panel */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <AgentsPanel selectedAgentId={selectedAgentId} onSelectAgent={handleSelectAgent} />
              </div>

              {/* Runs Panel */}
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
                    agentFilterId={selectedAgentId}
                    clearAgentFilter={handleClearAgentFilter}
                  />
                )}
              </div>
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
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-semibold font-mono" data-testid="run-id">
                            {selectedRun.id}
                          </h2>
                          <button
                            onClick={handleCopyRunId}
                            className="rounded-lg bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 border border-slate-700 transition-colors"
                            title="Copy run ID to clipboard"
                            data-testid="copy-run-id-btn"
                          >
                            Copy ID
                          </button>
                          {copyFeedback && (
                            <span className="text-xs text-emerald-400 animate-pulse">
                              {copyFeedback}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <span>Agent: {selectedRun.agentId}</span>
                          <RunStatusChip status={runStatus} />
                          <span title={new Date(lastUpdated).toISOString()}>
                            Last updated: {formatRelative(lastUpdated)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => refreshRunStatus()}
                          className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700 border border-slate-700 transition-colors"
                          title="Refresh run status"
                          data-testid="refresh-status"
                        >
                          Refresh status
                        </button>
                      </div>
                    </div>

                    {/* Approvals */}
                    <ApprovalsCard runId={selectedRun.id} />

                    {/* Logs */}
                    <RunLogs
                      runId={selectedRun.id}
                      onConnectionChange={(connected, paused) =>
                        setConnectionStatus({ connected, paused })
                      }
                    />
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

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="text-xs text-slate-400">
            API: {API_BASE} • Status: {connectionStatus.connected ? 'Connected' : 'Disconnected'}
            {connectionStatus.paused && ' • Paused'}
            {' • Agent filter: '}
            {selectedAgentId ? selectedAgentId : 'None'}
            {' • prompt2prod v0.1.0'}
          </div>
        </div>
      </footer>
    </div>
  );
}
