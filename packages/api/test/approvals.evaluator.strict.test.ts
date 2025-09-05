import { describe, it, expect } from 'vitest';
import { evaluatePolicy, createProviderRegistry } from '../src/approvals/evaluator.js';
import type { ApprovalPolicy, ProviderVerdict, Provider } from '@prompt2prod/shared';

describe('approval policy evaluator - STRICT edge cases', () => {
  const createMockProvider = (verdict: ProviderVerdict): Provider => {
    return async () => verdict;
  };

  const createPolicy = (
    mode: 'allOf' | 'anyOf',
    rules: Array<{ provider: string }>,
  ): ApprovalPolicy => ({
    mode,
    rules,
  });

  describe('anyOf STRICT edge cases', () => {
    it('should handle table-driven anyOf STRICT edge cases', async () => {
      const testCases = [
        {
          name: 'anyOf STRICT: all rules are fail → error',
          verdicts: ['fail', 'fail'] as ProviderVerdict[],
          expected: 'error',
        },
        {
          name: 'anyOf STRICT: all rules are unsupported → error',
          verdicts: ['unsupported', 'unsupported'] as ProviderVerdict[],
          expected: 'error',
        },
        {
          name: 'anyOf STRICT: all rules are fail + unsupported → error',
          verdicts: ['fail', 'unsupported'] as ProviderVerdict[],
          expected: 'error',
        },
        {
          name: 'anyOf STRICT: all rules are unsupported + fail → error',
          verdicts: ['unsupported', 'fail'] as ProviderVerdict[],
          expected: 'error',
        },
        {
          name: 'anyOf STRICT: mixed fail + unsupported + fail → error',
          verdicts: ['fail', 'unsupported', 'fail'] as ProviderVerdict[],
          expected: 'error',
        },
        {
          name: 'anyOf STRICT: single fail → error',
          verdicts: ['fail'] as ProviderVerdict[],
          expected: 'error',
        },
        {
          name: 'anyOf STRICT: single unsupported → error',
          verdicts: ['unsupported'] as ProviderVerdict[],
          expected: 'error',
        },
      ];

      for (const testCase of testCases) {
        // Create registry with providers that return the specified verdicts
        const registry = createProviderRegistry(
          testCase.verdicts.reduce(
            (acc, verdict, index) => {
              acc[`provider-${index}`] = createMockProvider(verdict);
              return acc;
            },
            {} as Record<string, Provider>,
          ),
        );

        const policy = createPolicy(
          'anyOf',
          testCase.verdicts.map((_, index) => ({
            provider: `provider-${index}`,
          })),
        );

        const result = await evaluatePolicy(policy, {
          taskId: 'test-task',
          registry,
          strict: true,
        });

        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe('allOf STRICT edge cases', () => {
    it('should handle table-driven allOf STRICT edge cases', async () => {
      const testCases = [
        {
          name: 'allOf STRICT: pending + unsupported → error',
          verdicts: ['pending', 'unsupported'] as ProviderVerdict[],
          expected: 'error',
          // STRICT doesn't allow unsupported to satisfy required rules
        },
        {
          name: 'allOf STRICT: satisfied + pending + unsupported → error',
          verdicts: ['satisfied', 'pending', 'unsupported'] as ProviderVerdict[],
          expected: 'error',
          // STRICT requires all rules to be supported; unsupported causes error
        },
        {
          name: 'allOf STRICT: satisfied + unsupported → error',
          verdicts: ['satisfied', 'unsupported'] as ProviderVerdict[],
          expected: 'error',
        },
        {
          name: 'allOf STRICT: unsupported + pending → error',
          verdicts: ['unsupported', 'pending'] as ProviderVerdict[],
          expected: 'error',
        },
        {
          name: 'allOf STRICT: multiple unsupported → error',
          verdicts: ['unsupported', 'unsupported', 'unsupported'] as ProviderVerdict[],
          expected: 'error',
        },
        {
          name: 'allOf STRICT: single unsupported → error',
          verdicts: ['unsupported'] as ProviderVerdict[],
          expected: 'error',
        },
      ];

      for (const testCase of testCases) {
        // Create registry with providers that return the specified verdicts
        const registry = createProviderRegistry(
          testCase.verdicts.reduce(
            (acc, verdict, index) => {
              acc[`provider-${index}`] = createMockProvider(verdict);
              return acc;
            },
            {} as Record<string, Provider>,
          ),
        );

        const policy = createPolicy(
          'allOf',
          testCase.verdicts.map((_, index) => ({
            provider: `provider-${index}`,
          })),
        );

        const result = await evaluatePolicy(policy, {
          taskId: 'test-task',
          registry,
          strict: true,
        });

        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe('mixed STRICT edge cases', () => {
    it('should handle table-driven mixed STRICT edge cases', async () => {
      const testCases = [
        {
          name: 'anyOf STRICT: unsupported + pending + satisfied → satisfied',
          mode: 'anyOf' as const,
          verdicts: ['unsupported', 'pending', 'satisfied'] as ProviderVerdict[],
          expected: 'satisfied',
          // STRICT anyOf: any satisfied rule satisfies the policy
        },
        {
          name: 'allOf STRICT: unsupported + pending + satisfied → error',
          mode: 'allOf' as const,
          verdicts: ['unsupported', 'pending', 'satisfied'] as ProviderVerdict[],
          expected: 'error',
          // STRICT allOf: any unsupported rule causes error regardless of other verdicts
        },
        {
          name: 'anyOf STRICT: fail + unsupported + pending → pending',
          mode: 'anyOf' as const,
          verdicts: ['fail', 'unsupported', 'pending'] as ProviderVerdict[],
          expected: 'pending',
          // STRICT anyOf: at least one pending rule results in pending
        },
        {
          name: 'allOf STRICT: fail + unsupported + pending → error',
          mode: 'allOf' as const,
          verdicts: ['fail', 'unsupported', 'pending'] as ProviderVerdict[],
          expected: 'error',
          // STRICT allOf: any fail or unsupported rule causes error
        },
      ];

      for (const testCase of testCases) {
        // Create registry with providers that return the specified verdicts
        const registry = createProviderRegistry(
          testCase.verdicts.reduce(
            (acc, verdict, index) => {
              acc[`provider-${index}`] = createMockProvider(verdict);
              return acc;
            },
            {} as Record<string, Provider>,
          ),
        );

        const policy = createPolicy(
          testCase.mode,
          testCase.verdicts.map((_, index) => ({
            provider: `provider-${index}`,
          })),
        );

        const result = await evaluatePolicy(policy, {
          taskId: 'test-task',
          registry,
          strict: true,
        });

        expect(result).toBe(testCase.expected);
      }
    });
  });
});
