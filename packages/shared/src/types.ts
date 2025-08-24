export type Health = { ok: true };

// Run status types
export type RunStatus = 'queued' | 'running' | 'done' | 'error' | 'canceled';

// Agent registry types
export type AgentStatus = 'online' | 'stale' | 'offline';

export interface AgentView {
  id: string;
  lastSeen: number; // ms since epoch
  status: AgentStatus;
  caps?: Record<string, unknown>;
}

// Task types
export type TaskState =
  | 'planned'
  | 'running'
  | 'awaiting-approvals'
  | 'done'
  | 'error'
  | 'canceled';

export type Task = {
  id: string;
  title: string;
  goal: string;
  targetRepo: string;
  agents: string[];
  policy?: Record<string, unknown>;
  state: TaskState; // initial: 'planned'
  createdAt: string; // ISO
  updatedAt: string; // ISO
  pr?: { url?: string; number?: number; branch?: string }; // reserved for later
  error?: string; // reserved for later
};
