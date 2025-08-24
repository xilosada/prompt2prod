import type { ApprovalPolicy, ApprovalRule } from '@prompt2prod/shared';

/**
 * Provider name validation constants
 * These can be reused in UI/SDK validation
 */
export const PROVIDER_NAME_REGEX = /^[A-Za-z0-9._-]+$/;
export const PROVIDER_NAME_MAX_LENGTH = 64;
export const PROVIDER_NAME_MIN_LENGTH = 1;

/**
 * Validates if a string is a valid provider name
 * Provider names must be non-empty, ≤64 chars, and match [A-Za-z0-9._-]+
 */
function isValidProviderName(name: string): boolean {
  if (
    typeof name !== 'string' ||
    name.length < PROVIDER_NAME_MIN_LENGTH ||
    name.length > PROVIDER_NAME_MAX_LENGTH
  ) {
    return false;
  }
  return PROVIDER_NAME_REGEX.test(name);
}

/**
 * Validates an ApprovalRule object
 */
function validateApprovalRule(
  rule: unknown,
): { ok: true; rule: ApprovalRule } | { ok: false; reason: string } {
  if (typeof rule !== 'object' || rule === null) {
    return { ok: false, reason: 'rule must be an object' };
  }

  const ruleObj = rule as Record<string, unknown>;

  if (!('provider' in ruleObj)) {
    return { ok: false, reason: 'rule must have a provider field' };
  }

  if (!isValidProviderName(ruleObj.provider as string)) {
    return {
      ok: false,
      reason: `provider must be a non-empty string ≤${PROVIDER_NAME_MAX_LENGTH} chars matching [A-Za-z0-9._-]+`,
    };
  }

  return { ok: true, rule: ruleObj as ApprovalRule };
}

/**
 * Validates an ApprovalPolicy object
 */
export function validateApprovalPolicy(
  obj: unknown,
): { ok: true; policy: ApprovalPolicy } | { ok: false; reason: string } {
  if (typeof obj !== 'object' || obj === null) {
    return { ok: false, reason: 'policy must be an object' };
  }

  const policyObj = obj as Record<string, unknown>;

  // Validate mode
  if (!('mode' in policyObj)) {
    return { ok: false, reason: 'policy must have a mode field' };
  }

  if (policyObj.mode !== 'allOf' && policyObj.mode !== 'anyOf') {
    return { ok: false, reason: 'mode must be either "allOf" or "anyOf"' };
  }

  // Validate rules
  if (!('rules' in policyObj)) {
    return { ok: false, reason: 'policy must have a rules field' };
  }

  if (!Array.isArray(policyObj.rules)) {
    return { ok: false, reason: 'rules must be an array' };
  }

  const rules = policyObj.rules;
  if (rules.length === 0) {
    return { ok: false, reason: 'rules array cannot be empty' };
  }

  if (rules.length > 16) {
    return { ok: false, reason: 'rules array cannot have more than 16 elements' };
  }

  // Validate each rule
  const validatedRules: ApprovalRule[] = [];
  for (let i = 0; i < rules.length; i++) {
    const ruleResult = validateApprovalRule(rules[i]);
    if (!ruleResult.ok) {
      return { ok: false, reason: `rule ${i}: ${ruleResult.reason}` };
    }
    validatedRules.push(ruleResult.rule);
  }

  return {
    ok: true,
    policy: {
      mode: policyObj.mode as 'allOf' | 'anyOf',
      rules: validatedRules,
    },
  };
}
