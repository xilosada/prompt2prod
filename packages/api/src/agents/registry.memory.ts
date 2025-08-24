import type { AgentView, AgentStatus } from '@prompt2prod/shared';

export type { AgentView, AgentStatus };

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

export function statusFrom(lastSeen: number, now: number = Date.now()): AgentStatus {
  const age = now - lastSeen;

  // Deterministic boundaries:
  // online: age <= ONLINE_TTL (inclusive)
  // stale: ONLINE_TTL < age <= STALE_TTL (exclusive lower, inclusive upper)
  // offline: age > STALE_TTL (exclusive)
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

  // Caps size limit to prevent memory issues
  const MAX_CAPS_SIZE = 32 * 1024; // 32KB

  return {
    upsertHeartbeat(id: string, caps?: Record<string, unknown>): void {
      const now = Date.now();
      const existing = agents.get(id);

      // Validate caps size if provided
      let validatedCaps = caps ?? existing?.caps;
      if (caps && typeof caps === 'object') {
        try {
          const capsSize = JSON.stringify(caps).length;
          if (capsSize > MAX_CAPS_SIZE) {
            // Log warning and drop caps to prevent memory issues
            console.warn(`Agent ${id} caps too large (${capsSize} bytes), dropping`);
            validatedCaps = existing?.caps; // Keep existing caps or undefined
          }
        } catch {
          // If serialization fails, drop caps
          validatedCaps = existing?.caps;
        }
      }

      agents.set(id, {
        id,
        lastSeen: now,
        caps: validatedCaps,
      });
    },

    getAll(now: number = Date.now()): AgentView[] {
      return Array.from(agents.values())
        .map((agent) => ({
          id: agent.id,
          lastSeen: agent.lastSeen,
          status: statusFrom(agent.lastSeen, now),
          caps: agent.caps,
        }))
        .sort((a, b) => b.lastSeen - a.lastSeen); // Sort by lastSeen desc (most recent first)
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
