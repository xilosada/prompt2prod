import { describe, it, expect } from 'vitest';
import { AgentClient } from '../src/index.js';
import { createMemoryTransport } from '../src/transports/memory.js';

describe('AgentClient status helpers', () => {
  it('publishes done/error/canceled', async () => {
    const t = createMemoryTransport();
    const agent = new AgentClient({ agentId: 'a1', transport: t });

    const seen: Array<{ state: string; detail?: unknown }> = [];
    const unsub = await t.subscribe<{ state: string; detail?: unknown }>('runs.r1.status', (m) =>
      seen.push(m),
    );

    await agent.markDone('r1', { ok: true });
    await agent.markError('r1', new Error('fail'));
    await agent.markCanceled('r1', 'user');

    await new Promise((r) => setTimeout(r, 10));
    expect(seen.map((s) => s.state)).toEqual(['done', 'error', 'canceled']);

    await unsub();
    await agent.close();
  });
});
