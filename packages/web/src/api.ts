const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

export interface CreateRunRequest {
  agentId: string;
  repo: string;
  base: string;
  prompt: string;
  payload?: Record<string, unknown>;
}

export interface Run {
  id: string;
  agentId: string;
  repo: string;
  base: string;
  prompt: string;
  status: 'queued' | 'dispatched' | 'running' | 'done' | 'error' | 'canceled';
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

export async function getRun(id: string): Promise<Run> {
  const response = await fetch(`${API_BASE}/runs/${encodeURIComponent(id)}`);

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
