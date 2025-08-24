import React, { useEffect, useState } from 'react';
import { getAgents, formatRelative, type AgentView } from '../api';
import { StatusChip } from './StatusChip';

type AgentsPanelProps = {
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
};

export function AgentsPanel({ selectedAgentId, onSelectAgent }: AgentsPanelProps) {
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const agentsData = await getAgents();
      setAgents(agentsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      console.error('Failed to fetch agents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchAgents();
  }, []);

  // Poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAgentClick = (agentId: string) => {
    if (selectedAgentId === agentId) {
      onSelectAgent(null); // Deselect if already selected
    } else {
      onSelectAgent(agentId);
    }
  };

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
        {agents.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-slate-400 mb-1">No agents</div>
            <div className="text-xs text-slate-500">Is any agent heartbeating?</div>
          </div>
        ) : (
          <ul className="space-y-2">
            {agents.map((agent) => (
              <li key={agent.id}>
                <button
                  onClick={() => handleAgentClick(agent.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedAgentId === agent.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100'
                      : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
                  }`}
                  data-testid={`agent-item-${agent.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm truncate">{agent.id}</div>
                      <div className="text-xs text-slate-400">{formatRelative(agent.lastSeen)}</div>
                    </div>
                    <StatusChip
                      status={agent.status}
                      className="ml-2 flex-shrink-0"
                      data-testid={`agent-status-${agent.id}`}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
