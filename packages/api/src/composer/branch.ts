// Branch naming constants
export const MAX_BRANCH_LEN = 60;
export const MAX_SUFFIX = 1000;
export const DEFAULT_BRANCH_NAME = 'head';

export function sanitizeBranch(name: string): string {
  // keep a-z0-9-_/ only; collapse repeats; trim to MAX_BRANCH_LEN chars
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-') // replace non-alphanumeric with dash
    .replace(/-+/g, '-') // collapse multiple dashes to single dash
    .replace(/\/+/g, '/') // collapse multiple slashes to single slash
    .replace(/^[-/]+|[-/]+$/g, ''); // trim leading/trailing dashes and slashes
  return s.slice(0, MAX_BRANCH_LEN) || DEFAULT_BRANCH_NAME;
}

export function nextBranch(
  base: string,
  exists: (name: string) => Promise<boolean>,
): Promise<string> {
  // try base, base-2, base-3...
  // impl in testable loop; ensure no infinite loop
  return (async () => {
    let candidate = base;
    let suffix = 1;

    while (await exists(candidate)) {
      suffix++;
      if (suffix > MAX_SUFFIX) {
        throw new Error('branch_collision_limit_exceeded');
      }
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  })();
}
