import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Bus } from '../bus/Bus.js';
import { topics } from '../bus/topics.js';
import type { Task, TaskRunRef } from '@prompt2prod/shared';
import type { RunsRepo } from '../runs/repo.memory.js';
import type { MemoryTaskRepo } from './repo.memory.js';

type UnsubFn = () => void;

export interface TaskOrchestrator {
  spawnRunForTask(task: Task, agentId: string): Promise<string>;
  watchRunForTask(runId: string, taskId: string): Promise<UnsubFn>;
  setOnTaskCreated(callback: (task: Task) => void): void;
}

export function attachTaskOrchestrator(
  app: FastifyInstance,
  bus: Bus,
  runsRepo: RunsRepo,
  tasksRepo: MemoryTaskRepo,
): TaskOrchestrator {
  const activeSubscriptions = new Map<string, UnsubFn>();
  let onTaskCreated: ((task: Task) => void) | null = null;

  // Cleanup subscriptions on server close
  app.addHook('onClose', async () => {
    try {
      for (const unsub of activeSubscriptions.values()) {
        await unsub();
      }
      activeSubscriptions.clear();
    } catch {
      // Ignore cleanup errors
    }
  });

  const orchestrator: TaskOrchestrator = {
    async spawnRunForTask(task: Task, agentId: string): Promise<string> {
      // Check if task already has runs (idempotency)
      if (task.runs && task.runs.length > 0) {
        return task.runs[0].id;
      }

      const runId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Publish work to agent
      await bus.publish(topics.agentWork(agentId), {
        taskId: task.id,
        runId,
        goal: task.goal,
      });

      // Create the run in the runs repo
      runsRepo.create({
        id: runId,
        agentId,
        repo: task.targetRepo,
        base: 'main', // Default branch
        prompt: task.goal,
        status: 'queued',
      });

      // Update task with run info and set state to running
      const runRef: TaskRunRef = {
        id: runId,
        agentId,
        createdAt: now,
      };

      tasksRepo.update(task.id, () => ({
        state: 'running',
        runs: [runRef],
      }));

      return runId;
    },

    async watchRunForTask(runId: string, taskId: string): Promise<UnsubFn> {
      // Don't create duplicate subscriptions
      if (activeSubscriptions.has(runId)) {
        return activeSubscriptions.get(runId)!;
      }

      const unsub = await bus.subscribe<{
        state: string;
        detail?: unknown;
      }>(topics.runStatus(runId), async (msg) => {
        if (!msg?.state) return;

        const task = tasksRepo.get(taskId);
        if (!task) return;

        const run = runsRepo.get(runId);
        if (!run) return;

        let updates: Partial<Task> = {};

        if (msg.state === 'done') {
          if (run.pr) {
            // Run has PR info - transition to awaiting-approvals
            updates = {
              state: 'awaiting-approvals',
              pr: run.pr,
            };
          } else {
            // No PR - transition to done
            updates = {
              state: 'done',
            };
          }
        } else if (msg.state === 'error' || msg.state === 'canceled') {
          // Transition to error state
          const errorMessage =
            msg.detail && typeof msg.detail === 'object' && 'message' in msg.detail
              ? String(msg.detail.message)
              : `Run ${msg.state}`;
          updates = {
            state: 'error',
            error: errorMessage,
          };
        }

        if (Object.keys(updates).length > 0) {
          tasksRepo.update(taskId, () => updates);
        }

        // Unsubscribe for terminal states
        if (['done', 'error', 'canceled', 'awaiting-approvals'].includes(updates.state || '')) {
          const subscription = activeSubscriptions.get(runId);
          if (subscription) {
            await subscription();
            activeSubscriptions.delete(runId);
          }
        }
      });

      activeSubscriptions.set(runId, unsub);
      return unsub;
    },

    setOnTaskCreated(callback: (task: Task) => void): void {
      onTaskCreated = callback;
    },
  };

  // Expose the callback for routes to use
  (orchestrator as { onTaskCreated?: ((task: Task) => void) | null }).onTaskCreated = onTaskCreated;

  return orchestrator;
}
