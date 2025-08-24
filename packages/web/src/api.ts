const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

// Agent types
export type AgentStatus = 'online' | 'stale' | 'offline';
export type AgentView = {
  id: string;
  lastSeen: number;
  status: AgentStatus;
  caps?: Record<string, unknown>;
};

// Agent registry thresholds (optional, for future UI labels)
export interface AgentThresholds {
  onlineTtlMs: number;
  staleTtlMs: number;
  minHeartbeatIntervalMs: number;
}

export interface AgentsResponse {
  agents: AgentView[];
  thresholds: AgentThresholds;
}

export interface CreateRunRequest {
  agentId: string;
  repo: string;
  base: string;
  prompt: string;
  payload?: Record<string, unknown>;
}

export type RunStatus = 'queued' | 'running' | 'done' | 'error' | 'canceled';

export interface Run {
  id: string;
  agentId: string;
  repo: string;
  base: string;
  prompt: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
}

export async function createRun(request: CreateRunRequest): Promise<Run> {
  const response = await fetch(`${API_BASE}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to create run: ${response.statusText}`);
  }

  return response.json();
}

export async function getRun(id: string, signal?: AbortSignal): Promise<Run> {
  const response = await fetch(`${API_BASE}/runs/${encodeURIComponent(id)}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to get run: ${response.statusText}`);
  }

  return response.json();
}

export async function emitTestLog(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/runs/${encodeURIComponent(id)}/logs/test`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to emit test log: ${response.statusText}`);
  }
}

// Agent API functions
export async function getAgents(signal?: AbortSignal): Promise<AgentView[]> {
  const res = await fetch(`${API_BASE}/agents`, { signal });
  if (!res.ok) throw new Error(`getAgents failed: ${res.status}`);
  const data = await res.json();
  return data.agents;
}

export async function getAgentsWithThresholds(signal?: AbortSignal): Promise<AgentsResponse> {
  const res = await fetch(`${API_BASE}/agents`, { signal });
  if (!res.ok) throw new Error(`getAgents failed: ${res.status}`);
  return res.json();
}

export function formatRelative(msEpoch: number): string {
  const s = Math.max(0, Math.floor((Date.now() - msEpoch) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
