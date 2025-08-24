import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  getAgents,
  getAgentsWithThresholds,
  formatRelative,
  type AgentView,
  type AgentThresholds,
} from '../api';
import { StatusChip } from './StatusChip';

type AgentsPanelProps = {
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  useThresholds?: boolean; // Optional: use thresholds for more precise labels
};

// Normalize agent ID for safe use in data-testid attributes
function normalizeTestId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '-');
}

export function AgentsPanel({
  selectedAgentId,
  onSelectAgent,
  useThresholds = false,
}: AgentsPanelProps) {
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [thresholds, setThresholds] = useState<AgentThresholds | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const abortController = useRef<AbortController | null>(null);

  const fetchAgents = async () => {
    if (!alive.current) return;

    setIsLoading(true);
    setError(null);

    // Cancel any ongoing request
    if (abortController.current) {
      abortController.current.abort();
    }

    // Create new abort controller for this request
    abortController.current = new AbortController();

    try {
      if (useThresholds) {
        const response = await getAgentsWithThresholds(abortController.current.signal);
        if (!alive.current) return;
        setAgents(response.agents);
        setThresholds(response.thresholds);
      } else {
        const agentsData = await getAgents(abortController.current.signal);
        if (!alive.current) return;
        setAgents(agentsData);
      }
    } catch (err) {
      if (!alive.current) return;

      // Don't set error for aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      console.error('Failed to fetch agents:', err);
    } finally {
      if (!alive.current) return;
      setIsLoading(false);
    }
  };

  // Initial fetch and polling setup
  useEffect(() => {
    alive.current = true;

    const interval = setInterval(fetchAgents, 10000);
    fetchAgents(); // Initial fetch

    return () => {
      alive.current = false;
      clearInterval(interval);
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [useThresholds]); // Re-run if useThresholds changes

  const handleAgentClick = (agentId: string) => {
    if (selectedAgentId === agentId) {
      onSelectAgent(null); // Deselect if already selected
    } else {
      onSelectAgent(agentId);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, agentId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleAgentClick(agentId);
    }
  };

  // Memoize sorted agents to avoid re-sorting on every render
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const statusOrder = { online: 0, stale: 1, offline: 2 };
      const aOrder = statusOrder[a.status];
      const bOrder = statusOrder[b.status];

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return b.lastSeen - a.lastSeen; // desc
    });
  }, [agents]);

  // Memoize agent items to prevent unnecessary re-renders
  const agentItems = useMemo(() => {
    return sortedAgents.map((agent) => {
      const isSelected = selectedAgentId === agent.id;
      const normalizedTestId = normalizeTestId(agent.id);

      return (
        <li key={agent.id}>
          <button
            onClick={() => handleAgentClick(agent.id)}
            onKeyDown={(e) => handleKeyDown(e, agent.id)}
            role="button"
            aria-pressed={isSelected}
            tabIndex={0}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              isSelected
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
            }`}
            data-testid={`agent-item-${normalizedTestId}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm truncate">{agent.id}</div>
                <div
                  className="text-xs text-slate-400"
                  title={new Date(agent.lastSeen).toISOString()}
                >
                  {formatRelative(agent.lastSeen)}
                </div>
              </div>
              <StatusChip
                status={agent.status}
                className="ml-2 flex-shrink-0"
                data-testid={`agent-status-${normalizedTestId}`}
              />
            </div>
          </button>
        </li>
      );
    });
  }, [sortedAgents, selectedAgentId]);

  return (
    <div className="space-y-4" data-testid="agents-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agents</h2>
        <button
          onClick={fetchAgents}
          disabled={isLoading}
          className="rounded-lg bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="agents-refresh"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-2">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {sortedAgents.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-slate-400 mb-1">No agents</div>
            <div className="text-xs text-slate-500">Is any agent heartbeating?</div>
          </div>
        ) : (
          <ul className="space-y-2" role="listbox">
            {agentItems}
          </ul>
        )}
      </div>
    </div>
  );
}
