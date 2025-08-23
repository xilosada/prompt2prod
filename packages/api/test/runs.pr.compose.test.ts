import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import * as os from 'node:os';
import * as path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { initBareRemote, initWorkspace, stageAll, commit, push } from '../src/git/local.js';
import { registerPrComposeRoutes } from '../src/runs/pr.compose.routes.js';
import { applyPatch } from '../src/patch/apply.js';

vi.mock('../src/git/gh', () => ({
  getOctokit: vi.fn(),
  createPullRequest: vi.fn(),
}));

describe('POST /runs/:id/pr/compose', () => {
  const OLD_ENV = process.env;
  let tmp!: string, bare!: string;

  beforeEach(async () => {
    process.env = { ...OLD_ENV, GITHUB_TOKEN: 't' };
    tmp = mkdtempSync(path.join(os.tmpdir(), 'p2p-compose-'));
    bare = path.join(tmp, 'remote.git');
    vi.clearAllMocks();

    // Set up mocks
    const { getOctokit, createPullRequest } = await import('../src/git/gh.js');
    getOctokit.mockImplementation((token = process.env.GITHUB_TOKEN) => {
      if (!token || token === '') throw new Error('github_token_missing');
      return { rest: { pulls: { create: vi.fn() } } };
    });
    createPullRequest.mockResolvedValue({ number: 321, url: 'https://gh/pr/321' });
  });

  afterEach(() => {
    process.env = OLD_ENV;
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('applies patch, pushes branch, and creates PR (mocked)', async () => {
    const remoteUrl = await initBareRemote(bare);

    // Initialize workspace and create initial commit
    const work = path.join(tmp, 'work');
    await initWorkspace(work, remoteUrl);
    await applyPatch(
      { files: [{ path: 'README.md', content: '# Initial\n' }] },
      { rootDir: work, normalizeEol: 'lf' },
    );
    await stageAll(work);
    await commit(work, 'Initial commit');
    await push(work, 'main');

    const app = Fastify();
    registerPrComposeRoutes(app);

    const res = await app.inject({
      method: 'POST',
      url: '/runs/abc/pr/compose',
      payload: {
        repo: 'org/repo',
        base: 'main',
        head: 'feat/run-abc',
        title: 'Automated PR',
        remoteUrl,
        patch: { files: [{ path: 'README.generated.md', content: '# Hello\n' }] },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { pr: { number: number; url: string }; head: string; sha: string };
    expect(body.pr).toEqual({ number: 321, url: 'https://gh/pr/321' });
    expect(body.head).toBe('feat/run-abc');
    expect(typeof body.sha).toBe('string');

    const ref = execFileSync(
      'git',
      ['for-each-ref', '--format=%(objectname)', 'refs/heads/feat/run-abc'],
      { cwd: bare },
    )
      .toString()
      .trim();
    expect(ref).toBe(body.sha);

    const list = execFileSync('git', ['ls-tree', '--name-only', 'refs/heads/feat/run-abc'], {
      cwd: bare,
    }).toString();
    expect(list).toContain('README.generated.md');
  });

  it('returns 500 github_token_missing when PAT is absent', async () => {
    process.env.GITHUB_TOKEN = '';
    const remoteUrl = await initBareRemote(bare);

    // Initialize workspace and create initial commit
    const work = path.join(tmp, 'work');
    await initWorkspace(work, remoteUrl);
    await applyPatch(
      { files: [{ path: 'README.md', content: '# Initial\n' }] },
      { rootDir: work, normalizeEol: 'lf' },
    );
    await stageAll(work);
    await commit(work, 'Initial commit');
    await push(work, 'main');

    const app = Fastify();
    registerPrComposeRoutes(app);

    const res = await app.inject({
      method: 'POST',
      url: '/runs/abc/pr/compose',
      payload: {
        repo: 'org/repo',
        base: 'main',
        title: 't',
        remoteUrl,
        patch: { files: [{ path: 'x.txt', content: 'y' }] },
      },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'github_token_missing' });
  });

  it('uses default branch name when head is not provided', async () => {
    const remoteUrl = await initBareRemote(bare);

    // Initialize workspace and create initial commit
    const work = path.join(tmp, 'work');
    await initWorkspace(work, remoteUrl);
    await applyPatch(
      { files: [{ path: 'README.md', content: '# Initial\n' }] },
      { rootDir: work, normalizeEol: 'lf' },
    );
    await stageAll(work);
    await commit(work, 'Initial commit');
    await push(work, 'main');

    const app = Fastify();
    registerPrComposeRoutes(app);

    const res = await app.inject({
      method: 'POST',
      url: '/runs/xyz/pr/compose',
      payload: {
        repo: 'org/repo',
        base: 'main',
        title: 'Automated PR',
        remoteUrl,
        patch: { files: [{ path: 'test.txt', content: 'test content' }] },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { head: string };
    expect(body.head).toBe('feat/run-xyz');
  });

  it('handles ops-based patches', async () => {
    const remoteUrl = await initBareRemote(bare);

    // Initialize workspace and create initial commit
    const work = path.join(tmp, 'work');
    await initWorkspace(work, remoteUrl);
    await applyPatch(
      { files: [{ path: 'README.md', content: '# Initial\n' }] },
      { rootDir: work, normalizeEol: 'lf' },
    );
    await stageAll(work);
    await commit(work, 'Initial commit');
    await push(work, 'main');

    const app = Fastify();
    registerPrComposeRoutes(app);

    const res = await app.inject({
      method: 'POST',
      url: '/runs/ops/pr/compose',
      payload: {
        repo: 'org/repo',
        base: 'main',
        title: 'Ops-based PR',
        remoteUrl,
        patch: {
          ops: [
            { kind: 'write', path: 'ops-file.txt', content: 'ops content' },
            { kind: 'delete', path: 'delete-me.txt' },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { pr: { number: number; url: string } };
    expect(body.pr).toEqual({ number: 321, url: 'https://gh/pr/321' });
  });

  it('returns 502 when Octokit PR creation fails', async () => {
    const remoteUrl = await initBareRemote(bare);

    // Initialize workspace and create initial commit
    const work = path.join(tmp, 'work');
    await initWorkspace(work, remoteUrl);
    await applyPatch(
      { files: [{ path: 'README.md', content: '# Initial\n' }] },
      { rootDir: work, normalizeEol: 'lf' },
    );
    await stageAll(work);
    await commit(work, 'Initial commit');
    await push(work, 'main');

    // Set up mocks to simulate Octokit failure
    const { getOctokit, createPullRequest } = await import('../src/git/gh.js');
    getOctokit.mockImplementation((token = process.env.GITHUB_TOKEN) => {
      if (!token || token === '') throw new Error('github_token_missing');
      return { rest: { pulls: { create: vi.fn() } } };
    });
    createPullRequest.mockRejectedValue(new Error('GitHub API error'));

    const app = Fastify();
    registerPrComposeRoutes(app);

    const res = await app.inject({
      method: 'POST',
      url: '/runs/error/pr/compose',
      payload: {
        repo: 'org/repo',
        base: 'main',
        title: 'Error PR',
        remoteUrl,
        patch: { files: [{ path: 'test.txt', content: 'test' }] },
      },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: 'orchestrate_error' });
  });

  it('trims and validates user inputs', async () => {
    const remoteUrl = await initBareRemote(bare);

    // Initialize workspace and create initial commit
    const work = path.join(tmp, 'work');
    await initWorkspace(work, remoteUrl);
    await applyPatch(
      { files: [{ path: 'README.md', content: '# Initial\n' }] },
      { rootDir: work, normalizeEol: 'lf' },
    );
    await stageAll(work);
    await commit(work, 'Initial commit');
    await push(work, 'main');

    const app = Fastify();
    registerPrComposeRoutes(app);

    const res = await app.inject({
      method: 'POST',
      url: '/runs/trim/pr/compose',
      payload: {
        repo: '  org/repo  ',
        base: '  main  ',
        head: '  feat/trimmed  ',
        title: '  Trimmed Title  ',
        remoteUrl,
        patch: { files: [{ path: 'test.txt', content: 'test' }] },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { head: string };
    expect(body.head).toBe('feat/trimmed'); // Should use trimmed head
  });

  it('falls back to default branch name when head has spaces', async () => {
    const remoteUrl = await initBareRemote(bare);

    // Initialize workspace and create initial commit
    const work = path.join(tmp, 'work');
    await initWorkspace(work, remoteUrl);
    await applyPatch(
      { files: [{ path: 'README.md', content: '# Initial\n' }] },
      { rootDir: work, normalizeEol: 'lf' },
    );
    await stageAll(work);
    await commit(work, 'Initial commit');
    await push(work, 'main');

    const app = Fastify();
    registerPrComposeRoutes(app);

    const res = await app.inject({
      method: 'POST',
      url: '/runs/invalid/pr/compose',
      payload: {
        repo: 'org/repo',
        base: 'main',
        head: 'invalid branch name',
        title: 'Invalid Branch Test',
        remoteUrl,
        patch: { files: [{ path: 'test.txt', content: 'test' }] },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { head: string };
    expect(body.head).toBe('feat/run-invalid'); // Should use default
  });
});
