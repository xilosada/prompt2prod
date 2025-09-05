import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerApprovalRoutes } from '../src/routes/approvals.js';
import { MemoryTaskRepo } from '../src/tasks/repo.memory.js';
import { createProviderRegistry, type ProviderRegistry } from '../src/approvals/evaluator.js';
import type { ApprovalPolicy } from '@prompt2prod/shared';

describe('approvals routes', () => {
  let app: ReturnType<typeof Fastify>;
  let taskRepo: MemoryTaskRepo;
  let providerRegistry: ProviderRegistry;

  beforeEach(() => {
    app = Fastify();
    taskRepo = new MemoryTaskRepo();

    // Create a test provider registry with mock providers
    providerRegistry = createProviderRegistry({
      'satisfied-provider': async () => 'satisfied',
      'pending-provider': async () => 'pending',
      'fail-provider': async () => 'fail',
      'unsupported-provider': async () => 'unsupported',
      'error-provider': async () => {
        throw new Error('Provider error');
      },
    });
  });

  describe('GET /tasks/:id/approvals', () => {
    it('should return 404 for non-existent task', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const response = await app.inject({
        method: 'GET',
        url: '/tasks/non-existent-id/approvals',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: 'Task not found',
      });
    });

    it('should return 400 for task without approval policy', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      // Create a task without policy
      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'Task has no approval policy',
      });
    });

    it('should return 400 for task with invalid approval policy', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      // Create a task with invalid policy
      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy: { invalid: 'policy' }, // Missing required fields
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: expect.stringContaining('Invalid approval policy:'),
      });
    });

    it('should return approval status for valid task with allOf policy (strict=true)', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'satisfied-provider' }, { provider: 'pending-provider' }],
      };

      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals?strict=true`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toEqual({
        taskId: task.id,
        strict: true,
        aggregate: 'pending', // allOf with satisfied + pending = pending
        rules: [
          { provider: 'satisfied-provider', verdict: 'satisfied' },
          { provider: 'pending-provider', verdict: 'pending' },
        ],
      });
    });

    it('should return approval status for valid task with anyOf policy (strict=false)', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const policy: ApprovalPolicy = {
        mode: 'anyOf',
        rules: [{ provider: 'fail-provider' }, { provider: 'unsupported-provider' }],
      };

      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals?strict=false`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toEqual({
        taskId: task.id,
        strict: false,
        aggregate: 'pending', // anyOf with fail + unsupported (non-strict) = pending
        rules: [
          { provider: 'fail-provider', verdict: 'fail' },
          { provider: 'unsupported-provider', verdict: 'unsupported' },
        ],
      });
    });

    it('should default to strict=true when strict parameter is not provided', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'satisfied-provider' }, { provider: 'unsupported-provider' }],
      };

      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals`, // No strict parameter
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.strict).toBe(true);
      expect(body.aggregate).toBe('fail'); // allOf with satisfied + unsupported (strict) = error -> fail
    });

    it('should handle missing providers as unsupported', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [
          { provider: 'satisfied-provider' },
          { provider: 'missing-provider' }, // Not in registry
        ],
      };

      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.aggregate).toBe('fail'); // allOf with satisfied + unsupported (strict) = error -> fail
      expect(body.rules).toEqual([
        { provider: 'satisfied-provider', verdict: 'satisfied' },
        { provider: 'missing-provider', verdict: 'unsupported' },
      ]);
    });

    it('should handle provider errors as fail', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [
          { provider: 'satisfied-provider' },
          { provider: 'error-provider' }, // Throws error
        ],
      };

      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.aggregate).toBe('fail'); // allOf with satisfied + fail = error -> fail
      expect(body.rules).toEqual([
        { provider: 'satisfied-provider', verdict: 'satisfied' },
        { provider: 'error-provider', verdict: 'fail' },
      ]);
    });

    it('should return satisfied when all rules are satisfied (allOf)', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'satisfied-provider' }, { provider: 'satisfied-provider' }],
      };

      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.aggregate).toBe('satisfied');
    });

    it('should return satisfied when any rule is satisfied (anyOf)', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const policy: ApprovalPolicy = {
        mode: 'anyOf',
        rules: [{ provider: 'fail-provider' }, { provider: 'satisfied-provider' }],
      };

      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.aggregate).toBe('satisfied');
    });

    it('should handle STRICT mixed case from QA (allOf with satisfied + pending + unsupported)', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [
          { provider: 'satisfied-provider' },
          { provider: 'pending-provider' },
          { provider: 'unsupported-provider' },
        ],
      };

      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals?strict=true`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.aggregate).toBe('fail'); // allOf with unsupported (strict) = error -> fail
      expect(body.rules).toEqual([
        { provider: 'satisfied-provider', verdict: 'satisfied' },
        { provider: 'pending-provider', verdict: 'pending' },
        { provider: 'unsupported-provider', verdict: 'unsupported' },
      ]);
    });

    it('should validate task ID parameter', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const response = await app.inject({
        method: 'GET',
        url: '/tasks//approvals', // Empty ID
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate strict query parameter', async () => {
      await registerApprovalRoutes(app, taskRepo, providerRegistry);

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'satisfied-provider' }],
      };

      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals?strict=invalid`,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('default providers', () => {
    it('should use default providers when none provided', async () => {
      // Register without custom provider registry
      await registerApprovalRoutes(app, taskRepo);

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'manual' }, { provider: 'checks' }],
      };

      const task = taskRepo.create({
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'org/repo',
        policy,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}/approvals`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.aggregate).toBe('pending'); // manual=pending, checks=satisfied, allOf=pending
      expect(body.rules).toEqual([
        { provider: 'manual', verdict: 'pending' },
        { provider: 'checks', verdict: 'satisfied' },
      ]);
    });
  });
});
