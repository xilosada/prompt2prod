import * as os from 'node:os';
import * as path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { applyPatch, type Patch } from '../patch/apply.js';
import {
  initWorkspace,
  ensureBranch,
  stageAll,
  commit,
  push,
  type GitAuthor,
} from '../git/local.js';
import { getOctokit, createPullRequest } from '../git/gh.js';

export type OrchestrateInput = {
  runId: string;
  repo: string; // "owner/name" for GitHub
  base: string; // base branch (e.g., "main")
  head?: string; // new branch; default "feat/run-<id>"
  title: string;
  body?: string;
  draft?: boolean;
  remoteUrl: string; // git remote (file:// or https://)
  patch: Patch; // {files} or {ops}
  author?: GitAuthor;
};

export type OrchestrateResult = {
  workdir: string;
  head: string;
  sha: string;
  pr: { number: number; url: string };
};

export async function orchestrateRunToPr(input: OrchestrateInput): Promise<OrchestrateResult> {
  const workdir = await mkdtemp(path.join(os.tmpdir(), 'p2p-work-'));
  try {
    await initWorkspace(workdir, input.remoteUrl);
    const head = input.head ?? `feat/run-${input.runId}`;
    await ensureBranch(workdir, head);

    await applyPatch(input.patch, {
      rootDir: workdir,
      atomic: true,
      overwrite: true,
      normalizeEol: 'lf',
    });
    await stageAll(workdir);
    const sha = await commit(workdir, `feat(run:${input.runId}): apply patch`, input.author);
    await push(workdir, head);

    const [owner, name] = input.repo.split('/');
    const octokit = getOctokit(); // throws if missing PAT
    const pr = await createPullRequest(octokit, {
      owner,
      repo: name,
      head,
      base: input.base,
      title: input.title,
      body: input.body,
      draft: input.draft ?? false,
    });

    return { workdir, head, sha, pr };
  } catch (error) {
    // Clean up workspace on error to aid debugging
    try {
      await rm(workdir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
