import { describe, it, expect } from 'vitest';
import {
  evaluatePolicy,
  createProviderRegistry,
  type ProviderVerdict,
  type Provider,
  type ProviderRegistry,
  type ProviderFn,
} from '../src/approvals/evaluator.js';
import type { ApprovalPolicy } from '@prompt2prod/shared';

describe('approval policy evaluator', () => {
  describe('createProviderRegistry', () => {
    it('should create empty registry by default', () => {
      const registry = createProviderRegistry();
      expect(registry).toEqual({});
    });

    it('should create registry with initial providers', () => {
      const mockProvider: Provider = async () => 'satisfied';
      const initial: ProviderRegistry = {
        'test-provider': mockProvider,
      };

      const registry = createProviderRegistry(initial);
      expect(registry).toHaveProperty('test-provider');
      expect(registry['test-provider']).toBe(mockProvider);
    });
  });

  describe('evaluatePolicy - allOf mode (STRICT)', () => {
    const createMockProvider = (verdict: ProviderVerdict): Provider => {
      return async () => verdict;
    };

    const createPolicy = (rules: Array<{ provider: string }>): ApprovalPolicy => ({
      mode: 'allOf',
      rules,
    });

    it('should return satisfied when all rules are satisfied', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('satisfied'),
        provider2: createMockProvider('satisfied'),
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('satisfied');
    });

    it('should return pending when some rules are pending', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('satisfied'),
        provider2: createMockProvider('pending'),
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('pending');
    });

    it('should return error when any rule fails', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('satisfied'),
        provider2: createMockProvider('fail'),
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('error');
    });

    it('should return error when any rule is unsupported (strict mode)', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('satisfied'),
        provider2: createMockProvider('unsupported'),
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('error');
    });

    it('should return pending when any rule is unsupported (non-strict mode)', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('satisfied'),
        provider2: createMockProvider('unsupported'),
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: false,
      });

      expect(result).toBe('pending');
    });

    it('should treat missing providers as unsupported', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('satisfied'),
        // provider2 is missing
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('error');
    });

    it('should treat provider errors as fail', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('satisfied'),
        provider2: async () => {
          throw new Error('Provider error');
        },
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('error');
    });
  });

  describe('evaluatePolicy - anyOf mode (STRICT)', () => {
    const createMockProvider = (verdict: ProviderVerdict): Provider => {
      return async () => verdict;
    };

    const createPolicy = (rules: Array<{ provider: string }>): ApprovalPolicy => ({
      mode: 'anyOf',
      rules,
    });

    it('should return satisfied when any rule is satisfied', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('pending'),
        provider2: createMockProvider('satisfied'),
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('satisfied');
    });

    it('should return pending when at least one rule is pending', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('unsupported'),
        provider2: createMockProvider('pending'),
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('pending');
    });

    it('should return error when all rules are fail/unsupported (strict mode)', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('fail'),
        provider2: createMockProvider('unsupported'),
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('error');
    });

    it('should return pending when all rules are fail/unsupported (non-strict mode)', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('fail'),
        provider2: createMockProvider('unsupported'),
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: false,
      });

      expect(result).toBe('pending');
    });

    it('should return satisfied when first rule is satisfied (short-circuit)', async () => {
      const registry = createProviderRegistry({
        provider1: createMockProvider('satisfied'),
        provider2: createMockProvider('fail'),
      });

      const policy = createPolicy([{ provider: 'provider1' }, { provider: 'provider2' }]);

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('satisfied');
    });
  });

  describe('provider integration', () => {
    it('should pass correct parameters to providers', async () => {
      let receivedTask: { id: string } | undefined;
      let receivedRule: Record<string, unknown> | undefined;

      const mockProvider: ProviderFn = async ({ rule, task }) => {
        receivedTask = task;
        receivedRule = rule;
        return 'pass';
      };

      const registry = createProviderRegistry({
        'test-provider': mockProvider,
      });

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'test-provider', customField: 'customValue' }],
      };

      await evaluatePolicy(policy, {
        taskId: 'test-task-123',
        registry,
        strict: true,
      });

      expect(receivedTask.id).toBe('test-task-123');
      expect(receivedRule).toEqual({
        provider: 'test-provider',
        customField: 'customValue',
      });
    });

    it('should handle multiple providers with different verdicts', async () => {
      const registry = createProviderRegistry({
        'satisfied-provider': async () => 'satisfied',
        'pending-provider': async () => 'pending',
        'fail-provider': async () => 'fail',
        'unsupported-provider': async () => 'unsupported',
      });

      const policy: ApprovalPolicy = {
        mode: 'anyOf',
        rules: [
          { provider: 'satisfied-provider' },
          { provider: 'pending-provider' },
          { provider: 'fail-provider' },
          { provider: 'unsupported-provider' },
        ],
      };

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('satisfied');
    });
  });

  describe('edge cases', () => {
    it('should handle single rule policies', async () => {
      const registry = createProviderRegistry({
        'single-provider': async () => 'satisfied',
      });

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'single-provider' }],
      };

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('satisfied');
    });

    it('should handle empty registry', async () => {
      const registry = createProviderRegistry();

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [{ provider: 'missing-provider' }],
      };

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('error');
    });

    it('should handle mixed provider availability', async () => {
      const registry = createProviderRegistry({
        'available-provider': async () => 'satisfied',
        // missing-provider is not in registry
      });

      const policy: ApprovalPolicy = {
        mode: 'anyOf',
        rules: [{ provider: 'available-provider' }, { provider: 'missing-provider' }],
      };

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      expect(result).toBe('satisfied');
    });

    it('should return error for empty registry + anyOf([unsupported])', async () => {
      const registry = createProviderRegistry(); // empty registry

      const policy: ApprovalPolicy = {
        mode: 'anyOf',
        rules: [{ provider: 'missing-provider' }], // provider not in registry
      };

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      // Missing provider is treated as 'unsupported', and in anyOf mode
      // with strict=true, when all rules are unsupported, it returns 'error'
      // because no conditions can be met
      expect(result).toBe('error');
    });
  });
});
