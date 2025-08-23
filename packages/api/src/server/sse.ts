import type { FastifyInstance } from 'fastify';
import { topics } from '../bus/topics.js';
import { createMemoryBus } from '../bus/memoryBus.js';

// Temporary in-memory singleton. In PR2.N (NATS) we'll replace this via DI/factory.
export const bus = createMemoryBus();

export function registerSse(app: FastifyInstance) {
  app.get('/runs/:id/logs/stream', async (req, reply) => {
    const runId = (req.params as any).id;
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const unsub = await bus.subscribe<string>(topics.runLogs(runId), (line) => {
      reply.raw.write(`data: ${JSON.stringify(line)}\n\n`);
    });

    req.raw.on('close', () => { unsub(); });
    reply.hijack();
  });

  // Dev helper to emit a test log line
  app.post('/runs/:id/logs/test', async (req) => {
    const runId = (req.params as any).id;
    await bus.publish(topics.runLogs(runId), `hello from ${runId}`);
    return { ok: true };
  });
} 