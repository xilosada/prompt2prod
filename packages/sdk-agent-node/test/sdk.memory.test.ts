import { describe, it, expect } from 'vitest';
import { AgentClient } from '../src/index.js';
import { createMemoryTransport } from '../src/transports/memory.js';

describe('AgentClient (memory transport)', () => {
  it('receives work and emits logs and patch', async () => {
    const t = createMemoryTransport();
    const agent = new AgentClient({ agentId: 'a1', transport: t });

    const logs: string[] = [];
    const patches: unknown[] = [];

    await t.subscribe<string>('runs.r1.logs', (l) => logs.push(l));
    await t.subscribe<unknown>('runs.r1.patch', (p) => patches.push(p));

    const unsub = await agent.onWork(async (job) => {
      await agent.publishLog(job.runId, 'hello');
      await agent.publishPatch(job.runId, { files: [{ path: 'x', content: 'y' }] });
    });

    // publish a work item
    await t.publish('agents.a1.work', {
      runId: 'r1',
      repo: 'org/repo',
      base: 'main',
      prompt: 'do it',
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(logs).toEqual(['hello']);
    expect(patches[0]?.files?.[0]?.path).toBe('x');

    await unsub();
    await agent.close();
  });
});
