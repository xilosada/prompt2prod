import type { FastifyInstance } from 'fastify';

export function registerAgentDevRoutes(
  app: FastifyInstance,
  registry: ReturnType<typeof import('./registry.memory.js').createMemoryAgentRegistry>,
) {
  // Guard: these routes must never exist unless explicitly enabled by env in server.ts
  app.post<{ Params: { id: string } }>('/__test/agents/:id/heartbeat', async (req, reply) => {
    const id = req.params.id.trim();
    if (!id) return reply.code(400).send({ error: 'bad_id' });
    // Optional caps from body if provided
    let caps: Record<string, unknown> | undefined;
    try {
      if (req.body && typeof req.body === 'object') {
        caps = req.body as Record<string, unknown>;
      }
    } catch {
      // Ignore parsing errors, use undefined caps
    }
    registry.upsertHeartbeat(id, caps);
    return { ok: true };
  });
}
