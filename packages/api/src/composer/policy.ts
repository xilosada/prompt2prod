export type ComposePolicy = {
  onStatuses: Set<'done' | 'error' | 'canceled' | 'running' | 'queued'>; // default: done
  remoteUrl: string; // required
  base: string; // default: 'main'
  dryRun: boolean; // default: false
};

export function loadComposePolicy(env = process.env): ComposePolicy {
  const on = (env.COMPOSE_PR_ON_STATUS ?? 'done')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const onSet = new Set(on) as ComposePolicy['onStatuses'];
  const remoteUrl = (env.COMPOSE_PR_REMOTE_URL ?? '').trim();
  if (!remoteUrl) throw new Error('compose_policy_remote_url_missing');
  const base = (env.COMPOSE_PR_BASE ?? 'main').trim();
  const dryRun = env.COMPOSE_PR_DRY_RUN === '1';
  return { onStatuses: onSet, remoteUrl, base, dryRun };
}
