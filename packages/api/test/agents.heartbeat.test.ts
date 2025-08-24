import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { createMemoryAgentRegistry } from '../src/agents/registry.memory.js';
import { registerAgentRoutes } from '../src/agents/routes.js';
import { createMemoryBus } from '../src/bus/memoryBus.js';
import { topics } from '../src/bus/topics.js';

async function listen(app: ReturnType<typeof Fastify>) {
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  return address;
}

describe('E2E: agent heartbeat ingestion', () => {
  it('heartbeat updates registry and appears in /agents endpoint', async () => {
    const app = Fastify();
    const bus = createMemoryBus();
    const agentRegistry = createMemoryAgentRegistry();

    // Register agent routes
    registerAgentRoutes(app, agentRegistry);

    // Subscribe to agent heartbeats (simulating server.ts behavior)
    // Note: Memory bus doesn't support wildcards, so we subscribe to the specific topic
    const agentId = 'test-agent-123';
    bus.subscribe<{ at: number; caps?: Record<string, unknown> }>(
      topics.agentHeartbeat(agentId),
      async (heartbeat) => {
        agentRegistry.upsertHeartbeat(agentId, heartbeat.caps);
      },
    );

    const base = await listen(app);

    try {
      // 1) Initially, no agents should be registered
      const initialRes = await fetch(`${base}/agents`);
      expect(initialRes.status).toBe(200);
      const initialAgents = await initialRes.json();
      expect(initialAgents).toEqual([]);

      // 2) Simulate a heartbeat from an agent
      const agentId = 'test-agent-123';
      const caps = { feature: 'test', version: '1.0.0' };
      await bus.publish(topics.agentHeartbeat(agentId), { at: Date.now(), caps });

      // 3) Wait a bit for the message to be processed
      await new Promise((r) => setTimeout(r, 100));

      // 4) Check that the agent now appears in the registry
      const agentsRes = await fetch(`${base}/agents`);
      expect(agentsRes.status).toBe(200);
      const agents = await agentsRes.json();
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe(agentId);
      expect(agents[0].status).toBe('online');
      expect(agents[0].caps).toEqual(caps);

      // 5) Check specific agent endpoint
      const agentRes = await fetch(`${base}/agents/${agentId}`);
      expect(agentRes.status).toBe(200);
      const agent = await agentRes.json();
      expect(agent.id).toBe(agentId);
      expect(agent.status).toBe('online');
      expect(agent.caps).toEqual(caps);

      // 6) Test 404 for unknown agent
      const unknownRes = await fetch(`${base}/agents/unknown-agent`);
      expect(unknownRes.status).toBe(404);

      // 7) Test multiple heartbeats update the same agent
      const newCaps = { feature: 'updated', version: '2.0.0' };
      await bus.publish(topics.agentHeartbeat(agentId), { at: Date.now(), caps: newCaps });
      await new Promise((r) => setTimeout(r, 100));

      const updatedRes = await fetch(`${base}/agents/${agentId}`);
      expect(updatedRes.status).toBe(200);
      const updatedAgent = await updatedRes.json();
      expect(updatedAgent.caps).toEqual(newCaps);
      expect(updatedAgent.lastSeen).toBeGreaterThan(agent.lastSeen);
    } finally {
      await app.close();
      await bus.close();
    }
  }, 5000);
});
