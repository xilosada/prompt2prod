/**
 * Shared configuration utilities for the prompt2prod system
 * Provides secure environment variable access with redaction for logging
 */

/**
 * Redacts sensitive values from environment variables for safe logging
 * @param value - The value to potentially redact
 * @returns Redacted value if it looks like a secret, otherwise the original value
 */
export function redactEnvValue(value: string | undefined): string {
  if (!value) return 'undefined';

  // Redact if it looks like a secret (contains common secret patterns)
  // Note: secretPatterns could be used for more sophisticated detection in the future

  // Check if the value itself looks like a secret (long, random-looking strings)
  const looksLikeSecret = value.length > 20 && /^[a-zA-Z0-9+/=_-]+$/.test(value);

  if (looksLikeSecret) {
    return '[REDACTED]';
  }

  return value;
}

/**
 * Redacts environment variable values for safe logging
 * @param env - Environment object (defaults to process.env)
 * @returns Object with redacted values
 */
export function redactEnvForLogging(
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const redacted: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    redacted[key] = redactEnvValue(value);
  }

  return redacted;
}

/**
 * Feature flag for GitHub Checks provider
 * Controls whether the real GitHub Checks provider is enabled
 * Default: 'off' (disabled)
 */
export function isGitHubChecksEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const flag = env.APPROVALS_GITHUB_CHECKS?.toLowerCase();
  return flag === 'on' || flag === 'true' || flag === '1';
}

/**
 * Configuration object for approvals system
 */
export interface ApprovalsConfig {
  githubChecksEnabled: boolean;
}

/**
 * Loads approvals configuration from environment variables
 * @param env - Environment object (defaults to process.env)
 * @returns ApprovalsConfig object
 */
export function loadApprovalsConfig(
  env: Record<string, string | undefined> = process.env,
): ApprovalsConfig {
  return {
    githubChecksEnabled: isGitHubChecksEnabled(env),
  };
}
