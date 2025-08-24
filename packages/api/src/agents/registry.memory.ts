export interface AgentView {
  id: string;
  lastSeen: number;
  status: 'online' | 'stale' | 'offline';
  caps?: Record<string, unknown>;
}

export interface AgentEntry {
  id: string;
  lastSeen: number;
  caps?: Record<string, unknown>;
}

// Status thresholds in milliseconds
export const STATUS_THRESHOLDS = {
  ONLINE_TTL: 15 * 1000, // 15 seconds
  STALE_TTL: 60 * 1000, // 60 seconds
} as const;

export function statusFrom(
  lastSeen: number,
  now: number = Date.now(),
): 'online' | 'stale' | 'offline' {
  const age = now - lastSeen;

  if (age <= STATUS_THRESHOLDS.ONLINE_TTL) {
    return 'online';
  } else if (age <= STATUS_THRESHOLDS.STALE_TTL) {
    return 'stale';
  } else {
    return 'offline';
  }
}

export function createMemoryAgentRegistry() {
  const agents = new Map<string, AgentEntry>();

  return {
    upsertHeartbeat(id: string, caps?: Record<string, unknown>): void {
      const now = Date.now();
      const existing = agents.get(id);

      agents.set(id, {
        id,
        lastSeen: now,
        caps: caps ?? existing?.caps,
      });
    },

    getAll(now: number = Date.now()): AgentView[] {
      return Array.from(agents.values()).map((agent) => ({
        id: agent.id,
        lastSeen: agent.lastSeen,
        status: statusFrom(agent.lastSeen, now),
        caps: agent.caps,
      }));
    },

    getOne(id: string, now: number = Date.now()): AgentView | undefined {
      const agent = agents.get(id);
      if (!agent) return undefined;

      return {
        id: agent.id,
        lastSeen: agent.lastSeen,
        status: statusFrom(agent.lastSeen, now),
        caps: agent.caps,
      };
    },

    // For testing purposes
    _getRawEntry(id: string): AgentEntry | undefined {
      return agents.get(id);
    },

    _clear(): void {
      agents.clear();
    },
  };
}
