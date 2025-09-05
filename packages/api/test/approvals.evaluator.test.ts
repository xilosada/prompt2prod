import { describe, it, expect } from 'vitest';
import { evaluatePolicy, createProviderRegistry } from '../src/approvals/evaluator.js';
import type {
  ApprovalPolicy,
  ProviderVerdict,
  Provider,
  ProviderRegistry,
} from '@prompt2prod/shared';

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
      let receivedTaskId: string | undefined;
      let receivedRule: Record<string, unknown> | undefined;

      const mockProvider: Provider = async ({ taskId, policyRule }) => {
        receivedTaskId = taskId;
        receivedRule = policyRule;
        return 'satisfied';
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

      expect(receivedTaskId).toBe('test-task-123');
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

    it('should return error when mixing unsupported + pending + satisfied under STRICT allOf', async () => {
      // Test case: STRICT mode with mixed verdicts including unsupported
      // Expected: error (any unsupported in STRICT allOf mode causes error)
      const registry = createProviderRegistry({
        'satisfied-provider': async () => 'satisfied',
        'pending-provider': async () => 'pending',
        'unsupported-provider': async () => 'unsupported',
      });

      const policy: ApprovalPolicy = {
        mode: 'allOf',
        rules: [
          { provider: 'satisfied-provider' },
          { provider: 'pending-provider' },
          { provider: 'unsupported-provider' },
        ],
      };

      const result = await evaluatePolicy(policy, {
        taskId: 'test-task',
        registry,
        strict: true,
      });

      // In STRICT allOf mode, any unsupported verdict causes error regardless of other verdicts
      expect(result).toBe('error');
    });

    it('should handle table-driven STRICT test cases for unsupported + pending combinations', async () => {
      // Table-driven test to lock in aggregate behavior for various combinations
      const testCases = [
        {
          name: 'allOf STRICT: satisfied + pending + unsupported → error',
          mode: 'allOf' as const,
          strict: true,
          verdicts: ['satisfied', 'pending', 'unsupported'],
          expected: 'error',
        },
        {
          name: 'allOf STRICT: pending + unsupported → error',
          mode: 'allOf' as const,
          strict: true,
          verdicts: ['pending', 'unsupported'],
          expected: 'error',
        },
        {
          name: 'allOf STRICT: satisfied + unsupported → error',
          mode: 'allOf' as const,
          strict: true,
          verdicts: ['satisfied', 'unsupported'],
          expected: 'error',
        },
        {
          name: 'allOf non-STRICT: satisfied + pending + unsupported → pending',
          mode: 'allOf' as const,
          strict: false,
          verdicts: ['satisfied', 'pending', 'unsupported'],
          expected: 'pending',
        },
        {
          name: 'anyOf STRICT: satisfied + pending + unsupported → satisfied',
          mode: 'anyOf' as const,
          strict: true,
          verdicts: ['satisfied', 'pending', 'unsupported'],
          expected: 'satisfied',
        },
        {
          name: 'anyOf STRICT: pending + unsupported → pending',
          mode: 'anyOf' as const,
          strict: true,
          verdicts: ['pending', 'unsupported'],
          expected: 'pending',
        },
        {
          name: 'anyOf STRICT: unsupported only → error',
          mode: 'anyOf' as const,
          strict: true,
          verdicts: ['unsupported'],
          expected: 'error',
        },
        {
          name: 'anyOf non-STRICT: unsupported only → pending',
          mode: 'anyOf' as const,
          strict: false,
          verdicts: ['unsupported'],
          expected: 'pending',
        },
      ];

      for (const testCase of testCases) {
        // Create registry with providers that return the specified verdicts
        const registry = createProviderRegistry(
          testCase.verdicts.reduce(
            (acc, verdict, index) => {
              acc[`provider-${index}`] = async () => verdict as ProviderVerdict;
              return acc;
            },
            {} as Record<string, Provider>,
          ),
        );

        const policy: ApprovalPolicy = {
          mode: testCase.mode,
          rules: testCase.verdicts.map((_, index) => ({
            provider: `provider-${index}`,
          })),
        };

        const result = await evaluatePolicy(policy, {
          taskId: 'test-task',
          registry,
          strict: testCase.strict,
        });

        expect(result).toBe(testCase.expected);
      }
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
