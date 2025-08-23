import type { FastifyInstance } from 'fastify';
import type { Bus } from '../bus/Bus.js';
import { topics } from '../bus/topics.js';

export function registerSse(app: FastifyInstance, bus: Bus) {
  app.get('/runs/:id/logs/stream', async (req, reply) => {
    const runId = (req.params as { id: string }).id;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    reply.raw.write(': connected\n\n');

    const unsub = await bus.subscribe<string>(topics.runLogs(runId), (line) => {
      reply.raw.write(`data: ${JSON.stringify(line)}\n\n`);
    });

    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 15000);
    const cleanup = async () => {
      clearInterval(ping);
      await unsub();
    };
    req.raw.on('close', cleanup);

    reply.hijack();
  });

  // Dev helper: emit a test log line
  app.post('/runs/:id/logs/test', async (req) => {
    const runId = (req.params as { id: string }).id;
    await bus.publish(topics.runLogs(runId), `hello from ${runId}`);
    return { ok: true };
  });
}
