import { describe, it, expect } from 'vitest';
import { validateApprovalPolicy } from '../src/approvals/policy.js';

describe('validateApprovalPolicy', () => {
  describe('valid policies', () => {
    it('should accept minimal valid allOf policy', () => {
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: [{ provider: 'test-provider' }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.policy.mode).toBe('allOf');
        expect(result.policy.rules).toHaveLength(1);
        expect(result.policy.rules[0].provider).toBe('test-provider');
      }
    });

    it('should accept minimal valid anyOf policy', () => {
      const result = validateApprovalPolicy({
        mode: 'anyOf',
        rules: [{ provider: 'test-provider' }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.policy.mode).toBe('anyOf');
        expect(result.policy.rules).toHaveLength(1);
        expect(result.policy.rules[0].provider).toBe('test-provider');
      }
    });

    it('should accept policy with multiple rules', () => {
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: [{ provider: 'provider1' }, { provider: 'provider2', extraField: 'value' }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.policy.rules).toHaveLength(2);
        expect(result.policy.rules[0].provider).toBe('provider1');
        expect(result.policy.rules[1].provider).toBe('provider2');
        expect((result.policy.rules[1] as Record<string, unknown>).extraField).toBe('value');
      }
    });

    it('should accept policy with maximum rules (16)', () => {
      const rules = Array.from({ length: 16 }, (_, i) => ({
        provider: `provider${i}`,
      }));

      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.policy.rules).toHaveLength(16);
      }
    });

    it('should accept provider names with valid characters', () => {
      const validProviders = [
        'provider',
        'provider123',
        'provider_name',
        'provider-name',
        'provider.name',
        'PROVIDER',
        'Provider123_Name-With.Dots',
      ];

      for (const provider of validProviders) {
        const result = validateApprovalPolicy({
          mode: 'allOf',
          rules: [{ provider }],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.policy.rules[0].provider).toBe(provider);
        }
      }
    });

    it('should accept provider names with maximum length (64 chars)', () => {
      const longProvider = 'a'.repeat(64);
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: [{ provider: longProvider }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.policy.rules[0].provider).toBe(longProvider);
      }
    });
  });

  describe('invalid policies', () => {
    it('should reject non-object input', () => {
      const result = validateApprovalPolicy(null);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('policy must be an object');

      const result2 = validateApprovalPolicy('not an object');
      expect(result2.ok).toBe(false);
      expect(result2.reason).toBe('policy must be an object');
    });

    it('should reject missing mode field', () => {
      const result = validateApprovalPolicy({
        rules: [{ provider: 'test' }],
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('policy must have a mode field');
    });

    it('should reject invalid mode values', () => {
      const result = validateApprovalPolicy({
        mode: 'invalid',
        rules: [{ provider: 'test' }],
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('mode must be either "allOf" or "anyOf"');
    });

    it('should reject missing rules field', () => {
      const result = validateApprovalPolicy({
        mode: 'allOf',
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('policy must have a rules field');
    });

    it('should reject non-array rules', () => {
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: 'not an array',
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('rules must be an array');
    });

    it('should reject empty rules array', () => {
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: [],
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('rules array cannot be empty');
    });

    it('should reject rules array with more than 16 elements', () => {
      const rules = Array.from({ length: 17 }, (_, i) => ({
        provider: `provider${i}`,
      }));

      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules,
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('rules array cannot have more than 16 elements');
    });

    it('should reject rule without provider field', () => {
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: [{ someField: 'value' }],
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('rule 0: rule must have a provider field');
    });

    it('should reject rule with non-object value', () => {
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: ['not an object'],
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('rule 0: rule must be an object');
    });

    it('should reject provider names that are too long', () => {
      const longProvider = 'a'.repeat(65);
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: [{ provider: longProvider }],
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe(
        'rule 0: provider must be a non-empty string ≤64 chars matching [A-Za-z0-9._-]+',
      );
    });

    it('should reject empty provider names', () => {
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: [{ provider: '' }],
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe(
        'rule 0: provider must be a non-empty string ≤64 chars matching [A-Za-z0-9._-]+',
      );
    });

    it('should reject provider names with invalid characters', () => {
      const invalidProviders = [
        'provider with spaces',
        'provider@domain',
        'provider#hash',
        'provider$dollar',
        'provider%percent',
        'provider^caret',
        'provider&and',
        'provider*star',
        'provider(open',
        'provider)close',
        'provider+plus',
        'provider=equals',
        'provider[open',
        'provider]close',
        'provider{open',
        'provider}close',
        'provider|pipe',
        'provider\\backslash',
        'provider/forward',
        'provider:colon',
        'provider;semicolon',
        'provider"quote',
        "provider'single",
        'provider<less',
        'provider>greater',
        'provider,comma',
        'provider?question',
        'provider~tilde',
        'provider`backtick',
      ];

      for (const provider of invalidProviders) {
        const result = validateApprovalPolicy({
          mode: 'allOf',
          rules: [{ provider }],
        });

        expect(result.ok).toBe(false);
        expect(result.reason).toBe(
          'rule 0: provider must be a non-empty string ≤64 chars matching [A-Za-z0-9._-]+',
        );
      }
    });

    it('should reject non-string provider values', () => {
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: [{ provider: 123 }],
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe(
        'rule 0: provider must be a non-empty string ≤64 chars matching [A-Za-z0-9._-]+',
      );
    });

    it('should report correct rule index for validation errors', () => {
      const result = validateApprovalPolicy({
        mode: 'allOf',
        rules: [
          { provider: 'valid-provider' },
          { provider: '' }, // invalid
          { provider: 'another-valid' },
        ],
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe(
        'rule 1: provider must be a non-empty string ≤64 chars matching [A-Za-z0-9._-]+',
      );
    });
  });
});
