import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerRunRoutes } from '../src/runs/routes.js';
import { createMemoryRunsRepo } from '../src/runs/repo.memory.js';
import { createMemoryBus } from '../src/bus/memoryBus.js';
import { topics } from '../src/bus/topics.js';

describe('runs lifecycle via bus watchers', () => {
  it('marks running on first log then done on status', async () => {
    const app = Fastify();
    const bus = createMemoryBus();
    const repo = createMemoryRunsRepo();
    registerRunRoutes(app, { bus, repo });

    const created = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { agentId: 'a', repo: 'o/r', base: 'main', prompt: 'p' },
    });
    const { id } = created.json() as { id: string };

    // first log -> running
    await bus.publish(topics.runLogs(id), 'hi');
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('running');

    // status=done
    await bus.publish(topics.runStatus(id), { state: 'done' });
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('done');
  });

  it('handles error and canceled terminals', async () => {
    const app = Fastify();
    const bus = createMemoryBus();
    const repo = createMemoryRunsRepo();
    registerRunRoutes(app, { bus, repo });

    const created = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { agentId: 'a', repo: 'o/r', base: 'main', prompt: 'p' },
    });
    const { id } = created.json() as { id: string };

    await bus.publish(topics.runStatus(id), { state: 'error', detail: 'boom' });
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('error');

    const created2 = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { agentId: 'a', repo: 'o/r', base: 'main', prompt: 'p2' },
    });
    const { id: id2 } = created2.json() as { id: string };
    await bus.publish(topics.runStatus(id2), { state: 'canceled' });
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id2)?.status).toBe('canceled');
  });
});
