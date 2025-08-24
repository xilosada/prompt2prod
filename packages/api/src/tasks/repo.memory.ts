import { randomUUID } from 'crypto';
import type { Task } from '@prompt2prod/shared';

export interface CreateTaskInput {
  title: string;
  goal: string;
  targetRepo: string;
  agents?: string[];
  policy?: Record<string, unknown>;
}

export interface ListTasksOptions {
  offset?: number;
  limit?: number;
  sort?: string;
}

export interface ListTasksResult {
  items: Task[];
  total: number;
}

export class MemoryTaskRepo {
  private tasks = new Map<string, Task>();

  create(input: CreateTaskInput): Task {
    // Validate input (this is called after routes validation, but keeping as safety)
    if (!input.title || input.title.length < 1 || input.title.length > 120) {
      throw new Error('Title must be between 1 and 120 characters');
    }
    if (!input.goal || input.goal.length < 1 || input.goal.length > 2000) {
      throw new Error('Goal must be between 1 and 2000 characters');
    }
    if (!input.targetRepo) {
      throw new Error('Target repository is required');
    }
    if (input.agents && input.agents.length > 16) {
      throw new Error('Maximum 16 agents allowed');
    }

    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      goal: input.goal,
      targetRepo: input.targetRepo,
      agents: input.agents || [],
      policy: input.policy,
      state: 'planned',
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  list(options: ListTasksOptions = {}): ListTasksResult {
    const { offset = 0, limit = 50, sort = 'createdAt:desc' } = options;

    // Validate pagination
    if (limit < 1 || limit > 200) {
      throw new Error('Limit must be between 1 and 200');
    }
    if (offset < 0) {
      throw new Error('Offset must be non-negative');
    }

    // Convert to array and sort based on sort parameter
    const sortedTasks = Array.from(this.tasks.values());

    if (sort === 'createdAt:desc') {
      sortedTasks.sort((a, b) => {
        const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.id.localeCompare(a.id); // Secondary sort by id (desc)
      });
    } else if (sort === 'createdAt:asc') {
      sortedTasks.sort((a, b) => {
        const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id); // Secondary sort by id (asc)
      });
    }

    const total = sortedTasks.length;
    const items = sortedTasks.slice(offset, offset + limit);

    return { items, total };
  }
}
