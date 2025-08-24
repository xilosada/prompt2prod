export function sanitizeBranch(name: string): string {
  // keep a-z0-9-_/ only; collapse repeats; trim to ~60 chars
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-') // replace non-alphanumeric with dash
    .replace(/-+/g, '-') // collapse multiple dashes to single dash
    .replace(/\/+/g, '/') // collapse multiple slashes to single slash
    .replace(/^[-/]+|[-/]+$/g, ''); // trim leading/trailing dashes and slashes
  return s.slice(0, 60) || 'head';
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
      if (suffix > 1000) {
        throw new Error('branch_collision_limit_exceeded');
      }
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  })();
}
