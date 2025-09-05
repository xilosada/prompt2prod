import type { FastifyInstance } from 'fastify';
import type { ProviderRegistry } from '../approvals/evaluator.js';

// In-memory stores for test seeding
interface ManualApprovalStore {
  [taskId: string]: {
    [approverId: string]: boolean; // true = approved, false = rejected
  };
}

interface ChecksStore {
  [taskId: string]: 'success' | 'failure' | 'pending' | 'unknown';
}

// Global test stores (only used in test/dev environments)
const manualApprovalStore: ManualApprovalStore = {};
const checksStore: ChecksStore = {};

/**
 * Creates test providers that use the in-memory stores
 */
export function createTestProviders(): ProviderRegistry {
  return {
    // Manual approval provider - checks the test store
    manual: async ({ taskId }) => {
      const approvals = manualApprovalStore[taskId];
      if (!approvals) {
        return 'pending'; // No approvals recorded yet
      }

      // Check if any approver has approved
      const hasApproval = Object.values(approvals).some((approved) => approved);
      if (hasApproval) {
        return 'satisfied';
      }

      // Check if any approver has rejected
      const hasRejection = Object.values(approvals).some((approved) => !approved);
      if (hasRejection) {
        return 'fail';
      }

      return 'pending';
    },

    // Checks provider - uses the test store
    checks: async ({ taskId }) => {
      const state = checksStore[taskId];
      if (!state) {
        return 'pending'; // No state recorded yet
      }

      switch (state) {
        case 'success':
          return 'satisfied';
        case 'failure':
          return 'fail';
        case 'pending':
          return 'pending';
        case 'unknown':
        default:
          return 'pending';
      }
    },
  };
}

/**
 * Seeds a manual approval for a task
 */
export function seedManualApproval(taskId: string, approverId: string, approved: boolean): void {
  if (!manualApprovalStore[taskId]) {
    manualApprovalStore[taskId] = {};
  }
  manualApprovalStore[taskId][approverId] = approved;
}

/**
 * Seeds a checks state for a task
 */
export function seedChecksState(
  taskId: string,
  state: 'success' | 'failure' | 'pending' | 'unknown',
): void {
  checksStore[taskId] = state;
}

/**
 * Clears all test stores
 */
export function resetTestStores(): void {
  Object.keys(manualApprovalStore).forEach((key) => delete manualApprovalStore[key]);
  Object.keys(checksStore).forEach((key) => delete checksStore[key]);
}

/**
 * Registers test-only approval seed endpoints
 * Only available when NODE_ENV !== 'production'
 */
export async function registerApprovalTestRoutes(fastify: FastifyInstance) {
  // Environment gate - never register in production
  if (process.env.NODE_ENV === 'production') {
    fastify.log.warn('[test] Approval test routes skipped in production');
    return;
  }

  // POST /__test__/approvals/manual - Record a manual approval
  fastify.post<{
    Body: { taskId: string; approverId: string; approved?: boolean };
    Reply: { success: boolean; message: string } | { error: string };
  }>(
    '/__test__/approvals/manual',
    {
      schema: {
        body: {
          type: 'object',
          required: ['taskId', 'approverId'],
          properties: {
            taskId: { type: 'string', minLength: 1 },
            approverId: { type: 'string', minLength: 1 },
            approved: { type: 'boolean' }, // defaults to true if not provided
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['success', 'message'],
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
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
      const { taskId, approverId, approved = true } = request.body;

      try {
        seedManualApproval(taskId, approverId, approved);

        return reply.send({
          success: true,
          message: `Manual approval ${approved ? 'granted' : 'rejected'} for task ${taskId} by ${approverId}`,
        });
      } catch (error) {
        return reply.status(400).send({
          error: `Failed to seed manual approval: ${(error as Error).message}`,
        });
      }
    },
  );

  // POST /__test__/approvals/checks - Set checks state
  fastify.post<{
    Body: { taskId: string; state: 'success' | 'failure' | 'pending' | 'unknown' };
    Reply: { success: boolean; message: string } | { error: string };
  }>(
    '/__test__/approvals/checks',
    {
      schema: {
        body: {
          type: 'object',
          required: ['taskId', 'state'],
          properties: {
            taskId: { type: 'string', minLength: 1 },
            state: {
              type: 'string',
              enum: ['success', 'failure', 'pending', 'unknown'],
            },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['success', 'message'],
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
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
      const { taskId, state } = request.body;

      try {
        seedChecksState(taskId, state);

        return reply.send({
          success: true,
          message: `Checks state set to ${state} for task ${taskId}`,
        });
      } catch (error) {
        return reply.status(400).send({
          error: `Failed to seed checks state: ${(error as Error).message}`,
        });
      }
    },
  );

  // POST /__test__/approvals/reset - Clear all stores
  fastify.post<{
    Reply: { success: boolean; message: string } | { error: string };
  }>(
    '/__test__/approvals/reset',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            required: ['success', 'message'],
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          500: {
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
      try {
        resetTestStores();

        return reply.send({
          success: true,
          message: 'All approval test stores cleared',
        });
      } catch (error) {
        return reply.status(500).send({
          error: `Failed to reset stores: ${(error as Error).message}`,
        });
      }
    },
  );

  fastify.log.info('[test] Approval test seed endpoints registered');
}
