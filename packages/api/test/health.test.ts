import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';

describe('health', () => {
  it('returns ok with agent registry thresholds', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.ok).toBe(true);
    expect(payload.agentRegistry).toBeDefined();
    expect(payload.agentRegistry.thresholds).toBeDefined();
    expect(payload.agentRegistry.thresholds.onlineTtlMs).toBe(15 * 1000);
    expect(payload.agentRegistry.thresholds.staleTtlMs).toBe(60 * 1000);
    expect(payload.agentRegistry.thresholds.minHeartbeatIntervalMs).toBe(250);
  });
});
