import { describe, it, expect, beforeEach } from 'vitest';
import type { Task, ApprovalPolicy } from '@prompt2prod/shared';
import { createDefaultProviderRegistry } from '../src/approvals/providers/registry.js';
import { evaluatePolicy } from '../src/approvals/evaluator.js';

describe('Approval Provider Stubs', () => {
  let manual: Map<string, Set<string>>;
  let checks: Map<string, 'success' | 'failure' | 'pending' | 'unknown'>;
  let registry: ReturnType<typeof createDefaultProviderRegistry>;
  let mockTask: Task;

  beforeEach(() => {
    // Create fresh stores per test
    manual = new Map<string, Set<string>>();
    checks = new Map<string, 'success' | 'failure' | 'pending' | 'unknown'>();
    registry = createDefaultProviderRegistry({ manual, checks });

    mockTask = {
      id: 'test-task-1',
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'test/repo',
      agents: ['agent1'],
      state: 'planned',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
  });

  describe('Manual Provider', () => {
    it('should return unsupported when rule.id is missing', async () => {
      const result = await registry.manual({
        rule: { provider: 'manual' },
        task: mockTask,
      });
      expect(result).toBe('unsupported');
    });

    it('should return unsupported when rule.id is empty string', async () => {
      const result = await registry.manual({
        rule: { provider: 'manual', id: '' },
        task: mockTask,
      });
      expect(result).toBe('unsupported');
    });

    it('should return unsupported when rule.id is not a string', async () => {
      const result = await registry.manual({
        rule: { provider: 'manual', id: 123 },
        task: mockTask,
      });
      expect(result).toBe('unsupported');
    });

    it('should return pending when approver not found', async () => {
      const result = await registry.manual({
        rule: { provider: 'manual', id: 'approver1' },
        task: mockTask,
      });
      expect(result).toBe('pending');
    });

    it('should return pass when approver found', async () => {
      // Add approver to store
      const approvers = new Set(['approver1']);
      manual.set(mockTask.id, approvers);

      const result = await registry.manual({
        rule: { provider: 'manual', id: 'approver1' },
        task: mockTask,
      });
      expect(result).toBe('pass');
    });

    it('should return pending when task exists but approver not in set', async () => {
      // Add different approver to store
      const approvers = new Set(['approver2']);
      manual.set(mockTask.id, approvers);

      const result = await registry.manual({
        rule: { provider: 'manual', id: 'approver1' },
        task: mockTask,
      });
      expect(result).toBe('pending');
    });
  });

  describe('QA Provider', () => {
    it('should return pass when qa approver found', async () => {
      // Add qa approver to store
      const approvers = new Set(['qa']);
      manual.set(mockTask.id, approvers);

      const result = await registry.qa({
        rule: { provider: 'qa' },
        task: mockTask,
      });
      expect(result).toBe('pass');
    });

    it('should return pending when qa approver not found', async () => {
      const result = await registry.qa({
        rule: { provider: 'qa' },
        task: mockTask,
      });
      expect(result).toBe('pending');
    });

    it('should ignore rule.id and always use qa', async () => {
      // Add qa approver to store
      const approvers = new Set(['qa']);
      manual.set(mockTask.id, approvers);

      const result = await registry.qa({
        rule: { provider: 'qa', id: 'some-other-id' },
        task: mockTask,
      });
      expect(result).toBe('pass');
    });
  });

  describe('Coordinator Provider', () => {
    it('should return pass when coordinator approver found', async () => {
      // Add coordinator approver to store
      const approvers = new Set(['coordinator']);
      manual.set(mockTask.id, approvers);

      const result = await registry.coordinator({
        rule: { provider: 'coordinator' },
        task: mockTask,
      });
      expect(result).toBe('pass');
    });

    it('should return pending when coordinator approver not found', async () => {
      const result = await registry.coordinator({
        rule: { provider: 'coordinator' },
        task: mockTask,
      });
      expect(result).toBe('pending');
    });

    it('should ignore rule.id and always use coordinator', async () => {
      // Add coordinator approver to store
      const approvers = new Set(['coordinator']);
      manual.set(mockTask.id, approvers);

      const result = await registry.coordinator({
        rule: { provider: 'coordinator', id: 'some-other-id' },
        task: mockTask,
      });
      expect(result).toBe('pass');
    });
  });

  describe('GitHub Checks Simulator', () => {
    it('should return unsupported when no store entry', async () => {
      const result = await registry['github.checks']({
        rule: { provider: 'github.checks' },
        task: mockTask,
      });
      expect(result).toBe('unsupported');
    });

    it('should return pass when require is none', async () => {
      const result = await registry['github.checks']({
        rule: { provider: 'github.checks', require: 'none' },
        task: mockTask,
      });
      expect(result).toBe('pass');
    });

    it('should return pass when checks state is success', async () => {
      checks.set(mockTask.id, 'success');

      const result = await registry['github.checks']({
        rule: { provider: 'github.checks' },
        task: mockTask,
      });
      expect(result).toBe('pass');
    });

    it('should return fail when checks state is failure', async () => {
      checks.set(mockTask.id, 'failure');

      const result = await registry['github.checks']({
        rule: { provider: 'github.checks' },
        task: mockTask,
      });
      expect(result).toBe('fail');
    });

    it('should return pending when checks state is pending', async () => {
      checks.set(mockTask.id, 'pending');

      const result = await registry['github.checks']({
        rule: { provider: 'github.checks' },
        task: mockTask,
      });
      expect(result).toBe('pending');
    });

    it('should return pending when checks state is unknown', async () => {
      checks.set(mockTask.id, 'unknown');

      const result = await registry['github.checks']({
        rule: { provider: 'github.checks' },
        task: mockTask,
      });
      expect(result).toBe('pending');
    });

    it('should return unsupported when no store entry (duplicate test)', async () => {
      const result = await registry['github.checks']({
        rule: { provider: 'github.checks' },
        task: mockTask,
      });
      expect(result).toBe('unsupported');
    });
  });

  describe('STRICT Mode Integration Tests', () => {
    it('should return pending for allOf with one satisfied and one pending', async () => {
      // Set up one approval
      const approvers = new Set(['qa']);
      manual.set(mockTask.id, approvers);

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'qa' }, { provider: 'coordinator' }],
      };

      const result = await evaluatePolicy(policy, {
        taskId: mockTask.id,
        registry,
        strict: true,
      });

      expect(result).toBe('pending');
    });

    it('should return error for anyOf with all fail/unsupported in strict mode', async () => {
      const policy: ApprovalPolicy = {
        mode: 'anyOf',
        rules: [
          { provider: 'github.checks' }, // unsupported (no store)
          { provider: 'github.checks', require: 'success' }, // unsupported (no store)
        ],
      };

      const result = await evaluatePolicy(policy, {
        taskId: mockTask.id,
        registry,
        strict: true,
      });

      expect(result).toBe('error');
    });

    it('should return satisfied for allOf with all satisfied', async () => {
      // Set up all approvals
      const approvers = new Set(['qa', 'coordinator']);
      manual.set(mockTask.id, approvers);
      checks.set(mockTask.id, 'success');

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'qa' }, { provider: 'coordinator' }, { provider: 'github.checks' }],
      };

      const result = await evaluatePolicy(policy, {
        taskId: mockTask.id,
        registry,
        strict: true,
      });

      expect(result).toBe('satisfied');
    });

    it('should return satisfied for anyOf with one satisfied', async () => {
      // Set up one approval
      const approvers = new Set(['qa']);
      manual.set(mockTask.id, approvers);

      const policy: ApprovalPolicy = {
        mode: 'anyOf',
        rules: [{ provider: 'qa' }, { provider: 'coordinator' }],
      };

      const result = await evaluatePolicy(policy, {
        taskId: mockTask.id,
        registry,
        strict: true,
      });

      expect(result).toBe('satisfied');
    });

    it('should return error for allOf with any fail in strict mode', async () => {
      // Set up one approval but fail checks
      const approvers = new Set(['qa']);
      manual.set(mockTask.id, approvers);
      checks.set(mockTask.id, 'failure');

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'qa' }, { provider: 'github.checks' }],
      };

      const result = await evaluatePolicy(policy, {
        taskId: mockTask.id,
        registry,
        strict: true,
      });

      expect(result).toBe('error');
    });
  });
});
