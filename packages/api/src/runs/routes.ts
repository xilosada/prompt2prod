import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import type { Bus } from '../bus/Bus.js';
import { topics } from '../bus/topics.js';
import type { RunsRepo } from './repo.memory.js';

export function registerRunRoutes(app: FastifyInstance, deps: { bus: Bus; repo: RunsRepo }) {
  app.post(
    '/runs',
    {
      schema: {
        body: {
          type: 'object',
          required: ['agentId', 'repo', 'base', 'prompt'],
          properties: {
            agentId: { type: 'string', minLength: 1 },
            repo: { type: 'string', minLength: 1 }, // e.g. org/repo
            base: { type: 'string', minLength: 1 }, // e.g. main
            prompt: { type: 'string', minLength: 1 },
            payload: {},
          },
        },
        response: {
          201: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as {
        agentId: string;
        repo: string;
        base: string;
        prompt: string;
        payload?: unknown;
      };
      const id = crypto.randomUUID();
      deps.repo.create({
        id,
        agentId: body.agentId,
        repo: body.repo,
        base: body.base,
        prompt: body.prompt,
        payload: body.payload,
      });

      try {
        // publish work item to agent queue
        await deps.bus.publish(topics.agentWork(body.agentId), {
          runId: id,
          repo: body.repo,
          base: body.base,
          prompt: body.prompt,
          payload: body.payload,
        });
        deps.repo.setStatus(id, 'dispatched');
        reply.code(201).send({ id });
      } catch {
        deps.repo.setStatus(id, 'error');
        reply.code(503).send({ error: 'dispatch_failed', id });
      }
    },
  );

  app.get(
    '/runs/:id',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              agentId: { type: 'string' },
              repo: { type: 'string' },
              base: { type: 'string' },
              prompt: { type: 'string' },
              payload: {},
              status: { type: 'string' },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' },
            },
            required: [
              'id',
              'agentId',
              'repo',
              'base',
              'prompt',
              'status',
              'createdAt',
              'updatedAt',
            ],
          },
          404: { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] },
        },
      },
    },
    async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const rec = deps.repo.get(id);
      if (!rec) {
        reply.code(404).send({ error: 'not_found' });
        return;
      }
      reply.send(rec);
    },
  );
}
