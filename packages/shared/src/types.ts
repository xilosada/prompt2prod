export type Health = { ok: true };

// Agent registry types
export type AgentStatus = 'online' | 'stale' | 'offline';

export interface AgentView {
  id: string;
  lastSeen: number; // ms since epoch
  status: AgentStatus;
  caps?: Record<string, unknown>;
}
