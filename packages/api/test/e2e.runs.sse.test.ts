import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerRunRoutes } from '../src/runs/routes.js';
import { registerSse } from '../src/server/sse.js';
import { createMemoryRunsRepo } from '../src/runs/repo.memory.js';
import { createMemoryBus } from '../src/bus/memoryBus.js';
import { topics } from '../src/bus/topics.js';

async function listen(app: ReturnType<typeof Fastify>) {
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  // Fastify returns a string like http://127.0.0.1:xxxxx
  return address;
}

describe('E2E: run dispatch + SSE logs', () => {
  it('POST /runs publishes work; SSE receives a log', async () => {
    const app = Fastify();
    const bus = createMemoryBus();
    const repo = createMemoryRunsRepo();

    // Wire routes with the same in-memory bus
    registerSse(app, bus);
    registerRunRoutes(app, { bus, repo });

    const base = await listen(app);

    try {
      // 1) Subscribe to agent work to capture runId and simulate the agent
      let seenRunId: string | null = null;
      const unsubWork = await bus.subscribe<{
        runId: string;
        repo: string;
        base: string;
        prompt: string;
      }>(
        topics.agentWork('a1'),
        async (job) => {
          seenRunId = job.runId;
          // simulate agent emitting a log line
          await bus.publish(topics.runLogs(job.runId), 'e2e-ok');
        },
        { queue: 'a1' },
      );

      // 2) Create the run
      const createRes = await fetch(`${base}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: 'a1', repo: 'org/repo', base: 'main', prompt: 'do' }),
      });
      expect(createRes.status).toBe(201);
      const { id } = (await createRes.json()) as { id: string };
      expect(id).toMatch(/[0-9a-f-]{36}/i);

      // 3) Wait for the work to be published and processed
      const waitUntil = Date.now() + 2000;
      while (!seenRunId && Date.now() < waitUntil) {
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(seenRunId).toBe(id);

      // 4) Start SSE stream and await the simulated agent log
      const abort = new AbortController();

      // Simple SSE test - just check if we can connect
      const sseRes = await fetch(`${base}/runs/${id}/logs/stream`, { signal: abort.signal });
      expect(sseRes.ok).toBe(true);
      expect(sseRes.headers.get('content-type')).toBe('text/event-stream');

      // Read the initial connection message
      const reader = sseRes.body!.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader.read();
      const initialData = decoder.decode(value);
      expect(initialData).toContain(': connected');

      // 5) Publish a log and verify it's received
      await bus.publish(topics.runLogs(id), 'e2e-ok');

      // Read the log message
      const { value: logValue } = await reader.read();
      const logData = decoder.decode(logValue);
      expect(logData).toContain('data: "e2e-ok"');

      abort.abort();

      // 6) GET /runs/:id returns metadata
      const getRes = await fetch(`${base}/runs/${id}`);
      expect(getRes.status).toBe(200);
      const rec = await getRes.json();
      expect(rec.id).toBe(id);
      expect(rec.status).toBe('dispatched');

      await unsubWork();
    } finally {
      await app.close();
      await bus.close();
    }
  });
});
