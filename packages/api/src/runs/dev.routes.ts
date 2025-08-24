import type { FastifyInstance } from 'fastify';
import type { Bus } from '../bus/Bus.js';
import { topics } from '../bus/topics.js';

const VALID = new Set(['queued', 'running', 'done', 'error', 'canceled'] as const);

export function registerRunDevRoutes(app: FastifyInstance, bus: Bus) {
  app.post<{ Params: { id: string; state: string } }>(
    '/__test/runs/:id/status/:state',
    async (req, reply) => {
      const id = req.params.id.trim();
      const state = req.params.state.trim();
      if (!id || !VALID.has(state as 'queued' | 'running' | 'done' | 'error' | 'canceled')) {
        return reply.code(400).send({ error: 'bad_params' });
      }
      await bus.publish(topics.runStatus(id), { state });
      // keep response simple & explicit
      return reply.code(200).send({ ok: true });
    },
  );
}
