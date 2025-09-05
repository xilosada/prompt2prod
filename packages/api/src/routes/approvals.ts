import type { FastifyInstance } from 'fastify';
import type { ApprovalPolicy, Task, ProviderVerdict, ProviderRegistry } from '@prompt2prod/shared';
import { validateApprovalPolicy } from '../approvals/policy.js';
import { evaluatePolicy, createProviderRegistry } from '../approvals/evaluator.js';
import type { MemoryTaskRepo } from '../tasks/repo.memory.js';
import { createTestProviders } from './approvals.test-utils.js';

// Response DTO types
export interface ApprovalRuleResult {
  provider: string;
  verdict: ProviderVerdict;
}

export interface TaskApprovalsResponse {
  taskId: string;
  strict: boolean;
  aggregate: 'satisfied' | 'pending' | 'fail' | 'error';
  rules: ApprovalRuleResult[];
}

// Default providers for MVP
const createDefaultProviders = (): ProviderRegistry => {
  return createProviderRegistry({
    // Manual approval provider - always returns pending for MVP
    manual: async ({ taskId, policyRule }) => {
      // In a real implementation, this would check a database for manual approvals
      // For MVP, we'll return pending to indicate manual approval is required
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = { taskId, policyRule }; // Acknowledge parameters for future use
      return 'pending';
    },

    // Checks provider - simulates CI checks
    checks: async ({ taskId, policyRule }) => {
      // In a real implementation, this would check CI status
      // For MVP, we'll return satisfied to simulate passing checks
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = { taskId, policyRule }; // Acknowledge parameters for future use
      return 'satisfied';
    },
  });
};

export async function registerApprovalRoutes(
  fastify: FastifyInstance,
  taskRepo: MemoryTaskRepo,
  providerRegistry?: ProviderRegistry,
) {
  // Use provided registry or default providers
  const registry = providerRegistry || createDefaultProviders();

  // Helper function to find task by run ID
  const findTaskByRunId = (runId: string): Task | undefined => {
    const tasks = taskRepo.list({ limit: 200 }); // Get all tasks for search (max allowed)
    return tasks.items.find((task) => task.runs?.some((run) => run.id === runId));
  };

  // GET /tasks/:id/approvals - Get approval status for a task
  fastify.get<{
    Params: { id: string };
    Querystring: { strict?: string };
    Reply: TaskApprovalsResponse | { error: string };
  }>(
    '/tasks/:id/approvals',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1 },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            strict: { type: 'string', enum: ['true', 'false'] },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['taskId', 'strict', 'aggregate', 'rules'],
            properties: {
              taskId: { type: 'string' },
              strict: { type: 'boolean' },
              aggregate: { type: 'string', enum: ['satisfied', 'pending', 'fail', 'error'] },
              rules: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['provider', 'verdict'],
                  properties: {
                    provider: { type: 'string' },
                    verdict: {
                      type: 'string',
                      enum: ['satisfied', 'pending', 'fail', 'unsupported'],
                    },
                  },
                },
              },
            },
          },
          404: {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id: taskId } = request.params;
      const strict = request.query.strict !== 'false'; // default to true

      // Get the task
      const task = taskRepo.get(taskId);
      if (!task) {
        return reply.status(404).send({
          error: 'Task not found',
        });
      }

      // Check if task has an approval policy
      if (!task.policy) {
        return reply.status(400).send({
          error: 'Task has no approval policy',
        });
      }

      // Validate the approval policy
      const policyResult = validateApprovalPolicy(task.policy);
      if (!policyResult.ok) {
        return reply.status(400).send({
          error: `Invalid approval policy: ${policyResult.reason}`,
        });
      }

      const policy: ApprovalPolicy = policyResult.policy;

      // Evaluate the policy and get individual rule results
      const ruleResults: ApprovalRuleResult[] = [];

      for (const rule of policy.rules) {
        const provider = registry[rule.provider];
        let verdict: 'satisfied' | 'pending' | 'fail' | 'unsupported';

        if (!provider) {
          verdict = 'unsupported';
        } else {
          try {
            verdict = await provider({ taskId, policyRule: rule });
          } catch {
            // Treat provider errors as 'fail' for deterministic behavior
            verdict = 'fail';
          }
        }

        ruleResults.push({
          provider: rule.provider,
          verdict,
        });
      }

      // Get the aggregate result using the evaluator
      const aggregate = await evaluatePolicy(policy, {
        taskId,
        registry,
        strict,
      });

      // Map 'error' to 'fail' for the response (as per requirements)
      const responseAggregate = aggregate === 'error' ? 'fail' : aggregate;

      return reply.send({
        taskId,
        strict,
        aggregate: responseAggregate,
        rules: ruleResults,
      });
    },
  );

  // GET /runs/:id/approvals - Get approval status for a run (via its task)
  fastify.get<{
    Params: { id: string };
    Querystring: { strict?: string };
    Reply: TaskApprovalsResponse | { error: string };
  }>(
    '/runs/:id/approvals',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', minLength: 1 },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            strict: { type: 'string', enum: ['true', 'false'] },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['taskId', 'strict', 'aggregate', 'rules'],
            properties: {
              taskId: { type: 'string' },
              strict: { type: 'boolean' },
              aggregate: { type: 'string', enum: ['satisfied', 'pending', 'fail', 'error'] },
              rules: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['provider', 'verdict'],
                  properties: {
                    provider: { type: 'string' },
                    verdict: {
                      type: 'string',
                      enum: ['satisfied', 'pending', 'fail', 'unsupported'],
                    },
                  },
                },
              },
            },
          },
          404: {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id: runId } = request.params;
      const strict = request.query.strict !== 'false'; // default to true

      // Find the task that contains this run
      const task = findTaskByRunId(runId);
      if (!task) {
        return reply.status(404).send({
          error: 'Run not found or not associated with any task',
        });
      }

      // Check if task has an approval policy
      if (!task.policy) {
        return reply.status(400).send({
          error: 'Task has no approval policy',
        });
      }

      // Validate the approval policy
      const policyResult = validateApprovalPolicy(task.policy);
      if (!policyResult.ok) {
        return reply.status(400).send({
          error: `Invalid approval policy: ${policyResult.reason}`,
        });
      }

      const policy: ApprovalPolicy = policyResult.policy;

      // Evaluate the policy and get individual rule results
      const ruleResults: ApprovalRuleResult[] = [];

      for (const rule of policy.rules) {
        const provider = registry[rule.provider];
        let verdict: 'satisfied' | 'pending' | 'fail' | 'unsupported';

        if (!provider) {
          verdict = 'unsupported';
        } else {
          try {
            verdict = await provider({ taskId: task.id, policyRule: rule });
          } catch {
            // Treat provider errors as 'fail' for deterministic behavior
            verdict = 'fail';
          }
        }

        ruleResults.push({
          provider: rule.provider,
          verdict,
        });
      }

      // Get the aggregate result using the evaluator
      const aggregate = await evaluatePolicy(policy, {
        taskId: task.id,
        registry,
        strict,
      });

      // Map 'error' to 'fail' for the response (as per requirements)
      const responseAggregate = aggregate === 'error' ? 'fail' : aggregate;

      return reply.send({
        taskId: task.id,
        strict,
        aggregate: responseAggregate,
        rules: ruleResults,
      });
    },
  );
}

/**
 * Registers approval routes with test providers (for dev/test environments)
 */
export async function registerApprovalRoutesWithTestProviders(
  fastify: FastifyInstance,
  taskRepo: MemoryTaskRepo,
) {
  return registerApprovalRoutes(fastify, taskRepo, createTestProviders());
}
