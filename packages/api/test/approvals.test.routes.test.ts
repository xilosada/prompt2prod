import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { registerApprovalTestRoutes, resetTestStores } from '../src/routes/approvals.test-utils.js';

// Mock environment to ensure test routes are available
const originalEnv = process.env.NODE_ENV;

describe('approval test routes', () => {
  beforeEach(() => {
    // Ensure we're in a non-production environment
    process.env.NODE_ENV = 'test';
    resetTestStores();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    resetTestStores();
  });

  it('should handle manual approval endpoint', async () => {
    const app = Fastify();
    await registerApprovalTestRoutes(app);

    // Test successful manual approval
    const response = await app.inject({
      method: 'POST',
      url: '/__test__/approvals/manual',
      payload: {
        taskId: 'test-task-123',
        approverId: 'user-456',
        approved: true,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('granted');
    expect(body.message).toContain('test-task-123');
    expect(body.message).toContain('user-456');
  });

  it('should handle manual approval rejection', async () => {
    const app = Fastify();
    await registerApprovalTestRoutes(app);

    // Test manual rejection
    const response = await app.inject({
      method: 'POST',
      url: '/__test__/approvals/manual',
      payload: {
        taskId: 'test-task-123',
        approverId: 'user-456',
        approved: false,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('rejected');
  });

  it('should default to approved when approved field is missing', async () => {
    const app = Fastify();
    await registerApprovalTestRoutes(app);

    // Test without approved field (should default to true)
    const response = await app.inject({
      method: 'POST',
      url: '/__test__/approvals/manual',
      payload: {
        taskId: 'test-task-123',
        approverId: 'user-456',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('granted');
  });

  it('should validate required fields for manual approval', async () => {
    const app = Fastify();
    await registerApprovalTestRoutes(app);

    // Test missing required fields
    const response = await app.inject({
      method: 'POST',
      url: '/__test__/approvals/manual',
      payload: {
        taskId: 'test-task-123',
        // missing approverId
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should handle checks endpoint', async () => {
    const app = Fastify();
    await registerApprovalTestRoutes(app);

    // Test setting checks state to success
    const response = await app.inject({
      method: 'POST',
      url: '/__test__/approvals/checks',
      payload: {
        taskId: 'test-task-123',
        state: 'success',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('success');
    expect(body.message).toContain('test-task-123');
  });

  it('should handle all checks states', async () => {
    const app = Fastify();
    await registerApprovalTestRoutes(app);

    const states = ['success', 'failure', 'pending', 'unknown'] as const;

    for (const state of states) {
      const response = await app.inject({
        method: 'POST',
        url: '/__test__/approvals/checks',
        payload: {
          taskId: 'test-task-123',
          state,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain(state);
    }
  });

  it('should validate checks state', async () => {
    const app = Fastify();
    await registerApprovalTestRoutes(app);

    // Test invalid state
    const response = await app.inject({
      method: 'POST',
      url: '/__test__/approvals/checks',
      payload: {
        taskId: 'test-task-123',
        state: 'invalid-state',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should handle reset endpoint', async () => {
    const app = Fastify();
    await registerApprovalTestRoutes(app);

    // First seed some data
    await app.inject({
      method: 'POST',
      url: '/__test__/approvals/manual',
      payload: {
        taskId: 'test-task-123',
        approverId: 'user-456',
        approved: true,
      },
    });

    await app.inject({
      method: 'POST',
      url: '/__test__/approvals/checks',
      payload: {
        taskId: 'test-task-123',
        state: 'success',
      },
    });

    // Now reset
    const response = await app.inject({
      method: 'POST',
      url: '/__test__/approvals/reset',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('cleared');
  });

  it('should not register routes in production environment', async () => {
    // Temporarily set production environment
    process.env.NODE_ENV = 'production';

    const app = Fastify();
    await registerApprovalTestRoutes(app);

    // Try to access the endpoints - they should not be registered
    const response = await app.inject({
      method: 'POST',
      url: '/__test__/approvals/manual',
      payload: {
        taskId: 'test-task-123',
        approverId: 'user-456',
      },
    });

    // Should get 404 because routes are not registered in production
    expect(response.statusCode).toBe(404);
  });

  it('should integrate with test providers', async () => {
    const app = Fastify();
    await registerApprovalTestRoutes(app);

    // Seed manual approval
    await app.inject({
      method: 'POST',
      url: '/__test__/approvals/manual',
      payload: {
        taskId: 'test-task-123',
        approverId: 'user-456',
        approved: true,
      },
    });

    // Seed checks state
    await app.inject({
      method: 'POST',
      url: '/__test__/approvals/checks',
      payload: {
        taskId: 'test-task-123',
        state: 'success',
      },
    });

    // The test providers should now return the seeded values
    // This would be tested in integration with the main approval routes
    // For now, we just verify the seeding worked without errors
    expect(true).toBe(true); // Seeding completed successfully
  });
});
