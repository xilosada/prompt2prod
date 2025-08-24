import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMemoryAgentRegistry,
  statusFrom,
  STATUS_THRESHOLDS,
} from '../src/agents/registry.memory.js';

describe('agent registry', () => {
  let registry: ReturnType<typeof createMemoryAgentRegistry>;

  beforeEach(() => {
    registry = createMemoryAgentRegistry();
    // Use fake timers for deterministic testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('statusFrom', () => {
    it('computes online status for recent heartbeats', () => {
      const now = Date.now();
      const recent = now - 5000; // 5 seconds ago
      expect(statusFrom(recent, now)).toBe('online');
    });

    it('computes stale status for medium-age heartbeats', () => {
      const now = Date.now();
      const stale = now - 30000; // 30 seconds ago
      expect(statusFrom(stale, now)).toBe('stale');
    });

    it('computes offline status for old heartbeats', () => {
      const now = Date.now();
      const offline = now - 120000; // 2 minutes ago
      expect(statusFrom(offline, now)).toBe('offline');
    });

    it('uses current time when now is not provided', () => {
      const now = Date.now();
      const recent = now - 5000;
      const status = statusFrom(recent);
      expect(status).toBe('online');
    });

    it('handles edge cases at threshold boundaries', () => {
      const now = Date.now();

      // At online threshold (inclusive)
      expect(statusFrom(now - STATUS_THRESHOLDS.ONLINE_TTL, now)).toBe('online');

      // Just over online threshold (exclusive)
      expect(statusFrom(now - STATUS_THRESHOLDS.ONLINE_TTL - 1, now)).toBe('stale');

      // At stale threshold (inclusive)
      expect(statusFrom(now - STATUS_THRESHOLDS.STALE_TTL, now)).toBe('stale');

      // Just over stale threshold (exclusive)
      expect(statusFrom(now - STATUS_THRESHOLDS.STALE_TTL - 1, now)).toBe('offline');
    });

    it('pins exact boundary values to prevent drift', () => {
      const now = Date.now();

      // Exact boundary tests - these should never change
      expect(statusFrom(now - 0, now)).toBe('online'); // exactly now
      expect(statusFrom(now - STATUS_THRESHOLDS.ONLINE_TTL, now)).toBe('online'); // exactly at online threshold
      expect(statusFrom(now - STATUS_THRESHOLDS.ONLINE_TTL - 1, now)).toBe('stale'); // 1ms over online threshold
      expect(statusFrom(now - STATUS_THRESHOLDS.STALE_TTL, now)).toBe('stale'); // exactly at stale threshold
      expect(statusFrom(now - STATUS_THRESHOLDS.STALE_TTL - 1, now)).toBe('offline'); // 1ms over stale threshold
    });
  });

  describe('upsertHeartbeat', () => {
    it('creates new agent entry', () => {
      const agentId = 'test-agent-1';
      const caps = { feature: 'test' };
      const now = Date.now();

      registry.upsertHeartbeat(agentId, caps);

      const entry = registry._getRawEntry(agentId);
      expect(entry).toBeDefined();
      expect(entry?.id).toBe(agentId);
      expect(entry?.caps).toEqual(caps);
      expect(entry?.lastSeen).toBe(now); // Should be exactly now with fake timers
    });

    it('updates existing agent entry', () => {
      const agentId = 'test-agent-2';
      const caps1 = { feature: 'test1' };
      const caps2 = { feature: 'test2' };

      // First heartbeat
      registry.upsertHeartbeat(agentId, caps1);
      const entry1 = registry._getRawEntry(agentId);
      const firstSeen = entry1!.lastSeen;

      // Advance time
      vi.advanceTimersByTime(100);

      // Second heartbeat
      registry.upsertHeartbeat(agentId, caps2);
      const entry2 = registry._getRawEntry(agentId);

      expect(entry2?.lastSeen).toBeGreaterThan(firstSeen);
      expect(entry2?.caps).toEqual(caps2); // Should update caps
    });

    it('preserves existing caps when not provided', () => {
      const agentId = 'test-agent-3';
      const caps = { feature: 'test' };

      // First heartbeat with caps
      registry.upsertHeartbeat(agentId, caps);

      // Second heartbeat without caps
      registry.upsertHeartbeat(agentId);

      const entry = registry._getRawEntry(agentId);
      expect(entry?.caps).toEqual(caps); // Should preserve original caps
    });

    it('rejects oversized caps to prevent memory issues', () => {
      const agentId = 'test-agent-4';
      const originalCaps = { feature: 'test' };

      // First heartbeat with normal caps
      registry.upsertHeartbeat(agentId, originalCaps);

      // Create oversized caps (more than 32KB)
      const oversizedCaps = { data: 'x'.repeat(33 * 1024) };

      // Second heartbeat with oversized caps
      registry.upsertHeartbeat(agentId, oversizedCaps);

      const entry = registry._getRawEntry(agentId);
      expect(entry?.caps).toEqual(originalCaps); // Should preserve original caps, not oversized ones
    });
  });

  describe('getAll', () => {
    it('returns empty array when no agents', () => {
      const agents = registry.getAll();
      expect(agents).toEqual([]);
    });

    it('returns all agents with computed status', () => {
      const now = Date.now();

      // Add agents with different ages
      registry.upsertHeartbeat('online-agent');
      registry.upsertHeartbeat('stale-agent');
      registry.upsertHeartbeat('offline-agent');

      // Manually set lastSeen to simulate different ages
      const onlineEntry = registry._getRawEntry('online-agent')!;
      const staleEntry = registry._getRawEntry('stale-agent')!;
      const offlineEntry = registry._getRawEntry('offline-agent')!;

      onlineEntry.lastSeen = now - 5000; // 5 seconds ago
      staleEntry.lastSeen = now - 30000; // 30 seconds ago
      offlineEntry.lastSeen = now - 120000; // 2 minutes ago

      const agents = registry.getAll(now);

      expect(agents).toHaveLength(3);
      expect(agents.find((a) => a.id === 'online-agent')?.status).toBe('online');
      expect(agents.find((a) => a.id === 'stale-agent')?.status).toBe('stale');
      expect(agents.find((a) => a.id === 'offline-agent')?.status).toBe('offline');
    });

    it('uses current time when now is not provided', () => {
      const now = Date.now();
      registry.upsertHeartbeat('test-agent');
      const agents = registry.getAll(now);

      expect(agents).toHaveLength(1);
      expect(agents[0].status).toBe('online'); // Should be online since just created
    });

    it('returns agents sorted by lastSeen desc (most recent first)', () => {
      const now = Date.now();

      // Add agents in random order
      registry.upsertHeartbeat('agent-1');
      vi.advanceTimersByTime(1000);
      registry.upsertHeartbeat('agent-2');
      vi.advanceTimersByTime(1000);
      registry.upsertHeartbeat('agent-3');

      const agents = registry.getAll(now + 2000); // Use time after all heartbeats

      expect(agents).toHaveLength(3);
      expect(agents[0].id).toBe('agent-3'); // Most recent first
      expect(agents[1].id).toBe('agent-2');
      expect(agents[2].id).toBe('agent-1'); // Oldest last
    });
  });

  describe('getOne', () => {
    it('returns undefined for unknown agent', () => {
      const agent = registry.getOne('unknown-agent');
      expect(agent).toBeUndefined();
    });

    it('returns agent with computed status', () => {
      const now = Date.now();
      const agentId = 'test-agent';
      const caps = { feature: 'test' };

      registry.upsertHeartbeat(agentId, caps);

      // Manually set lastSeen to simulate stale status
      const entry = registry._getRawEntry(agentId)!;
      entry.lastSeen = now - 30000; // 30 seconds ago

      const agent = registry.getOne(agentId, now);

      expect(agent).toBeDefined();
      expect(agent?.id).toBe(agentId);
      expect(agent?.status).toBe('stale');
      expect(agent?.caps).toEqual(caps);
      expect(agent?.lastSeen).toBe(entry.lastSeen);
    });

    it('uses current time when now is not provided', () => {
      const now = Date.now();
      registry.upsertHeartbeat('test-agent');
      const agent = registry.getOne('test-agent', now);

      expect(agent).toBeDefined();
      expect(agent?.status).toBe('online'); // Should be online since just created
    });
  });

  describe('STATUS_THRESHOLDS', () => {
    it('exports correct threshold values', () => {
      expect(STATUS_THRESHOLDS.ONLINE_TTL).toBe(15 * 1000); // 15 seconds
      expect(STATUS_THRESHOLDS.STALE_TTL).toBe(60 * 1000); // 60 seconds
    });
  });
});
