/**
 * Utility functions for input validation and sanitization
 */

/**
 * Trims a string value, returning empty string if not a string
 */
export function trimmed(str: unknown): string {
  return typeof str === 'string' ? str.trim() : '';
}

/**
 * Trims an array of strings, removes empty entries, and returns unique values
 */
export function trimArrayUnique(arr: unknown[]): string[] {
  if (!Array.isArray(arr)) return [];

  const trimmed = arr
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(trimmed)];
}

/**
 * Validates target repository format against allow-list patterns
 */
export function isValidTargetRepo(s: string): boolean {
  const patterns = [
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, // GitHub slug: owner/repo
    /^file:\/\/\/.*$/, // File URL: file:///path
  ];

  return patterns.some((pattern) => pattern.test(s));
}

/**
 * Checks if a policy object is within size and key count limits
 */
export function isPolicyWithinCaps(obj: unknown): { ok: boolean; reason?: string } {
  if (obj === null || typeof obj !== 'object') {
    return { ok: false, reason: 'Policy must be an object' };
  }

  const policy = obj as Record<string, unknown>;

  // Check key count limit (≤50)
  const keyCount = Object.keys(policy).length;
  if (keyCount > 50) {
    return { ok: false, reason: `Policy has ${keyCount} keys, maximum is 50` };
  }

  // Check serialized size limit (≤32KB)
  try {
    const serialized = JSON.stringify(policy);
    if (serialized.length > 32 * 1024) {
      return {
        ok: false,
        reason: `Policy serialized size is ${serialized.length} bytes, maximum is ${32 * 1024}`,
      };
    }
  } catch {
    return { ok: false, reason: 'Policy contains non-serializable values' };
  }

  return { ok: true };
}
