import { describe, it, expect } from 'vitest';
import { validateApprovalPolicy } from '../src/approvals/policy.js';

describe('provider name validation', () => {
  it('should reject provider names with spaces', () => {
    const result = validateApprovalPolicy({
      mode: 'allOf',
      rules: [{ provider: 'manual approval' }],
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(
      'rule 0: provider must be a non-empty string ≤64 chars matching [A-Za-z0-9._-]+',
    );
  });

  it('should accept valid provider names without spaces', () => {
    const validProviders = ['manual-approval', 'github.checks', 'QA_01'];

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
});
