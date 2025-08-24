import type { FastifyInstance } from 'fastify';
import type { Bus } from '../bus/Bus.js';
import { topics } from '../bus/topics.js';
import type { RunStatus } from '@prompt2prod/shared';

const VALID = new Set(['queued', 'running', 'done', 'error', 'canceled'] as const);

export function registerRunDevRoutes(app: FastifyInstance, bus: Bus) {
  app.post<{ Params: { id: string; state: string } }>(
    '/__test/runs/:id/status/:state',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id', 'state'],
          properties: {
            id: { type: 'string', minLength: 1 },
            state: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
            required: ['error'],
          },
        },
      },
    },
    async (req, reply) => {
      const id = req.params.id.trim();
      const state = req.params.state.trim();
      if (!id || !VALID.has(state as RunStatus)) {
        return reply.code(400).send({ error: 'bad_params' });
      }
      await bus.publish(topics.runStatus(id), { state });
      app.log.debug('[dev] Published run status: %s -> %s', id, state);
      // keep response simple & explicit
      return reply.code(200).send({ ok: true });
    },
  );
}
