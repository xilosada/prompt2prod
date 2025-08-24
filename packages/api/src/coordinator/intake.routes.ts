import { FastifyInstance } from 'fastify';
import { MemoryTaskRepo, CreateTaskInput } from '../tasks/repo.memory.js';
import {
  trimmed,
  trimArrayUnique,
  isValidTargetRepo,
  isPolicyWithinCaps,
} from '../util/validators.js';

// JSON Schemas
const coordinatorIntakeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'goal', 'targetRepo'],
  properties: {
    title: { type: 'string' },
    goal: { type: 'string' },
    targetRepo: { type: 'string' },
    agents: {
      type: 'array',
      maxItems: 16,
      items: { type: 'string' },
    },
    policy: { type: 'object', additionalProperties: true },
    plan: { type: 'string' },
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
  },
  required: ['id', 'title', 'goal', 'targetRepo', 'agents', 'state', 'createdAt', 'updatedAt'],
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

/**
 * Validates and sanitizes coordinator intake input
 * Schema handles basic validation (types, extra fields)
 * This function handles all business logic validation and sanitization
 */
function validateAndSanitizeIntake(input: Record<string, unknown>): CreateTaskInput {
  // Trim and validate required fields
  const title = trimmed(input.title as string);
  const goal = trimmed(input.goal as string);
  const targetRepo = trimmed(input.targetRepo as string);

  // Check for empty required fields after trimming
  if (!title) {
    throw new Error('Title is required and cannot be empty after trimming');
  }
  if (!goal) {
    throw new Error('Goal is required and cannot be empty after trimming');
  }
  if (!targetRepo) {
    throw new Error('Target repository is required and cannot be empty after trimming');
  }

  // Validate title length
  if (title.length > 120) {
    throw new Error('Title must be 120 characters or less');
  }

  // Validate goal length
  if (goal.length > 2000) {
    throw new Error('Goal must be 2000 characters or less');
  }

  // Validate targetRepo format
  if (!isValidTargetRepo(targetRepo)) {
    throw new Error(
      'Target repository must be a GitHub slug (owner/repo) or file URL (file:///path)',
    );
  }

  // Process agents array (schema ensures it's an array with valid items)
  const agents = trimArrayUnique(Array.isArray(input.agents) ? input.agents : []);

  // Validate each agent format
  for (const agent of agents) {
    if (!/^[A-Za-z0-9_.-]+$/.test(agent)) {
      throw new Error(
        `Agent name "${agent}" contains invalid characters. Only letters, numbers, dots, underscores, and hyphens are allowed`,
      );
    }
  }

  // Process policy object
  let policy: Record<string, unknown> | undefined;
  if (input.policy !== undefined) {
    if (input.policy === null || typeof input.policy !== 'object') {
      throw new Error('Policy must be an object');
    }

    policy = input.policy as Record<string, unknown>;

    // Check policy caps
    const capsCheck = isPolicyWithinCaps(policy);
    if (!capsCheck.ok) {
      throw new Error(`Policy validation failed: ${capsCheck.reason}`);
    }
  }

  // Handle raw plan text - store under policy.__plan if provided
  if (input.plan !== undefined && typeof input.plan === 'string') {
    const planText = input.plan.trim();
    if (planText) {
      // Initialize policy if not present
      if (!policy) {
        policy = {};
      }

      // Truncate plan to fit within 32KB policy limit (leaving room for other policy fields)
      const maxPlanSize = 30 * 1024; // 30KB to leave room for other policy fields
      const truncatedPlan =
        planText.length > maxPlanSize ? planText.substring(0, maxPlanSize) : planText;

      policy.__plan = truncatedPlan;

      // Re-check policy caps after adding plan
      const capsCheck = isPolicyWithinCaps(policy);
      if (!capsCheck.ok) {
        throw new Error(`Policy with plan exceeds limits: ${capsCheck.reason}`);
      }
    }
  }

  return {
    title,
    goal,
    targetRepo,
    agents,
    policy,
  };
}

export async function coordinatorIntakeRoutes(fastify: FastifyInstance) {
  const taskRepo = new MemoryTaskRepo();

  // POST /coordinator/intake - Create a task from coordinator submission
  fastify.post(
    '/coordinator/intake',
    {
      attachValidation: true,
      schema: {
        body: coordinatorIntakeSchema,
        response: {
          201: taskResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'invalid_request',
          details: request.validationError.validation,
        });
      }

      try {
        const sanitizedInput = validateAndSanitizeIntake(request.body as Record<string, unknown>);
        const task = taskRepo.create(sanitizedInput);

        return reply.header('Location', `/tasks/${task.id}`).code(201).send(task);
      } catch (error) {
        return reply.code(400).send({
          error: (error as Error).message,
          details: { field: 'validation' },
        });
      }
    },
  );
}
