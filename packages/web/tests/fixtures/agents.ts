import { test as base } from '@playwright/test';

// Extend the test fixture to include agent management
export const test = base.extend<{
  createAgent: (id: string, caps?: Record<string, unknown>) => Promise<void>;
}>({
  createAgent: async ({ request }, use) => {
    const createAgent = async (id: string, caps: Record<string, unknown> = {}) => {
      const apiBase = process.env.API_BASE || 'http://localhost:3000';
      try {
        const response = await request.post(`${apiBase}/__test/agents/${id}/heartbeat`, {
          headers: { 'content-type': 'application/json' },
          data: { caps },
        });
        if (response.status() !== 204) {
          throw new Error(`Failed to create agent ${id}: ${response.status()}`);
        }
      } catch (error) {
        throw new Error(
          `Failed to create agent ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    };
    await use(createAgent);
  },
});

export { expect } from '@playwright/test';
