import type { ApprovalPolicy, ApprovalRule, Task } from '@prompt2prod/shared';

export type ApprovalVerdict = 'pass' | 'fail' | 'pending' | 'unsupported';

export type ProviderFn = (args: {
  rule: { provider: string; [k: string]: unknown };
  task: Task;
  env?: NodeJS.ProcessEnv;
  // optional contextual hints; leave undefined if not available
  pr?: { number?: number; url?: string; branch?: string } | undefined;
}) => Promise<ApprovalVerdict> | ApprovalVerdict;

export type ProviderRegistry = Record<string, ProviderFn>;

// Legacy types for backward compatibility
export type ProviderVerdict = 'satisfied' | 'pending' | 'fail' | 'unsupported';
export type Provider = (input: {
  taskId: string;
  policyRule: ApprovalRule;
}) => Promise<ProviderVerdict>;

/**
 * Creates a provider registry with optional initial providers
 */
export function createProviderRegistry(initial?: ProviderRegistry): ProviderRegistry {
  return { ...initial };
}

/**
 * Evaluates an approval policy using the provided registry
 * Implements STRICT aggregation semantics
 */
export async function evaluatePolicy(
  policy: ApprovalPolicy,
  ctx: { taskId: string; registry: ProviderRegistry; strict: boolean },
): Promise<'satisfied' | 'pending' | 'error'> {
  const { taskId, registry, strict } = ctx;
  const verdicts: ProviderVerdict[] = [];

  // Evaluate each rule
  for (const rule of policy.rules) {
    const provider = registry[rule.provider];
    if (!provider) {
      verdicts.push('unsupported');
      continue;
    }

    try {
      // Create a mock task object for the new provider interface
      const mockTask = { id: taskId } as Task;
      const verdict = await provider({ rule, task: mockTask });
      // Convert new verdict format to legacy format for compatibility
      const legacyVerdict = verdict === 'pass' ? 'satisfied' : verdict;
      verdicts.push(legacyVerdict as ProviderVerdict);
    } catch {
      // Treat provider errors as 'fail' for deterministic behavior
      verdicts.push('fail');
    }
  }

  // Apply STRICT aggregation logic
  if (policy.mode === 'allOf') {
    return evaluateAllOf(verdicts, strict);
  } else {
    return evaluateAnyOf(verdicts, strict);
  }
}

/**
 * Evaluates allOf mode with STRICT semantics
 */
function evaluateAllOf(
  verdicts: ProviderVerdict[],
  strict: boolean,
): 'satisfied' | 'pending' | 'error' {
  // If any rule → fail → error
  if (verdicts.includes('fail')) {
    return 'error';
  }

  // If any rule → unsupported AND strict=true → error
  if (strict && verdicts.includes('unsupported')) {
    return 'error';
  }

  // If all rules → satisfied → satisfied
  if (verdicts.every((v) => v === 'satisfied')) {
    return 'satisfied';
  }

  // Else (some pending) → pending
  return 'pending';
}

/**
 * Evaluates anyOf mode with STRICT semantics
 */
function evaluateAnyOf(
  verdicts: ProviderVerdict[],
  strict: boolean,
): 'satisfied' | 'pending' | 'error' {
  // If any rule → satisfied → satisfied
  if (verdicts.includes('satisfied')) {
    return 'satisfied';
  }

  // If all rules ∈ {fail,unsupported} AND strict=true → error
  if (strict && verdicts.every((v) => v === 'fail' || v === 'unsupported')) {
    return 'error';
  }

  // Else (at least one pending) → pending
  return 'pending';
}
