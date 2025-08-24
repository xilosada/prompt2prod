import { FastifyInstance } from 'fastify';
import { MemoryTaskRepo, CreateTaskInput } from './repo.memory.js';
import type { TaskOrchestrator } from './orchestrator.js';

// JSON Schemas
const createTaskSchema = {
  type: 'object',
  required: ['title', 'goal', 'targetRepo'],
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
    },
    goal: {
      type: 'string',
    },
    targetRepo: {
      type: 'string',
    },
    agents: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    policy: {
      type: 'object',
      additionalProperties: true,
    },
  },
};

const listTasksQuerySchema = {
  type: 'object',
  additionalProperties: false,
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
    sort: {
      type: 'string',
      enum: ['createdAt:desc', 'createdAt:asc'],
      default: 'createdAt:desc',
    },
  },
};

const getTaskParamsSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
  },
};

const taskResponseSchema = {
  type: 'object',
  additionalProperties: false,
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
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        number: { type: 'number' },
        branch: { type: 'string' },
      },
    },
    error: { type: 'string' },
    runs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          agentId: { type: 'string' },
          createdAt: { type: 'string' },
        },
        required: ['id', 'agentId', 'createdAt'],
      },
    },
  },
  required: ['id', 'title', 'goal', 'targetRepo', 'agents', 'state', 'createdAt', 'updatedAt'],
};

const listTasksResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: taskResponseSchema,
    },
    total: { type: 'number' },
  },
  required: ['items', 'total'],
};

const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    error: { type: 'string' },
    details: { type: 'object', additionalProperties: true },
  },
  required: ['error'],
};

// Helper function to trim and clean input
function cleanTaskInput(input: Record<string, unknown>): CreateTaskInput {
  const cleaned = {
    title: typeof input.title === 'string' ? input.title.trim() : '',
    goal: typeof input.goal === 'string' ? input.goal.trim() : '',
    targetRepo: typeof input.targetRepo === 'string' ? input.targetRepo.trim() : '',
    agents: Array.isArray(input.agents)
      ? input.agents
          .filter((agent): agent is string => typeof agent === 'string')
          .map((agent: string) => agent.trim())
          .filter(Boolean)
      : [],
    policy: input.policy as Record<string, unknown> | undefined,
  };

  // Validate required fields after trimming
  if (!cleaned.title) {
    throw new Error('Title is required and cannot be empty after trimming');
  }
  if (!cleaned.goal) {
    throw new Error('Goal is required and cannot be empty after trimming');
  }
  if (!cleaned.targetRepo) {
    throw new Error('Target repository is required and cannot be empty after trimming');
  }

  // Validate targetRepo format after trimming - restrictive allow-list
  const allowedPatterns = [
    /^file:\/\/\/.+/, // file:///path
    /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/, // git@github.com:owner/repo.git
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/, // https://github.com/owner/repo[.git]
  ];

  const isValidTargetRepo = allowedPatterns.some((pattern) => pattern.test(cleaned.targetRepo));
  if (!isValidTargetRepo) {
    throw new Error(
      'Target repository must be one of: file:///path, git@github.com:owner/repo.git, or https://github.com/owner/repo[.git]',
    );
  }

  // Note: We filter out empty agent entries instead of rejecting them
  // This allows the API to be more forgiving with input

  return cleaned;
}

// Helper function to generate Link headers for pagination
function generateLinkHeaders(
  baseUrl: string,
  limit: number,
  offset: number,
  total: number,
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (offset + limit < total) {
    headers['Link'] = `<${baseUrl}?limit=${limit}&offset=${offset + limit}>; rel="next"`;
  }

  if (offset > 0) {
    const prevOffset = Math.max(0, offset - limit);
    headers['Link'] =
      (headers['Link'] || '') +
      (headers['Link'] ? ', ' : '') +
      `<${baseUrl}?limit=${limit}&offset=${prevOffset}>; rel="prev"`;
  }

  return headers;
}

export async function taskRoutes(
  fastify: FastifyInstance,
  orchestrator?: TaskOrchestrator,
  taskRepo?: MemoryTaskRepo,
) {
  const taskRepoInstance = taskRepo || new MemoryTaskRepo();

  // Store orchestrator in fastify instance for access in route handlers
  (fastify as { _taskOrchestrator?: TaskOrchestrator })._taskOrchestrator = orchestrator;

  // POST /tasks - Create a new task
  fastify.post(
    '/tasks',
    {
      schema: {
        body: createTaskSchema,
        response: {
          201: taskResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const cleanedInput = cleanTaskInput(request.body as Record<string, unknown>);
        const task = taskRepoInstance.create(cleanedInput);

        // Orchestrator hook: spawn run if agents are available
        const taskOrchestrator = (fastify as { _taskOrchestrator?: TaskOrchestrator })
          ._taskOrchestrator;
        if (taskOrchestrator && task.agents.length > 0) {
          const agentId = task.agents[0]; // Use first agent for MVP
          try {
            const runId = await taskOrchestrator.spawnRunForTask(task, agentId);
            // Watch the run for status updates
            await taskOrchestrator.watchRunForTask(runId, task.id);
          } catch (error) {
            // Log error but don't fail the task creation
            fastify.log.warn(
              'Failed to spawn run for task %s: %s',
              task.id,
              (error as Error).message,
            );
          }
        }

        // Get the updated task from the repo (in case orchestrator modified it)
        const updatedTask = taskRepoInstance.get(task.id) || task;
        return reply.status(201).header('Location', `/tasks/${updatedTask.id}`).send(updatedTask);
      } catch (error) {
        return reply.status(400).send({
          error: (error as Error).message,
          details: { field: 'validation' },
        });
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
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          limit = 50,
          offset = 0,
          sort = 'createdAt:desc',
        } = request.query as {
          limit?: number;
          offset?: number;
          sort?: string;
        };

        const result = taskRepoInstance.list({ limit, offset, sort });

        // Add Link headers for pagination
        const baseUrl = `${request.protocol}://${request.hostname}${request.url.split('?')[0]}`;
        const linkHeaders = generateLinkHeaders(baseUrl, limit, offset, result.total);

        Object.entries(linkHeaders).forEach(([key, value]) => {
          reply.header(key, value);
        });

        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({
          error: (error as Error).message,
          details: { field: 'pagination' },
        });
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
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const task = taskRepoInstance.get(id);

      if (!task) {
        return reply.status(404).send({
          error: 'Task not found',
          details: { id },
        });
      }

      return reply.send(task);
    },
  );
}
