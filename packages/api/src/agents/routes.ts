import type { FastifyInstance } from 'fastify';

const agentViewSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    lastSeen: { type: 'integer' }, // ms since epoch
    status: { type: 'string', enum: ['online', 'stale', 'offline'] },
    caps: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['id', 'lastSeen', 'status'],
} as const;

const agentsResponseSchema = {
  type: 'array',
  items: agentViewSchema,
} as const;

export function registerAgentRoutes(
  app: FastifyInstance,
  registry: ReturnType<typeof import('./registry.memory.js').createMemoryAgentRegistry>,
) {
  // GET /agents - List all agents
  app.get(
    '/agents',
    {
      schema: {
        response: {
          200: agentsResponseSchema,
        },
      },
    },
    async () => {
      return registry.getAll();
    },
  );

  // GET /agents/:id - Get specific agent
  app.get(
    '/agents/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: agentViewSchema,
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const agent = registry.getOne(id);

      if (!agent) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Agent with id '${id}' not found`,
        });
      }

      return agent;
    },
  );
}
