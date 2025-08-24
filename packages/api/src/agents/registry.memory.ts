import type { AgentView, AgentStatus } from '@prompt2prod/shared';

export type { AgentView, AgentStatus };

export interface AgentEntry {
  id: string;
  lastSeen: number;
  caps?: Record<string, unknown>;
}

// Status thresholds in milliseconds - configurable via environment
export const STATUS_THRESHOLDS = {
  ONLINE_TTL: parseInt(process.env.AGENT_ONLINE_TTL_MS ?? '15000'), // 15 seconds default
  STALE_TTL: parseInt(process.env.AGENT_STALE_TTL_MS ?? '60000'), // 60 seconds default
} as const;

// Validate thresholds
if (STATUS_THRESHOLDS.ONLINE_TTL <= 0 || STATUS_THRESHOLDS.STALE_TTL <= 0) {
  throw new Error('Agent status thresholds must be positive values');
}
if (STATUS_THRESHOLDS.ONLINE_TTL >= STATUS_THRESHOLDS.STALE_TTL) {
  throw new Error('ONLINE_TTL must be less than STALE_TTL');
}

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
  const lastHeartbeatTime = new Map<string, number>(); // For rate limiting

  // Caps size limit to prevent memory issues
  const MAX_CAPS_SIZE = 32 * 1024; // 32KB

  // Rate limiting: minimum interval between heartbeats per agent (configurable)
  const MIN_HEARTBEAT_INTERVAL = parseInt(process.env.AGENT_MIN_HEARTBEAT_INTERVAL_MS ?? '250'); // 250ms default

  return {
    upsertHeartbeat(id: string, caps?: Record<string, unknown>): void {
      const now = Date.now();
      const existing = agents.get(id);
      const lastHeartbeat = lastHeartbeatTime.get(id);

      // Rate limiting: ignore heartbeats that are too frequent
      if (lastHeartbeat && now - lastHeartbeat < MIN_HEARTBEAT_INTERVAL) {
        // Log rate limiting (but don't spam - only log occasionally)
        if ((now - lastHeartbeat) % 1000 < MIN_HEARTBEAT_INTERVAL) {
          console.warn(
            `Agent ${id} heartbeat rate limited (${now - lastHeartbeat}ms < ${MIN_HEARTBEAT_INTERVAL}ms)`,
          );
        }
        return; // Ignore this heartbeat
      }

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

      // Track status transition for metrics
      const oldStatus = existing ? statusFrom(existing.lastSeen, now) : 'offline';

      agents.set(id, {
        id,
        lastSeen: now,
        caps: validatedCaps,
      });

      lastHeartbeatTime.set(id, now);

      // Emit status transition metric if status changed
      const newStatus = statusFrom(now, now); // Should be 'online' for new heartbeat
      if (oldStatus !== newStatus) {
        console.log(
          `[METRIC] agent_status_transition agent_id=${id} old_status=${oldStatus} new_status=${newStatus}`,
        );
      }

      // Emit heartbeat counter metric
      console.log(`[METRIC] agent_heartbeat_received agent_id=${id}`);
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
