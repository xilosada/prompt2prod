import type { FastifyInstance } from 'fastify';
import type { Bus } from '../bus/Bus.js';
import { topics } from '../bus/topics.js';
import { loadComposePolicy, type ComposePolicy } from './policy.js';
import { sanitizeBranch, nextBranch } from './branch.js';
import * as git from '../git/local.js';
import { applyPatch } from '../patch/apply.js';
import { getOctokit, createPullRequest } from '../git/gh.js';
import type { RunsRepo } from '../runs/repo.memory.js';

type ComposeState = {
  patchByRun: Map<string, import('../patch/apply.js').Patch>; // store latest patch per run
  composed: Set<string>; // runIds already composed (idempotency)
};

export async function startComposer(app: FastifyInstance, bus: Bus, runsRepo: RunsRepo) {
  const st: ComposeState = { patchByRun: new Map(), composed: new Set() };

  // Hook into run lifecycle similar to existing watchers: when a run is created, attach per-run subscriptions
  const initialPolicy = loadComposePolicy();
  app.log.info(
    '[composer] starting; on=%s base=%s dry=%s remote=%s',
    [...initialPolicy.onStatuses].join(','),
    initialPolicy.base,
    initialPolicy.dryRun ? 'true' : 'false',
    redact(initialPolicy.remoteUrl),
  );

  // Track subscriptions per run (memory bus doesn't support wildcards)
  const runSubscriptions = new Map<string, { status: () => void; patch: () => void }>();

  // Function to attach subscriptions for a specific run
  const attachRun = async (runId: string) => {
    if (runSubscriptions.has(runId)) return; // Already subscribed

    const statusUnsub = await bus.subscribe<{ state: string }>(
      topics.runStatus(runId),
      async (msg) => {
        await stTryCompose(runId, msg.state);
      },
    );

    const patchUnsub = await bus.subscribe<import('../patch/apply.js').Patch>(
      topics.runPatch(runId),
      async (msg) => {
        st.patchByRun.set(runId, msg);
      },
    );

    runSubscriptions.set(runId, { status: statusUnsub, patch: patchUnsub });
  };

  // Export the attach function for use in run creation
  (app as { _attachComposerRun?: (runId: string) => Promise<void> })._attachComposerRun = attachRun;

  async function stTryCompose(runId: string, state: string) {
    const policy = loadComposePolicy(); // Load policy fresh each time

    if (!policy.onStatuses.has(state as 'done' | 'error' | 'canceled' | 'running' | 'queued'))
      return;
    if (st.composed?.has(runId)) return;
    const patch = st.patchByRun.get(runId);
    if (!patch) return; // wait until we have a patch

    st.composed?.add(runId); // guard before starting (idempotent)
    try {
      await composeOne(runId, patch, policy);
      app.log.info('[composer] composed %s', runId);
    } catch (err) {
      st.composed?.delete(runId); // allow retry on failure
      app.log.error({ err }, '[composer] compose failed for %s', runId);
      // optional: write an error field into run repo
      await runsRepo.update(runId, (r) => ({
        ...r,
        composeError: String((err as Error)?.message ?? err),
      }));
    }
  }

  async function composeOne(
    runId: string,
    patch: import('../patch/apply.js').Patch,
    policy: ComposePolicy,
  ) {
    // 1) Prepare workspace
    const tmp = await git.createTempWorkspace();
    await git.initRepo(tmp);
    await git.ensureBranch(tmp, policy.base);
    await git.addRemote(tmp, 'origin', policy.remoteUrl);

    // 2) Branch name (collision-safe)
    const raw = sanitizeBranch(`feat/run-${runId}`);
    const branch = await nextBranch(raw, async (b) =>
      git.remoteBranchExists(policy.remoteUrl, b).catch(() => false),
    );
    await git.checkoutBranch(tmp, branch, policy.base);

    // 3) Apply patch
    const plan = await applyPatch(patch, { rootDir: tmp, atomic: true, overwrite: true });
    if (policy.dryRun) {
      app.log.info('[composer] dry-run plan for %s -> %o', runId, plan);
      return;
    }

    // 4) Commit & push
    await git.commitAll(tmp, `feat(run): compose changes for ${runId}`);
    await git.pushBranch(tmp, 'origin', branch);

    // 5) Optional GitHub PR
    let pr: { number?: number; url?: string } = {};
    if (isGithubHttps(policy.remoteUrl)) {
      const ok = process.env.GITHUB_TOKEN ? getOctokit() : null;
      if (ok) {
        const { owner, repo } = parseOwnerRepoFromRemote(policy.remoteUrl);
        pr = await createPullRequest(ok, {
          owner,
          repo,
          head: branch,
          base: policy.base,
          title: `feat(run): ${runId}`,
        });
      } else {
        app.log.warn('[composer] github_token_missing for %s', runId);
      }
    }

    // 6) Persist result & log
    await runsRepo.update(runId, (r) => ({ ...r, pr: { branch, url: pr.url, number: pr.number } }));
    await bus.publish(
      topics.runLogs(runId),
      `[composer] pushed ${branch}${pr.url ? `, PR: ${pr.url}` : ''}`,
    );
  }

  app.addHook('onClose', async () => {
    // Cleanup all run subscriptions
    for (const { status, patch } of runSubscriptions.values()) {
      try {
        await status();
        await patch();
      } catch {
        // Ignore cleanup errors
      }
    }
    runSubscriptions.clear();
  });
}

function redact(u: string) {
  return u.replace(/:\/\/[^@]+@/, '://***@');
}
function isGithubHttps(u: string) {
  return /^https?:\/\/github\.com\//i.test(u);
}
function parseOwnerRepoFromRemote(u: string) {
  const match = u.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) throw new Error('invalid_github_remote_url');
  return { owner: match[1], repo: match[2] };
}
