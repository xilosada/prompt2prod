import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerRunRoutes } from '../src/runs/routes.js';
import { createMemoryRunsRepo } from '../src/runs/repo.memory.js';
import { createMemoryBus } from '../src/bus/memoryBus.js';
import { topics } from '../src/bus/topics.js';
import type { Bus } from '../src/bus/Bus.js';

type WorkItem = {
  runId: string;
  repo: string;
  base: string;
  prompt: string;
  payload?: unknown;
};

describe('runs routes', () => {
  it('POST /runs creates id, stores record, and publishes work', async () => {
    const app = Fastify();
    const bus = createMemoryBus();
    const repo = createMemoryRunsRepo();

    let published: WorkItem | undefined;
    await bus.subscribe<WorkItem>(topics.agentWork('agent-1'), (m) => {
      published = m;
    });

    registerRunRoutes(app, { bus, repo });

    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: {
        agentId: 'agent-1',
        repo: 'org/repo',
        base: 'main',
        prompt: 'do something',
        payload: { x: 1 },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: string };
    expect(body.id).toMatch(/[0-9a-f-]{36}/i);

    // published work includes the same id
    await new Promise((r) => setTimeout(r, 10));
    expect(published?.runId).toBe(body.id);

    // repo has status
    const stored = repo.get(body.id)!;
    expect(stored.status).toBe('queued');
  });

  it('GET /runs/:id returns record or 404', async () => {
    const app = Fastify();
    const bus = createMemoryBus();
    const repo = createMemoryRunsRepo();
    registerRunRoutes(app, { bus, repo });

    const create = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { agentId: 'a', repo: 'o/r', base: 'main', prompt: 'p' },
    });
    const id = (create.json() as { id: string }).id;

    const ok = await app.inject({ method: 'GET', url: `/runs/${id}` });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().id).toBe(id);

    const nf = await app.inject({ method: 'GET', url: `/runs/does-not-exist` });
    expect(nf.statusCode).toBe(404);
  });

  it('POST /runs sets status=error and returns 503 if publish fails', async () => {
    const app = Fastify();
    const failingBus = {
      publish: async () => {
        throw new Error('boom');
      },
      subscribe: async () => async () => {},
      request: async () => {
        throw new Error('not-used');
      },
      close: async () => {},
    } as Bus;
    const repo = createMemoryRunsRepo();
    registerRunRoutes(app, { bus: failingBus, repo });

    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { agentId: 'a', repo: 'o/r', base: 'main', prompt: 'p' },
    });
    expect(res.statusCode).toBe(503);
    const body = res.json() as { error: string; id: string };
    expect(body.error).toBe('dispatch_failed');
    const rec = repo.get(body.id);
    expect(rec?.status).toBe('error');
  });
});
