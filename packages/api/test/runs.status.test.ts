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

  it('status arrives before first log - sets final state directly and cleans both watchers', async () => {
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

    // Status arrives before any logs - should set final state directly
    await bus.publish(topics.runStatus(id), { state: 'done', detail: 'early completion' });
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('done');

    // Publishing logs after terminal state should not change status
    await bus.publish(topics.runLogs(id), 'log after done');
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('done'); // Should still be done, not running
  });

  it('idempotency: sending second terminal status should not change anything', async () => {
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

    // First terminal status
    await bus.publish(topics.runStatus(id), { state: 'error', detail: 'first error' });
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('error');

    // Second terminal status - should not change anything
    await bus.publish(topics.runStatus(id), { state: 'done', detail: 'second status' });
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('error'); // Should still be error, not done

    // Third terminal status - should not change anything
    await bus.publish(topics.runStatus(id), { state: 'canceled', detail: 'third status' });
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('error'); // Should still be error, not canceled
  });

  it('watcher cleanup: after terminal status, publishing more logs/status should not mutate the run', async () => {
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

    // Set terminal state
    await bus.publish(topics.runStatus(id), { state: 'canceled', detail: 'user canceled' });
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('canceled');

    // Publish more logs - should not change status
    await bus.publish(topics.runLogs(id), 'log after canceled');
    await bus.publish(topics.runLogs(id), 'another log after canceled');
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('canceled'); // Should still be canceled, not running

    // Publish more status messages - should not change status
    await bus.publish(topics.runStatus(id), { state: 'done', detail: 'late done' });
    await bus.publish(topics.runStatus(id), { state: 'error', detail: 'late error' });
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.get(id)?.status).toBe('canceled'); // Should still be canceled
  });
});
