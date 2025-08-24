import { FastifyInstance } from 'fastify';
import { MemoryTaskRepo, CreateTaskInput } from './repo.memory.js';

// JSON Schemas
const createTaskSchema = {
  type: 'object',
  required: ['title', 'goal', 'targetRepo'],
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 120,
    },
    goal: {
      type: 'string',
      minLength: 1,
      maxLength: 2000,
    },
    targetRepo: {
      type: 'string',
      minLength: 1,
    },
    agents: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 16,
    },
    policy: {
      type: 'object',
      additionalProperties: true,
    },
  },
};

const listTasksQuerySchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 200,
      default: 50,
    },
    offset: {
      type: 'integer',
      minimum: 0,
      default: 0,
    },
  },
};

const getTaskParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    },
  },
};

const taskResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    goal: { type: 'string' },
    targetRepo: { type: 'string' },
    agents: { type: 'array', items: { type: 'string' } },
    policy: { type: 'object', additionalProperties: true },
    state: {
      type: 'string',
      enum: ['planned', 'running', 'awaiting-approvals', 'done', 'error', 'canceled'],
    },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    pr: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        number: { type: 'number' },
        branch: { type: 'string' },
      },
    },
    error: { type: 'string' },
  },
  required: ['id', 'title', 'goal', 'targetRepo', 'agents', 'state', 'createdAt', 'updatedAt'],
};

const listTasksResponseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: taskResponseSchema,
    },
    total: { type: 'number' },
  },
  required: ['items', 'total'],
};

export async function taskRoutes(fastify: FastifyInstance) {
  const taskRepo = new MemoryTaskRepo();

  // POST /tasks - Create a new task
  fastify.post(
    '/tasks',
    {
      schema: {
        body: createTaskSchema,
        response: {
          201: taskResponseSchema,
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const task = taskRepo.create(request.body as CreateTaskInput);
        return reply.status(201).send(task);
      } catch (error) {
        return reply.status(400).send({ error: (error as Error).message });
      }
    },
  );

  // GET /tasks - List tasks with pagination
  fastify.get(
    '/tasks',
    {
      schema: {
        querystring: listTasksQuerySchema,
        response: {
          200: listTasksResponseSchema,
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };
        const result = taskRepo.list({ limit, offset });
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({ error: (error as Error).message });
      }
    },
  );

  // GET /tasks/:id - Get a specific task
  fastify.get(
    '/tasks/:id',
    {
      schema: {
        params: getTaskParamsSchema,
        response: {
          200: taskResponseSchema,
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const task = taskRepo.get(id);

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      return reply.send(task);
    },
  );
}
